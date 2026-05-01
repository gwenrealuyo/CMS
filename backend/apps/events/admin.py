from django.contrib import admin

from .models import Event, EventType


@admin.register(EventType)
class EventTypeAdmin(admin.ModelAdmin):
    list_display = ["code", "label", "sort_order"]
    ordering = ["sort_order", "code"]


admin.site.register(Event)
