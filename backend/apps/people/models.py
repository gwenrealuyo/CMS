from django.db import models
from django.contrib.auth.models import AbstractUser, Group, Permission


class Branch(models.Model):
    """Represents a church branch/location"""

    name = models.CharField(max_length=200)
    code = models.CharField(
        max_length=50,
        unique=True,
        blank=True,
        null=True,
        help_text="Short code for the branch (e.g., 'HQ', 'BRANCH1')",
    )
    address = models.TextField(blank=True)
    phone = models.CharField(max_length=20, blank=True)
    email = models.EmailField(blank=True)
    is_headquarters = models.BooleanField(
        default=False, help_text="Mark this branch as the headquarters"
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name_plural = "Branches"
        ordering = ["name"]
        indexes = [
            models.Index(fields=["is_headquarters"]),
            models.Index(fields=["is_active"]),
        ]

    def __str__(self):
        return self.name


class Person(AbstractUser):
    middle_name = models.CharField(blank=True, max_length=150)
    suffix = models.CharField(blank=True, max_length=150)
    nickname = models.CharField(blank=True, max_length=150)
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
    has_finished_lessons = models.BooleanField(default=False)
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
    branch = models.ForeignKey(
        Branch,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="members",
        help_text="The church branch this person belongs to",
    )
    member_id = models.CharField(max_length=20, blank=True)  # LAMP ID
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
    must_change_password = models.BooleanField(default=False)
    first_login = models.BooleanField(default=True)

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

    def can_see_all_branches(self):
        """
        Check if this user can see all branches.
        Returns True for:
        - ADMIN users
        - PASTOR users from headquarters branch
        """
        if self.role == "ADMIN":
            return True
        if self.role == "PASTOR" and self.branch and self.branch.is_headquarters:
            return True
        return False

    def is_module_coordinator(self, module_type, level=None, resource_id=None):
        """Check if user is a coordinator for a specific module"""
        queryset = self.module_coordinator_assignments.filter(module=module_type)
        if level:
            queryset = queryset.filter(level=level)
        if resource_id is not None:
            queryset = queryset.filter(resource_id=resource_id)
        return queryset.exists()

    def is_senior_coordinator(self, module_type=None):
        """Check if user is a senior coordinator (optionally for a specific module)"""
        queryset = self.module_coordinator_assignments.filter(
            level=ModuleCoordinator.CoordinatorLevel.SENIOR_COORDINATOR
        )
        if module_type:
            queryset = queryset.filter(module=module_type)
        return queryset.exists()


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


class Journey(models.Model):
    user = models.ForeignKey(Person, on_delete=models.CASCADE, related_name="journeys")
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
            ("EVENT_ATTENDANCE", "Event Attendance"),
            ("MINISTRY", "Ministry"),
            ("BRANCH_TRANSFER", "Branch Transfer"),
        ],
    )
    description = models.TextField(blank=True)
    verified_by = models.ForeignKey(
        Person, on_delete=models.SET_NULL, null=True, related_name="verified_journeys"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user.username} - {self.type} - {self.date}"


class ModuleCoordinator(models.Model):
    """Tracks which users have coordinator access to specific modules"""

    class ModuleType(models.TextChoices):
        CLUSTER = "CLUSTER", "Cluster"
        FINANCE = "FINANCE", "Finance"
        EVANGELISM = "EVANGELISM", "Evangelism"
        SUNDAY_SCHOOL = "SUNDAY_SCHOOL", "Sunday School"
        LESSONS = "LESSONS", "Lessons"
        EVENTS = "EVENTS", "Events"
        MINISTRIES = "MINISTRIES", "Ministries"

    class CoordinatorLevel(models.TextChoices):
        COORDINATOR = "COORDINATOR", "Coordinator"  # Limited to assigned resources
        SENIOR_COORDINATOR = (
            "SENIOR_COORDINATOR",
            "Senior Coordinator",
        )  # Full module access
        TEACHER = "TEACHER", "Teacher"  # For Sunday School/Lessons
        BIBLE_SHARER = "BIBLE_SHARER", "Bible Sharer"  # For Evangelism

    person = models.ForeignKey(
        Person, on_delete=models.CASCADE, related_name="module_coordinator_assignments"
    )
    module = models.CharField(max_length=50, choices=ModuleType.choices)
    level = models.CharField(max_length=50, choices=CoordinatorLevel.choices)
    resource_id = models.IntegerField(
        null=True,
        blank=True,
        help_text="For resource-specific assignments (e.g., specific cluster ID)",
    )
    resource_type = models.CharField(
        max_length=50,
        blank=True,
        help_text="Type of resource (e.g., 'Cluster', 'EvangelismGroup')",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [("person", "module", "resource_id")]
        indexes = [
            models.Index(fields=["person", "module"]),
        ]
        verbose_name = "Module Coordinator"
        verbose_name_plural = "Module Coordinators"
        ordering = ["person", "module", "level"]

    def __str__(self):
        resource_info = (
            f" ({self.resource_type}#{self.resource_id})" if self.resource_id else ""
        )
        return f"{self.person.username} - {self.get_module_display()} {self.get_level_display()}{resource_info}"
