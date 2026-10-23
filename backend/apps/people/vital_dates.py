"""Vital milestone dates editable only by cluster coordinator+."""

from __future__ import annotations

from apps.people.models import Person

VITAL_DATE_ATTRS = (
    "date_first_invited",
    "date_first_attended",
    "first_activity_attended",
    "water_baptism_date",
    "spirit_baptism_date",
    "lessons_started_at",
    "lessons_finished_at",
    "has_finished_lessons",
    # Legacy commitment write-through (not Person columns; stripped with vital dates)
    "commitment_form_signed",
    "commitment_signed_at",
    "lesson_teacher_id",
    "historical_teacher_first_name",
    "historical_teacher_last_name",
    "baptized_by",
    "hg_witnessed_by",
    "baptized_by_first_name",
    "baptized_by_last_name",
    "hg_witnessed_by_first_name",
    "hg_witnessed_by_last_name",
)


def user_can_edit_vital_dates(actor: Person | None, person: Person | None) -> bool:
    """
    ADMIN / PASTOR / CLUSTER senior / CLUSTER coordinator or assistant of a
    cluster that includes the person.
    """
    if not actor or not getattr(actor, "is_authenticated", False):
        return False
    if getattr(actor, "role", None) in ("ADMIN", "PASTOR"):
        return True
    from apps.clusters.permissions import (
        can_pick_cluster_branch,
        has_cluster_oversight_access,
    )

    if has_cluster_oversight_access(actor):
        if can_pick_cluster_branch(actor) and getattr(actor, "role", None) not in (
            "ADMIN",
            "PASTOR",
        ):
            return True
        if (
            person is not None
            and actor.branch_id
            and person.branch_id == actor.branch_id
        ):
            return True
    if person is None or not getattr(person, "pk", None):
        return False
    from apps.clusters.permissions import managed_cluster_ids_for_operator

    managed_ids = managed_cluster_ids_for_operator(actor)
    if not managed_ids:
        return False
    return person.clusters.filter(id__in=managed_ids).exists()


def strip_vital_date_attrs(attrs: dict) -> None:
    for field in VITAL_DATE_ATTRS:
        attrs.pop(field, None)
