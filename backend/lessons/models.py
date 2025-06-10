from django.db import models
from members.models import User

class Lesson(models.Model):
    title = models.CharField(max_length=200)
    content = models.TextField()
    order = models.IntegerField()
    duration_minutes = models.IntegerField()
    prerequisites = models.ManyToManyField('self', symmetrical=False, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Lesson {self.order}: {self.title}"

class LessonCompletion(models.Model):
    lesson = models.ForeignKey(Lesson, on_delete=models.CASCADE)
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    completed_date = models.DateTimeField(auto_now_add=True)
    instructor = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='taught_lessons')
    score = models.IntegerField(null=True, blank=True)
    notes = models.TextField(blank=True)

    class Meta:
        unique_together = ['lesson', 'user']

    def __str__(self):
        return f"{self.user.username} - {self.lesson.title}"
