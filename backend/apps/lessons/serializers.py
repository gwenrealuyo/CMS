from __future__ import annotations

from typing import Any, Dict

from django.utils import timezone
from rest_framework import serializers

from apps.people.models import Person

from .models import (
    Lesson,
    LessonMilestone,
    LessonSessionReport,
    LessonSettings,
    PersonLessonProgress,
)
from .services import (
    mark_commitment_signed,
    mark_progress_completed,
    revert_progress_completion,
)


class LessonMilestoneSerializer(serializers.ModelSerializer):
    class Meta:
        model = LessonMilestone
        fields = ["milestone_type", "title_template", "note_template"]


class LessonSerializer(serializers.ModelSerializer):
    milestone_config = LessonMilestoneSerializer(required=False)

    class Meta:
        model = Lesson
        fields = [
            "id",
            "code",
            "version_label",
            "title",
            "summary",
            "outline",
            "order",
            "is_latest",
            "is_active",
            "created_at",
            "updated_at",
            "milestone_config",
        ]
        read_only_fields = ["created_at", "updated_at"]

    def create(self, validated_data: Dict[str, Any]) -> Lesson:
        milestone_data = validated_data.pop("milestone_config", None)
        lesson = super().create(validated_data)
        if milestone_data:
            LessonMilestone.objects.create(lesson=lesson, **milestone_data)
        else:
            LessonMilestone.objects.create(lesson=lesson)
        return lesson

    def update(self, instance: Lesson, validated_data: Dict[str, Any]) -> Lesson:
        milestone_data = validated_data.pop("milestone_config", None)
        lesson = super().update(instance, validated_data)
        if milestone_data:
            LessonMilestone.objects.update_or_create(
                lesson=lesson, defaults=milestone_data
            )
        return lesson


class PersonNestedSerializer(serializers.ModelSerializer):
    class Meta:
        model = Person
        fields = [
            "id",
            "first_name",
            "middle_name",
            "last_name",
            "suffix",
            "username",
            "member_id",
        ]


class PersonLessonProgressSerializer(serializers.ModelSerializer):
    person = PersonNestedSerializer(read_only=True)
    person_id = serializers.PrimaryKeyRelatedField(
        queryset=Person.objects.all(), source="person", write_only=True, required=False
    )
    lesson = LessonSerializer(read_only=True)
    lesson_id = serializers.PrimaryKeyRelatedField(
        queryset=Lesson.objects.all(), source="lesson", write_only=True, required=False
    )

    class Meta:
        model = PersonLessonProgress
        fields = [
            "id",
            "person",
            "person_id",
            "lesson",
            "lesson_id",
            "status",
            "assigned_at",
            "assigned_by",
            "started_at",
            "completed_at",
            "completed_by",
            "milestone",
            "notes",
            "commitment_signed",
            "commitment_signed_at",
            "commitment_signed_by",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "assigned_at",
            "milestone",
            "commitment_signed_at",
            "commitment_signed_by",
            "created_at",
            "updated_at",
        ]

    def update(
        self, instance: PersonLessonProgress, validated_data: Dict[str, Any]
    ) -> PersonLessonProgress:
        status_before = instance.status
        commitment_signed_before = instance.commitment_signed
        instance = super().update(instance, validated_data)

        status_after = instance.status
        if status_after == PersonLessonProgress.Status.COMPLETED:
            note = validated_data.get("notes")
            completed_by = validated_data.get("completed_by", instance.completed_by)
            completed_at = (
                validated_data.get("completed_at")
                or instance.completed_at
                or timezone.now()
            )
            mark_progress_completed(
                instance,
                completed_by=completed_by,
                note=note,
                completed_at=completed_at,
            )
        elif status_after != PersonLessonProgress.Status.COMPLETED:
            revert_progress_completion(instance, previous_status=status_before)

        commitment_signed_after = instance.commitment_signed
        request = self.context.get("request")
        updated_fields = []

        if commitment_signed_after and not commitment_signed_before:
            signed_by = (
                request.user if request and isinstance(request.user, Person) else None
            )
            mark_commitment_signed(
                instance,
                signed_by=signed_by,
                signed_at=instance.commitment_signed_at or timezone.now(),
                note=validated_data.get("notes"),
            )
        elif not commitment_signed_after and commitment_signed_before:
            instance.commitment_signed_at = None
            instance.commitment_signed_by = None
            updated_fields.extend(["commitment_signed_at", "commitment_signed_by"])

        return instance


class LessonSessionReportSerializer(serializers.ModelSerializer):
    teacher = PersonNestedSerializer(read_only=True)
    teacher_id = serializers.PrimaryKeyRelatedField(
        queryset=Person.objects.exclude(role="VISITOR"),
        source="teacher",
        required=False,
        write_only=True,
    )
    student = PersonNestedSerializer(read_only=True)
    student_id = serializers.PrimaryKeyRelatedField(
        queryset=Person.objects.all(), source="student", write_only=True
    )
    lesson = LessonSerializer(read_only=True)
    lesson_id = serializers.PrimaryKeyRelatedField(
        queryset=Lesson.objects.all(), source="lesson", write_only=True
    )
    progress = serializers.PrimaryKeyRelatedField(read_only=True)
    progress_id = serializers.PrimaryKeyRelatedField(
        queryset=PersonLessonProgress.objects.all(),
        source="progress",
        required=False,
        allow_null=True,
        write_only=True,
    )

    class Meta:
        model = LessonSessionReport
        fields = [
            "id",
            "teacher",
            "teacher_id",
            "student",
            "student_id",
            "lesson",
            "lesson_id",
            "progress",
            "progress_id",
            "session_date",
            "session_start",
            "score",
            "next_session_date",
            "remarks",
            "submitted_by",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "teacher",
            "student",
            "lesson",
            "progress",
            "submitted_by",
            "created_at",
            "updated_at",
        ]

    def validate_teacher_id(self, value):
        """Ensure teacher is not a VISITOR."""
        if value and value.role == "VISITOR":
            raise serializers.ValidationError("Teacher cannot be a visitor.")
        return value

    def validate(self, attrs):
        """Validate that next_session_date is after session_date."""
        session_date = attrs.get("session_date")
        next_session_date = attrs.get("next_session_date")
        
        if session_date and next_session_date:
            if next_session_date <= session_date:
                raise serializers.ValidationError({
                    "next_session_date": "Next session date must be after the session date."
                })
        
        return attrs



class LessonSettingsSerializer(serializers.ModelSerializer):
    commitment_form_url = serializers.SerializerMethodField()

    class Meta:
        model = LessonSettings
        fields = [
            "id",
            "commitment_form",
            "commitment_form_url",
            "uploaded_by",
            "updated_at",
        ]
        read_only_fields = ["id", "commitment_form_url", "uploaded_by", "updated_at"]

    def get_commitment_form_url(self, obj: LessonSettings) -> str | None:
        request = self.context.get("request")
        if obj.commitment_form and request:
            return request.build_absolute_uri(obj.commitment_form.url)
        if obj.commitment_form:
            return obj.commitment_form.url
        return None

    def update(self, instance: LessonSettings, validated_data: Dict[str, Any]):
        request = self.context.get("request")
        uploaded_by = (
            request.user if request and isinstance(request.user, Person) else None
        )
        instance.commitment_form = validated_data.get(
            "commitment_form", instance.commitment_form
        )
        instance.uploaded_by = uploaded_by
        instance.save(update_fields=["commitment_form", "uploaded_by", "updated_at"])
        return instance


class LessonCompletionSerializer(serializers.Serializer):
    note = serializers.CharField(required=False, allow_blank=True)
    completed_at = serializers.DateTimeField(required=False)
    completed_by = serializers.PrimaryKeyRelatedField(
        queryset=Person.objects.all(), required=False
    )


class LessonBulkAssignSerializer(serializers.Serializer):
    lesson_id = serializers.PrimaryKeyRelatedField(
        queryset=Lesson.objects.all(), source="lesson"
    )
    person_ids = serializers.PrimaryKeyRelatedField(
        queryset=Person.objects.all(), many=True, source="persons"
    )
