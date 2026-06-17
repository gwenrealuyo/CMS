from django.db.models.signals import post_save
from django.dispatch import receiver

from apps.evangelism.services import advance_prospect_to_taken_ncc

from .models import LessonSessionReport


@receiver(post_save, sender=LessonSessionReport)
def advance_prospect_on_lesson_session(
    sender, instance: LessonSessionReport, created: bool, **kwargs
):
    if created and instance.student_id:
        advance_prospect_to_taken_ncc(
            instance.student,
            activity_date=instance.session_date,
        )
