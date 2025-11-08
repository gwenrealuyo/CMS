from django.db import models
from django.db.models import Q

from apps.people.models import Milestone, Person


class Lesson(models.Model):
    """
    Stores the canonical lesson definition.
    Multiple versions of the same lesson share the same `code` value.
    """

    code = models.CharField(
        max_length=50,
        help_text="Stable identifier used to group lesson versions together.",
    )
    version_label = models.CharField(
        max_length=20,
        default="v1",
        help_text="Short label that indicates the lesson revision (e.g., v1, v2).",
    )
    title = models.CharField(max_length=200)
    summary = models.TextField(blank=True)
    outline = models.TextField(
        blank=True,
        help_text="Optional structured outline or talking points for the lesson.",
    )
    order = models.PositiveSmallIntegerField(
        help_text="Display order within the conversion journey."
    )
    is_latest = models.BooleanField(
        default=True,
        help_text="Marks the latest published version for this lesson code.",
    )
    is_active = models.BooleanField(
        default=True,
        help_text="Allows disabling a lesson version without deleting it.",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["order", "title"]
        constraints = [
            models.UniqueConstraint(
                fields=["code", "version_label"],
                name="unique_lesson_code_version",
            ),
            models.UniqueConstraint(
                fields=["code"],
                condition=Q(is_latest=True),
                name="unique_latest_lesson_per_code",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.title} ({self.version_label})"


class LessonMilestone(models.Model):
    """
    Stores metadata that determines how a lesson completion appears in the conversion
    timeline as a milestone (LESSON type by default).
    """

    lesson = models.OneToOneField(
        Lesson, on_delete=models.CASCADE, related_name="milestone_config"
    )
    milestone_type = models.CharField(
        max_length=20,
        choices=Milestone._meta.get_field("type").choices,
        default="LESSON",
        help_text="Milestone type to create when the lesson is completed.",
    )
    title_template = models.CharField(
        max_length=100,
        blank=True,
        help_text="Optional override for the milestone title (defaults to lesson title).",
    )
    note_template = models.TextField(
        blank=True,
        help_text="Optional note body saved on the milestone when the lesson is completed.",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Lesson Milestone Configuration"
        verbose_name_plural = "Lesson Milestone Configurations"

    def __str__(self) -> str:
        return f"{self.lesson.title} milestone config"


class PersonLessonProgress(models.Model):
    """
    Tracks an individual's journey through each lesson version.
    """

    class Status(models.TextChoices):
        ASSIGNED = "ASSIGNED", "Assigned"
        IN_PROGRESS = "IN_PROGRESS", "In progress"
        COMPLETED = "COMPLETED", "Completed"
        SKIPPED = "SKIPPED", "Skipped"

    person = models.ForeignKey(
        Person, on_delete=models.CASCADE, related_name="lesson_progress"
    )
    lesson = models.ForeignKey(
        Lesson, on_delete=models.CASCADE, related_name="progress_records"
    )
    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.ASSIGNED
    )
    assigned_at = models.DateTimeField(auto_now_add=True)
    assigned_by = models.ForeignKey(
        Person,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="lessons_assigned",
    )
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    completed_by = models.ForeignKey(
        Person,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="lessons_verified",
    )
    milestone = models.OneToOneField(
        Milestone,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="lesson_progress",
    )
    notes = models.TextField(blank=True)
    commitment_signed = models.BooleanField(default=False)
    commitment_signed_at = models.DateTimeField(null=True, blank=True)
    commitment_signed_by = models.ForeignKey(
        Person,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="lessons_commitments_verified",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["lesson__order", "person__last_name", "person__first_name"]
        unique_together = ("person", "lesson")

    def __str__(self) -> str:
        return f"{self.person.get_full_name() or self.person.username} - {self.lesson}"


class LessonSettings(models.Model):
    """
    Stores global configuration for the lessons module, including the commitment form.
    """

    commitment_form = models.FileField(
        upload_to="lessons/commitment_forms/", blank=True, null=True
    )
    uploaded_by = models.ForeignKey(
        Person,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="uploaded_commitment_forms",
    )
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self) -> str:
        return "Lesson Settings"


class LessonSessionReport(models.Model):
    """
    Records a 1:1 lesson session between a teacher and student.
    """

    teacher = models.ForeignKey(
        Person,
        on_delete=models.SET_NULL,
        null=True,
        related_name="lesson_reports_as_teacher",
        limit_choices_to=~Q(role="VISITOR"),
    )
    student = models.ForeignKey(
        Person,
        on_delete=models.CASCADE,
        related_name="lesson_reports_as_student",
    )
    lesson = models.ForeignKey(
        Lesson,
        on_delete=models.SET_NULL,
        null=True,
        related_name="session_reports",
    )
    progress = models.ForeignKey(
        PersonLessonProgress,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="session_reports",
    )
    session_date = models.DateField()
    session_start = models.DateTimeField()
    score = models.CharField(max_length=100, blank=True)
    next_session_date = models.DateField(null=True, blank=True)
    remarks = models.TextField(blank=True)

    submitted_by = models.ForeignKey(
        Person,
        on_delete=models.SET_NULL,
        null=True,
        related_name="lesson_reports_submitted",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self) -> str:
        teacher_name = self.teacher.get_full_name() or self.teacher.username if self.teacher else "Unknown"
        student_name = self.student.get_full_name() or self.student.username
        return f"{teacher_name} -> {student_name} ({self.session_date})"

    class Meta:
        ordering = ("-session_date", "-session_start", "-created_at")
