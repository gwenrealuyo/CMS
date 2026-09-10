"""Headquarters Bible Sharers roster helpers (single HQ system ministry)."""

from __future__ import annotations

from typing import Optional

from django.db import transaction

from apps.people.models import Branch, ModuleCoordinator, Person

from .models import (
    BIBLE_SHARERS_MINISTRY_CODE,
    BIBLE_SHARERS_MINISTRY_NAME,
    Ministry,
    MinistryCadence,
    MinistryCategory,
    MinistryMember,
    MinistryRole,
    MinistryScope,
)

_EVANGELISM_MANAGER_LEVELS = (
    ModuleCoordinator.CoordinatorLevel.COORDINATOR,
    ModuleCoordinator.CoordinatorLevel.SENIOR_COORDINATOR,
)


def is_bible_sharers_ministry(ministry: Ministry | None) -> bool:
    if ministry is None:
        return False
    return bool(ministry.is_bible_sharers_roster)


def headquarters_branch() -> Optional[Branch]:
    return (
        Branch.objects.filter(is_headquarters=True, is_active=True)
        .order_by("id")
        .first()
    )


def get_bible_sharers_ministry() -> Optional[Ministry]:
    hq = headquarters_branch()
    if hq is None:
        return None
    return Ministry.objects.filter(
        code=BIBLE_SHARERS_MINISTRY_CODE,
        branch=hq,
    ).first()


@transaction.atomic
def ensure_bible_sharers_ministry() -> Optional[Ministry]:
    """Get or create the HQ-branch Bible Sharers roster. No-op without an HQ branch."""
    hq = headquarters_branch()
    if hq is None:
        return None
    ministry, created = Ministry.objects.get_or_create(
        code=BIBLE_SHARERS_MINISTRY_CODE,
        branch=hq,
        defaults={
            "name": BIBLE_SHARERS_MINISTRY_NAME,
            "scope": MinistryScope.BRANCH,
            "is_system": True,
            "category": MinistryCategory.OUTREACH,
            "activity_cadence": MinistryCadence.WEEKLY,
            "description": (
                "Headquarters Bible Sharers roster. People on this roster can "
                "be assigned as Bible Sharers on HQ evangelism groups."
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
    if ministry.branch_id != hq.id:
        ministry.branch = hq
        update_fields.append("branch")
    if update_fields:
        ministry.save(update_fields=update_fields + ["updated_at"])
    return ministry


def bible_sharers_roster_person_ids() -> set[int]:
    ministry = get_bible_sharers_ministry()
    if ministry is None:
        return set()
    return set(
        MinistryMember.objects.filter(ministry=ministry).values_list(
            "member_id", flat=True
        )
    )


def person_on_bible_sharers_roster(person: Person) -> bool:
    """True if person is on the HQ Bible Sharers roster (active or inactive)."""
    if person is None:
        return False
    ministry = get_bible_sharers_ministry()
    if ministry is None:
        return False
    return MinistryMember.objects.filter(
        ministry=ministry,
        member=person,
    ).exists()


def user_is_bible_sharers_roster_manager(user: Person) -> bool:
    """
    Who may be considered for HQ roster management.

    Satellite pastors are excluded; HQ pastors qualify via can_see_all_branches.
    """
    if not user or not getattr(user, "is_authenticated", False):
        return False
    if user.role == "ADMIN":
        return True
    if user.role == "PASTOR" and user.can_see_all_branches():
        return True
    return user.module_coordinator_assignments.filter(
        module=ModuleCoordinator.ModuleType.EVANGELISM,
        level__in=_EVANGELISM_MANAGER_LEVELS,
    ).exists()


def user_can_manage_bible_sharers_ministry(user: Person, ministry: Ministry) -> bool:
    if not is_bible_sharers_ministry(ministry):
        return False
    if not user_is_bible_sharers_roster_manager(user):
        return False
    if user.role == "ADMIN" or user.can_see_all_branches():
        return True
    if user.is_senior_coordinator(ModuleCoordinator.ModuleType.EVANGELISM):
        return True
    return bool(user.branch_id and ministry.branch_id == user.branch_id)


def _ensure_bible_sharers_membership(person: Person, ministry: Ministry) -> bool:
    if person is None or ministry is None:
        return False
    _, created = MinistryMember.objects.get_or_create(
        ministry=ministry,
        member=person,
        defaults={"role": MinistryRole.TEAM_MEMBER, "is_active": True},
    )
    return created


def backfill_bible_sharers_roster_from_assignments() -> int:
    """
    Add people who already have EVANGELISM BIBLE_SHARER on HQ groups.

    Does not create extra ModuleCoordinator rows.
    Returns the number of memberships created.
    """
    from apps.evangelism.models import EvangelismGroup

    ministry = ensure_bible_sharers_ministry()
    if ministry is None:
        return 0

    hq_group_ids = EvangelismGroup.objects.filter(
        cluster__branch__is_headquarters=True,
    ).values_list("id", flat=True)
    people = (
        Person.objects.filter(
            module_coordinator_assignments__module=ModuleCoordinator.ModuleType.EVANGELISM,
            module_coordinator_assignments__level=(
                ModuleCoordinator.CoordinatorLevel.BIBLE_SHARER
            ),
            module_coordinator_assignments__resource_id__in=hq_group_ids,
        )
        .distinct()
    )
    created = 0
    for person in people.iterator():
        if _ensure_bible_sharers_membership(person, ministry):
            created += 1
    return created
