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
    families = models.ManyToManyField(Family)
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name


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
