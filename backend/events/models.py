from django.db import models
from django.conf import settings
from members.models import User

class Event(models.Model):
    title = models.CharField(max_length=200)
    description = models.TextField()
    start_date = models.DateTimeField()
    end_date = models.DateTimeField()
    type = models.CharField(
        max_length=50,
        choices=[
            ('SUNDAY_SERVICE', 'Sunday Service'),
            ('BIBLE_STUDY', 'Bible Study'),
            ('PRAYER_MEETING', 'Prayer Meeting'),
            ('SPECIAL_EVENT', 'Special Event'),
        ]
    )
    location = models.CharField(max_length=200)
    is_recurring = models.BooleanField(default=False)
    recurrence_pattern = models.JSONField(null=True, blank=True)
    volunteers = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        related_name='volunteered_events'
    )
    # attendees = models.ManyToManyField(
    #     settings.AUTH_USER_MODEL,
    #     related_name='attended_events',
    #     through='attendance.Attendance'
    # )
    attendees = models.ManyToManyField(
        User,
        related_name='attended_events',
        through="attendance.Attendance",  # Your intermediate model
        through_fields=("event", "user"),  # Specify the related fields for through model
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True
    )
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.title} - {self.start_date}"
