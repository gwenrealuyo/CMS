from django.db.models.signals import m2m_changed
from django.dispatch import receiver
from django.db import transaction
import logging

from apps.people.models import Journey
from .models import ClusterWeeklyReport

logger = logging.getLogger(__name__)


def _get_cluster_display_name(cluster):
    """Get cluster code, name, or fallback identifier"""
    if cluster.code:
        return cluster.code
    if cluster.name:
        return cluster.name
    return f"Cluster {cluster.id}"


@receiver(m2m_changed, sender=ClusterWeeklyReport.members_attended.through)
@receiver(m2m_changed, sender=ClusterWeeklyReport.visitors_attended.through)
def create_cluster_attendance_journey(sender, instance, action, pk_set, **kwargs):
    """
    Automatically create Journey entries when people are added to cluster attendance.
    Delete corresponding journeys when attendance is removed.
    """
    if action == 'post_add':
        from apps.people.models import Person
        
        try:
            attendees = Person.objects.filter(pk__in=pk_set)
            cluster_display = _get_cluster_display_name(instance.cluster)
            journeys_to_create = []
            
            for person in attendees:
                title = f"Attended Cluster Meeting - {cluster_display}"
                
                # Check for duplicate journey (exact title match)
                existing = Journey.objects.filter(
                    user=person,
                    date=instance.meeting_date,
                    type='CLUSTER',
                    title=title
                ).exists()
                
                if not existing:
                    description = f"Attended cluster meeting ({instance.gathering_type})"
                    
                    journeys_to_create.append(Journey(
                        user=person,
                        title=title,
                        date=instance.meeting_date,
                        type='CLUSTER',
                        description=description,
                        verified_by=instance.submitted_by
                    ))
            
            if journeys_to_create:
                with transaction.atomic():
                    Journey.objects.bulk_create(journeys_to_create)
                logger.info(f"Created {len(journeys_to_create)} attendance journeys for report {instance.id}")
        
        except Exception as e:
            logger.error(f"Error creating attendance journeys for report {instance.id}: {str(e)}", exc_info=True)
            # Don't raise - allow report creation to succeed even if journey creation fails
    
    elif action == 'post_remove':
        from apps.people.models import Person
        
        try:
            attendees = Person.objects.filter(pk__in=pk_set)
            cluster_display = _get_cluster_display_name(instance.cluster)
            
            # Delete corresponding journeys (exact title match)
            title = f"Attended Cluster Meeting - {cluster_display}"
            deleted_count = Journey.objects.filter(
                user__in=attendees,
                date=instance.meeting_date,
                type='CLUSTER',
                title=title
            ).delete()[0]
            
            if deleted_count > 0:
                logger.info(f"Deleted {deleted_count} attendance journeys for report {instance.id}")
        
        except Exception as e:
            logger.error(f"Error deleting attendance journeys for report {instance.id}: {str(e)}", exc_info=True)

