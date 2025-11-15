from django.contrib import admin
from .models import Donation, Offering, Pledge, PledgeContribution


@admin.register(Donation)
class DonationAdmin(admin.ModelAdmin):
    list_display = ("receipt_number", "amount", "date", "purpose", "recorded_by")
    list_filter = ("date", "payment_method", "is_anonymous")
    search_fields = ("receipt_number", "purpose", "notes")


@admin.register(Offering)
class OfferingAdmin(admin.ModelAdmin):
    list_display = ("service_date", "service_name", "fund", "amount", "recorded_by")
    list_filter = ("service_date", "fund")
    search_fields = ("service_name", "fund", "notes")


@admin.register(Pledge)
class PledgeAdmin(admin.ModelAdmin):
    list_display = ("pledge_title", "pledger", "pledge_amount", "amount_received", "status", "target_date")
    list_filter = ("status",)
    search_fields = ("pledge_title", "purpose", "notes")


@admin.register(PledgeContribution)
class PledgeContributionAdmin(admin.ModelAdmin):
    list_display = ("pledge", "amount", "contribution_date", "recorded_by", "created_at")
    list_filter = ("contribution_date", "pledge", "recorded_by")
    search_fields = ("pledge__pledge_title", "note")
    date_hierarchy = "contribution_date"
    readonly_fields = ("created_at", "updated_at")
