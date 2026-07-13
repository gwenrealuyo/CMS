import json

from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils import timezone
from rest_framework import serializers
from rest_framework.exceptions import ValidationError

from apps.people.models import Branch

from .models import Ministry, MinistryMember, MinistryRole, MinistryScope
from .utils import sync_coordinators_to_members, user_can_set_national_ministry_scope

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
    branch = serializers.PrimaryKeyRelatedField(
        queryset=Branch.objects.all(),
        required=False,
        allow_null=True,
    )

    class Meta:
        model = Ministry
        fields = (
            "id",
            "name",
            "code",
            "description",
            "category",
            "activity_cadence",
            "scope",
            "branch",
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

    def validate_code(self, value):
        if value is None or str(value).strip() == "":
            return None
        return str(value).strip().upper()

    def validate(self, attrs):
        attrs = super().validate(attrs)
        primary = attrs.get("primary_coordinator")
        request = self.context.get("request")
        user = (
            request.user
            if request is not None and getattr(request, "user", None)
            else None
        )
        authenticated = bool(
            user is not None and getattr(user, "is_authenticated", False)
        )

        if self.instance is None and not attrs.get("code"):
            name = attrs.get("name") or "MINISTRY"
            base = "".join(ch for ch in name.upper() if ch.isalnum())[:8] or "MIN"
            candidate = base
            suffix = 2
            while Ministry.objects.filter(code=candidate).exists():
                candidate = f"{base[: max(1, 45)]}-{suffix}"
                suffix += 1
            attrs["code"] = candidate

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

        instance = self.instance
        scope_in_attrs = "scope" in attrs
        branch_in_attrs = "branch" in attrs

        scope = attrs["scope"] if scope_in_attrs else (
            instance.scope if instance is not None else None
        )
        branch = attrs["branch"] if branch_in_attrs else (
            instance.branch if instance is not None else None
        )

        # Create defaults when scope was omitted
        if instance is None and not scope_in_attrs:
            if branch is not None:
                scope = MinistryScope.BRANCH
            elif authenticated and getattr(user, "branch_id", None):
                scope = MinistryScope.BRANCH
                branch = user.branch
            else:
                scope = MinistryScope.NATIONAL
            attrs["scope"] = scope
            if branch is not None:
                attrs["branch"] = branch

        if scope == MinistryScope.NATIONAL:
            creating = instance is None
            changing_to_national = (
                instance is not None and instance.scope != MinistryScope.NATIONAL
            )
            if authenticated and (creating or changing_to_national):
                if not user_can_set_national_ministry_scope(user):
                    raise ValidationError(
                        {
                            "scope": (
                                "Only admins, headquarters pastors, and senior "
                                "ministries coordinators can create or edit national ministries."
                            )
                        }
                    )
            attrs["scope"] = MinistryScope.NATIONAL
            attrs["branch"] = None
        elif scope == MinistryScope.BRANCH:
            if branch is None and authenticated and getattr(user, "branch_id", None):
                can_pick_any = user.role == "ADMIN" or user.can_see_all_branches()
                if not can_pick_any:
                    branch = user.branch
            if branch is None:
                raise ValidationError(
                    {"branch": "Branch is required for branch-scoped ministries."}
                )
            if (
                authenticated
                and getattr(user, "branch_id", None)
                and not (user.role == "ADMIN" or user.can_see_all_branches())
                and branch.pk != user.branch_id
            ):
                raise ValidationError(
                    {"branch": "You can only create ministries for your own branch."}
                )
            attrs["scope"] = MinistryScope.BRANCH
            attrs["branch"] = branch
        else:
            raise ValidationError({"scope": "Invalid ministry scope."})

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
