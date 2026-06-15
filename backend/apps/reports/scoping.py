"""Shared branch + RBAC scoping helpers for the reports/analytics hub.

Generalizes the per-module branch filtering (see
``apps.lessons.branch_scope``) so any future report endpoint can scope a
queryset by a configurable lookup path while honoring the same access rules:

- ADMIN and headquarters PASTOR can see every branch and may pick one.
- Any other PASTOR (a "branch pastor") is locked to their own branch.

Access to the reports module itself is gated separately by
``apps.reports.permissions.IsReportsViewer``.
"""

from __future__ import annotations

from typing import Optional

from apps.people.models import Person


def can_pick_branch(user: Person) -> bool:
    """Whether the user may freely choose which branch to view.

    True for ADMIN and headquarters PASTOR (see
    ``Person.can_see_all_branches``); False for branch-scoped pastors.
    """
    return bool(user and user.can_see_all_branches())


def parse_branch_param(request) -> Optional[int]:
    """Read an optional ``branch_id`` (or ``branch``) query param as an int."""
    branch_param = request.query_params.get("branch_id") or request.query_params.get(
        "branch"
    )
    if not branch_param:
        return None
    try:
        return int(branch_param)
    except (TypeError, ValueError):
        return None


def resolve_branch_scope(user: Person, request) -> dict:
    """Resolve the effective branch scope for a reports request.

    Returns a dict with:
    - ``can_pick``: user may choose any branch.
    - ``locked``: branch is forced to the user's own branch.
    - ``effective_branch_id``: the branch to filter by, or ``None`` for
      "all branches" (only possible when ``can_pick`` is True and no branch
      param was supplied).
    """
    if can_pick_branch(user):
        return {
            "can_pick": True,
            "locked": False,
            "effective_branch_id": parse_branch_param(request),
        }

    return {
        "can_pick": False,
        "locked": True,
        "effective_branch_id": user.branch_id,
    }


def apply_branch_filter(queryset, user: Person, request, *, branch_lookup: str):
    """Scope a queryset by branch using a configurable lookup path.

    ``branch_lookup`` is the ORM path to the branch id relative to the
    queryset's model, e.g. ``"branch_id"`` for a Person/Cluster queryset,
    ``"person__branch_id"`` for lesson progress, or ``"cluster__branch_id"``
    / ``"event__branch_id"`` for related models.

    Branch-scoped users with no assigned branch get an empty queryset, matching
    the conservative default used elsewhere in the codebase.
    """
    scope = resolve_branch_scope(user, request)
    branch_id = scope["effective_branch_id"]

    if scope["can_pick"]:
        if branch_id is not None:
            return queryset.filter(**{branch_lookup: branch_id})
        return queryset

    if branch_id is not None:
        return queryset.filter(**{branch_lookup: branch_id})
    return queryset.none()
