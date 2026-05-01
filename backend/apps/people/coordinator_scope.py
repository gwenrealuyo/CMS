"""Helpers for module coordinator assignment scoping (multi-resource coordinators)."""

from __future__ import annotations

from typing import List, Optional


def coordinator_assigned_resource_ids_when_all_scoped(
    user,
    module: str,
    level: str,
) -> Optional[List[int]]:
    """
    Broad module access (returns None) when there are no matching rows or any row has
    resource_id NULL. Otherwise returns distinct non-null resource_id values for scoped
    list/object filtering.
    """
    if not getattr(user, "is_authenticated", False):
        return None
    qs = user.module_coordinator_assignments.filter(module=module, level=level)
    if not qs.exists():
        return None
    if qs.filter(resource_id__isnull=True).exists():
        return None
    return list(qs.values_list("resource_id", flat=True).distinct())
