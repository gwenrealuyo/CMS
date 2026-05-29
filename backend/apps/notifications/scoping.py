"""Coordinator scoping helpers for notification feed builders."""

from __future__ import annotations

from typing import List

from apps.clusters.models import Cluster
from apps.evangelism.models import EvangelismGroup
from apps.people.coordinator_scope import coordinator_assigned_resource_ids_when_all_scoped
from apps.people.models import ModuleCoordinator


def managed_evangelism_group_ids_for_coordinator(user) -> List[int]:
    """
    Evangelism group PKs the user must submit weekly reports for.

    Uses group FK coordinator plus scoped ModuleCoordinator resource_id rows.
    Broad (NULL resource_id) senior assignments do not expand to all groups.
    """
    if not getattr(user, "is_authenticated", False):
        return []

    fk_ids = list(
        EvangelismGroup.objects.filter(
            coordinator=user, is_active=True
        ).values_list("id", flat=True)
    )

    scoped = coordinator_assigned_resource_ids_when_all_scoped(
        user,
        ModuleCoordinator.ModuleType.EVANGELISM,
        ModuleCoordinator.CoordinatorLevel.COORDINATOR,
    )
    if scoped is not None:
        return list(set(fk_ids + scoped))

    return list(set(fk_ids))


def evangelism_groups_queryset_for_user(user):
    """Active evangelism groups visible for oversight notification logic."""
    qs = EvangelismGroup.objects.filter(is_active=True)
    if getattr(user, "role", None) in ("ADMIN", "PASTOR"):
        return qs
    if user.is_senior_coordinator(ModuleCoordinator.ModuleType.EVANGELISM):
        return qs
    managed = managed_evangelism_group_ids_for_coordinator(user)
    if not managed:
        return qs.none()
    return qs.filter(id__in=managed)


def clusters_oversight_queryset_for_user(user):
    """Clusters an oversight role can see missing reports for (not own-managed due)."""
    qs = Cluster.objects.all()
    role = getattr(user, "role", None)
    if role == "ADMIN":
        return qs
    if role == "PASTOR":
        branch = getattr(user, "branch", None)
        if branch and not user.can_see_all_branches():
            return qs.filter(branch=branch)
        return qs
    if user.is_senior_coordinator(ModuleCoordinator.ModuleType.CLUSTER):
        return qs
    return qs.none()
