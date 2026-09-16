from django.conf import settings
from django.core.validators import RegexValidator
from django.db import models
from django.db.models.functions import Lower

from .event_type_seed import DEFAULT_EVENT_TYPE_COLOR


hex_color_validator = RegexValidator(
    regex=r"^#[0-9A-Fa-f]{6}$",
    message="Color must be a hex value like #RRGGBB.",
)


class EventType(models.Model):
    code = models.CharField(max_length=50, primary_key=True)
    label = models.CharField(max_length=100)
    sort_order = models.PositiveSmallIntegerField(default=0)
    color = models.CharField(
        max_length=7,
        default=DEFAULT_EVENT_TYPE_COLOR,
        validators=[hex_color_validator],
    )
    is_system = models.BooleanField(default=False)
    counts_as_activity = models.BooleanField(
        default=True,
        help_text=(
            "If false, this type is a room hold only and is not a person's "
            "first activity attended."
        ),
    )

    class Meta:
        ordering = ["sort_order", "code"]

    def __str__(self):
        return self.label

    @classmethod
    def activity_queryset(cls):
        return cls.objects.filter(counts_as_activity=True)


class AttendanceVenue(models.Model):
    """Admin-managed online attendance venues (Home altar, Cluster house, etc.)."""

    code = models.CharField(max_length=50, primary_key=True)
    label = models.CharField(max_length=100)
    sort_order = models.PositiveSmallIntegerField(default=0)
    color = models.CharField(
        max_length=7,
        default=DEFAULT_EVENT_TYPE_COLOR,
        validators=[hex_color_validator],
    )
    is_active = models.BooleanField(default=True)
    is_system = models.BooleanField(default=False)

    class Meta:
        ordering = ["sort_order", "code"]
        verbose_name = "Attendance Venue"
        verbose_name_plural = "Attendance Venues"

    def __str__(self):
        return self.label


class EventRoom(models.Model):
    branch = models.ForeignKey(
        "people.Branch",
        on_delete=models.CASCADE,
        related_name="event_rooms",
    )
    name = models.CharField(max_length=200)
    capacity = models.PositiveIntegerField(null=True, blank=True)
    notes = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    sort_order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ["sort_order", "name"]
        constraints = [
            models.UniqueConstraint(
                Lower("name"),
                "branch",
                name="events_eventroom_branch_lname_uniq",
            ),
        ]
        indexes = [
            models.Index(fields=["branch", "is_active"]),
        ]

    def __str__(self):
        return f"{self.name} ({self.branch})"


class Event(models.Model):
    class BookingStatus(models.TextChoices):
        PENDING = "pending", "Pending"
        APPROVED = "approved", "Approved"
        REJECTED = "rejected", "Rejected"

    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    start_date = models.DateTimeField()
    end_date = models.DateTimeField()
    event_type = models.ForeignKey(
        EventType,
        on_delete=models.PROTECT,
        related_name="events",
        default="SUNDAY_SERVICE",
    )
    location = models.CharField(max_length=200)
    room = models.ForeignKey(
        EventRoom,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="events",
    )
    branch = models.ForeignKey(
        "people.Branch",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="events",
    )
    is_recurring = models.BooleanField(default=False)
    recurrence_pattern = models.JSONField(null=True, blank=True)
    booking_status = models.CharField(
        max_length=20,
        choices=BookingStatus.choices,
        default=BookingStatus.APPROVED,
        db_index=True,
    )
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="events_reviewed",
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    review_note = models.TextField(blank=True)
    expected_include_active = models.BooleanField(default=True)
    expected_include_semiactive = models.BooleanField(default=True)
    expected_include_inactive = models.BooleanField(default=True)
    expected_include_ongoing_visitors = models.BooleanField(default=True)
    volunteers = models.ManyToManyField(
        settings.AUTH_USER_MODEL, related_name="volunteered_events"
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="events_updated",
    )
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.title} - {self.start_date}"


class EventSetting(models.Model):
    """Singleton flags for the Events module (e.g. member self-check-in)."""

    SOLO_PK = 1

    member_self_checkin_enabled = models.BooleanField(
        default=False,
        help_text=(
            "When enabled, members can check in online from the public Sunday "
            "link (LAMP ID / member QR) without logging in. When disabled, only "
            "admins and Events coordinators can use logged-in household and "
            "guest self-check-in."
        ),
    )
    updated_at = models.DateTimeField(auto_now=True)
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="updated_event_settings",
    )

    class Meta:
        verbose_name = "Event Setting"
        verbose_name_plural = "Event Settings"

    def save(self, *args, **kwargs):
        self.pk = self.SOLO_PK
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        self.member_self_checkin_enabled = False
        self.updated_by = None
        self.save(
            update_fields=["member_self_checkin_enabled", "updated_by", "updated_at"]
        )

    @classmethod
    def get_solo(cls):
        obj, _ = cls.objects.get_or_create(
            pk=cls.SOLO_PK,
            defaults={"member_self_checkin_enabled": False},
        )
        return obj

    def __str__(self):
        status = "Enabled" if self.member_self_checkin_enabled else "Disabled"
        return f"Member self-check-in: {status}"
