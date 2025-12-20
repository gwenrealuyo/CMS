"""
Signal handlers for automatic person status updates based on attendance.
"""
from django.db.models.signals import post_save, m2m_changed
from django.dispatch import receiver
from apps.attendance.models import AttendanceRecord
from apps.clusters.models import ClusterWeeklyReport
from apps.people.utils import update_person_status
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

