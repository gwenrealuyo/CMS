"""Access helpers for ministry visibility, roster privacy, and coordinator edit."""

from __future__ import annotations

from typing import Optional

from django.db.models import Q, QuerySet

from apps.people.models import ModuleCoordinator

from .cluster_committee import is_cluster_committee_ministry
from .models import (
    CLUSTER_COMMITTEE_MINISTRY_CODE,
    Ministry,
    MinistryMember,
    MinistryRole,
    MinistryVisibility,
)
from .bible_sharers import (
    is_bible_sharers_ministry,
    user_can_manage_bible_sharers_ministry,
)
from .ncc import is_ncc_ministry, user_can_manage_ncc_ministry

# Fields a ministry primary/support coordinator may not change without Ministries write.
COORDINATOR_LOCKED_MINISTRY_FIELDS = frozenset(
    {
        "code",
        "scope",
        "branch",
        "visibility",
        "is_active",
        "primary_coordinator",
        "primary_coordinator_id",
        "support_coordinators",
        "support_coordinator_ids",
    }
)

COORDINATOR_MEMBERSHIP_ROLES = frozenset(
    {
        MinistryRole.PRIMARY_COORDINATOR,
        MinistryRole.COORDINATOR,
    }
)


def user_has_ministries_write(user) -> bool:
    if not user or not getattr(user, "is_authenticated", False):
        return False
    if getattr(user, "role", None) in ("ADMIN", "PASTOR"):
        return True
    if not hasattr(user, "module_coordinator_assignments"):
        return False
    return user.module_coordinator_assignments.filter(
        module=ModuleCoordinator.ModuleType.MINISTRIES,
        level__in=(
            ModuleCoordinator.CoordinatorLevel.COORDINATOR,
            ModuleCoordinator.CoordinatorLevel.SENIOR_COORDINATOR,
            ModuleCoordinator.CoordinatorLevel.TEACHER,
            ModuleCoordinator.CoordinatorLevel.BIBLE_SHARER,
        ),
    ).exists()


def user_is_ministry_coordinator(user, ministry: Optional[Ministry]) -> bool:
    if not user or not ministry or not getattr(user, "pk", None):
        return False
    if ministry.primary_coordinator_id == user.pk:
        return True
    return ministry.support_coordinators.filter(pk=user.pk).exists()


def user_is_hq_cluster_senior(user) -> bool:
    if not user or not getattr(user, "is_authenticated", False):
        return False
    if not hasattr(user, "is_senior_coordinator"):
        return False
    if not user.is_senior_coordinator(ModuleCoordinator.ModuleType.CLUSTER):
        return False
    from apps.clusters.permissions import _user_branch_is_headquarters

    return _user_branch_is_headquarters(user)


def user_can_view_internal_ministries(user) -> bool:
    """Whether the UI should offer Internal / All directory filters."""
    if not user or not getattr(user, "is_authenticated", False):
        return False
    if getattr(user, "role", None) in ("ADMIN", "PASTOR"):
        return True
    if user_has_ministries_write(user):
        return True
    if user_is_hq_cluster_senior(user):
        return True
    if Ministry.objects.filter(primary_coordinator=user).exists():
        return True
    if Ministry.objects.filter(support_coordinators=user).exists():
        return True
    return False


def user_can_see_internal_ministry(user, ministry: Ministry) -> bool:
    if not user or not ministry:
        return False
    if ministry.visibility != MinistryVisibility.INTERNAL:
        return True
    if getattr(user, "role", None) in ("ADMIN", "PASTOR"):
        return True
    if user_has_ministries_write(user):
        return True
    if user_is_ministry_coordinator(user, ministry):
        return True
    if is_cluster_committee_ministry(ministry) and user_is_hq_cluster_senior(user):
        return True
    return False


def filter_internal_ministries_for_user(queryset: QuerySet, user) -> QuerySet:
    """INTERNAL rows the user is allowed to see (within an already branch-scoped qs)."""
    if not user or not getattr(user, "is_authenticated", False):
        return queryset.none()
    internal = queryset.filter(visibility=MinistryVisibility.INTERNAL)
    if getattr(user, "role", None) in ("ADMIN", "PASTOR") or user_has_ministries_write(
        user
    ):
        return internal
    as_coord = internal.filter(
        Q(primary_coordinator=user) | Q(support_coordinators=user)
    )
    if user_is_hq_cluster_senior(user):
        as_coord = as_coord | internal.filter(code=CLUSTER_COMMITTEE_MINISTRY_CODE)
    return as_coord.distinct()


def apply_ministry_visibility_filter(
    queryset: QuerySet, user, *, mode: str = "directory"
) -> QuerySet:
    """
    mode: directory (default) | internal | all
    """
    normalized = (mode or "directory").strip().lower()
    if normalized in ("", "directory"):
        return queryset.filter(visibility=MinistryVisibility.DIRECTORY)
    if normalized == "internal":
        return filter_internal_ministries_for_user(queryset, user)
    if normalized == "all":
        directory = queryset.filter(visibility=MinistryVisibility.DIRECTORY)
        internal = filter_internal_ministries_for_user(queryset, user)
        return (directory | internal).distinct()
    return queryset.filter(visibility=MinistryVisibility.DIRECTORY)


def apply_ministry_visibility_for_retrieve(queryset: QuerySet, user) -> QuerySet:
    """Directory rows plus internal rows the user may see."""
    return apply_ministry_visibility_filter(queryset, user, mode="all")


def user_can_view_ministry_roster(user, ministry: Optional[Ministry]) -> bool:
    if not user or not ministry or not getattr(user, "is_authenticated", False):
        return False
    if getattr(user, "role", None) in ("ADMIN", "PASTOR"):
        return True
    if user_has_ministries_write(user):
        return True
    if user_is_ministry_coordinator(user, ministry):
        return True
    if MinistryMember.objects.filter(
        ministry=ministry, member=user, is_active=True
    ).exists():
        return True
    if is_ncc_ministry(ministry) and user_can_manage_ncc_ministry(user, ministry):
        return True
    if is_bible_sharers_ministry(ministry) and user_can_manage_bible_sharers_ministry(
        user, ministry
    ):
        return True
    if is_cluster_committee_ministry(ministry) and user_is_hq_cluster_senior(user):
        return True
    return False


def user_can_edit_ministry(user, ministry: Optional[Ministry]) -> bool:
    """Whether the user may open the edit form / PATCH unlocked fields."""
    if not user or not ministry or not getattr(user, "is_authenticated", False):
        return False
    if user_has_ministries_write(user):
        return True
    if user_is_ministry_coordinator(user, ministry):
        return True
    if is_cluster_committee_ministry(ministry) and user_is_hq_cluster_senior(user):
        return True
    return False


def user_can_manage_ministry_members(user, ministry: Optional[Ministry]) -> bool:
    """Write access for team memberships (not necessarily leadership fields)."""
    if not user or not ministry or not getattr(user, "is_authenticated", False):
        return False
    if getattr(user, "role", None) in ("ADMIN", "PASTOR"):
        return True
    if user_has_ministries_write(user):
        return True
    if is_ncc_ministry(ministry):
        return user_can_manage_ncc_ministry(user, ministry)
    if is_bible_sharers_ministry(ministry):
        return user_can_manage_bible_sharers_ministry(user, ministry)
    if user_is_ministry_coordinator(user, ministry):
        return True
    if is_cluster_committee_ministry(ministry) and user_is_hq_cluster_senior(user):
        return True
    return False


def coordinator_only_edit(user, ministry: Optional[Ministry]) -> bool:
    """True when user may edit as coordinator but lacks Ministries write."""
    if not ministry:
        return False
    if user_has_ministries_write(user):
        return False
    return user_can_edit_ministry(user, ministry)
