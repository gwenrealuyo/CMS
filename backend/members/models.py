from django.db import models
from django.contrib.auth.models import AbstractUser, Group, Permission

class User(AbstractUser):
    middle_name = models.CharField(blank=True, max_length=150, verbose_name='middle_name')
    suffix = models.CharField(blank=True, max_length=150, verbose_name='suffix')
    gender = models.CharField(blank=True, max_length=20, choices=[
        ('MALE', 'Male'),
        ('FEMALE', 'Female'),
    ])
    facebook_name = models.CharField(blank=True, max_length=150, verbose_name='facebook_name')
    photo = models.ImageField(upload_to='profiles/', null=True, blank=True)
    role = models.CharField(max_length=20, choices=[
        ('MEMBER', 'Member'),
        ('VISITOR', 'Visitor'),
        ('COORDINATOR', 'Coordinator'),
        ('PASTOR', 'Pastor'),
        ('ADMIN', 'Admin'),
    ])
    phone = models.CharField(max_length=20, blank=True)
    address = models.TextField(blank=True)
    country = models.CharField(max_length=20, blank=True)
    date_of_birth = models.DateField(null=True, blank=True)
    date_first_attended = models.DateField(null=True, blank=True)
    inviter = models.ForeignKey("self", null=True, blank=True, on_delete=models.SET_NULL, related_name="person_inviter")
    member_id = models.CharField(max_length=20, blank=True)
    status = models.CharField(blank=True, max_length=20, choices=[
        ('ACTIVE', 'Active'),
        ('SEMIACTIVE', 'Semiactive'),
        ('INACTIVE', 'Inactive'),
        ('DECEASED', 'Deceased'),
    ])

    groups = models.ManyToManyField(
        Group,
        related_name="members_user_set",  # Custom related_name for reverse relation
        blank=True
    )
    user_permissions = models.ManyToManyField(
        Permission,
        related_name="members_user_permissions",  # Custom related_name for reverse relation
        blank=True
    )

class Family(models.Model):
    name = models.CharField(max_length=100)
    leader = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='family_leader')
    members = models.ManyToManyField(User, related_name='family_members')
    address = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name
    
    class Meta:
        verbose_name_plural = "Families"

class Cluster(models.Model):
    name = models.CharField(max_length=100)
    leader = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    families = models.ManyToManyField(Family)
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name

class Milestone(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    title = models.CharField(blank=True, max_length=100)
    date = models.DateField()
    type = models.CharField(max_length=20, choices=[
        ('LESSON', 'Lesson'),
        ('BAPTISM', 'Baptism'),
        ('SPIRIT', 'Spirit'),
        ('CLUSTER', 'Cluster'),
        ('NOTE', 'Note'),
    ])
    description = models.TextField(blank=True)
    verified_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='verified_milestones')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user.username} - {self.type} - {self.date}"
