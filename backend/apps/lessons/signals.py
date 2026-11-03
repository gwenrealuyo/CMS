from django.db.models.signals import post_save
from django.dispatch import receiver

from apps.evangelism.services import advance_prospect_to_taken_ncc

from .models import LessonSessionReport
from .services import sync_person_lessons_started_from_report


@receiver(post_save, sender=LessonSessionReport)
def advance_prospect_on_lesson_session(
    sender, instance: LessonSessionReport, created: bool, **kwargs
):
    if created and instance.student_id:
        # Set lessons_started_at first — Taken NCC requires start date or teacher.
        sync_person_lessons_started_from_report(instance)
        advance_prospect_to_taken_ncc(
            instance.student,
            activity_date=instance.session_date,
        )
