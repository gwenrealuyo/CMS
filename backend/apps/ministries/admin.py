from django.contrib import admin

from .models import Ministry, MinistryMember


@admin.register(Ministry)
class MinistryAdmin(admin.ModelAdmin):
    list_display = (
        "name",
        "primary_coordinator",
        "activity_cadence",
        "is_active",
        "created_at",
    )
    list_filter = ("activity_cadence", "is_active", "category")
    search_fields = ("name", "description")
    filter_horizontal = ("support_coordinators",)


@admin.register(MinistryMember)
class MinistryMemberAdmin(admin.ModelAdmin):
    list_display = (
        "ministry",
        "member",
        "role",
        "join_date",
        "is_active",
    )
    list_filter = ("role", "is_active")
    search_fields = ("ministry__name", "member__username", "member__first_name", "member__last_name")
