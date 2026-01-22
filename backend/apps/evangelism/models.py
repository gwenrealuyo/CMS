from django.db import models
from django.conf import settings
from django.utils import timezone


class EvangelismGroup(models.Model):
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    coordinator = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="coordinated_evangelism_groups",
    )
    cluster = models.ForeignKey(
        "clusters.Cluster",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="evangelism_groups",
    )
    location = models.CharField(max_length=200, blank=True)
    meeting_time = models.TimeField(null=True, blank=True)
    meeting_day = models.CharField(
        max_length=20,
        blank=True,
        choices=[
            ("MONDAY", "Monday"),
            ("TUESDAY", "Tuesday"),
            ("WEDNESDAY", "Wednesday"),
            ("THURSDAY", "Thursday"),
            ("FRIDAY", "Friday"),
            ("SATURDAY", "Saturday"),
            ("SUNDAY", "Sunday"),
        ],
    )
    is_active = models.BooleanField(default=True)
    is_bible_sharers_group = models.BooleanField(
        default=False,
        help_text="Mark this group as a Bible Sharers group. Bible Sharers are capable of facilitating bible studies and can step in when a cluster doesn't have someone to facilitate.",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("name",)
        verbose_name = "Evangelism Group"
        verbose_name_plural = "Evangelism Groups"

    def __str__(self):
        return self.name


class EvangelismGroupMember(models.Model):
    class Role(models.TextChoices):
        LEADER = "LEADER", "Leader"
        MEMBER = "MEMBER", "Member"
        ASSISTANT_LEADER = "ASSISTANT_LEADER", "Assistant Leader"

    evangelism_group = models.ForeignKey(
        EvangelismGroup,
        on_delete=models.CASCADE,
        related_name="members",
    )
    person = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="evangelism_group_memberships",
    )
    role = models.CharField(max_length=20, choices=Role.choices)
    joined_date = models.DateField(default=timezone.localdate)
    is_active = models.BooleanField(default=True)
    notes = models.TextField(blank=True)

    class Meta:
        unique_together = ("evangelism_group", "person")
        ordering = (
            "evangelism_group",
            "role",
            "person__last_name",
            "person__first_name",
        )
        verbose_name = "Evangelism Group Member"
        verbose_name_plural = "Evangelism Group Members"

    def __str__(self):
        return f"{self.person.get_full_name() or self.person.username} - {self.evangelism_group.name} ({self.get_role_display()})"


class EvangelismSession(models.Model):
    evangelism_group = models.ForeignKey(
        EvangelismGroup,
        on_delete=models.CASCADE,
        related_name="sessions",
    )
    event = models.OneToOneField(
        "events.Event",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="evangelism_session",
    )
    session_date = models.DateField()
    session_time = models.TimeField(null=True, blank=True)
    topic = models.CharField(max_length=200, blank=True)
    notes = models.TextField(blank=True)
    is_recurring_instance = models.BooleanField(default=False)
    recurring_group_id = models.CharField(max_length=100, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-session_date", "-session_time")
        verbose_name = "Evangelism Session"
        verbose_name_plural = "Evangelism Sessions"

    def __str__(self):
        return f"{self.evangelism_group.name} - {self.session_date}"


class EvangelismWeeklyReport(models.Model):
    evangelism_group = models.ForeignKey(
        EvangelismGroup,
        on_delete=models.CASCADE,
        related_name="weekly_reports",
    )
    year = models.IntegerField(help_text="Year of the report (e.g., 2025)")
    week_number = models.IntegerField(help_text="ISO week number (1-53)")
    meeting_date = models.DateField(
        help_text="Actual date the meeting was held this week"
    )
    members_attended = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        blank=True,
        related_name="evangelism_reports_as_member",
        limit_choices_to={"role": "MEMBER"},
    )
    visitors_attended = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        blank=True,
        related_name="evangelism_reports_as_visitor",
        limit_choices_to={"role": "VISITOR"},
    )
    gathering_type = models.CharField(
        max_length=20,
        choices=[
            ("PHYSICAL", "Physical"),
            ("ONLINE", "Online"),
            ("HYBRID", "Hybrid"),
        ],
    )
    topic = models.CharField(max_length=200, blank=True)
    activities_held = models.TextField(blank=True)
    prayer_requests = models.TextField(blank=True)
    testimonies = models.TextField(blank=True)
    new_prospects = models.IntegerField(default=0)
    conversions_this_week = models.IntegerField(default=0)
    notes = models.TextField(blank=True)
    submitted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="submitted_evangelism_reports",
    )
    submitted_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ["evangelism_group", "year", "week_number"]
        ordering = ["-year", "-week_number"]
        verbose_name = "Evangelism Weekly Report"
        verbose_name_plural = "Evangelism Weekly Reports"

    def __str__(self):
        return f"{self.evangelism_group.name} - {self.year} Week {self.week_number}"


class Prospect(models.Model):
    class PipelineStage(models.TextChoices):
        INVITED = "INVITED", "Invited"
        ATTENDED = "ATTENDED", "Attended"
        BAPTIZED = "BAPTIZED", "Baptized"
        RECEIVED_HG = "RECEIVED_HG", "Received Holy Ghost"
        CONVERTED = "CONVERTED", "Converted"

    class FastTrackReason(models.TextChoices):
        NONE = "NONE", "None"
        GOING_ABROAD = "GOING_ABROAD", "Going Abroad"
        HEALTH_ISSUES = "HEALTH_ISSUES", "Health Issues"
        OTHER = "OTHER", "Other"

    name = models.CharField(max_length=200)
    contact_info = models.CharField(max_length=200, blank=True)
    facebook_name = models.CharField(max_length=200, blank=True)
    invited_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="invited_prospects",
    )
    inviter_cluster = models.ForeignKey(
        "clusters.Cluster",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="prospects_by_inviter",
    )
    evangelism_group = models.ForeignKey(
        EvangelismGroup,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="prospects",
    )
    endorsed_cluster = models.ForeignKey(
        "clusters.Cluster",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="endorsed_prospects",
    )
    person = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="prospect_record",
    )
    pipeline_stage = models.CharField(
        max_length=20, choices=PipelineStage.choices, default=PipelineStage.INVITED
    )
    first_contact_date = models.DateField(null=True, blank=True)
    last_activity_date = models.DateField(null=True, blank=True)
    is_attending_cluster = models.BooleanField(default=False)
    is_dropped_off = models.BooleanField(default=False)
    drop_off_date = models.DateField(null=True, blank=True)
    drop_off_stage = models.CharField(
        max_length=20, choices=PipelineStage.choices, null=True, blank=True
    )
    drop_off_reason = models.TextField(blank=True)
    has_finished_lessons = models.BooleanField(default=False)
    commitment_form_signed = models.BooleanField(default=False)
    fast_track_reason = models.CharField(
        max_length=20, choices=FastTrackReason.choices, default=FastTrackReason.NONE
    )
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-last_activity_date", "name")
        verbose_name = "Prospect"
        verbose_name_plural = "Prospects"

    @property
    def days_since_last_activity(self):
        if not self.last_activity_date:
            return None
        return (timezone.now().date() - self.last_activity_date).days

    def __str__(self):
        return self.name


class FollowUpTask(models.Model):
    class TaskType(models.TextChoices):
        PHONE_CALL = "PHONE_CALL", "Phone Call"
        TEXT_MESSAGE = "TEXT_MESSAGE", "Text Message"
        VISIT = "VISIT", "Visit"
        EMAIL = "EMAIL", "Email"
        PRAYER = "PRAYER", "Prayer"
        OTHER = "OTHER", "Other"

    class Status(models.TextChoices):
        PENDING = "PENDING", "Pending"
        IN_PROGRESS = "IN_PROGRESS", "In Progress"
        COMPLETED = "COMPLETED", "Completed"
        CANCELLED = "CANCELLED", "Cancelled"

    class Priority(models.TextChoices):
        LOW = "LOW", "Low"
        MEDIUM = "MEDIUM", "Medium"
        HIGH = "HIGH", "High"
        URGENT = "URGENT", "Urgent"

    prospect = models.ForeignKey(
        Prospect, on_delete=models.CASCADE, related_name="follow_up_tasks"
    )
    assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="assigned_follow_up_tasks",
    )
    task_type = models.CharField(max_length=20, choices=TaskType.choices)
    due_date = models.DateField()
    completed_date = models.DateField(null=True, blank=True)
    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.PENDING
    )
    notes = models.TextField(blank=True)
    priority = models.CharField(
        max_length=20, choices=Priority.choices, default=Priority.MEDIUM
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_follow_up_tasks",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("due_date", "priority")
        verbose_name = "Follow-up Task"
        verbose_name_plural = "Follow-up Tasks"

    def __str__(self):
        return f"{self.prospect.name} - {self.get_task_type_display()} ({self.get_status_display()})"


class DropOff(models.Model):
    class DropOffReason(models.TextChoices):
        NO_CONTACT = "NO_CONTACT", "No Contact"
        NO_SHOW = "NO_SHOW", "No Show"
        LOST_INTEREST = "LOST_INTEREST", "Lost Interest"
        MOVED = "MOVED", "Moved"
        OTHER = "OTHER", "Other"

    prospect = models.OneToOneField(
        Prospect, on_delete=models.CASCADE, related_name="drop_off_record"
    )
    drop_off_date = models.DateField()
    drop_off_stage = models.CharField(
        max_length=20,
        choices=Prospect.PipelineStage.choices,
    )
    days_inactive = models.IntegerField()
    reason = models.CharField(
        max_length=20, choices=DropOffReason.choices, blank=True
    )
    reason_details = models.TextField(blank=True)
    recovery_attempted = models.BooleanField(default=False)
    recovery_date = models.DateField(null=True, blank=True)
    recovered = models.BooleanField(default=False)
    recovered_date = models.DateField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-drop_off_date",)
        verbose_name = "Drop-off"
        verbose_name_plural = "Drop-offs"

    def __str__(self):
        return f"{self.prospect.name} - {self.drop_off_date} ({self.get_reason_display()})"


class Conversion(models.Model):
    person = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="conversions",
    )
    prospect = models.ForeignKey(
        Prospect,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="conversions",
    )
    converted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="conversions_led",
    )
    evangelism_group = models.ForeignKey(
        EvangelismGroup,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="conversions",
    )
    cluster = models.ForeignKey(
        "clusters.Cluster",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="conversions",
    )
    conversion_date = models.DateField()
    water_baptism_date = models.DateField(null=True, blank=True)
    spirit_baptism_date = models.DateField(null=True, blank=True)
    is_complete = models.BooleanField(default=False)
    notes = models.TextField(blank=True)
    verified_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="verified_conversions",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-conversion_date",)
        verbose_name = "Conversion"
        verbose_name_plural = "Conversions"

    def __str__(self):
        return f"{self.person.get_full_name() or self.person.username} - {self.conversion_date}"


class MonthlyConversionTracking(models.Model):
    class Stage(models.TextChoices):
        INVITED = "INVITED", "Invited"
        ATTENDED = "ATTENDED", "Attended"
        BAPTIZED = "BAPTIZED", "Baptized"
        RECEIVED_HG = "RECEIVED_HG", "Received Holy Ghost"

    cluster = models.ForeignKey(
        "clusters.Cluster",
        on_delete=models.CASCADE,
        related_name="monthly_conversion_tracking",
    )
    prospect = models.ForeignKey(
        Prospect,
        on_delete=models.CASCADE,
        related_name="monthly_tracking",
    )
    person = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="monthly_conversion_tracking",
    )
    year = models.IntegerField()
    month = models.IntegerField()
    stage = models.CharField(max_length=20, choices=Stage.choices)
    count = models.IntegerField(default=1)
    first_date_in_stage = models.DateField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("cluster", "prospect", "year", "month", "stage")
        indexes = [
            models.Index(fields=["cluster", "year", "month", "stage"]),
        ]
        ordering = ("-year", "-month", "stage")
        verbose_name = "Monthly Conversion Tracking"
        verbose_name_plural = "Monthly Conversion Tracking"

    def __str__(self):
        return f"{self.cluster.name} - {self.prospect.name} - {self.year}/{self.month:02d} - {self.get_stage_display()}"


class Each1Reach1Goal(models.Model):
    class Status(models.TextChoices):
        IN_PROGRESS = "IN_PROGRESS", "In Progress"
        COMPLETED = "COMPLETED", "Completed"
        NOT_STARTED = "NOT_STARTED", "Not Started"

    cluster = models.ForeignKey(
        "clusters.Cluster",
        on_delete=models.CASCADE,
        related_name="each1reach1_goals",
    )
    year = models.IntegerField()
    target_conversions = models.IntegerField()
    achieved_conversions = models.IntegerField(default=0)
    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.NOT_STARTED
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("cluster", "year")
        ordering = ("-year", "cluster__name")
        verbose_name = "Each 1 Reach 1 Goal"
        verbose_name_plural = "Each 1 Reach 1 Goals"

    @property
    def progress_percentage(self):
        if self.target_conversions == 0:
            return 0.0
        return round((self.achieved_conversions / self.target_conversions) * 100, 2)

    def __str__(self):
        return f"{self.cluster.name} - {self.year} ({self.achieved_conversions}/{self.target_conversions})"

