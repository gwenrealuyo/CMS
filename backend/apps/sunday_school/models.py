from django.db import models
from django.conf import settings
from django.utils import timezone


class SundaySchoolCategory(models.Model):
    name = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True)
    min_age = models.PositiveSmallIntegerField(null=True, blank=True)
    max_age = models.PositiveSmallIntegerField(null=True, blank=True)
    order = models.PositiveSmallIntegerField(default=0)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Sunday School Category"
        verbose_name_plural = "Sunday School Categories"
        ordering = ("order", "name")

    def __str__(self):
        age_range = ""
        if self.min_age is not None and self.max_age is not None:
            age_range = f" ({self.min_age}-{self.max_age})"
        elif self.min_age is not None:
            age_range = f" ({self.min_age}+)"
        return f"{self.name}{age_range}"


class SundaySchoolClass(models.Model):
    name = models.CharField(max_length=200)
    category = models.ForeignKey(
        SundaySchoolCategory,
        on_delete=models.PROTECT,
        related_name="classes",
    )
    description = models.TextField(blank=True)
    yearly_theme = models.CharField(max_length=200, blank=True)
    room_location = models.CharField(max_length=200, blank=True)
    meeting_time = models.TimeField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Sunday School Class"
        verbose_name_plural = "Sunday School Classes"
        ordering = ("category__order", "name")

    def __str__(self):
        return f"{self.name} ({self.category.name})"


class SundaySchoolClassMember(models.Model):
    class Role(models.TextChoices):
        TEACHER = "TEACHER", "Teacher"
        ASSISTANT_TEACHER = "ASSISTANT_TEACHER", "Assistant Teacher"
        STUDENT = "STUDENT", "Student"

    sunday_school_class = models.ForeignKey(
        SundaySchoolClass,
        on_delete=models.CASCADE,
        related_name="members",
    )
    person = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="sunday_school_memberships",
    )
    role = models.CharField(max_length=20, choices=Role.choices)
    enrolled_date = models.DateField(default=timezone.now)
    is_active = models.BooleanField(default=True)
    notes = models.TextField(blank=True)

    class Meta:
        unique_together = ("sunday_school_class", "person")
        ordering = (
            "sunday_school_class",
            "role",
            "person__last_name",
            "person__first_name",
        )
        verbose_name = "Sunday School Class Member"
        verbose_name_plural = "Sunday School Class Members"

    def __str__(self):
        return f"{self.person.get_full_name() or self.person.username} - {self.sunday_school_class.name} ({self.get_role_display()})"


class SundaySchoolSession(models.Model):
    sunday_school_class = models.ForeignKey(
        SundaySchoolClass,
        on_delete=models.CASCADE,
        related_name="sessions",
    )
    event = models.OneToOneField(
        "events.Event",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="sunday_school_session",
    )
    session_date = models.DateField()
    session_time = models.TimeField(null=True, blank=True)
    lesson_title = models.CharField(max_length=200, blank=True)
    notes = models.TextField(blank=True)
    is_recurring_instance = models.BooleanField(default=False)
    recurring_group_id = models.CharField(max_length=100, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-session_date", "-session_time")
        verbose_name = "Sunday School Session"
        verbose_name_plural = "Sunday School Sessions"

    def __str__(self):
        return f"{self.sunday_school_class.name} - {self.session_date}"
