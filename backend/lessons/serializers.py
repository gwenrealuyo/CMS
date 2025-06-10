from rest_framework import serializers
from .models import Lesson, LessonCompletion

class LessonSerializer(serializers.ModelSerializer):
    class Meta:
        model = Lesson
        fields = ['id', 'title', 'content', 'order', 'created_at']

class LessonCompletionSerializer(serializers.ModelSerializer):
    class Meta:
        model = LessonCompletion
        fields = ['id', 'user', 'lesson', 'completion_date', 'notes']
