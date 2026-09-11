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

    class Meta:
        ordering = ["sort_order", "code"]

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
