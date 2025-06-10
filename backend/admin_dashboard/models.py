from django.db import models
from django.conf import settings

class UserActivity(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    activity_type = models.CharField(max_length=50)
    description = models.TextField()
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name_plural = 'User Activities'

    def __str__(self):
        return f"{self.user.username} - {self.activity_type}"

class SystemMetric(models.Model):
    metric_name = models.CharField(max_length=100)
    metric_value = models.JSONField()
    recorded_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.metric_name} - {self.recorded_at}"
    