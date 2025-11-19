from django.contrib import admin

from .models import (
    SundaySchoolCategory,
    SundaySchoolClass,
    SundaySchoolClassMember,
    SundaySchoolSession,
)


@admin.register(SundaySchoolCategory)
class SundaySchoolCategoryAdmin(admin.ModelAdmin):
    list_display = ("name", "min_age", "max_age", "order", "is_active", "created_at")
    list_filter = ("is_active",)
    search_fields = ("name", "description")
    ordering = ("order", "name")


@admin.register(SundaySchoolClass)
class SundaySchoolClassAdmin(admin.ModelAdmin):
    list_display = (
        "name",
        "category",
        "yearly_theme",
        "room_location",
        "is_active",
        "created_at",
    )
    list_filter = ("category", "is_active")
    search_fields = ("name", "description", "yearly_theme", "room_location")


@admin.register(SundaySchoolClassMember)
class SundaySchoolClassMemberAdmin(admin.ModelAdmin):
    list_display = (
        "sunday_school_class",
        "person",
        "role",
        "enrolled_date",
        "is_active",
    )
    list_filter = ("role", "is_active", "sunday_school_class__category")
    search_fields = (
        "sunday_school_class__name",
        "person__username",
        "person__first_name",
        "person__last_name",
    )


@admin.register(SundaySchoolSession)
class SundaySchoolSessionAdmin(admin.ModelAdmin):
    list_display = (
        "sunday_school_class",
        "session_date",
        "session_time",
        "lesson_title",
        "event",
        "created_at",
    )
    list_filter = ("sunday_school_class__category", "session_date")
    search_fields = (
        "sunday_school_class__name",
        "lesson_title",
        "notes",
    )
    date_hierarchy = "session_date"

