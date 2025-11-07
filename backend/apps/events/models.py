from django.db import models
from django.conf import settings


class Event(models.Model):
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    start_date = models.DateTimeField()
    end_date = models.DateTimeField()
    type = models.CharField(
        max_length=50,
        choices=[
            ("SUNDAY_SERVICE", "Sunday Service"),
            ("BIBLE_STUDY", "Bible Study"),
            ("PRAYER_MEETING", "Prayer Meeting"),
            ("CLUSTER_BS_EVANGELISM", "Cluster/BS Evangelism"),
            ("CLUSTERING", "Clustering"),
            ("DOCTRINAL_CLASS", "Doctrinal Class"),
            ("CYM_CLASS", "CYM Class"),
            ("MINI_WORSHIP", "Mini Worship"),
            ("GOLDEN_WARRIORS", "Golden Warriors"),
            ("CAMPING", "Camping"),
            ("AWTA", "AWTA"),
            ("CONFERENCE", "Conference"),
            ("OTHER", "Others"),
        ],
        default="SUNDAY_SERVICE",
    )
    location = models.CharField(max_length=200)
    is_recurring = models.BooleanField(default=False)
    recurrence_pattern = models.JSONField(null=True, blank=True)
    volunteers = models.ManyToManyField(
        settings.AUTH_USER_MODEL, related_name="volunteered_events"
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True
    )
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.title} - {self.start_date}"
