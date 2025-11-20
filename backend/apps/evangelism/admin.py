from django.contrib import admin

from .models import (
    EvangelismGroup,
    EvangelismGroupMember,
    EvangelismSession,
    EvangelismWeeklyReport,
    Prospect,
    FollowUpTask,
    DropOff,
    Conversion,
    MonthlyConversionTracking,
    Each1Reach1Goal,
)


@admin.register(EvangelismGroup)
class EvangelismGroupAdmin(admin.ModelAdmin):
    list_display = (
        "name",
        "coordinator",
        "cluster",
        "location",
        "meeting_time",
        "is_active",
        "created_at",
    )
    list_filter = ("cluster", "is_active")
    search_fields = ("name", "description", "location", "coordinator__username")
    raw_id_fields = ("coordinator", "cluster")


@admin.register(EvangelismGroupMember)
class EvangelismGroupMemberAdmin(admin.ModelAdmin):
    list_display = (
        "evangelism_group",
        "person",
        "role",
        "joined_date",
        "is_active",
    )
    list_filter = ("role", "is_active", "evangelism_group")
    search_fields = (
        "evangelism_group__name",
        "person__username",
        "person__first_name",
        "person__last_name",
    )
    raw_id_fields = ("person", "evangelism_group")


@admin.register(EvangelismSession)
class EvangelismSessionAdmin(admin.ModelAdmin):
    list_display = (
        "evangelism_group",
        "session_date",
        "session_time",
        "topic",
        "event",
        "created_at",
    )
    list_filter = ("evangelism_group", "session_date")
    search_fields = (
        "evangelism_group__name",
        "topic",
        "notes",
    )
    date_hierarchy = "session_date"
    raw_id_fields = ("evangelism_group", "event")


@admin.register(EvangelismWeeklyReport)
class EvangelismWeeklyReportAdmin(admin.ModelAdmin):
    list_display = (
        "evangelism_group",
        "year",
        "week_number",
        "meeting_date",
        "gathering_type",
        "submitted_by",
        "submitted_at",
    )
    list_filter = ("evangelism_group", "year", "week_number", "gathering_type")
    search_fields = ("evangelism_group__name", "topic", "notes")
    date_hierarchy = "meeting_date"
    raw_id_fields = ("evangelism_group", "submitted_by")
    filter_horizontal = ("members_attended", "visitors_attended")


@admin.register(Prospect)
class ProspectAdmin(admin.ModelAdmin):
    list_display = (
        "name",
        "invited_by",
        "pipeline_stage",
        "last_activity_date",
        "is_dropped_off",
        "created_at",
    )
    list_filter = (
        "pipeline_stage",
        "inviter_cluster",
        "evangelism_group",
        "is_dropped_off",
    )
    search_fields = ("name", "contact_info", "notes")
    date_hierarchy = "last_activity_date"
    raw_id_fields = ("invited_by", "inviter_cluster", "evangelism_group", "endorsed_cluster", "person")


@admin.register(FollowUpTask)
class FollowUpTaskAdmin(admin.ModelAdmin):
    list_display = (
        "prospect",
        "assigned_to",
        "task_type",
        "due_date",
        "status",
        "priority",
        "created_at",
    )
    list_filter = ("status", "priority", "task_type", "assigned_to")
    search_fields = ("prospect__name", "notes")
    date_hierarchy = "due_date"
    raw_id_fields = ("prospect", "assigned_to", "created_by")


@admin.register(DropOff)
class DropOffAdmin(admin.ModelAdmin):
    list_display = (
        "prospect",
        "drop_off_date",
        "drop_off_stage",
        "reason",
        "recovered",
        "created_at",
    )
    list_filter = ("drop_off_stage", "reason", "recovered")
    search_fields = ("prospect__name", "reason_details")
    date_hierarchy = "drop_off_date"
    raw_id_fields = ("prospect",)


@admin.register(Conversion)
class ConversionAdmin(admin.ModelAdmin):
    list_display = (
        "person",
        "converted_by",
        "conversion_date",
        "water_baptism_date",
        "spirit_baptism_date",
        "is_complete",
        "created_at",
    )
    list_filter = ("cluster", "evangelism_group", "is_complete", "conversion_date")
    search_fields = (
        "person__first_name",
        "person__last_name",
        "person__username",
        "converted_by__username",
        "notes",
    )
    date_hierarchy = "conversion_date"
    raw_id_fields = ("person", "prospect", "converted_by", "evangelism_group", "cluster", "verified_by")


@admin.register(MonthlyConversionTracking)
class MonthlyConversionTrackingAdmin(admin.ModelAdmin):
    list_display = (
        "cluster",
        "prospect",
        "year",
        "month",
        "stage",
        "first_date_in_stage",
        "created_at",
    )
    list_filter = ("cluster", "year", "month", "stage")
    search_fields = ("prospect__name",)
    raw_id_fields = ("cluster", "prospect", "person")


@admin.register(Each1Reach1Goal)
class Each1Reach1GoalAdmin(admin.ModelAdmin):
    list_display = (
        "cluster",
        "year",
        "target_conversions",
        "achieved_conversions",
        "status",
        "created_at",
    )
    list_filter = ("cluster", "year", "status")
    search_fields = ("cluster__name",)
    raw_id_fields = ("cluster",)

