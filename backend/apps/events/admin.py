from django.contrib import admin

from .models import Event, EventType


@admin.register(EventType)
class EventTypeAdmin(admin.ModelAdmin):
    list_display = ["code", "label", "color", "sort_order", "is_system"]
    ordering = ["sort_order", "code"]
    readonly_fields = ["is_system"]


admin.site.register(Event)
