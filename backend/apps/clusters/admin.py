from django.contrib import admin
from .models import Cluster, ClusterWeeklyReport, ClusterComplianceNote


@admin.register(Cluster)
class ClusterAdmin(admin.ModelAdmin):
    list_display = ("code", "name", "coordinator", "location", "created_at")
    list_filter = ("created_at",)
    search_fields = ("code", "name", "location")
    filter_horizontal = ("families", "members")
    fieldsets = (
        (
            "Basic Information",
            {
                "fields": (
                    "code",
                    "name",
                    "coordinator",
                    "location",
                    "meeting_schedule",
                    "description",
                )
            },
        ),
        (
            "Relations",
            {
                "fields": (
                    "families",
                    "members",
                )
            },
        ),
        ("Metadata", {"fields": ("created_at",)}),
    )
    readonly_fields = ("created_at",)


@admin.register(ClusterWeeklyReport)
class ClusterWeeklyReportAdmin(admin.ModelAdmin):
    list_display = (
        "cluster",
        "year",
        "week_number",
        "meeting_date",
        "gathering_type",
        "submitted_by",
        "submitted_at",
    )
    list_filter = ("year", "week_number", "gathering_type", "submitted_at")
    search_fields = ("cluster__name", "cluster__code")
    filter_horizontal = ("members_attended", "visitors_attended")
    fieldsets = (
        (
            "Report Information",
            {
                "fields": (
                    "cluster",
                    "year",
                    "week_number",
                    "meeting_date",
                    "gathering_type",
                )
            },
        ),
        (
            "Attendance",
            {
                "fields": (
                    "members_attended",
                    "visitors_attended",
                )
            },
        ),
        (
            "Meeting Details",
            {
                "fields": (
                    "activities_held",
                    "prayer_requests",
                    "testimonies",
                    "offerings",
                )
            },
        ),
        (
            "Summary",
            {
                "fields": (
                    "highlights",
                    "lowlights",
                )
            },
        ),
        (
            "Submission",
            {
                "fields": (
                    "submitted_by",
                    "submitted_at",
                    "updated_at",
                )
            },
        ),
    )
    readonly_fields = ("submitted_at", "updated_at")


@admin.register(ClusterComplianceNote)
class ClusterComplianceNoteAdmin(admin.ModelAdmin):
    list_display = ("cluster", "created_by", "period_start", "period_end", "created_at")
    list_filter = ("created_at", "period_start", "period_end")
    search_fields = ("cluster__name", "cluster__code", "note")
    readonly_fields = ("created_at", "updated_at")
    fieldsets = (
        (
            "Note Information",
            {
                "fields": (
                    "cluster",
                    "note",
                    "created_by",
                )
            },
        ),
        (
            "Period",
            {
                "fields": (
                    "period_start",
                    "period_end",
                )
            },
        ),
        (
            "Metadata",
            {
                "fields": (
                    "created_at",
                    "updated_at",
                )
            },
        ),
    )
