from django.db import models
from members.models import User

class Ministry(models.Model):
    name = models.CharField(max_length=100)
    description = models.TextField()
    leader = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='ministry_leader')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name

class MinistryMember(models.Model):
    ministry = models.ForeignKey(Ministry, on_delete=models.CASCADE)
    member = models.ForeignKey(User, on_delete=models.CASCADE)
    join_date = models.DateField(auto_now_add=True)
    is_active = models.BooleanField(default=True)
    availability = models.JSONField(default=dict)
    skills = models.TextField(blank=True)
    notes = models.TextField(blank=True)

    class Meta:
        unique_together = ['ministry', 'member']

    def __str__(self):
        return f"{self.member.username} - {self.ministry.name}"
