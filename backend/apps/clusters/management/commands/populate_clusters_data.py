"""
Management command to populate the database with sample cluster data
Usage: python manage.py populate_clusters_data
"""

from django.core.management.base import BaseCommand
from apps.clusters.models import Cluster, ClusterWeeklyReport
from apps.people.models import Person, Family
from datetime import datetime, timedelta, date
from decimal import Decimal
import random


class Command(BaseCommand):
    help = "Populates the database with sample cluster data for testing"

    def add_arguments(self, parser):
        parser.add_argument(
            "--clusters",
            type=int,
            default=5,
            help="Number of clusters to create (default: 5)",
        )
        parser.add_argument(
            "--reports",
            type=int,
            default=12,
            help="Number of weekly reports per cluster (default: 12)",
        )
        parser.add_argument(
            "--clear",
            action="store_true",
            help="Clear existing cluster data before populating",
        )

    def handle(self, *args, **options):
        num_clusters = options["clusters"]
        num_reports = options["reports"]
        clear_existing = options["clear"]

        if clear_existing:
            self.stdout.write("Clearing existing cluster data...")
            ClusterWeeklyReport.objects.all().delete()
            Cluster.objects.all().delete()

        # Check if we have people and families
        people = list(Person.objects.all())
        families = list(Family.objects.all())

        if not people:
            self.stdout.write(
                self.style.ERROR(
                    "No people found in database. Please run populate_sample_data first."
                )
            )
            return

        if not families:
            self.stdout.write(
                self.style.WARNING(
                    "No families found. Clusters will be created without families."
                )
            )

        # Cluster names
        cluster_names = [
            "North Cluster",
            "South Cluster",
            "East Cluster",
            "West Cluster",
            "Central Cluster",
            "Riverside Cluster",
            "Hillside Cluster",
            "Valley Cluster",
            "Summit Cluster",
            "Prairie Cluster",
        ]

        # Create Clusters
        clusters = []
        for i in range(num_clusters):
            cluster_name = cluster_names[i % len(cluster_names)]
            cluster_code = f"CLU-{str(i + 1).zfill(3)}"

            # Select a random coordinator (prefer COORDINATOR role, fallback to any)
            coordinators = [p for p in people if p.role == "COORDINATOR"]
            if not coordinators:
                coordinators = people
            coordinator = random.choice(coordinators) if coordinators else None

            cluster = Cluster(
                name=cluster_name,
                code=cluster_code,
                coordinator=coordinator,
                location=f"{cluster_name} Location",
                meeting_schedule=f"Every {random.choice(['Sunday', 'Wednesday', 'Friday'])} at {random.randint(6, 8)} PM",
                description=f"{cluster_name} focuses on community building and spiritual growth",
            )
            cluster.save()

            # Add 1-3 families to cluster if available
            if families:
                num_families_in_cluster = random.randint(1, min(3, len(families)))
                cluster_families = random.sample(families, num_families_in_cluster)
                cluster.families.add(*cluster_families)

            # Add 3-8 individual members to cluster
            num_individual_members = random.randint(3, 8)
            individual_members = random.sample(
                [p for p in people if p not in cluster.members.all()],
                min(num_individual_members, len(people) - cluster.members.count()),
            )
            cluster.members.add(*individual_members)

            clusters.append(cluster)

        self.stdout.write(self.style.SUCCESS(f"✓ Created {len(clusters)} clusters"))

        # Create Cluster Weekly Reports
        today = date.today()
        gathering_types = ["PHYSICAL", "ONLINE", "HYBRID"]
        activities = [
            "Bible Study",
            "Prayer Meeting",
            "Fellowship",
            "Worship",
            "Testimony Sharing",
            "Evangelism Training",
        ]

        for cluster in clusters:
            cluster_all_members = list(cluster.members.all())
            cluster_members = [m for m in cluster_all_members if m.role == "MEMBER"]
            cluster_visitors = [m for m in cluster_all_members if m.role == "VISITOR"]

            for week_offset in range(num_reports):
                # Calculate week date (going backwards from today)
                week_date = today - timedelta(weeks=week_offset)
                year = week_date.year
                week_number = week_date.isocalendar()[1]

                # Random attendance (50-100% of members)
                if cluster_members:
                    num_members_attended = random.randint(
                        max(1, len(cluster_members) // 2),
                        len(cluster_members),
                    )
                    members_attended = random.sample(
                        cluster_members, num_members_attended
                    )
                else:
                    members_attended = []

                # Random visitors (0-3)
                num_visitors_attended = random.randint(0, min(3, len(cluster_visitors)))
                visitors_attended = (
                    random.sample(cluster_visitors, num_visitors_attended)
                    if cluster_visitors
                    else []
                )

                report = ClusterWeeklyReport(
                    cluster=cluster,
                    year=year,
                    week_number=week_number,
                    meeting_date=week_date,
                    gathering_type=random.choice(gathering_types),
                    activities_held=random.choice(activities),
                    prayer_requests=random.choice(
                        [
                            "Prayer for new members",
                            "Prayer for healing",
                            "Prayer for families",
                            "Prayer for outreach",
                            "",
                        ]
                    ),
                    testimonies=random.choice(
                        [
                            "Member shared about answered prayer",
                            "New member shared conversion story",
                            "Member shared about God's provision",
                            "",
                        ]
                    ),
                    offerings=Decimal(random.randint(500, 5000)),
                    highlights=random.choice(
                        [
                            "Great attendance this week",
                            "New members joined the cluster",
                            "Powerful worship time",
                            "Strong fellowship",
                        ]
                    ),
                    lowlights=random.choice(
                        [
                            "Some members were absent",
                            "Technical issues during online meeting",
                            "",
                        ]
                    ),
                    submitted_by=cluster.coordinator,
                )
                report.save()
                report.members_attended.add(*members_attended)
                report.visitors_attended.add(*visitors_attended)

        self.stdout.write(
            self.style.SUCCESS(
                f"✓ Created {num_reports} weekly reports for each cluster"
            )
        )

        # Summary
        self.stdout.write(self.style.SUCCESS("\n✓ Cluster data population complete!"))
        self.stdout.write(f"  • Clusters: {Cluster.objects.count()}")
        self.stdout.write(f"  • Weekly Reports: {ClusterWeeklyReport.objects.count()}")
