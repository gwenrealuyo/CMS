from __future__ import annotations

from typing import Any, Dict

from django.utils import timezone
from rest_framework import serializers

from apps.people.models import Person

from .models import (
    Lesson,
    LessonJourney,
    LessonSessionReport,
    LessonSettings,
    LessonStudentEnrollment,
    LessonTeacherTransfer,
    PersonLessonProgress,
)
from .services import (
    ensure_lesson_enrollment,
    mark_commitment_signed,
    mark_progress_completed,
    revert_progress_completion,
    transfer_lesson_teacher,
)


class LessonJourneySerializer(serializers.ModelSerializer):
    class Meta:
        model = LessonJourney
        fields = ["journey_type", "title_template", "note_template"]


class LessonSerializer(serializers.ModelSerializer):
    journey_config = LessonJourneySerializer(required=False)

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
            "journey_config",
        ]
        read_only_fields = ["created_at", "updated_at"]

    def create(self, validated_data: Dict[str, Any]) -> Lesson:
        journey_data = validated_data.pop("journey_config", None)
        lesson = super().create(validated_data)
        if journey_data:
            LessonJourney.objects.create(lesson=lesson, **journey_data)
        else:
            LessonJourney.objects.create(lesson=lesson)
        return lesson

    def update(self, instance: Lesson, validated_data: Dict[str, Any]) -> Lesson:
        journey_data = validated_data.pop("journey_config", None)
        lesson = super().update(instance, validated_data)
        if journey_data:
            LessonJourney.objects.update_or_create(lesson=lesson, defaults=journey_data)
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
            "journey",
            "notes",
            "commitment_signed",
            "commitment_signed_at",
            "commitment_signed_by",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "assigned_at",
            "journey",
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
        queryset=Person.objects.exclude(role="VISITOR").exclude(role="ADMIN"),
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
        queryset=Lesson.objects.all(),
        source="lesson",
        write_only=True,
        required=False,
        allow_null=True,
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
            "session_type",
            "pre_lesson_kind",
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
        """Validate session type vs lesson, and next_session_date."""
        instance = getattr(self, "instance", None)
        session_type = attrs.get(
            "session_type",
            instance.session_type if instance else LessonSessionReport.SessionType.LESSON,
        )
        pre_lesson_kind = attrs.get(
            "pre_lesson_kind",
            instance.pre_lesson_kind if instance else None,
        )
        lesson = attrs.get("lesson", instance.lesson if instance else None)
        remarks = attrs.get("remarks", instance.remarks if instance else "")

        if session_type == LessonSessionReport.SessionType.PRE_LESSON:
            if not pre_lesson_kind:
                raise serializers.ValidationError(
                    {"pre_lesson_kind": "Select a pre-lesson type."}
                )
            if lesson is not None:
                raise serializers.ValidationError(
                    {"lesson_id": "Pre-lesson sessions cannot be linked to a lesson."}
                )
            if pre_lesson_kind == LessonSessionReport.PreLessonKind.OTHER and not (
                remarks and remarks.strip()
            ):
                raise serializers.ValidationError(
                    {
                        "remarks": "Add remarks describing this pre-lesson session."
                    }
                )
            attrs["lesson"] = None
            attrs["progress"] = None
        else:
            if pre_lesson_kind:
                raise serializers.ValidationError(
                    {
                        "pre_lesson_kind": "Only pre-lesson sessions may set a pre-lesson type."
                    }
                )
            if lesson is None:
                raise serializers.ValidationError(
                    {"lesson_id": "Select the lesson covered in this session."}
                )
            attrs["pre_lesson_kind"] = None

        session_date = attrs.get("session_date")
        next_session_date = attrs.get("next_session_date")

        if session_date and next_session_date:
            if next_session_date <= session_date:
                raise serializers.ValidationError(
                    {
                        "next_session_date": "Next session date must be after the scheduled session date."
                    }
                )

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


class LessonStudentEnrollmentSerializer(serializers.ModelSerializer):
    student = PersonNestedSerializer(read_only=True)
    student_id = serializers.PrimaryKeyRelatedField(
        queryset=Person.objects.all(),
        source="student",
        write_only=True,
    )
    teacher = PersonNestedSerializer(read_only=True)
    teacher_id = serializers.PrimaryKeyRelatedField(
        queryset=Person.objects.exclude(role="VISITOR").exclude(role="ADMIN"),
        source="teacher",
        write_only=True,
    )

    class Meta:
        model = LessonStudentEnrollment
        fields = [
            "id",
            "student",
            "student_id",
            "teacher",
            "teacher_id",
            "is_active",
            "assigned_at",
            "updated_at",
        ]
        read_only_fields = ["assigned_at", "updated_at"]

    def create(self, validated_data: Dict[str, Any]) -> LessonStudentEnrollment:
        request = self.context.get("request")
        assigned_by = (
            request.user if request and isinstance(request.user, Person) else None
        )
        student = validated_data["student"]
        teacher = validated_data["teacher"]
        if LessonStudentEnrollment.objects.filter(student=student).exists():
            raise serializers.ValidationError(
                {"student_id": "This student already has a lessons teacher assigned."}
            )
        return ensure_lesson_enrollment(
            student,
            teacher,
            assigned_by=assigned_by,
        )


class LessonTeacherTransferSerializer(serializers.ModelSerializer):
    from_teacher = PersonNestedSerializer(read_only=True)
    to_teacher = PersonNestedSerializer(read_only=True)
    transferred_by = PersonNestedSerializer(read_only=True)

    class Meta:
        model = LessonTeacherTransfer
        fields = [
            "id",
            "from_teacher",
            "to_teacher",
            "transferred_by",
            "note",
            "created_at",
        ]
        read_only_fields = fields


class LessonTeacherTransferRequestSerializer(serializers.Serializer):
    teacher_id = serializers.PrimaryKeyRelatedField(
        queryset=Person.objects.exclude(role="VISITOR").exclude(role="ADMIN"),
        source="teacher",
    )
    note = serializers.CharField(required=False, allow_blank=True, default="")

    def validate(self, attrs: Dict[str, Any]) -> Dict[str, Any]:
        enrollment: LessonStudentEnrollment = self.context["enrollment"]
        teacher = attrs.get("teacher")
        if teacher and enrollment.teacher_id == teacher.id:
            raise serializers.ValidationError(
                {"teacher_id": "This student is already assigned to that teacher."}
            )
        return attrs

    def create(self, validated_data: Dict[str, Any]) -> LessonTeacherTransfer:
        enrollment: LessonStudentEnrollment = self.context["enrollment"]
        request = self.context.get("request")
        transferred_by = (
            request.user if request and isinstance(request.user, Person) else None
        )
        return transfer_lesson_teacher(
            enrollment,
            validated_data["teacher"],
            transferred_by=transferred_by,
            note=validated_data.get("note") or "",
        )


class LessonBulkAssignSerializer(serializers.Serializer):
    lesson_id = serializers.PrimaryKeyRelatedField(
        queryset=Lesson.objects.all(), source="lesson"
    )
    person_ids = serializers.PrimaryKeyRelatedField(
        queryset=Person.objects.all(), many=True, source="persons"
    )
    teacher_id = serializers.PrimaryKeyRelatedField(
        queryset=Person.objects.exclude(role="VISITOR").exclude(role="ADMIN"),
        source="teacher",
        required=False,
        allow_null=True,
    )

    def validate(self, attrs: Dict[str, Any]) -> Dict[str, Any]:
        persons = attrs.get("persons") or []
        teacher = attrs.get("teacher")
        needs_teacher = [
            person
            for person in persons
            if not LessonStudentEnrollment.objects.filter(student=person).exists()
        ]
        if needs_teacher and not teacher:
            raise serializers.ValidationError(
                {
                    "teacher_id": (
                        "Teacher is required when assigning lessons to students "
                        "who do not yet have a lessons teacher."
                    )
                }
            )
        return attrs
