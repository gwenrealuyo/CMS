"""
Schema checks and repairs for local dev sample-data seeding.

Handles drift when squashed migrations were applied against an older database
shape (e.g. evangelism Prospect.name vs first_name, people_journey.updated_at,
events missing EventType table).
"""

from django.core.management import call_command
from django.db import connection

# Apps that FK to events.Event — must be reset before events when schema is stale.
EVENT_DEPENDENT_APPS = ("evangelism", "sunday_school", "attendance")


def table_exists(table: str) -> bool:
    return table in connection.introspection.table_names()


def column_exists(table: str, column: str) -> bool:
    if not table_exists(table):
        return False
    with connection.cursor() as cursor:
        description = connection.introspection.get_table_description(cursor, table)
    return any(col.name == column for col in description)


def tables_with_prefix(prefix: str) -> list[str]:
    return [
        name
        for name in connection.introspection.table_names()
        if name.startswith(prefix)
    ]


def drop_tables(tables: list[str]) -> None:
    with connection.cursor() as cursor:
        for table in tables:
            if connection.vendor == "postgresql":
                cursor.execute(f'DROP TABLE IF EXISTS "{table}" CASCADE')
            else:
                cursor.execute(f'DROP TABLE IF EXISTS "{table}"')


def fake_migrate_zero(app_label: str) -> None:
    call_command("migrate", app_label, "zero", fake=True, verbosity=0)


def people_journey_needs_updated_at() -> bool:
    if not table_exists("people_journey"):
        return False
    return not column_exists("people_journey", "updated_at")


def events_needs_reset() -> bool:
    """True when EventType table is missing but legacy events tables may exist."""
    if table_exists("events_eventtype"):
        return False
    if table_exists("events_event"):
        return True
    # Migration recorded but tables never created — remigrate events only.
    from django.db.migrations.recorder import MigrationRecorder

    applied = MigrationRecorder.Migration.objects.filter(
        app="events", name="0001_initial"
    ).exists()
    return applied and not table_exists("events_event")


def evangelism_needs_reset() -> bool:
    if not table_exists("evangelism_prospect"):
        return False
    if column_exists("evangelism_prospect", "name"):
        return True
    if not column_exists("evangelism_prospect", "first_name"):
        return True
    if column_exists("evangelism_prospect", "fast_track_reason"):
        return True
    if table_exists("evangelism_evangelismgroupmember"):
        return True
    return False


def ensure_people_journey_schema(stdout=None) -> bool:
    """Re-apply people 0007 when updated_at is missing. Returns True if repaired."""
    if not people_journey_needs_updated_at():
        return False

    if stdout:
        stdout.write("Repairing people_journey schema (missing updated_at)...")

    call_command("migrate", "people", "0006", fake=True, verbosity=0)
    call_command("migrate", "people", "0007", verbosity=0)

    if column_exists("people_person", "date_first_invited"):
        call_command("migrate", "people", "0009", fake=True, verbosity=0)
    else:
        call_command("migrate", "people", "0009", verbosity=0)

    if table_exists("people_modulesetting"):
        call_command("migrate", "people", "0010", fake=True, verbosity=0)
    else:
        call_command("migrate", "people", "0010", verbosity=0)

    if stdout:
        stdout.write("  ✓ people_journey.updated_at restored")
    return True


def reset_events_schema(stdout=None) -> bool:
    """
    Drop stale events (and dependent app) tables and re-run current migrations.
    Returns True if reset was performed.
    """
    if not events_needs_reset():
        return False

    if stdout:
        stdout.write("Resetting events schema (missing events_eventtype)...")

    dropped: list[str] = []
    for app_label in EVENT_DEPENDENT_APPS:
        prefix = f"{app_label}_"
        tables = tables_with_prefix(prefix)
        if tables:
            fake_migrate_zero(app_label)
            drop_tables(tables)
            dropped.extend(tables)

    events_tables = tables_with_prefix("events_")
    fake_migrate_zero("events")
    drop_tables(events_tables)
    dropped.extend(events_tables)

    call_command("migrate", "events", verbosity=0)
    call_command("migrate", "attendance", verbosity=0)
    call_command("migrate", "sunday_school", verbosity=0)
    call_command("migrate", "evangelism", verbosity=0)

    if stdout:
        stdout.write(
            f"  ✓ Dropped {len(dropped)} table(s); re-migrated events and dependents"
        )
    return True


def reset_evangelism_schema(stdout=None) -> bool:
    """Drop evangelism tables and re-run 0001_initial. Returns True if reset."""
    if not evangelism_needs_reset():
        return False

    if stdout:
        stdout.write("Resetting evangelism schema (stale migration state)...")

    fake_migrate_zero("evangelism")
    tables = tables_with_prefix("evangelism_")
    drop_tables(tables)
    call_command("migrate", "evangelism", verbosity=0)

    if stdout:
        stdout.write(f"  ✓ Dropped {len(tables)} evangelism table(s) and re-migrated")
    return True


def sync_sample_data_schema(stdout=None) -> list[str]:
    """
    Apply pending migrations and repair known schema drift.
    Returns human-readable labels for actions taken.
    """
    call_command("migrate", verbosity=0)
    actions: list[str] = []

    if ensure_people_journey_schema(stdout):
        actions.append("people_journey.updated_at")

    if reset_events_schema(stdout):
        actions.append("events schema reset (evangelism re-migrated)")

    if reset_evangelism_schema(stdout):
        actions.append("evangelism schema reset")

    return actions
