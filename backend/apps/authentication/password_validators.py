import re

from rest_framework import serializers


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
