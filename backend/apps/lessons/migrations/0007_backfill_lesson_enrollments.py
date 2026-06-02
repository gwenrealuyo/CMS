from django.db import migrations


def backfill_lesson_enrollments(apps, schema_editor):
    PersonLessonProgress = apps.get_model("lessons", "PersonLessonProgress")
    LessonSessionReport = apps.get_model("lessons", "LessonSessionReport")
    LessonStudentEnrollment = apps.get_model("lessons", "LessonStudentEnrollment")
    LessonTeacherTransfer = apps.get_model("lessons", "LessonTeacherTransfer")

    student_ids = (
        PersonLessonProgress.objects.values_list("person_id", flat=True).distinct()
    )
    for student_id in student_ids:
        if LessonStudentEnrollment.objects.filter(student_id=student_id).exists():
            continue

        report = (
            LessonSessionReport.objects.filter(
                student_id=student_id, teacher_id__isnull=False
            )
            .order_by("-session_start", "-session_date", "-created_at")
            .first()
        )
        if not report:
            continue

        enrollment = LessonStudentEnrollment.objects.create(
            student_id=student_id,
            teacher_id=report.teacher_id,
            is_active=True,
        )
        LessonTeacherTransfer.objects.create(
            enrollment=enrollment,
            from_teacher_id=None,
            to_teacher_id=report.teacher_id,
            transferred_by_id=None,
            note="Backfilled from latest session report.",
        )


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("lessons", "0006_lesson_student_enrollment"),
    ]

    operations = [
        migrations.RunPython(backfill_lesson_enrollments, noop_reverse),
    ]
