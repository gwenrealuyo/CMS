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

    class AttendanceFormat(models.TextChoices):
        HYBRID = "hybrid", "Hybrid"
        ONLINE_ONLY = "online_only", "Online only"
        ONSITE_ONLY = "onsite_only", "Onsite only"

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
    track_expected_attendees = models.BooleanField(
        default=False,
        help_text=(
            "When enabled, check-in Total/Remaining and attendance reports use "
            "the expected-include status flags (duty-style). When disabled, "
            "the event is open headcount-only (no expected pool)."
        ),
    )
    allow_cross_branch_attendance = models.BooleanField(
        default=False,
        help_text=(
            "When enabled on a branch-hosted event, people from other branches "
            "may check in and self-check-in. The expected pool (when tracking) "
            "still uses only the event's branch. Ignored for church-wide events."
        ),
    )
    tardy_grace_minutes = models.PositiveIntegerField(
        default=0,
        help_text=(
            "Minutes after occurrence start before a check-in counts as tardy. "
            "0 means any check-in after start is tardy."
        ),
    )
    self_checkin_enabled = models.BooleanField(
        default=False,
        help_text=(
            "When enabled, this approved activity event opens for online "
            "member self-check-in (public LAMP ID and logged-in household) "
            "on occurrence days. Meeting room holds cannot enable this."
        ),
    )
    attendance_format = models.CharField(
        max_length=20,
        choices=AttendanceFormat.choices,
        default=AttendanceFormat.HYBRID,
        help_text=(
            "Hybrid allows onsite and online (online requires a venue). "
            "Online only is remote attendance without a venue. "
            "Onsite only is door/station check-in only."
        ),
    )
    registration_enabled = models.BooleanField(default=False)
    onsite_registration_required = models.BooleanField(default=False)
    online_registration_required = models.BooleanField(default=False)
    onsite_capacity = models.PositiveIntegerField(null=True, blank=True)
    online_capacity = models.PositiveIntegerField(null=True, blank=True)
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

    @property
    def requires_online_venue(self) -> bool:
        """Hybrid online check-in needs Home altar / Cluster house, etc."""
        return self.attendance_format == self.AttendanceFormat.HYBRID

    @property
    def allows_onsite_attendance(self) -> bool:
        return self.attendance_format in (
            self.AttendanceFormat.HYBRID,
            self.AttendanceFormat.ONSITE_ONLY,
        )

    @property
    def allows_online_attendance(self) -> bool:
        return self.attendance_format in (
            self.AttendanceFormat.HYBRID,
            self.AttendanceFormat.ONLINE_ONLY,
        )


class EventRegistrationTier(models.Model):
    event = models.ForeignKey(
        Event,
        on_delete=models.CASCADE,
        related_name="registration_tiers",
    )
    code = models.CharField(max_length=50)
    label = models.CharField(max_length=100)
    sort_order = models.PositiveSmallIntegerField(default=0)
    is_active = models.BooleanField(default=True)
    onsite_offered = models.BooleanField(default=True)
    online_offered = models.BooleanField(default=True)
    onsite_price = models.DecimalField(
        max_digits=10, decimal_places=2, default=0
    )
    online_price = models.DecimalField(
        max_digits=10, decimal_places=2, default=0
    )
    available_from = models.DateTimeField(null=True, blank=True)
    available_until = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["sort_order", "id"]
        unique_together = ("event", "code")
        verbose_name = "Event Registration Tier"
        verbose_name_plural = "Event Registration Tiers"

    def __str__(self):
        return f"{self.label} ({self.event_id})"


class EventRegistration(models.Model):
    class AttendanceMode(models.TextChoices):
        ONSITE = "ONSITE", "Onsite"
        ONLINE = "ONLINE", "Online"

    class Status(models.TextChoices):
        PENDING_PAYMENT = "pending_payment", "Pending payment"
        CONFIRMED = "confirmed", "Confirmed"
        CANCELLED = "cancelled", "Cancelled"
        REFUNDED = "refunded", "Refunded"
        WAITLISTED = "waitlisted", "Waitlisted"

    event = models.ForeignKey(
        Event,
        on_delete=models.CASCADE,
        related_name="registrations",
    )
    person = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="event_registrations",
    )
    occurrence_date = models.DateField(null=True, blank=True)
    mode = models.CharField(
        max_length=20,
        choices=AttendanceMode.choices,
    )
    tier = models.ForeignKey(
        EventRegistrationTier,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="registrations",
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING_PAYMENT,
        db_index=True,
    )
    amount_due = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    amount_paid = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="event_registrations_created",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at", "id"]
        indexes = [
            models.Index(fields=["event", "person", "occurrence_date"]),
            models.Index(fields=["event", "status"]),
            models.Index(fields=["event", "mode", "status"]),
        ]
        verbose_name = "Event Registration"
        verbose_name_plural = "Event Registrations"

    def __str__(self):
        return f"{self.person_id} @ {self.event_id} ({self.status})"


class EventRegistrationPayment(models.Model):
    class Method(models.TextChoices):
        CASH = "CASH", "Cash"
        CHECK = "CHECK", "Check"
        BANK_TRANSFER = "BANK_TRANSFER", "Bank transfer"
        CARD = "CARD", "Card"
        DIGITAL_WALLET = "DIGITAL_WALLET", "Digital wallet"

    registration = models.ForeignKey(
        EventRegistration,
        on_delete=models.CASCADE,
        related_name="payments",
    )
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    method = models.CharField(max_length=20, choices=Method.choices)
    paid_at = models.DateTimeField()
    recorded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="event_registration_payments_recorded",
    )
    note = models.TextField(blank=True)
    provider = models.CharField(max_length=100, blank=True, default="")
    provider_ref = models.CharField(max_length=100, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-paid_at", "-id"]
        verbose_name = "Event Registration Payment"
        verbose_name_plural = "Event Registration Payments"

    def __str__(self):
        return f"{self.amount} for registration {self.registration_id}"


class EventSetting(models.Model):
    """Singleton flags for the Events module (e.g. member self-check-in)."""

    SOLO_PK = 1

    member_self_checkin_enabled = models.BooleanField(
        default=False,
        help_text=(
            "When enabled, members can check in online from the public "
            "self-check-in link (LAMP ID / member QR) without logging in, for "
            "events that have self-check-in enabled. When disabled, only "
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
