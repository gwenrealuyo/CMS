"""Vital milestone dates editable only by cluster coordinator+."""

from __future__ import annotations

from apps.people.models import ModuleCoordinator, Person

VITAL_DATE_ATTRS = (
    "date_first_invited",
    "date_first_attended",
    "first_activity_attended",
    "water_baptism_date",
    "spirit_baptism_date",
    "lessons_finished_at",
    "has_finished_lessons",
)


def user_can_edit_vital_dates(actor: Person | None, person: Person | None) -> bool:
    """
    ADMIN / PASTOR / CLUSTER senior / CLUSTER coordinator of a cluster
    that includes the person.
    """
    if not actor or not getattr(actor, "is_authenticated", False):
        return False
    if getattr(actor, "role", None) in ("ADMIN", "PASTOR"):
        return True
    if actor.is_senior_coordinator(ModuleCoordinator.ModuleType.CLUSTER):
        return True
    if person is None or not getattr(person, "pk", None):
        return False
    from apps.clusters.permissions import managed_cluster_ids_for_coordinator

    managed_ids = managed_cluster_ids_for_coordinator(actor)
    if not managed_ids:
        return False
    return person.clusters.filter(id__in=managed_ids).exists()


def strip_vital_date_attrs(attrs: dict) -> None:
    for field in VITAL_DATE_ATTRS:
        attrs.pop(field, None)
