from django.contrib import admin

from .models import Event, EventRoom, EventType


@admin.register(EventType)
class EventTypeAdmin(admin.ModelAdmin):
    list_display = ["code", "label", "color", "sort_order", "is_system"]
    ordering = ["sort_order", "code"]
    readonly_fields = ["is_system"]


@admin.register(EventRoom)
class EventRoomAdmin(admin.ModelAdmin):
    list_display = ["name", "branch", "capacity", "is_active", "sort_order"]
    list_filter = ["branch", "is_active"]
    search_fields = ["name", "notes"]
    ordering = ["branch", "sort_order", "name"]


admin.site.register(Event)
