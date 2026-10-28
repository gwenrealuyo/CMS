"""ORM helpers for Ministry columns that may not exist yet mid-migrate."""

from __future__ import annotations

from django.db import connection
from django.utils import timezone

MINISTRY_FIELDS_DEFER_IF_PENDING = ("visibility",)


def defer_pending_ministry_fields(queryset):
    """Omit Ministry columns that may be missing from the DB during migrate."""
    return queryset.defer(*MINISTRY_FIELDS_DEFER_IF_PENDING)


def ministry_has_visibility_column() -> bool:
    """True when ministries_ministry.visibility exists (post-0009)."""
    with connection.cursor() as cursor:
        columns = connection.introspection.get_table_description(
            cursor, "ministries_ministry"
        )
    return any(col.name == "visibility" for col in columns)


def get_or_create_ministry_mid_migrate_safe(*, lookup: dict, defaults: dict):
    """
    get_or_create that works before the visibility column exists.

    Old RunPython migrations (e.g. 0007) call live ensure_* helpers. SELECT must
    defer visibility; INSERT must omit it until migration 0009 runs.
    """
    from .models import Ministry

    qs = defer_pending_ministry_fields(Ministry.objects)
    existing = qs.filter(**lookup).first()
    if existing is not None:
        return existing, False

    create_kwargs = {**lookup, **defaults}
    if ministry_has_visibility_column():
        return Ministry.objects.get_or_create(**lookup, defaults=defaults)

    # Pre-visibility schema: insert only columns that exist.
    now = timezone.now()
    with connection.cursor() as cursor:
        cursor.execute(
            """
            INSERT INTO ministries_ministry (
                name, code, description, category, activity_cadence,
                primary_coordinator_id, scope, branch_id, meeting_location,
                meeting_schedule, communication_channel, is_active, is_system,
                created_at, updated_at
            ) VALUES (
                %s, %s, %s, %s, %s,
                %s, %s, %s, %s,
                %s, %s, %s, %s,
                %s, %s
            )
            """,
            [
                create_kwargs.get("name") or "",
                create_kwargs.get("code"),
                create_kwargs.get("description") or "",
                create_kwargs.get("category") or "",
                create_kwargs.get("activity_cadence") or "weekly",
                getattr(create_kwargs.get("primary_coordinator"), "pk", None)
                or create_kwargs.get("primary_coordinator_id"),
                create_kwargs.get("scope") or "BRANCH",
                getattr(create_kwargs.get("branch"), "pk", None)
                or create_kwargs.get("branch_id"),
                create_kwargs.get("meeting_location") or "",
                None,  # meeting_schedule JSON
                create_kwargs.get("communication_channel") or "",
                bool(create_kwargs.get("is_active", True)),
                bool(create_kwargs.get("is_system", False)),
                now,
                now,
            ],
        )
    created = defer_pending_ministry_fields(Ministry.objects).get(**lookup)
    return created, True
