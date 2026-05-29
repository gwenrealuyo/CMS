from django.conf import settings
from django.db import models


class NotificationDismissal(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="notification_dismissals",
    )
    notification_key = models.CharField(max_length=255)
    dismissed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["user", "notification_key"],
                name="notifications_user_key_unique",
            ),
        ]
        indexes = [
            models.Index(fields=["user", "notification_key"]),
        ]

    def __str__(self):
        return f"{self.user_id}:{self.notification_key}"
