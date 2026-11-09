from django.core.management.base import BaseCommand

from apps.clusters.primary_membership import backfill_primary_clusters


class Command(BaseCommand):
    help = (
        "Set Person.primary_cluster from memberships "
        "(sole = that cluster; multi = lowest cluster id)."
    )

    def handle(self, *args, **options):
        counts = backfill_primary_clusters()
        self.stdout.write(
            self.style.SUCCESS(
                "Primary cluster backfill: "
                f"cleared={counts['cleared']} "
                f"sole={counts['updated_sole']} "
                f"multi={counts['updated_multi']}"
            )
        )
