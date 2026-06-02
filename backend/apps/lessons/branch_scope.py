from __future__ import annotations

from typing import Optional

from apps.people.models import ModuleCoordinator, Person


def can_pick_lessons_branch(user: Person) -> bool:
    if user.role in ("ADMIN", "PASTOR"):
        return True
    return user.is_senior_coordinator(ModuleCoordinator.ModuleType.LESSONS)


def _parse_branch_param(request) -> Optional[int]:
    branch_param = request.query_params.get("branch_id") or request.query_params.get(
        "branch"
    )
    if not branch_param:
        return None
    try:
        return int(branch_param)
    except (TypeError, ValueError):
        return None


def apply_lessons_branch_filter(queryset, user: Person, request, *, person_lookup: str):
    """
    Scope student-linked querysets by branch.

    person_lookup: relation prefix, e.g. "person" or "student".
    """
    lookup = f"{person_lookup}__branch_id"
    branch_id = _parse_branch_param(request)

    if can_pick_lessons_branch(user):
        if branch_id is not None:
            queryset = queryset.filter(**{lookup: branch_id})
        return queryset

    if user.branch_id:
        return queryset.filter(**{lookup: user.branch_id})
    return queryset.none()


def apply_branch_to_person_queryset(queryset, user: Person, request):
    """Scope a Person queryset by branch (direct branch_id field)."""
    branch_id = _parse_branch_param(request)

    if can_pick_lessons_branch(user):
        if branch_id is not None:
            queryset = queryset.filter(branch_id=branch_id)
        return queryset

    if user.branch_id:
        return queryset.filter(branch_id=user.branch_id)
    return queryset.none()
