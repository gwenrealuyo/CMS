from django.db import models
from django.contrib.auth.models import AbstractUser, Group, Permission


class Person(AbstractUser):
    middle_name = models.CharField(blank=True, max_length=150)
    suffix = models.CharField(blank=True, max_length=150)
    gender = models.CharField(
        blank=True,
        max_length=20,
        choices=[
            ("MALE", "Male"),
            ("FEMALE", "Female"),
        ],
    )
    facebook_name = models.CharField(blank=True, max_length=150)
    photo = models.ImageField(upload_to="profiles/", null=True, blank=True)
    role = models.CharField(
        max_length=20,
        choices=[
            ("MEMBER", "Member"),
            ("VISITOR", "Visitor"),
            ("COORDINATOR", "Coordinator"),
            ("PASTOR", "Pastor"),
            ("ADMIN", "Admin"),
        ],
    )
    phone = models.CharField(max_length=20, blank=True)
    address = models.TextField(blank=True)
    country = models.CharField(max_length=20, blank=True)
    date_of_birth = models.DateField(null=True, blank=True)
    date_first_attended = models.DateField(null=True, blank=True)
    water_baptism_date = models.DateField(null=True, blank=True)
    spirit_baptism_date = models.DateField(null=True, blank=True)
    first_activity_attended = models.CharField(
        blank=True,
        max_length=50,
        choices=[
            ("CLUSTER_BS_EVANGELISM", "Cluster/BS Evangelism"),
            ("CLUSTERING", "Clustering"),
            ("SUNDAY_SERVICE", "Sunday Service"),
            ("DOCTRINAL_CLASS", "Doctrinal Class"),
            ("PRAYER_MEETING", "Prayer Meeting"),
            ("CYM_CLASS", "CYM Class"),
            ("MINI_WORSHIP", "Mini Worship"),
            ("GOLDEN_WARRIORS", "Golden Warriors"),
            ("CAMPING", "Camping"),
            ("AWTA", "AWTA"),
            ("CONFERENCE", "Conference"),
            ("CONCERT_CRUSADE", "Concert/Crusade"),
        ],
    )
    inviter = models.ForeignKey(
        "self",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="invited_people",
    )
    member_id = models.CharField(max_length=20, blank=True)
    status = models.CharField(
        blank=True,
        max_length=20,
        choices=[
            ("ACTIVE", "Active"),
            ("SEMIACTIVE", "Semiactive"),
            ("INACTIVE", "Inactive"),
            ("DECEASED", "Deceased"),
            # For VISITOR role specialized states; UI can restrict selection conditionally
            ("INVITED", "Invited"),
            ("ATTENDED", "Attended"),
        ],
    )

    groups = models.ManyToManyField(
        Group,
        related_name="people_person_set",  # renamed to reflect new model name
        blank=True,
    )
    user_permissions = models.ManyToManyField(
        Permission,
        related_name="people_person_permissions",  # renamed to reflect new model name
        blank=True,
    )

    def __str__(self):
        return self.username  # or full name if you prefer


class Family(models.Model):
    name = models.CharField(max_length=100)
    leader = models.ForeignKey(
        Person, on_delete=models.SET_NULL, null=True, related_name="led_families"
    )
    members = models.ManyToManyField(Person, related_name="families")
    address = models.TextField(blank=True)  # Physical address/location
    notes = models.TextField(blank=True)  # Family notes/description
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name

    class Meta:
        verbose_name_plural = "Families"


class Cluster(models.Model):
    code = models.CharField(max_length=100, unique=True, null=True)
    name = models.CharField(max_length=100, null=True)
    coordinator = models.ForeignKey(
        Person,
        on_delete=models.SET_NULL,
        null=True,
        related_name="coordinated_clusters",
    )
    # A cluster can include families and/or individual people
    families = models.ManyToManyField(Family, blank=True)
    members = models.ManyToManyField(Person, related_name="clusters", blank=True)
    location = models.CharField(max_length=150, blank=True)
    meeting_schedule = models.CharField(max_length=200, blank=True)
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name


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
        Person,
        blank=True,
        related_name="cluster_reports_as_member",
        limit_choices_to={"role": "MEMBER"},
    )
    visitors_attended = models.ManyToManyField(
        Person,
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
        Person,
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


class Milestone(models.Model):
    user = models.ForeignKey(
        Person, on_delete=models.CASCADE, related_name="milestones"
    )
    title = models.CharField(blank=True, max_length=100)
    date = models.DateField()
    type = models.CharField(
        max_length=20,
        choices=[
            ("LESSON", "Lesson"),
            ("BAPTISM", "Baptism"),
            ("SPIRIT", "Spirit"),
            ("CLUSTER", "Cluster"),
            ("NOTE", "Note"),
        ],
    )
    description = models.TextField(blank=True)
    verified_by = models.ForeignKey(
        Person, on_delete=models.SET_NULL, null=True, related_name="verified_milestones"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user.username} - {self.type} - {self.date}"
