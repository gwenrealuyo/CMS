"""Generate and validate Person usernames."""

from __future__ import annotations

import re
from typing import Optional

from django.contrib.auth.validators import UnicodeUsernameValidator
from django.core.exceptions import ValidationError

from apps.people.models import Person

USERNAME_ALLOWED_RE = re.compile(r"[^a-z0-9@.+_-]")
RESERVED_USERNAMES = frozenset({"admin"})
_username_validator = UnicodeUsernameValidator()


def sanitize_username_fragment(value: Optional[str]) -> str:
    return USERNAME_ALLOWED_RE.sub("", (value or "").strip().lower())


def suggested_username(first_name: str, last_name: str) -> str:
    """First two letters of first name plus last name, with invalid chars removed."""
    first = sanitize_username_fragment(first_name)
    last = sanitize_username_fragment(last_name)
    return f"{first[:2]}{last}"


def allocate_unique_username(
    base: str,
    *,
    exclude_pk: Optional[int] = None,
    fallback: str = "user",
) -> str:
    original = sanitize_username_fragment(base) or fallback
    username = original
    counter = 1
    while _username_taken(username, exclude_pk=exclude_pk):
        username = f"{original}{counter}"
        counter += 1
    return username


def generate_unique_username(
    first_name: str,
    last_name: str,
    *,
    exclude_pk: Optional[int] = None,
    fallback: str = "user",
) -> str:
    return allocate_unique_username(
        suggested_username(first_name, last_name),
        exclude_pk=exclude_pk,
        fallback=fallback,
    )


def normalize_and_validate_username(
    value: Optional[str],
    *,
    exclude_pk: Optional[int] = None,
) -> str:
    username = (value or "").strip().lower()
    if not username:
        raise ValidationError("Username cannot be blank.")
    if username in RESERVED_USERNAMES:
        raise ValidationError("This username is reserved.")
    _username_validator(username)
    if _username_taken(username, exclude_pk=exclude_pk):
        raise ValidationError("A user with that username already exists.")
    return username


def _username_taken(username: str, *, exclude_pk: Optional[int] = None) -> bool:
    if username in RESERVED_USERNAMES:
        return True
    qs = Person.objects.filter(username=username)
    if exclude_pk is not None:
        qs = qs.exclude(pk=exclude_pk)
    return qs.exists()
