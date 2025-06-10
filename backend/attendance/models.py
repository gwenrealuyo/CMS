from django.db import models
from django.conf import settings
from events.models import Event
from members.models import User

class Attendance(models.Model):
    event = models.ForeignKey(Event, on_delete=models.CASCADE)
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    check_in_time = models.DateTimeField(auto_now_add=True)
    check_in_method = models.CharField(
        max_length=20,
        choices=[
            ('MANUAL', 'Manual'),
            ('QR', 'QR Code'),
        ],
        default='MANUAL'
    )
    checked_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='checked_in_attendances'
    )
    notes = models.TextField(blank=True)

    class Meta:
        unique_together = ['event', 'user']
        verbose_name = 'Attendance'
        verbose_name_plural = 'Attendances'

    def __str__(self):
        return f"{self.user.username} - {self.event.title}"
