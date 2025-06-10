from django.db import models
from django.contrib.auth.models import AbstractUser, Group, Permission

class User(AbstractUser):
    photo = models.ImageField(upload_to='profiles/', null=True, blank=True)
    role = models.CharField(max_length=20, choices=[
        ('MEMBER', 'Member'),
        ('VISITOR', 'Visitor'),
        ('LEADER', 'Leader'),
        ('PASTOR', 'Pastor'),
        ('ADMIN', 'Admin'),
    ])
    phone = models.CharField(max_length=20, blank=True)
    address = models.TextField(blank=True)
    date_of_birth = models.DateField(null=True, blank=True)

     # Fixing the reverse accessor clashes
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
    date = models.DateField()
    type = models.CharField(max_length=20, choices=[
        ('LESSON', 'Lesson'),
        ('BAPTISM', 'Baptism'),
        ('MEMBERSHIP', 'Membership'),
    ])
    description = models.TextField()
    verified_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='verified_milestones')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user.username} - {self.type} - {self.date}"
