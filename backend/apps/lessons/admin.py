from django.contrib import admin
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
from .services import reconcile_student_progress_from_reports


@admin.register(Lesson)
class LessonAdmin(admin.ModelAdmin):
    list_display = (
        "title",
        "code",
        "version_label",
        "order",
        "is_latest",
        "is_active",
        "updated_at",
    )
    list_filter = ("is_latest", "is_active", "version_label")
    search_fields = ("title", "code", "version_label")
    ordering = ("order", "title")


@admin.register(LessonJourney)
class LessonJourneyAdmin(admin.ModelAdmin):
    list_display = ("lesson", "journey_type", "updated_at")
    list_filter = ("journey_type",)
    search_fields = ("lesson__title", "lesson__code", "title_template")


@admin.register(PersonLessonProgress)
class PersonLessonProgressAdmin(admin.ModelAdmin):
    list_display = (
        "person",
        "lesson",
        "status",
        "assigned_at",
        "started_at",
        "completed_at",
    )
    list_filter = ("status", "lesson__is_active", "lesson__is_latest")
    search_fields = (
        "person__first_name",
        "person__last_name",
        "person__username",
        "lesson__title",
    )
    autocomplete_fields = ("person", "lesson", "assigned_by", "completed_by")
    ordering = ("lesson__order", "-updated_at")


@admin.register(LessonStudentEnrollment)
class LessonStudentEnrollmentAdmin(admin.ModelAdmin):
    list_display = (
        "student",
        "teacher",
        "commitment_signed",
        "commitment_signed_at",
        "is_active",
        "assigned_at",
    )
    list_filter = ("commitment_signed", "is_active")
    search_fields = (
        "student__first_name",
        "student__last_name",
        "student__username",
        "teacher__first_name",
        "teacher__last_name",
        "teacher__username",
    )
    autocomplete_fields = ("student", "teacher", "assigned_by", "commitment_signed_by")
    ordering = ("student__last_name", "student__first_name")


@admin.register(LessonTeacherTransfer)
class LessonTeacherTransferAdmin(admin.ModelAdmin):
    list_display = (
        "enrollment",
        "from_teacher",
        "to_teacher",
        "transferred_by",
        "created_at",
    )
    list_filter = ("created_at",)
    search_fields = (
        "enrollment__student__first_name",
        "enrollment__student__last_name",
        "from_teacher__first_name",
        "from_teacher__last_name",
        "to_teacher__first_name",
        "to_teacher__last_name",
        "note",
    )
    autocomplete_fields = ("enrollment", "from_teacher", "to_teacher", "transferred_by")
    ordering = ("-created_at",)


@admin.register(LessonSettings)
class LessonSettingsAdmin(admin.ModelAdmin):
    list_display = ("id", "uploaded_by", "updated_at")
    autocomplete_fields = ("uploaded_by",)


@admin.register(LessonSessionReport)
class LessonSessionReportAdmin(admin.ModelAdmin):
    list_display = (
        "student",
        "teacher",
        "session_type",
        "pre_lesson_kind",
        "lesson",
        "session_date",
        "session_start",
    )
    list_filter = ("session_type", "pre_lesson_kind", "session_date")
    search_fields = (
        "student__first_name",
        "student__last_name",
        "student__username",
        "teacher__first_name",
        "teacher__last_name",
        "teacher__username",
        "lesson__title",
        "remarks",
    )
    autocomplete_fields = ("teacher", "student", "lesson", "progress", "submitted_by")
    ordering = ("-session_date", "-session_start")

    def delete_model(self, request, obj):
        student = obj.student
        super().delete_model(request, obj)
        if student:
            reconcile_student_progress_from_reports(student, force_report_rules=True)

    def delete_queryset(self, request, queryset):
        student_ids = list(queryset.values_list("student_id", flat=True).distinct())
        super().delete_queryset(request, queryset)
        for student_id in student_ids:
            if not student_id:
                continue
            student = Person.objects.filter(id=student_id).first()
            if student:
                reconcile_student_progress_from_reports(
                    student, force_report_rules=True
                )
