from django.contrib import admin

from .models import AttendanceRecord


@admin.register(AttendanceRecord)
class AttendanceRecordAdmin(admin.ModelAdmin):
    list_display = (
        "event",
        "person",
        "occurrence_date",
        "status",
        "recorded_at",
    )
    list_filter = ("status", "occurrence_date", "event__type")
    search_fields = (
        "event__title",
        "person__username",
        "person__first_name",
        "person__last_name",
    )
    ordering = ("-occurrence_date", "-recorded_at")


