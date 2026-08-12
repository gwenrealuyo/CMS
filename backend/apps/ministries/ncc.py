"""NCC / Lessons teacher roster helpers (per-branch system ministry)."""

from __future__ import annotations

from typing import Iterable, Optional

from django.db import transaction

from apps.people.models import Branch, ModuleCoordinator, Person
from apps.lessons.branch_scope import can_pick_lessons_branch

from .models import (
    NCC_MINISTRY_CODE,
    NCC_MINISTRY_NAME,
    Ministry,
    MinistryCategory,
    MinistryCadence,
    MinistryMember,
    MinistryScope,
)


def is_ncc_ministry(ministry: Ministry | None) -> bool:
    if ministry is None:
        return False
    return bool(ministry.is_ncc_roster)


@transaction.atomic
def ensure_ncc_ministry(branch: Branch) -> Ministry:
    """Get or create the BRANCH-scoped NCC / Lessons roster ministry for a branch."""
    ministry, created = Ministry.objects.get_or_create(
        code=NCC_MINISTRY_CODE,
        branch=branch,
        defaults={
            "name": NCC_MINISTRY_NAME,
            "scope": MinistryScope.BRANCH,
            "is_system": True,
            "category": MinistryCategory.CARE,
            "activity_cadence": MinistryCadence.WEEKLY,
            "description": (
                "New Converts Course / Lessons teachers roster for this branch."
            ),
            "is_active": True,
        },
    )
    update_fields = []
    if not ministry.is_system:
        ministry.is_system = True
        update_fields.append("is_system")
    if ministry.scope != MinistryScope.BRANCH:
        ministry.scope = MinistryScope.BRANCH
        update_fields.append("scope")
    if ministry.name != NCC_MINISTRY_NAME and created is False:
        # Keep custom renames if admins changed display name; only set on create.
        pass
    if update_fields:
        ministry.save(update_fields=update_fields + ["updated_at"])
    return ministry


def seed_ncc_ministries_for_all_branches() -> int:
    """Ensure an NCC ministry exists for every active branch. Returns created count."""
    created = 0
    for branch in Branch.objects.filter(is_active=True).iterator():
        _, was_created = Ministry.objects.get_or_create(
            code=NCC_MINISTRY_CODE,
            branch=branch,
            defaults={
                "name": NCC_MINISTRY_NAME,
                "scope": MinistryScope.BRANCH,
                "is_system": True,
                "category": MinistryCategory.CARE,
                "activity_cadence": MinistryCadence.WEEKLY,
                "description": (
                    "New Converts Course / Lessons teachers roster for this branch."
                ),
                "is_active": True,
            },
        )
        if was_created:
            created += 1
        else:
            ensure_ncc_ministry(branch)
    return created


def grant_lessons_teacher_access(person: Person) -> Optional[ModuleCoordinator]:
    """
    Ensure the person can access Lessons as a teacher.

    ModuleCoordinator is unique on (person, module, resource_id), so a Lessons
    coordinator/senior already covers access — do not create a duplicate TEACHER row.
    """
    existing = ModuleCoordinator.objects.filter(
        person=person,
        module=ModuleCoordinator.ModuleType.LESSONS,
        resource_id=None,
    ).first()
    if existing:
        return existing
    return ModuleCoordinator.objects.create(
        person=person,
        module=ModuleCoordinator.ModuleType.LESSONS,
        level=ModuleCoordinator.CoordinatorLevel.TEACHER,
        resource_id=None,
        resource_type="",
    )


def person_has_lessons_teacher_access(person: Person) -> bool:
    if getattr(person, "role", None) in ("ADMIN", "PASTOR"):
        return True
    return person.module_coordinator_assignments.filter(
        module=ModuleCoordinator.ModuleType.LESSONS,
        level__in=(
            ModuleCoordinator.CoordinatorLevel.TEACHER,
            ModuleCoordinator.CoordinatorLevel.COORDINATOR,
            ModuleCoordinator.CoordinatorLevel.SENIOR_COORDINATOR,
        ),
    ).exists()


def revoke_lessons_teacher_access(person: Person) -> int:
    """Remove LESSONS TEACHER assignments only (not coordinator levels)."""
    deleted, _ = ModuleCoordinator.objects.filter(
        person=person,
        module=ModuleCoordinator.ModuleType.LESSONS,
        level=ModuleCoordinator.CoordinatorLevel.TEACHER,
    ).delete()
    return deleted


def sync_ncc_member_access(
    membership: MinistryMember,
    *,
    grant_lessons_teacher_access_flag: Optional[bool] = None,
) -> None:
    """
    Apply Lessons TEACHER ModuleCoordinator sync for an NCC roster membership.

    - Inactive membership always revokes TEACHER access.
    - Active membership: grant when flag is True; revoke when flag is False;
      when flag is None on update, leave access unchanged.
    """
    if not is_ncc_ministry(membership.ministry):
        return

    if not membership.is_active:
        revoke_lessons_teacher_access(membership.member)
        return

    if grant_lessons_teacher_access_flag is True:
        grant_lessons_teacher_access(membership.member)
    elif grant_lessons_teacher_access_flag is False:
        revoke_lessons_teacher_access(membership.member)


def user_is_lessons_roster_manager(user: Person) -> bool:
    if not user or not getattr(user, "is_authenticated", False):
        return False
    if user.role in ("ADMIN", "PASTOR"):
        return True
    return user.module_coordinator_assignments.filter(
        module=ModuleCoordinator.ModuleType.LESSONS,
        level__in=(
            ModuleCoordinator.CoordinatorLevel.COORDINATOR,
            ModuleCoordinator.CoordinatorLevel.SENIOR_COORDINATOR,
        ),
    ).exists()


def user_can_manage_ncc_ministry(user: Person, ministry: Ministry) -> bool:
    """Branch-limited NCC roster management for Lessons managers / pastors / admins."""
    if not is_ncc_ministry(ministry):
        return False
    if not user_is_lessons_roster_manager(user):
        return False
    if can_pick_lessons_branch(user):
        return True
    return bool(user.branch_id and ministry.branch_id == user.branch_id)


def ncc_roster_person_ids_for_branch(branch_id: int) -> Iterable[int]:
    ministry = (
        Ministry.objects.filter(
            code=NCC_MINISTRY_CODE,
            branch_id=branch_id,
        )
        .only("id")
        .first()
    )
    if not ministry:
        return []
    return MinistryMember.objects.filter(ministry=ministry).values_list(
        "member_id", flat=True
    )


def person_on_ncc_roster(person: Person, branch: Optional[Branch] = None) -> bool:
    """True if person is on the branch NCC roster (active or inactive)."""
    branch = branch or getattr(person, "branch", None)
    if branch is None:
        return False
    return MinistryMember.objects.filter(
        ministry__code=NCC_MINISTRY_CODE,
        ministry__branch=branch,
        member=person,
    ).exists()
