from rest_framework import serializers
from django.contrib.auth import get_user_model
from rest_framework_simplejwt.tokens import RefreshToken
from .models import PasswordResetRequest, AccountLockout, AuditLog
import re

User = get_user_model()


def format_person_name(user):
    """
    Formats a person's name with first name, nickname (in quotes),
    middle initial, last name, and suffix.
    """
    pieces = []

    if user.first_name:
        pieces.append(user.first_name.strip())

    # Nickname in quotes (after first name)
    if user.nickname:
        pieces.append(f'"{user.nickname.strip()}"')

    # Middle initial
    if user.middle_name:
        middle_initial = user.middle_name.strip()
        if middle_initial:
            pieces.append(f"{middle_initial[0].upper()}.")

    if user.last_name:
        pieces.append(user.last_name.strip())

    if user.suffix:
        pieces.append(user.suffix.strip())

    name = " ".join(pieces).strip()
    return name if name else user.username


class PasswordStrengthValidator:
    """
    Validates that password has:
    - Minimum 8 characters
    - At least one letter (a-z, A-Z)
    - At least one number (0-9)
    """

    def __call__(self, value):
        if len(value) < 8:
            raise serializers.ValidationError(
                "Password must be at least 8 characters long."
            )
        if not re.search(r"[a-zA-Z]", value):
            raise serializers.ValidationError(
                "Password must contain at least one letter."
            )
        if not re.search(r"[0-9]", value):
            raise serializers.ValidationError(
                "Password must contain at least one number."
            )


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
        )
        read_only_fields = (
            "id",
            "username",
            "email",
            "role",
            "must_change_password",
            "first_login",
        )

    def get_full_name(self, obj):
        return format_person_name(obj)


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


class ProfileUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ("first_name", "last_name", "middle_name", "email", "photo")
        extra_kwargs = {
            "first_name": {"required": False},
            "last_name": {"required": False},
            "middle_name": {"required": False},
            "email": {"required": False},
            "photo": {"required": False},
        }


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
        return format_person_name(obj.user)

    def get_approved_by_name(self, obj):
        if obj.approved_by:
            return format_person_name(obj.approved_by)
        return None

    def get_rejected_by_name(self, obj):
        if obj.rejected_by:
            return format_person_name(obj.rejected_by)
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
        return format_person_name(obj.user)


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
            return format_person_name(obj.user)
        return None
