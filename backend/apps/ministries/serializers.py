import json

from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils import timezone
from rest_framework import serializers
from rest_framework.exceptions import ValidationError

from .models import Ministry, MinistryMember, MinistryRole
from .utils import sync_coordinators_to_members

User = get_user_model()


class UserSummarySerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = (
            "id",
            "username",
            "first_name",
            "middle_name",
            "last_name",
            "suffix",
            "email",
        )


class MinistryMemberSerializer(serializers.ModelSerializer):
    member = UserSummarySerializer(read_only=True)
    member_id = serializers.PrimaryKeyRelatedField(
        source="member",
        queryset=User.objects.exclude(role="ADMIN"),
        write_only=True,
    )

    class Meta:
        model = MinistryMember
        fields = (
            "id",
            "ministry",
            "member",
            "member_id",
            "role",
            "join_date",
            "is_active",
            "availability",
            "skills",
            "notes",
        )
        read_only_fields = ("join_date",)

    def create(self, validated_data):
        # Ensure join_date is set as a date (not datetime)
        if "join_date" not in validated_data:
            validated_data["join_date"] = timezone.now().date()
        return super().create(validated_data)


class MinistrySerializer(serializers.ModelSerializer):
    primary_coordinator = UserSummarySerializer(read_only=True)
    primary_coordinator_id = serializers.PrimaryKeyRelatedField(
        source="primary_coordinator",
        queryset=User.objects.exclude(role="ADMIN"),
        required=False,
        allow_null=True,
        write_only=True,
    )
    support_coordinators = UserSummarySerializer(many=True, read_only=True)
    support_coordinator_ids = serializers.PrimaryKeyRelatedField(
        source="support_coordinators",
        queryset=User.objects.exclude(role="ADMIN"),
        many=True,
        required=False,
        write_only=True,
    )
    memberships = MinistryMemberSerializer(many=True, read_only=True)

    class Meta:
        model = Ministry
        fields = (
            "id",
            "name",
            "description",
            "category",
            "activity_cadence",
            "primary_coordinator",
            "primary_coordinator_id",
            "support_coordinators",
            "support_coordinator_ids",
            "meeting_location",
            "meeting_schedule",
            "communication_channel",
            "is_active",
            "created_at",
            "updated_at",
            "memberships",
        )
        read_only_fields = ("created_at", "updated_at")

    def validate_meeting_schedule(self, value):
        if value in (None, "", {}):
            return None

        if isinstance(value, str):
            try:
                parsed = json.loads(value)
            except json.JSONDecodeError as exc:
                raise ValidationError("Meeting schedule must be valid JSON.") from exc
            if not isinstance(parsed, dict):
                raise ValidationError("Meeting schedule must be a JSON object.")
            return parsed

        if isinstance(value, dict):
            return value

        raise ValidationError("Meeting schedule must be a JSON object.")

    def validate(self, attrs):
        attrs = super().validate(attrs)
        primary = attrs.get("primary_coordinator")

        if "support_coordinators" in attrs and attrs["support_coordinators"]:
            unique = []
            seen_ids = set()
            for coordinator in attrs["support_coordinators"]:
                if coordinator is None:
                    continue
                if primary and coordinator.pk == primary.pk:
                    continue
                if coordinator.pk not in seen_ids:
                    unique.append(coordinator)
                    seen_ids.add(coordinator.pk)
            attrs["support_coordinators"] = unique

        return attrs

    @transaction.atomic
    def create(self, validated_data):
        # Extract ManyToMany field before saving
        support_coordinators = validated_data.pop("support_coordinators", [])

        # Create the ministry instance
        ministry = super().create(validated_data)

        # Set support_coordinators (ManyToMany must be set after save)
        if support_coordinators:
            ministry.support_coordinators.set(support_coordinators)

        # Sync coordinators to MinistryMember entries
        sync_coordinators_to_members(ministry)

        return ministry

    @transaction.atomic
    def update(self, instance, validated_data):
        # Extract ManyToMany field before saving
        support_coordinators = validated_data.pop("support_coordinators", None)

        # Update the ministry instance
        ministry = super().update(instance, validated_data)

        # Update support_coordinators if provided
        if support_coordinators is not None:
            ministry.support_coordinators.set(support_coordinators)

        # Sync coordinators to MinistryMember entries
        sync_coordinators_to_members(ministry)

        return ministry
