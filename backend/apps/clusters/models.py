from django.db import models


class Cluster(models.Model):
    code = models.CharField(max_length=100, unique=True, null=True)
    name = models.CharField(max_length=100, null=True)
    coordinator = models.ForeignKey(
        'people.Person',
        on_delete=models.SET_NULL,
        null=True,
        related_name="coordinated_clusters",
    )
    # A cluster can include families and/or individual people
    families = models.ManyToManyField('people.Family', blank=True)
    members = models.ManyToManyField('people.Person', related_name="clusters", blank=True)
    location = models.CharField(max_length=150, blank=True)
    meeting_schedule = models.CharField(max_length=200, blank=True)
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name or self.code or f"Cluster {self.id}"


class ClusterWeeklyReport(models.Model):
    cluster = models.ForeignKey(
        Cluster, on_delete=models.CASCADE, related_name="weekly_reports"
    )
    year = models.IntegerField(help_text="Year of the report (e.g., 2025)")
    week_number = models.IntegerField(help_text="ISO week number (1-53)")

    # Cluster Meeting Information
    meeting_date = models.DateField(
        help_text="Actual date the cluster meeting was held this week"
    )

    # Attendance
    members_attended = models.ManyToManyField(
        'people.Person',
        blank=True,
        related_name="cluster_reports_as_member",
        limit_choices_to={"role": "MEMBER"},
    )
    visitors_attended = models.ManyToManyField(
        'people.Person',
        blank=True,
        related_name="cluster_reports_as_visitor",
        limit_choices_to={"role": "VISITOR"},
    )

    # Gathering Information
    gathering_type = models.CharField(
        max_length=20,
        choices=[
            ("PHYSICAL", "Physical"),
            ("ONLINE", "Online"),
            ("HYBRID", "Hybrid"),
        ],
    )

    # Activities and Events
    activities_held = models.TextField(
        blank=True, help_text="Activities/events held during the cluster meeting"
    )

    # Prayer and Testimonies
    prayer_requests = models.TextField(blank=True)
    testimonies = models.TextField(blank=True)

    # Financial
    offerings = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)

    # Highlights and Lowlights
    highlights = models.TextField(
        blank=True, help_text="Positive events or achievements"
    )
    lowlights = models.TextField(blank=True, help_text="Challenges or concerns")

    # Submission Info
    submitted_by = models.ForeignKey(
        'people.Person',
        on_delete=models.SET_NULL,
        null=True,
        related_name="submitted_cluster_reports",
    )
    submitted_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    @property
    def members_present(self):
        return self.members_attended.count()

    @property
    def visitors_present(self):
        return self.visitors_attended.count()

    @property
    def member_attendance_rate(self):
        """Returns the percentage of cluster members who attended the meeting."""
        total_members = self.cluster.members.count()
        if total_members == 0:
            return 0.0  # Avoid division by zero
        members_attended_count = self.members_attended.count()
        return round((members_attended_count / total_members) * 100, 2)

    class Meta:
        unique_together = ["cluster", "year", "week_number"]
        ordering = ["-year", "-week_number"]

    def __str__(self):
        return f"{self.cluster.name} - {self.year} Week {self.week_number}"
