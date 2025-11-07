from django.conf import settings
from django.db import models


class AttendanceRecord(models.Model):
    class AttendanceStatus(models.TextChoices):
        PRESENT = "PRESENT", "Present"
        ABSENT = "ABSENT", "Absent"
        EXCUSED = "EXCUSED", "Excused"

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
    notes = models.TextField(blank=True)
    milestone = models.OneToOneField(
        "people.Milestone",
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

    def __str__(self):
        return (
            f"{self.person} - {self.event.title} "
            f"({self.occurrence_date.isoformat()})"
        )
