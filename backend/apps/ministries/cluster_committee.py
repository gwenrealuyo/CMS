"""Per-branch Cluster Committee roster (primary + support coordinators).

Access is derived at runtime. These helpers do not create ModuleCoordinator rows.
"""

from __future__ import annotations

from typing import Optional

from django.db import transaction

from apps.people.models import Branch, Person

from .models import (
    CLUSTER_COMMITTEE_MINISTRY_CODE,
    CLUSTER_COMMITTEE_MINISTRY_NAME,
    Ministry,
    MinistryCategory,
    MinistryCadence,
    MinistryScope,
)


def is_cluster_committee_ministry(ministry: Optional[Ministry]) -> bool:
    if ministry is None:
        return False
    return bool(ministry.is_cluster_committee_roster)


def _active_committee_qs():
    return Ministry.objects.filter(
        code=CLUSTER_COMMITTEE_MINISTRY_CODE,
        is_active=True,
    )


def is_cluster_committee_primary(user: Optional[Person]) -> bool:
    if not user or not getattr(user, "is_authenticated", False):
        return False
    if not getattr(user, "pk", None):
        return False
    return _active_committee_qs().filter(primary_coordinator_id=user.pk).exists()


def is_cluster_committee_support(user: Optional[Person]) -> bool:
    if not user or not getattr(user, "is_authenticated", False):
        return False
    if not getattr(user, "pk", None):
        return False
    if is_cluster_committee_primary(user):
        return False
    return _active_committee_qs().filter(support_coordinators=user).exists()


def is_cluster_committee_primary_at_headquarters(user: Optional[Person]) -> bool:
    if not user or not getattr(user, "is_authenticated", False):
        return False
    if not getattr(user, "pk", None):
        return False
    return _active_committee_qs().filter(
        primary_coordinator_id=user.pk,
        branch__is_headquarters=True,
    ).exists()


def cluster_committee_role(user: Optional[Person]) -> Optional[str]:
    if is_cluster_committee_primary(user):
        return "PRIMARY"
    if is_cluster_committee_support(user):
        return "SUPPORT"
    return None


@transaction.atomic
def ensure_cluster_committee_ministry(branch: Branch) -> Ministry:
    """Get or create the BRANCH-scoped Cluster Committee ministry for a branch."""
    ministry, _created = Ministry.objects.get_or_create(
        code=CLUSTER_COMMITTEE_MINISTRY_CODE,
        branch=branch,
        defaults={
            "name": CLUSTER_COMMITTEE_MINISTRY_NAME,
            "scope": MinistryScope.BRANCH,
            "is_system": True,
            "category": MinistryCategory.CARE,
            "activity_cadence": MinistryCadence.WEEKLY,
            "description": (
                "Cluster Committee roster for this branch. "
                "Primary Coordinator and Support Coordinators share in-branch "
                "Cluster oversight. All-branch Cluster oversight stays with "
                "headquarters."
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
    if update_fields:
        ministry.save(update_fields=update_fields + ["updated_at"])
    return ministry


def seed_cluster_committee_ministries_for_all_branches() -> int:
    """Ensure a Cluster Committee ministry exists for every active branch."""
    created = 0
    for branch in Branch.objects.filter(is_active=True).iterator():
        before = Ministry.objects.filter(
            code=CLUSTER_COMMITTEE_MINISTRY_CODE,
            branch=branch,
        ).exists()
        ensure_cluster_committee_ministry(branch)
        if not before:
            created += 1
    return created
