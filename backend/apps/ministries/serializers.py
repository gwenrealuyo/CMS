import json

from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils import timezone

from core.datetime_utils import church_today
from rest_framework import serializers
from rest_framework.exceptions import ValidationError

from apps.people.models import Branch

from .models import Ministry, MinistryMember, MinistryRole, MinistryScope
from .ncc import (
    is_ncc_ministry,
    person_has_lessons_teacher_access,
    sync_ncc_member_access,
)
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
        required=False,
    )
    grant_lessons_teacher_access = serializers.BooleanField(
        required=False,
        write_only=True,
        default=True,
    )
    has_lessons_teacher_access = serializers.SerializerMethodField()

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
            "grant_lessons_teacher_access",
            "has_lessons_teacher_access",
        )
        read_only_fields = ("join_date",)
        # UniqueTogetherValidator requires ministry+member on every write;
        # enforce uniqueness in validate() so PATCH (e.g. is_active) works.
        validators = []

    def get_has_lessons_teacher_access(self, obj: MinistryMember) -> bool:
        return person_has_lessons_teacher_access(obj.member)

    def validate(self, attrs):
        attrs = super().validate(attrs)
        if self.instance is None and "member" not in attrs:
            raise serializers.ValidationError(
                {"member_id": "This field is required."}
            )
        if self.instance is None and "ministry" not in attrs:
            raise serializers.ValidationError(
                {"ministry": "This field is required."}
            )

        ministry = attrs.get(
            "ministry", getattr(self.instance, "ministry", None)
        )
        member = attrs.get("member", getattr(self.instance, "member", None))
        if ministry is not None and member is not None:
            qs = MinistryMember.objects.filter(ministry=ministry, member=member)
            if self.instance is not None:
                qs = qs.exclude(pk=self.instance.pk)
            if qs.exists():
                raise serializers.ValidationError(
                    {
                        "member_id": (
                            "This person is already a member of this ministry."
                        )
                    }
                )
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        grant_flag = validated_data.pop("grant_lessons_teacher_access", True)
        if "join_date" not in validated_data:
            validated_data["join_date"] = church_today()
        membership = super().create(validated_data)
        if is_ncc_ministry(membership.ministry):
            sync_ncc_member_access(
                membership,
                grant_lessons_teacher_access_flag=bool(grant_flag),
            )
        return membership

    @transaction.atomic
    def update(self, instance, validated_data):
        grant_flag = validated_data.pop("grant_lessons_teacher_access", serializers.empty)
        previous_active = instance.is_active
        membership = super().update(instance, validated_data)
        if not is_ncc_ministry(membership.ministry):
            return membership

        if not membership.is_active:
            sync_ncc_member_access(
                membership,
                grant_lessons_teacher_access_flag=False,
            )
        elif grant_flag is not serializers.empty:
            sync_ncc_member_access(
                membership,
                grant_lessons_teacher_access_flag=bool(grant_flag),
            )
        elif not previous_active and membership.is_active:
            # Reactivated without explicit flag → default grant access
            sync_ncc_member_access(
                membership,
                grant_lessons_teacher_access_flag=True,
            )
        return membership


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
            "is_system",
            "created_at",
            "updated_at",
            "memberships",
        )
        read_only_fields = ("created_at", "updated_at", "is_system")
        # UniqueConstraint(code, branch) auto-adds UniqueTogetherValidator which
        # always requires branch on create; enforce uniqueness in validate().
        validators = []

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
        initial = self.initial_data
        if not isinstance(initial, dict):
            initial = {}
        # Prefer request payload over model-field defaults injected into attrs
        # (scope defaults to BRANCH on the model, which would skip create defaults).
        scope_in_input = "scope" in initial
        branch_in_input = "branch" in initial

        scope = attrs["scope"] if scope_in_input else (
            instance.scope if instance is not None else None
        )
        branch = attrs["branch"] if branch_in_input else (
            instance.branch if instance is not None else None
        )

        # Create defaults when scope was omitted in the request
        if instance is None and not scope_in_input:
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

        if instance is not None and instance.is_system:
            if "code" in attrs and attrs["code"] != instance.code:
                raise ValidationError(
                    {"code": "System ministry codes cannot be changed."}
                )
            if "scope" in attrs and attrs["scope"] != instance.scope:
                raise ValidationError(
                    {"scope": "System ministry scope cannot be changed."}
                )
            if "branch" in attrs and attrs["branch"] != instance.branch:
                raise ValidationError(
                    {"branch": "System ministry branch cannot be changed."}
                )

        code = attrs.get("code", instance.code if instance is not None else None)
        branch = attrs.get("branch", instance.branch if instance is not None else None)
        if code:
            qs = Ministry.objects.filter(code=code)
            if branch is not None:
                qs = qs.filter(branch=branch)
            else:
                qs = qs.filter(branch__isnull=True)
            if instance is not None:
                qs = qs.exclude(pk=instance.pk)
            if qs.exists():
                raise ValidationError(
                    {
                        "code": (
                            "A ministry with this code already exists for this "
                            "branch (or nationally if branch is empty)."
                        )
                    }
                )

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
