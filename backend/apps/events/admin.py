from django.contrib import admin

from .models import AttendanceVenue, Event, EventRoom, EventType


@admin.register(EventType)
class EventTypeAdmin(admin.ModelAdmin):
    list_display = ["code", "label", "color", "sort_order", "is_system"]
    ordering = ["sort_order", "code"]
    readonly_fields = ["is_system"]


@admin.register(AttendanceVenue)
class AttendanceVenueAdmin(admin.ModelAdmin):
    list_display = [
        "code",
        "label",
        "color",
        "sort_order",
        "is_active",
        "is_system",
    ]
    list_filter = ["is_active", "is_system"]
    ordering = ["sort_order", "code"]
    readonly_fields = ["is_system"]


@admin.register(EventRoom)
class EventRoomAdmin(admin.ModelAdmin):
    list_display = ["name", "branch", "capacity", "is_active", "sort_order"]
    list_filter = ["branch", "is_active"]
    search_fields = ["name", "notes"]
    ordering = ["branch", "sort_order", "name"]


@admin.register(Event)
class EventAdmin(admin.ModelAdmin):
    list_display = [
        "title",
        "event_type",
        "start_date",
        "booking_status",
        "branch",
        "room",
    ]
    list_filter = ["booking_status", "event_type", "is_recurring"]
    search_fields = ["title", "location"]
