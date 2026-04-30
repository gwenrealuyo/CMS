"""
Keep ModuleCoordinator scoped rows aligned with Cluster.coordinator.
"""

from typing import Optional

from django.db import transaction

from apps.people.models import ModuleCoordinator

from .models import Cluster


def sync_cluster_coordinator_module_assignment(
    cluster: Cluster,
    previous_coordinator_id: Optional[int],
) -> None:
    """
    For this cluster's coordinator FK, ensure a ModuleCoordinator row exists with
    resource_id=cluster.id and level=COORDINATOR; remove that scoped row from the
    previous coordinator when the FK changes or is cleared.

    Does not modify SENIOR_COORDINATOR rows or legacy resource_id=None assignments.
    """
    if cluster.pk is None:
        return

    current_id = cluster.coordinator_id

    with transaction.atomic():
        if (
            previous_coordinator_id is not None
            and previous_coordinator_id != current_id
        ):
            ModuleCoordinator.objects.filter(
                person_id=previous_coordinator_id,
                module=ModuleCoordinator.ModuleType.CLUSTER,
                resource_id=cluster.id,
                level=ModuleCoordinator.CoordinatorLevel.COORDINATOR,
            ).delete()

        if current_id is not None:
            ModuleCoordinator.objects.update_or_create(
                person_id=current_id,
                module=ModuleCoordinator.ModuleType.CLUSTER,
                resource_id=cluster.id,
                defaults={
                    "level": ModuleCoordinator.CoordinatorLevel.COORDINATOR,
                    "resource_type": "Cluster",
                },
            )
