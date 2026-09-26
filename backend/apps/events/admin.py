from django.contrib import admin

from .models import (
    AttendanceVenue,
    Event,
    EventRegistration,
    EventRegistrationPayment,
    EventRegistrationTier,
    EventRoom,
    EventType,
)


@admin.register(EventType)
class EventTypeAdmin(admin.ModelAdmin):
    list_display = ["code", "label", "color", "sort_order", "is_system", "counts_as_activity"]
    ordering = ["sort_order", "code"]
    readonly_fields = ["is_system", "counts_as_activity"]


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
        "attendance_format",
        "self_checkin_enabled",
        "registration_enabled",
        "track_expected_attendees",
        "allow_cross_branch_attendance",
        "branch",
        "room",
    ]
    list_filter = [
        "booking_status",
        "event_type",
        "is_recurring",
        "attendance_format",
        "self_checkin_enabled",
        "registration_enabled",
        "track_expected_attendees",
        "allow_cross_branch_attendance",
    ]
    search_fields = ["title", "location"]


@admin.register(EventRegistrationTier)
class EventRegistrationTierAdmin(admin.ModelAdmin):
    list_display = [
        "label",
        "code",
        "event",
        "is_active",
        "onsite_price",
        "online_price",
        "sort_order",
    ]
    list_filter = ["is_active", "onsite_offered", "online_offered"]
    search_fields = ["code", "label", "event__title"]
    ordering = ["event", "sort_order", "id"]


class EventRegistrationPaymentInline(admin.TabularInline):
    model = EventRegistrationPayment
    extra = 0
    readonly_fields = ["created_at"]


@admin.register(EventRegistration)
class EventRegistrationAdmin(admin.ModelAdmin):
    list_display = [
        "id",
        "event",
        "person",
        "mode",
        "status",
        "amount_due",
        "amount_paid",
        "occurrence_date",
    ]
    list_filter = ["status", "mode"]
    search_fields = [
        "person__first_name",
        "person__last_name",
        "person__username",
        "event__title",
    ]
    inlines = [EventRegistrationPaymentInline]


@admin.register(EventRegistrationPayment)
class EventRegistrationPaymentAdmin(admin.ModelAdmin):
    list_display = [
        "id",
        "registration",
        "amount",
        "method",
        "paid_at",
        "recorded_by",
    ]
    list_filter = ["method"]
    search_fields = ["provider_ref", "note"]
