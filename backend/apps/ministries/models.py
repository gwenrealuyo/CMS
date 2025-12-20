from django.db import models
from django.conf import settings
from django.utils import timezone


def today():
    """Return today's date (not datetime) for DateField defaults."""
    return timezone.now().date()


class MinistryCategory(models.TextChoices):
    WORSHIP = "worship", "Worship"
    OUTREACH = "outreach", "Outreach"
    CARE = "care", "Care"
    LOGISTICS = "logistics", "Logistics"
    OTHER = "other", "Other"


class MinistryCadence(models.TextChoices):
    WEEKLY = "weekly", "Weekly"
    MONTHLY = "monthly", "Monthly"
    SEASONAL = "seasonal", "Seasonal"
    EVENT_DRIVEN = "event_driven", "Event Driven"
    HOLIDAY = "holiday", "Holiday"
    AD_HOC = "ad_hoc", "Ad Hoc"


class Ministry(models.Model):
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    category = models.CharField(
        max_length=30,
        choices=MinistryCategory.choices,
        blank=True,
    )
    activity_cadence = models.CharField(
        max_length=30,
        choices=MinistryCadence.choices,
        default=MinistryCadence.WEEKLY,
    )
    primary_coordinator = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="ministries_primary",
    )
    support_coordinators = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        blank=True,
        related_name="ministries_supporting",
    )
    branch = models.ForeignKey(
        "people.Branch",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="ministries",
    )
    meeting_location = models.CharField(max_length=255, blank=True)
    meeting_schedule = models.JSONField(blank=True, null=True)
    communication_channel = models.URLField(blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name_plural = "Ministries"
        ordering = ("name",)

    def __str__(self) -> str:
        return self.name


class MinistryRole(models.TextChoices):
    PRIMARY_COORDINATOR = "primary_coordinator", "Primary Coordinator"
    COORDINATOR = "coordinator", "Coordinator"
    TEAM_MEMBER = "team_member", "Team Member"
    GUEST_HELPER = "guest_helper", "Guest Helper"


class MinistryMember(models.Model):
    ministry = models.ForeignKey(
        Ministry,
        on_delete=models.CASCADE,
        related_name="memberships",
    )
    member = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="ministry_memberships",
    )
    role = models.CharField(
        max_length=30,
        choices=MinistryRole.choices,
        default=MinistryRole.TEAM_MEMBER,
    )
    join_date = models.DateField(default=today)
    is_active = models.BooleanField(default=True)
    availability = models.JSONField(default=dict, blank=True)
    skills = models.TextField(blank=True)
    notes = models.TextField(blank=True)

    class Meta:
        unique_together = ("ministry", "member")
        ordering = ("ministry", "member")

    def __str__(self) -> str:
        return f"{self.member} – {self.ministry}"
