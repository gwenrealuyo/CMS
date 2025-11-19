from __future__ import annotations

from typing import Any, Dict, List

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import serializers

from apps.events.models import Event
from apps.people.models import Person

from .models import (
    SundaySchoolCategory,
    SundaySchoolClass,
    SundaySchoolClassMember,
    SundaySchoolSession,
)

User = get_user_model()


class PersonSummarySerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()

    class Meta:
        model = Person
        fields = (
            "id",
            "username",
            "first_name",
            "middle_name",
            "last_name",
            "suffix",
            "nickname",
            "full_name",
            "date_of_birth",
            "status",
        )

    def get_full_name(self, obj):
        """Format name with middle initial, nickname, and suffix."""
        parts = []
        
        # First name
        if obj.first_name:
            parts.append(obj.first_name.strip())
        
        # Nickname in quotes
        if obj.nickname:
            parts.append(f'"{obj.nickname.strip()}"')
        
        # Middle initial
        if obj.middle_name:
            middle_initial = obj.middle_name.strip()[0].upper() if obj.middle_name.strip() else ""
            if middle_initial:
                parts.append(f"{middle_initial}.")
        
        # Last name
        if obj.last_name:
            parts.append(obj.last_name.strip())
        
        # Suffix
        if obj.suffix:
            parts.append(obj.suffix.strip())
        
        name = " ".join(parts).strip()
        return name or obj.username


class SundaySchoolCategorySerializer(serializers.ModelSerializer):
    age_range_display = serializers.SerializerMethodField()

    class Meta:
        model = SundaySchoolCategory
        fields = (
            "id",
            "name",
            "description",
            "min_age",
            "max_age",
            "age_range_display",
            "order",
            "is_active",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("created_at", "updated_at")

    def get_age_range_display(self, obj):
        if obj.min_age is not None and obj.max_age is not None:
            return f"{obj.min_age}-{obj.max_age}"
        elif obj.min_age is not None:
            return f"{obj.min_age}+"
        return ""


class SundaySchoolClassMemberSerializer(serializers.ModelSerializer):
    person = PersonSummarySerializer(read_only=True)
    person_id = serializers.PrimaryKeyRelatedField(
        source="person",
        queryset=Person.objects.all(),
        write_only=True,
    )
    role_display = serializers.CharField(source="get_role_display", read_only=True)

    class Meta:
        model = SundaySchoolClassMember
        fields = (
            "id",
            "sunday_school_class",
            "person",
            "person_id",
            "role",
            "role_display",
            "enrolled_date",
            "is_active",
            "notes",
        )
        read_only_fields = ("enrolled_date",)


class SundaySchoolClassSerializer(serializers.ModelSerializer):
    category = SundaySchoolCategorySerializer(read_only=True)
    category_id = serializers.PrimaryKeyRelatedField(
        source="category",
        queryset=SundaySchoolCategory.objects.all(),
        write_only=True,
    )
    members = SundaySchoolClassMemberSerializer(many=True, read_only=True)
    members_count = serializers.SerializerMethodField()
    students_count = serializers.SerializerMethodField()
    teachers_count = serializers.SerializerMethodField()

    class Meta:
        model = SundaySchoolClass
        fields = (
            "id",
            "name",
            "category",
            "category_id",
            "description",
            "yearly_theme",
            "room_location",
            "meeting_time",
            "is_active",
            "created_at",
            "updated_at",
            "members",
            "members_count",
            "students_count",
            "teachers_count",
        )
        read_only_fields = ("created_at", "updated_at")

    def get_members_count(self, obj):
        return obj.members.filter(is_active=True).count()

    def get_students_count(self, obj):
        return obj.members.filter(is_active=True, role=SundaySchoolClassMember.Role.STUDENT).count()

    def get_teachers_count(self, obj):
        return obj.members.filter(
            is_active=True,
            role__in=[
                SundaySchoolClassMember.Role.TEACHER,
                SundaySchoolClassMember.Role.ASSISTANT_TEACHER,
            ],
        ).count()


class SundaySchoolBulkEnrollSerializer(serializers.Serializer):
    person_ids = serializers.ListField(
        child=serializers.IntegerField(),
        min_length=1,
    )
    role = serializers.ChoiceField(choices=SundaySchoolClassMember.Role.choices)
    class_id = serializers.IntegerField()


class SundaySchoolSessionSerializer(serializers.ModelSerializer):
    sunday_school_class = SundaySchoolClassSerializer(read_only=True)
    sunday_school_class_id = serializers.PrimaryKeyRelatedField(
        source="sunday_school_class",
        queryset=SundaySchoolClass.objects.all(),
        write_only=True,
    )
    event_id = serializers.IntegerField(source="event.id", read_only=True)

    class Meta:
        model = SundaySchoolSession
        fields = (
            "id",
            "sunday_school_class",
            "sunday_school_class_id",
            "event",
            "event_id",
            "session_date",
            "session_time",
            "lesson_title",
            "notes",
            "is_recurring_instance",
            "recurring_group_id",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("event", "created_at", "updated_at")

    def create(self, validated_data):
        session = super().create(validated_data)
        # Event creation will be handled in the view's perform_create
        return session


class SundaySchoolRecurringSessionSerializer(serializers.Serializer):
    sunday_school_class_id = serializers.IntegerField()
    start_date = serializers.DateField()
    end_date = serializers.DateField(required=False, allow_null=True)
    num_occurrences = serializers.IntegerField(required=False, min_value=1, max_value=52)
    recurrence_pattern = serializers.ChoiceField(
        choices=[
            ("weekly", "Weekly"),
            ("bi_weekly", "Bi-weekly"),
            ("monthly", "Monthly"),
        ]
    )
    day_of_week = serializers.IntegerField(
        required=False, min_value=0, max_value=6, help_text="0=Monday, 6=Sunday"
    )
    default_lesson_title = serializers.CharField(required=False, allow_blank=True, max_length=200)

    def validate(self, attrs):
        if not attrs.get("end_date") and not attrs.get("num_occurrences"):
            raise serializers.ValidationError(
                "Either end_date or num_occurrences must be provided."
            )
        if attrs.get("recurrence_pattern") == "weekly" and attrs.get("day_of_week") is None:
            raise serializers.ValidationError("day_of_week is required for weekly recurrence.")
        return attrs


class SundaySchoolUnenrolledPersonSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    full_name = serializers.CharField()
    first_name = serializers.CharField(allow_blank=True, allow_null=True)
    middle_name = serializers.CharField(allow_blank=True, allow_null=True, required=False)
    last_name = serializers.CharField(allow_blank=True, allow_null=True)
    suffix = serializers.CharField(allow_blank=True, allow_null=True, required=False)
    age = serializers.IntegerField()
    date_of_birth = serializers.DateField(allow_null=True, required=False)
    status = serializers.CharField(allow_blank=True, allow_null=True, required=False)
    cluster_info = serializers.CharField(allow_blank=True, required=False)
    family_names = serializers.CharField(allow_blank=True, required=False)


class SundaySchoolUnenrolledByCategorySerializer(serializers.Serializer):
    category_id = serializers.IntegerField()
    category_name = serializers.CharField()
    age_range = serializers.CharField()
    unenrolled_count = serializers.IntegerField()
    unenrolled_people = SundaySchoolUnenrolledPersonSerializer(many=True)


class SundaySchoolSummarySerializer(serializers.Serializer):
    total_classes = serializers.IntegerField()
    active_classes = serializers.IntegerField()
    inactive_classes = serializers.IntegerField()
    total_students = serializers.IntegerField()
    total_teachers = serializers.IntegerField()
    average_attendance_rate = serializers.FloatField(allow_null=True)
    most_attended_classes = serializers.ListField(required=False)
    least_attended_classes = serializers.ListField(required=False)


class SundaySchoolAttendanceReportSerializer(serializers.Serializer):
    session_id = serializers.IntegerField()
    session_date = serializers.DateField()
    lesson_title = serializers.CharField(allow_blank=True)
    total_enrolled = serializers.IntegerField()
    present_count = serializers.IntegerField()
    absent_count = serializers.IntegerField()
    excused_count = serializers.IntegerField()
    attendance_rate = serializers.FloatField()

