from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models


class AttendanceRecord(models.Model):
    class AttendanceStatus(models.TextChoices):
        PRESENT = "PRESENT", "Present"
        ABSENT = "ABSENT", "Absent"
        EXCUSED = "EXCUSED", "Excused"

    class AttendanceMode(models.TextChoices):
        ONSITE = "ONSITE", "Onsite"
        ONLINE = "ONLINE", "Online"

    class CatchupReason(models.TextChoices):
        REPLAY = "REPLAY", "Watched the replay"
        TIMEZONE = "TIMEZONE", "Another timezone"
        FORGOT_CHECKIN = "FORGOT_CHECKIN", "Forgot to check in"
        OTHER = "OTHER", "Other"

    event = models.ForeignKey(
        "events.Event",
        on_delete=models.CASCADE,
        related_name="attendance_records",
    )
    person = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="event_attendances",
    )
    occurrence_date = models.DateField(
        help_text="Date of the specific event occurrence for this attendance record."
    )
    status = models.CharField(
        max_length=20,
        choices=AttendanceStatus.choices,
        default=AttendanceStatus.PRESENT,
    )
    attendance_mode = models.CharField(
        max_length=20,
        choices=AttendanceMode.choices,
        default=AttendanceMode.ONSITE,
    )
    attendance_venue = models.ForeignKey(
        "events.AttendanceVenue",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="attendance_records",
    )
    notes = models.TextField(blank=True)
    recorded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="attendance_records_recorded",
    )
    catchup_reason = models.CharField(
        max_length=20,
        choices=CatchupReason.choices,
        blank=True,
        default="",
    )
    catchup_note = models.CharField(max_length=200, blank=True, default="")
    journey = models.OneToOneField(
        "people.Journey",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="attendance_record",
    )
    recorded_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("event", "person", "occurrence_date")
        ordering = ("-occurrence_date", "-recorded_at")
        verbose_name = "Attendance Record"
        verbose_name_plural = "Attendance Records"

    def catchup_summary(self) -> str:
        """Short label for a coordinator/reporter catch-up, or empty."""
        reason = self.catchup_reason or ""
        if not reason:
            return ""
        if reason == self.CatchupReason.OTHER:
            note = (self.catchup_note or "").strip()
            return note or "Other"
        return self.get_catchup_reason_display()

    def _clean_catchup(self):
        reason = (self.catchup_reason or "").strip()
        note = (self.catchup_note or "").strip()
        if not reason:
            if note:
                raise ValidationError(
                    {
                        "catchup_note": (
                            "A catch-up note requires a catch-up reason."
                        )
                    }
                )
            return
        mode = self.attendance_mode or self.AttendanceMode.ONSITE
        if mode != self.AttendanceMode.ONLINE:
            raise ValidationError(
                {
                    "catchup_reason": (
                        "Catch-up attendance must be online."
                    )
                }
            )
        if reason == self.CatchupReason.OTHER and not note:
            raise ValidationError(
                {"catchup_note": "Describe the reason when you choose Other."}
            )
        if reason != self.CatchupReason.OTHER and note:
            raise ValidationError(
                {
                    "catchup_note": (
                        "A note is only used when the reason is Other."
                    )
                }
            )

    def clean(self):
        super().clean()
        self._clean_catchup()
        mode = self.attendance_mode or self.AttendanceMode.ONSITE
        event = self.event
        online_only = (
            event is not None
            and getattr(event, "attendance_format", None) == "online_only"
        )
        if mode == self.AttendanceMode.ONSITE:
            if self.attendance_venue_id:
                raise ValidationError(
                    {
                        "attendance_venue": (
                            "Onsite attendance cannot have an online venue."
                        )
                    }
                )
            if online_only:
                raise ValidationError(
                    {
                        "attendance_mode": (
                            "This event is online only; use online attendance."
                        )
                    }
                )
        elif mode == self.AttendanceMode.ONLINE:
            if event is not None and getattr(event, "attendance_format", None) == (
                "onsite_only"
            ):
                raise ValidationError(
                    {
                        "attendance_mode": (
                            "This event is onsite only; use onsite attendance."
                        )
                    }
                )
            if online_only:
                if self.attendance_venue_id:
                    raise ValidationError(
                        {
                            "attendance_venue": (
                                "Online-only events do not use an online venue."
                            )
                        }
                    )
                return
            if not self.attendance_venue_id:
                raise ValidationError(
                    {
                        "attendance_venue": (
                            "Online attendance requires an online venue."
                        )
                    }
                )
            venue = self.attendance_venue
            if venue is not None and not venue.is_active:
                raise ValidationError(
                    {
                        "attendance_venue": (
                            "Selected online venue is not active."
                        )
                    }
                )

    def __str__(self):
        return (
            f"{self.person} - {self.event.title} "
            f"({self.occurrence_date.isoformat()})"
        )
