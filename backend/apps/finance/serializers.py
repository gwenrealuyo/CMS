from decimal import Decimal

from django.core.validators import MinValueValidator
from rest_framework import serializers
from .models import Donation, Offering, Pledge, PledgeContribution


class DonationSerializer(serializers.ModelSerializer):
    recorded_by_name = serializers.SerializerMethodField()
    amount = serializers.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0.00"))],
    )

    class Meta:
        model = Donation
        fields = [
            "id",
            "donor",
            "amount",
            "date",
            "purpose",
            "is_anonymous",
            "payment_method",
            "receipt_number",
            "notes",
            "recorded_by",
            "recorded_by_name",
            "created_at",
        ]
        read_only_fields = ["id", "created_at", "recorded_by_name"]

    def get_recorded_by_name(self, obj):
        user = obj.recorded_by
        if not user:
            return None
        # Format: First Name, Middle Name, Last Name, Suffix
        parts = [user.first_name, user.middle_name, user.last_name, user.suffix]
        full_name = " ".join(filter(None, parts)).strip()
        # Fallback to username if no name parts exist
        return full_name or user.username


class OfferingSerializer(serializers.ModelSerializer):
    recorded_by_name = serializers.SerializerMethodField()
    amount = serializers.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0.00"))],
    )

    class Meta:
        model = Offering
        fields = [
            "id",
            "service_date",
            "service_name",
            "fund",
            "amount",
            "notes",
            "recorded_by",
            "recorded_by_name",
            "created_at",
        ]
        read_only_fields = ["id", "created_at", "recorded_by_name"]

    def get_recorded_by_name(self, obj):
        user = obj.recorded_by
        if not user:
            return None
        # Format: First Name, Middle Name, Last Name, Suffix
        parts = [user.first_name, user.middle_name, user.last_name, user.suffix]
        full_name = " ".join(filter(None, parts)).strip()
        # Fallback to username if no name parts exist
        return full_name or user.username


class PledgeContributionSerializer(serializers.ModelSerializer):
    recorded_by_name = serializers.SerializerMethodField()
    contributor_name = serializers.SerializerMethodField()
    amount = serializers.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0.00"))],
    )

    class Meta:
        model = PledgeContribution
        fields = [
            "id",
            "pledge",
            "contributor",
            "contributor_name",
            "amount",
            "contribution_date",
            "note",
            "recorded_by",
            "recorded_by_name",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "pledge",
            "recorded_by",
            "recorded_by_name",
            "contributor_name",
            "created_at",
            "updated_at",
        ]

    def get_recorded_by_name(self, obj):
        user = obj.recorded_by
        if not user:
            return None
        # Format: First Name, Middle Name, Last Name, Suffix
        parts = [user.first_name, user.middle_name, user.last_name, user.suffix]
        full_name = " ".join(filter(None, parts)).strip()
        # Fallback to username if no name parts exist
        return full_name or user.username

    def get_contributor_name(self, obj):
        contributor = obj.contributor
        if not contributor:
            return None
        # Format: First Name, Middle Name, Last Name, Suffix
        parts = [
            contributor.first_name,
            contributor.middle_name,
            contributor.last_name,
            contributor.suffix,
        ]
        full_name = " ".join(filter(None, parts)).strip()
        # Fallback to username if no name parts exist
        return full_name or contributor.username


class PledgeSerializer(serializers.ModelSerializer):
    recorded_by_name = serializers.SerializerMethodField()
    balance = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    progress_percent = serializers.FloatField(read_only=True)
    contributions_total = serializers.SerializerMethodField()
    contributions = PledgeContributionSerializer(many=True, read_only=True)
    pledge_amount = serializers.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0.00"))],
    )
    amount_received = serializers.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0.00"))],
    )

    class Meta:
        model = Pledge
        fields = [
            "id",
            "pledger",
            "pledge_title",
            "pledge_amount",
            "amount_received",
            "balance",
            "progress_percent",
            "start_date",
            "target_date",
            "purpose",
            "status",
            "notes",
            "recorded_by",
            "recorded_by_name",
            "created_at",
            "updated_at",
            "contributions_total",
            "contributions",
        ]
        read_only_fields = [
            "id",
            "balance",
            "progress_percent",
            "created_at",
            "updated_at",
            "recorded_by_name",
            "contributions_total",
            "contributions",
        ]

    def get_recorded_by_name(self, obj):
        user = obj.recorded_by
        if not user:
            return None
        # Format: First Name, Middle Name, Last Name, Suffix
        parts = [user.first_name, user.middle_name, user.last_name, user.suffix]
        full_name = " ".join(filter(None, parts)).strip()
        # Fallback to username if no name parts exist
        return full_name or user.username

    def get_contributions_total(self, obj):
        return obj.effective_amount_received()
