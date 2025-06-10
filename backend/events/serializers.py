from rest_framework import serializers
from .models import Event, Attendance

class AttendanceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Attendance
        fields = ['id', 'user', 'event', 'check_in_time', 'check_in_method']

class EventSerializer(serializers.ModelSerializer):
    attendance_count = serializers.SerializerMethodField()

    class Meta:
        model = Event
        fields = ['id', 'title', 'description', 'start_date', 'end_date', 
                 'event_type', 'is_recurring', 'recurrence_pattern', 
                 'volunteers', 'attendance_count']

    def get_attendance_count(self, obj):
        return obj.attendance_set.count()
