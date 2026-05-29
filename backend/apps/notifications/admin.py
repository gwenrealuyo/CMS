from django.contrib import admin

from .models import NotificationDismissal


@admin.register(NotificationDismissal)
class NotificationDismissalAdmin(admin.ModelAdmin):
    list_display = ("user", "notification_key", "dismissed_at")
    list_filter = ("dismissed_at",)
    search_fields = ("notification_key", "user__username")
