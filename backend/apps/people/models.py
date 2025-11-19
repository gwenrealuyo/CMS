from django.db import models
from django.contrib.auth.models import AbstractUser, Group, Permission


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
            ("EVENT_ATTENDANCE", "Event Attendance"),
        ],
    )
    description = models.TextField(blank=True)
    verified_by = models.ForeignKey(
        Person, on_delete=models.SET_NULL, null=True, related_name="verified_milestones"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user.username} - {self.type} - {self.date}"
