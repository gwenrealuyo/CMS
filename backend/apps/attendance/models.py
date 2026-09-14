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

    def clean(self):
        super().clean()
        mode = self.attendance_mode or self.AttendanceMode.ONSITE
        if mode == self.AttendanceMode.ONSITE:
            if self.attendance_venue_id:
                raise ValidationError(
                    {
                        "attendance_venue": (
                            "Onsite attendance cannot have an online venue."
                        )
                    }
                )
        elif mode == self.AttendanceMode.ONLINE:
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
