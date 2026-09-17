from decimal import Decimal

from django.core.validators import MinValueValidator
from rest_framework import serializers

from apps.people.name_formatting import format_person_display_name

from .models import Donation, Offering, Pledge, PledgeContribution


def _person_display_name(person):
    if not person:
        return None
    return format_person_display_name(person) or person.username


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
        return _person_display_name(obj.recorded_by)


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
        return _person_display_name(obj.recorded_by)


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
        return _person_display_name(obj.recorded_by)

    def get_contributor_name(self, obj):
        return _person_display_name(obj.contributor)


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
        return _person_display_name(obj.recorded_by)

    def get_contributions_total(self, obj):
        return obj.effective_amount_received()
