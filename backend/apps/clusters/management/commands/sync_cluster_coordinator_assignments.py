from django.core.management.base import BaseCommand

from apps.clusters.models import Cluster
from apps.clusters.coordinator_assignments import sync_cluster_coordinator_module_assignment


class Command(BaseCommand):
    help = (
        "Ensure ModuleCoordinator scoped rows exist for each cluster's coordinator "
        "(resource_id=cluster id, level=COORDINATOR)."
    )

    def handle(self, *args, **options):
        qs = Cluster.objects.exclude(coordinator_id__isnull=True)
        count = 0
        for cluster in qs.iterator():
            sync_cluster_coordinator_module_assignment(
                cluster, cluster.coordinator_id
            )
            count += 1
        self.stdout.write(
            self.style.SUCCESS(
                f"Synced coordinator assignments for {count} cluster(s)."
            )
        )
