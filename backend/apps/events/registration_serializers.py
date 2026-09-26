from rest_framework import serializers
from rest_framework.exceptions import ValidationError

from apps.people.models import Person
from apps.people.name_formatting import format_person_display_name

from .models import (
    EventRegistration,
    EventRegistrationPayment,
    EventRegistrationTier,
)


class EventRegistrationTierSerializer(serializers.ModelSerializer):
    class Meta:
        model = EventRegistrationTier
        fields = [
            "id",
            "event",
            "code",
            "label",
            "sort_order",
            "is_active",
            "onsite_offered",
            "online_offered",
            "onsite_price",
            "online_price",
            "available_from",
            "available_until",
        ]
        read_only_fields = ["id", "event"]

    def validate_code(self, value):
        code = (value or "").strip()
        if not code:
            raise ValidationError("Code is required.")
        return code

    def validate_label(self, value):
        label = (value or "").strip()
        if not label:
            raise ValidationError("Label is required.")
        return label


class EventRegistrationPaymentSerializer(serializers.ModelSerializer):
    recorded_by_name = serializers.SerializerMethodField()

    class Meta:
        model = EventRegistrationPayment
        fields = [
            "id",
            "registration",
            "amount",
            "method",
            "paid_at",
            "recorded_by",
            "recorded_by_name",
            "note",
            "provider",
            "provider_ref",
            "created_at",
        ]
        read_only_fields = [
            "id",
            "registration",
            "recorded_by",
            "recorded_by_name",
            "created_at",
        ]

    def get_recorded_by_name(self, obj):
        if not obj.recorded_by_id:
            return None
        return format_person_display_name(obj.recorded_by) or obj.recorded_by.username


class EventRegistrationSerializer(serializers.ModelSerializer):
    payments = EventRegistrationPaymentSerializer(many=True, read_only=True)
    person_name = serializers.SerializerMethodField()
    tier_label = serializers.CharField(
        source="tier.label", read_only=True, allow_null=True
    )
    person = serializers.PrimaryKeyRelatedField(
        queryset=Person.objects.exclude(role="ADMIN"),
    )
    tier = serializers.PrimaryKeyRelatedField(
        queryset=EventRegistrationTier.objects.all(),
        allow_null=True,
        required=False,
    )

    class Meta:
        model = EventRegistration
        fields = [
            "id",
            "event",
            "person",
            "person_name",
            "occurrence_date",
            "mode",
            "tier",
            "tier_label",
            "status",
            "amount_due",
            "amount_paid",
            "payments",
            "created_by",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "event",
            "person_name",
            "tier_label",
            "amount_due",
            "amount_paid",
            "payments",
            "created_by",
            "created_at",
            "updated_at",
            "status",
        ]

    def get_person_name(self, obj):
        if not obj.person_id:
            return None
        return format_person_display_name(obj.person) or obj.person.username


class EventRegistrationRequestSerializer(serializers.Serializer):
    person = serializers.PrimaryKeyRelatedField(
        queryset=Person.objects.exclude(role="ADMIN"),
    )
    mode = serializers.ChoiceField(choices=EventRegistration.AttendanceMode.choices)
    tier = serializers.PrimaryKeyRelatedField(
        queryset=EventRegistrationTier.objects.all(),
        allow_null=True,
        required=False,
    )
    occurrence_date = serializers.DateField(allow_null=True, required=False)
    allow_capacity_override = serializers.BooleanField(required=False, default=False)
