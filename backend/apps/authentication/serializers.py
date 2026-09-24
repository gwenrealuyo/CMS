from rest_framework import serializers
from django.contrib.auth import get_user_model
from rest_framework_simplejwt.tokens import RefreshToken
from apps.people.serializers import (
    ModuleCoordinatorSerializer,
    delete_person_photo_if_cleared,
)
from apps.people.name_formatting import (
    apply_title_case_name_fields,
    format_person_display_name,
)
from apps.people.photo_validators import validate_person_photo
from .models import PasswordResetRequest, AccountLockout, AuditLog
from .password_validators import PasswordStrengthValidator

User = get_user_model()


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField(write_only=True)
    remember_me = serializers.BooleanField(default=False, required=False)

    def validate(self, attrs):
        username = attrs.get("username")
        password = attrs.get("password")

        if username and password:
            # Try to authenticate with username or email
            try:
                user = User.objects.get(username=username)
            except User.DoesNotExist:
                try:
                    user = User.objects.get(email=username)
                except User.DoesNotExist:
                    raise serializers.ValidationError(
                        "Invalid credentials. Please check your username/email and password."
                    )

            if not user.check_password(password):
                raise serializers.ValidationError(
                    "Invalid credentials. Please check your username/email and password."
                )

            # Check if user is VISITOR role (not allowed to login)
            if user.role == "VISITOR":
                raise serializers.ValidationError(
                    "Visitor accounts cannot log in. Please contact an administrator."
                )

            if not user.is_active:
                raise serializers.ValidationError("This account is inactive.")

            attrs["user"] = user
        else:
            raise serializers.ValidationError("Must include 'username' and 'password'.")

        return attrs


class UserSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()
    branch = serializers.IntegerField(source="branch_id", read_only=True, allow_null=True)
    branch_name = serializers.SerializerMethodField()
    branch_is_headquarters = serializers.SerializerMethodField()
    can_see_all_branches = serializers.SerializerMethodField()
    can_manage_national_events = serializers.SerializerMethodField()
    module_coordinator_assignments = ModuleCoordinatorSerializer(
        many=True, read_only=True
    )
    ncc_lessons_role = serializers.SerializerMethodField()
    ncc_primary_at_headquarters = serializers.SerializerMethodField()
    on_bible_sharers_roster = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = (
            "id",
            "username",
            "email",
            "first_name",
            "last_name",
            "middle_name",
            "full_name",
            "role",
            "photo",
            "must_change_password",
            "first_login",
            "branch",
            "branch_name",
            "branch_is_headquarters",
            "can_see_all_branches",
            "can_manage_national_events",
            "module_coordinator_assignments",
            "ncc_lessons_role",
            "ncc_primary_at_headquarters",
            "on_bible_sharers_roster",
        )
        read_only_fields = (
            "id",
            "username",
            "email",
            "role",
            "must_change_password",
            "first_login",
            "branch",
            "branch_name",
            "branch_is_headquarters",
            "can_see_all_branches",
            "can_manage_national_events",
            "module_coordinator_assignments",
            "ncc_lessons_role",
            "ncc_primary_at_headquarters",
            "on_bible_sharers_roster",
        )

    def get_full_name(self, obj):
        return format_person_display_name(obj)

    def get_branch_name(self, obj):
        if obj.branch_id and getattr(obj, "branch", None):
            return obj.branch.name
        return None

    def get_branch_is_headquarters(self, obj):
        if obj.branch_id and getattr(obj, "branch", None):
            return bool(obj.branch.is_headquarters)
        return False

    def get_can_see_all_branches(self, obj):
        return obj.can_see_all_branches()

    def get_can_manage_national_events(self, obj):
        from apps.events.permissions import can_manage_national_events

        return can_manage_national_events(obj)

    def get_ncc_lessons_role(self, obj):
        from apps.lessons.coordinator_access import ncc_lessons_role

        return ncc_lessons_role(obj)

    def get_ncc_primary_at_headquarters(self, obj):
        from apps.lessons.coordinator_access import is_ncc_primary_at_headquarters

        return is_ncc_primary_at_headquarters(obj)

    def get_on_bible_sharers_roster(self, obj):
        from apps.ministries.bible_sharers import person_on_bible_sharers_roster

        return person_on_bible_sharers_roster(obj)


class TokenResponseSerializer(serializers.Serializer):
    access = serializers.CharField()
    refresh = serializers.CharField()
    user = UserSerializer()


class PasswordChangeSerializer(serializers.Serializer):
    old_password = serializers.CharField(write_only=True, required=False)
    new_password = serializers.CharField(
        write_only=True, min_length=8, validators=[PasswordStrengthValidator()]
    )
    confirm_password = serializers.CharField(write_only=True, min_length=8)

    def validate(self, attrs):
        new_password = attrs.get("new_password")
        confirm_password = attrs.get("confirm_password")

        if new_password != confirm_password:
            raise serializers.ValidationError(
                {"confirm_password": "Passwords do not match."}
            )

        return attrs


class AdminPasswordResetSerializer(serializers.Serializer):
    new_password = serializers.CharField(
        write_only=True, required=False, allow_blank=True
    )
    generate_temporary_password = serializers.BooleanField(required=False, default=True)

    def validate(self, attrs):
        new_password = (attrs.get("new_password") or "").strip()
        generate_temp = attrs.get("generate_temporary_password", True)

        if new_password:
            PasswordStrengthValidator()(new_password)
            attrs["new_password"] = new_password
            attrs["generate_temporary_password"] = False
        elif not generate_temp:
            raise serializers.ValidationError(
                {
                    "new_password": (
                        "Provide new_password or enable generate_temporary_password."
                    )
                }
            )

        return attrs


class ProfileUpdateSerializer(serializers.ModelSerializer):
    photo = serializers.ImageField(
        required=False,
        allow_null=True,
        validators=[validate_person_photo],
    )

    class Meta:
        model = User
        fields = ("first_name", "last_name", "middle_name", "email", "photo")
        extra_kwargs = {
            "first_name": {"required": False},
            "last_name": {"required": False},
            "middle_name": {"required": False},
            "email": {"required": False},
        }

    def validate(self, attrs):
        apply_title_case_name_fields(
            attrs, ("first_name", "last_name", "middle_name")
        )
        return attrs

    def update(self, instance, validated_data):
        delete_person_photo_if_cleared(instance, validated_data)
        return super().update(instance, validated_data)


class PasswordResetRequestSerializer(serializers.Serializer):
    user_id = serializers.IntegerField()
    notes = serializers.CharField(required=False, allow_blank=True)


class PasswordResetRequestListSerializer(serializers.ModelSerializer):
    user_id = serializers.IntegerField(source="user.id", read_only=True)
    username = serializers.CharField(source="user.username", read_only=True)
    email = serializers.EmailField(source="user.email", read_only=True)
    full_name = serializers.SerializerMethodField()
    approved_by_name = serializers.SerializerMethodField()
    rejected_by_name = serializers.SerializerMethodField()

    class Meta:
        model = PasswordResetRequest
        fields = (
            "id",
            "user_id",
            "username",
            "email",
            "full_name",
            "requested_at",
            "approved_at",
            "approved_by_name",
            "rejected_at",
            "rejected_by_name",
            "status",
            "notes",
        )

    def get_full_name(self, obj):
        return format_person_display_name(obj.user)

    def get_approved_by_name(self, obj):
        if obj.approved_by:
            return format_person_display_name(obj.approved_by)
        return None

    def get_rejected_by_name(self, obj):
        if obj.rejected_by:
            return format_person_display_name(obj.rejected_by)
        return None


class AccountLockoutSerializer(serializers.ModelSerializer):
    user_id = serializers.IntegerField(source="user.id", read_only=True)
    username = serializers.CharField(source="user.username", read_only=True)
    email = serializers.EmailField(source="user.email", read_only=True)
    full_name = serializers.SerializerMethodField()

    class Meta:
        model = AccountLockout
        fields = (
            "user_id",
            "username",
            "email",
            "full_name",
            "failed_attempts",
            "locked_until",
            "lockout_count",
            "last_attempt",
        )

    def get_full_name(self, obj):
        return format_person_display_name(obj.user)


class AuditLogSerializer(serializers.ModelSerializer):
    user_id = serializers.IntegerField(
        source="user.id", read_only=True, allow_null=True
    )
    username = serializers.CharField(
        source="user.username", read_only=True, allow_null=True
    )
    full_name = serializers.SerializerMethodField()

    class Meta:
        model = AuditLog
        fields = (
            "id",
            "user_id",
            "username",
            "full_name",
            "action",
            "ip_address",
            "user_agent",
            "details",
            "timestamp",
        )

    def get_full_name(self, obj):
        if obj.user:
            return format_person_display_name(obj.user)
        return None
