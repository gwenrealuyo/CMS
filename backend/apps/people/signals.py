"""
Signal handlers for automatic person status updates based on attendance.
"""
from django.db.models.signals import post_save, pre_save, m2m_changed
from django.dispatch import receiver
from apps.attendance.models import AttendanceRecord
from apps.clusters.models import ClusterWeeklyReport
from apps.people.utils import update_person_status
from apps.people.models import Person, Journey
import logging

logger = logging.getLogger(__name__)


@receiver(post_save, sender=AttendanceRecord)
def update_status_on_attendance_record(sender, instance, created, **kwargs):
    """
    Update person status when attendance record is created/updated.
    Only triggers for Sunday Service and Doctrinal Class events.
    """
    if instance.event.type in ["SUNDAY_SERVICE", "DOCTRINAL_CLASS"]:
        try:
            update_person_status(instance.person)
            logger.debug(f"Updated status for person {instance.person.id} after attendance record change")
        except Exception as e:
            logger.error(f"Error updating person status for {instance.person.id}: {str(e)}", exc_info=True)


@receiver(m2m_changed, sender=ClusterWeeklyReport.members_attended.through)
def update_status_on_cluster_attendance(sender, instance, action, pk_set, **kwargs):
    """
    Update person status when cluster attendance changes.
    Triggers when members are added or removed from cluster attendance.
    """
    if action in ['post_add', 'post_remove']:
        from apps.people.models import Person
        try:
            persons = Person.objects.filter(pk__in=pk_set)
            for person in persons:
                update_person_status(person)
                logger.debug(f"Updated status for person {person.id} after cluster attendance change")
        except Exception as e:
            logger.error(f"Error updating person statuses after cluster attendance change: {str(e)}", exc_info=True)


@receiver(pre_save, sender=Person)
def store_person_original_values(sender, instance, **kwargs):
    """
    Store original values of date fields before save to detect changes.
    """
    if instance.pk:
        try:
            original = Person.objects.get(pk=instance.pk)
            instance._original_water_baptism_date = original.water_baptism_date
            instance._original_spirit_baptism_date = original.spirit_baptism_date
            instance._original_date_first_attended = original.date_first_attended
            instance._original_first_activity_attended = original.first_activity_attended
        except Person.DoesNotExist:
            # New instance, no original values
            instance._original_water_baptism_date = None
            instance._original_spirit_baptism_date = None
            instance._original_date_first_attended = None
            instance._original_first_activity_attended = None
    else:
        # New instance, no original values
        instance._original_water_baptism_date = None
        instance._original_spirit_baptism_date = None
        instance._original_date_first_attended = None
        instance._original_first_activity_attended = None


@receiver(post_save, sender=Person)
def manage_baptism_journeys(sender, instance, created, **kwargs):
    """
    Automatically create, update, or delete Journey entries when baptism dates or 
    first attendance date are set, changed, or cleared.
    """
    try:
        # Get original values (stored in pre_save)
        original_water_baptism = getattr(instance, '_original_water_baptism_date', None)
        original_spirit_baptism = getattr(instance, '_original_spirit_baptism_date', None)
        original_first_attended = getattr(instance, '_original_date_first_attended', None)
        original_first_activity = getattr(instance, '_original_first_activity_attended', None)
        
        # Handle water_baptism_date
        _handle_baptism_date_journey(
            instance,
            instance.water_baptism_date,
            original_water_baptism,
            "BAPTISM",
            "Baptized in Jesus' name",
            "Water baptism"
        )
        
        # Handle spirit_baptism_date
        _handle_baptism_date_journey(
            instance,
            instance.spirit_baptism_date,
            original_spirit_baptism,
            "SPIRIT",
            "Received the Holy Ghost",
            "Spirit baptism"
        )
        
        # Handle date_first_attended
        _handle_first_attended_journey(
            instance,
            instance.date_first_attended,
            original_first_attended,
            instance.first_activity_attended,
            original_first_activity
        )
        
    except Exception as e:
        logger.error(f"Error managing baptism journeys for person {instance.id}: {str(e)}", exc_info=True)


def _handle_baptism_date_journey(person, current_date, original_date, journey_type, title, description_base):
    """
    Helper function to create, update, or delete a baptism journey.
    
    Args:
        person: Person instance
        current_date: Current value of the baptism date field
        original_date: Original value of the baptism date field (before save)
        journey_type: Journey type ("BAPTISM" or "SPIRIT")
        title: Journey title
        description_base: Base description text
    """
    # Check if date was cleared (changed from date to None)
    if original_date is not None and current_date is None:
        # Delete the journey if it exists
        Journey.objects.filter(
            user=person,
            type=journey_type
        ).delete()
        logger.debug(f"Deleted {journey_type} journey for person {person.id}")
        return
    
    # Check if date was set or changed (None to date, or date to different date)
    if current_date is not None:
        # Check if journey already exists
        journey = Journey.objects.filter(
            user=person,
            type=journey_type
        ).first()
        
        if journey:
            # Update existing journey
            journey.date = current_date
            journey.title = title
            journey.description = description_base
            journey.save()
            logger.debug(f"Updated {journey_type} journey for person {person.id}")
        else:
            # Create new journey
            Journey.objects.create(
                user=person,
                type=journey_type,
                date=current_date,
                title=title,
                description=description_base,
                verified_by=None
            )
            logger.debug(f"Created {journey_type} journey for person {person.id}")


def _handle_first_attended_journey(person, current_date, original_date, current_activity, original_activity):
    """
    Helper function to create, update, or delete a first attended journey.
    
    Args:
        person: Person instance
        current_date: Current value of date_first_attended
        original_date: Original value of date_first_attended (before save)
        current_activity: Current value of first_activity_attended
        original_activity: Original value of first_activity_attended (before save)
    """
    # Check if date was cleared (changed from date to None)
    if original_date is not None and current_date is None:
        # Delete the journey if it exists
        Journey.objects.filter(
            user=person,
            type="NOTE",
            title="First Attended"
        ).delete()
        logger.debug(f"Deleted First Attended journey for person {person.id}")
        return
    
    # Build description with activity if available
    description = "First attendance"
    if current_activity:
        activity_display = person.get_first_activity_attended_display()
        description = f"First attendance: {activity_display}"
    
    # Check if date was set or changed, or if activity changed
    date_changed = original_date != current_date
    activity_changed = original_activity != current_activity
    
    if current_date is not None and (date_changed or activity_changed):
        # Check if journey already exists
        journey = Journey.objects.filter(
            user=person,
            type="NOTE",
            title="First Attended"
        ).first()
        
        if journey:
            # Update existing journey
            journey.date = current_date
            journey.description = description
            journey.save()
            logger.debug(f"Updated First Attended journey for person {person.id}")
        else:
            # Create new journey
            Journey.objects.create(
                user=person,
                type="NOTE",
                date=current_date,
                title="First Attended",
                description=description,
                verified_by=None
            )
            logger.debug(f"Created First Attended journey for person {person.id}")



