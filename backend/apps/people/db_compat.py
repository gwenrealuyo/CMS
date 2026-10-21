"""
ORM helpers for Person columns that may not exist yet mid-migrate.

Historical RunPython seeds often use the live Person model. When a new
nullable FK (e.g. intended_cord) is on the model but its migration has not
run yet, SELECTs fail. Defer those fields so seeds can run safely.
"""

PERSON_FIELDS_DEFER_IF_PENDING = ("intended_cord",)


def defer_pending_person_fields(queryset):
    """Omit Person columns that may be missing from the DB during migrate."""
    return queryset.defer(*PERSON_FIELDS_DEFER_IF_PENDING)
