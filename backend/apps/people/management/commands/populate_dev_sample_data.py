"""
Orchestrate dev sample-data seeding with schema sync first.

Sync includes legacy Person.role='COORDINATOR' normalization (converted to MEMBER).

Usage:
    python manage.py populate_dev_sample_data
    python manage.py populate_dev_sample_data --reset
    python manage.py populate_dev_sample_data --people 30 --families 8 --clusters 5
"""

from django.core.management import call_command
from django.core.management.base import BaseCommand

from apps.clusters.models import Cluster
from apps.people.models import Person
from apps.people.sample_data_schema import sync_sample_data_schema


class Command(BaseCommand):
    help = (
        "Sync migrations/schema, then seed people, clusters, and evangelism sample data. "
        "Development only — do not run in production."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--reset",
            action="store_true",
            help="Clear people/families, clusters, and evangelism sample data before seeding",
        )
        parser.add_argument(
            "--people",
            type=int,
            default=30,
            help="Number of people to create (default: 30)",
        )
        parser.add_argument(
            "--families",
            type=int,
            default=8,
            help="Number of families to create (default: 8)",
        )
        parser.add_argument(
            "--clusters",
            type=int,
            default=5,
            help="Number of clusters to create (default: 5)",
        )
        parser.add_argument(
            "--skip-clusters",
            action="store_true",
            help="Skip cluster sample data",
        )
        parser.add_argument(
            "--skip-evangelism",
            action="store_true",
            help="Skip evangelism sample data",
        )
        parser.add_argument(
            "--skip-schema-sync",
            action="store_true",
            help="Skip migration apply and schema drift repair (not recommended)",
        )

    def handle(self, *args, **options):
        if not options["skip_schema_sync"]:
            self.stdout.write("Syncing migrations and checking schema...")
            actions = sync_sample_data_schema(stdout=self.stdout)
            if actions:
                self.stdout.write(
                    self.style.WARNING(f"  Repaired: {', '.join(actions)}")
                )
            else:
                self.stdout.write(self.style.SUCCESS("  Schema OK"))

        reset = options["reset"]

        people_exist = Person.objects.exclude(role="ADMIN").exists()
        if people_exist and not reset:
            self.stdout.write(
                self.style.WARNING(
                    "\n1/3 Skipping people/families — data already exists "
                    "(use --reset to replace)"
                )
            )
        else:
            sample_args = [
                "--people",
                str(options["people"]),
                "--families",
                str(options["families"]),
            ]
            if reset and people_exist:
                sample_args.append("--clear")

            self.stdout.write("\n1/3 Seeding people and families...")
            call_command("populate_sample_data", *sample_args, stdout=self.stdout)

        if not options["skip_clusters"]:
            clusters_exist = Cluster.objects.exists()
            if clusters_exist and not reset:
                self.stdout.write(
                    self.style.WARNING(
                        "\n2/3 Skipping clusters — data already exists "
                        "(use --reset or populate_clusters_data --clear to replace)"
                    )
                )
            else:
                cluster_args = [
                    "--clusters",
                    str(options["clusters"]),
                ]
                if reset or not clusters_exist:
                    if reset and clusters_exist:
                        cluster_args.append("--clear")
                    self.stdout.write("\n2/3 Seeding clusters...")
                    call_command(
                        "populate_clusters_data", *cluster_args, stdout=self.stdout
                    )
        else:
            self.stdout.write("\n2/3 Skipping clusters (--skip-clusters)")

        if not options["skip_evangelism"]:
            self.stdout.write("\n3/3 Seeding evangelism...")
            call_command(
                "populate_evangelism_data",
                "--clear",
                stdout=self.stdout,
            )
        else:
            self.stdout.write("\n3/3 Skipping evangelism (--skip-evangelism)")

        self.stdout.write(
            self.style.SUCCESS("\nDev sample data ready. Sample user password: password123")
        )
