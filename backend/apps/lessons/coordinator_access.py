"""Lessons access derived from ModuleCoordinator assignments and NCC ministry roles."""

from __future__ import annotations

from typing import Optional

from apps.ministries.models import NCC_MINISTRY_CODE, Ministry
from apps.people.models import ModuleCoordinator, Person

NCC_LESSONS_ROLE_PRIMARY = "PRIMARY"
NCC_LESSONS_ROLE_SUPPORT = "SUPPORT"

_LESSONS_BROWSE_LEVELS = (
    ModuleCoordinator.CoordinatorLevel.COORDINATOR,
    ModuleCoordinator.CoordinatorLevel.SENIOR_COORDINATOR,
)


def _ncc_ministries_qs():
    return Ministry.objects.filter(code=NCC_MINISTRY_CODE, is_active=True)


def is_ncc_primary_coordinator(user: Optional[Person]) -> bool:
    if user is None or not getattr(user, "pk", None):
        return False
    return _ncc_ministries_qs().filter(primary_coordinator_id=user.pk).exists()


def is_ncc_support_coordinator(user: Optional[Person]) -> bool:
    if user is None or not getattr(user, "pk", None):
        return False
    return _ncc_ministries_qs().filter(support_coordinators=user).exists()


def is_ncc_primary_at_headquarters(user: Optional[Person]) -> bool:
    if user is None or not getattr(user, "pk", None):
        return False
    return _ncc_ministries_qs().filter(
        primary_coordinator_id=user.pk,
        branch__is_headquarters=True,
    ).exists()


def ncc_lessons_role(user: Optional[Person]) -> Optional[str]:
    """Highest NCC ministry coordinator role: PRIMARY, SUPPORT, or None."""
    if is_ncc_primary_coordinator(user):
        return NCC_LESSONS_ROLE_PRIMARY
    if is_ncc_support_coordinator(user):
        return NCC_LESSONS_ROLE_SUPPORT
    return None


def _has_lessons_assignment(user: Person, levels) -> bool:
    cache = getattr(user, "_prefetched_objects_cache", None) or {}
    if "module_coordinator_assignments" in cache:
        return any(
            assignment.module == ModuleCoordinator.ModuleType.LESSONS
            and assignment.level in levels
            for assignment in user.module_coordinator_assignments.all()
        )
    return user.module_coordinator_assignments.filter(
        module=ModuleCoordinator.ModuleType.LESSONS,
        level__in=levels,
    ).exists()


def has_lessons_browse_all(user: Optional[Person]) -> bool:
    """Coordinator-level Lessons lists: assignments or NCC primary/support."""
    if user is None or not getattr(user, "pk", None):
        return False
    if ncc_lessons_role(user) is not None:
        return True
    return _has_lessons_assignment(user, _LESSONS_BROWSE_LEVELS)


def has_lessons_senior_access(user: Optional[Person]) -> bool:
    if user is None or not getattr(user, "pk", None):
        return False
    if is_ncc_primary_coordinator(user):
        return True
    return _has_lessons_assignment(
        user, (ModuleCoordinator.CoordinatorLevel.SENIOR_COORDINATOR,)
    )


def has_lessons_teacher_assignment(user: Optional[Person]) -> bool:
    if user is None or not getattr(user, "pk", None):
        return False
    return _has_lessons_assignment(
        user, (ModuleCoordinator.CoordinatorLevel.TEACHER,)
    )


def has_lessons_write_access(user: Optional[Person]) -> bool:
    """Create/update Lessons data (not hard-delete)."""
    return has_lessons_browse_all(user) or has_lessons_teacher_assignment(user)


def _user_branch_is_headquarters(user: Person) -> bool:
    branch = getattr(user, "branch", None)
    return bool(branch and getattr(branch, "is_headquarters", False))


def can_pick_lessons_branch(user: Person) -> bool:
    """
    Who may pass branch_id / omit it for all-branch Lessons lists.

    Admin and Pastor keep existing picker access. Lessons seniors (Admin
    Settings or NCC primary) may pick only when HQ.
    """
    if user is None or not getattr(user, "pk", None):
        return False
    if getattr(user, "role", None) in ("ADMIN", "PASTOR"):
        return True
    if not has_lessons_senior_access(user):
        return False
    return _user_branch_is_headquarters(user) or is_ncc_primary_at_headquarters(user)
