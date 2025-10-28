"""
Management command to populate the database with sample data
Usage: python manage.py populate_sample_data
"""

from django.core.management.base import BaseCommand
from django.contrib.auth.hashers import make_password
from apps.people.models import Person, Family, Cluster, Milestone, ClusterWeeklyReport
from datetime import datetime, timedelta
from decimal import Decimal
import random


class Command(BaseCommand):
    help = "Populates the database with sample data for testing"

    def add_arguments(self, parser):
        parser.add_argument(
            "--people",
            type=int,
            default=50,
            help="Number of people to create (default: 50)",
        )
        parser.add_argument(
            "--families",
            type=int,
            default=10,
            help="Number of families to create (default: 10)",
        )
        parser.add_argument(
            "--clusters",
            type=int,
            default=5,
            help="Number of clusters to create (default: 5)",
        )
        parser.add_argument(
            "--clear", action="store_true", help="Clear existing data before populating"
        )

    def handle(self, *args, **options):
        num_people = options["people"]
        num_families = options["families"]
        num_clusters = options["clusters"]
        clear_existing = options["clear"]

        if clear_existing:
            self.stdout.write("Clearing existing data...")
            ClusterWeeklyReport.objects.all().delete()
            Milestone.objects.all().delete()
            Cluster.objects.all().delete()
            Family.objects.all().delete()
            Person.objects.filter(
                role__in=["MEMBER", "VISITOR", "COORDINATOR"]
            ).delete()

        self.stdout.write("Creating sample data...")

        # Filipino first names (majority)
        filipino_first_names = [
            "Maria",
            "Jose",
            "Juan",
            "Luz",
            "Rosa",
            "Antonio",
            "Ana",
            "Francisco",
            "Mariano",
            "Catalina",
            "Felipe",
            "Juanita",
            "Pedro",
            "Mercedes",
            "Andres",
            "Isabella",
            "Carlos",
            "Dolores",
            "Manuel",
            "Esperanza",
            "Fernando",
            "Carmen",
            "Roberto",
            "Diana",
            "Rafael",
            "Cecilia",
            "Miguel",
            "Amparo",
            "Alberto",
            "Angelita",
            "Felix",
            "Victoria",
            "Eduardo",
            "Patricia",
            "Jorge",
            "Rita",
            "Manuel",
            "Consuelo",
            "Sergio",
            "Guadalupe",
            "Benito",
            "Magdalena",
            "Emilio",
            "Teresa",
            "Rolando",
            "Elena",
            "Mario",
            "Rosario",
        ]

        # International first names (minority)
        international_first_names = [
            "John",
            "Mary",
            "David",
            "Sarah",
            "Michael",
            "Jennifer",
            "James",
            "Elizabeth",
            "Robert",
            "Patricia",
            "William",
            "Linda",
            "Richard",
            "Barbara",
            "Joseph",
            "Susan",
            "Thomas",
            "Jessica",
            "Charles",
            "Margaret",
            "Daniel",
            "Nancy",
            "Matthew",
            "Karen",
        ]

        # Filipino last names (majority)
        filipino_last_names = [
            "Dela Cruz",
            "Garcia",
            "Reyes",
            "Ramos",
            "Mendoza",
            "Santos",
            "Cruz",
            "Bautista",
            "Villanueva",
            "Fernandez",
            "Torres",
            "Ramos",
            "Perez",
            "Antonio",
            "Gomez",
            "Rodriguez",
            "Lopez",
            "Diaz",
            "Morales",
            "Panganiban",
            "Castro",
            "Villanueva",
            "Aguilar",
            "Marquez",
            "Agustin",
            "Bautista",
            "Espiritu",
            "Navarro",
            "Sarmiento",
            "Mercado",
            "Flores",
            "Rosales",
            "Ignacio",
            "Sanchez",
            "Medina",
            "Bernardo",
            "Dominguez",
            "Evangelista",
            "Manalo",
            "Alvarez",
            "Macaraeg",
            "Abella",
            "Basilio",
            "Carreon",
            "Del Rosario",
            "Estrada",
            "Gabriel",
            "Hernandez",
        ]

        # International last names (minority)
        international_last_names = [
            "Smith",
            "Johnson",
            "Williams",
            "Brown",
            "Jones",
            "Garcia",
            "Miller",
            "Davis",
            "Rodriguez",
            "Martinez",
            "Hernandez",
            "Lopez",
            "Gonzalez",
            "Wilson",
            "Anderson",
        ]

        roles = ["MEMBER", "VISITOR", "COORDINATOR", "PASTOR"]
        statuses = ["ACTIVE", "SEMIACTIVE", "INACTIVE"]
        genders = ["MALE", "FEMALE"]
        activities = [
            "SUNDAY_SERVICE",
            "CLUSTER_BS_EVANGELISM",
            "DOCTRINAL_CLASS",
            "PRAYER_MEETING",
            "MINI_WORSHIP",
            "CONFERENCE",
        ]

        # Create People
        people = []
        # Filipino middle names
        filipino_middle_names = [
            "Marie",
            "Cruz",
            "Santos",
            "Reyes",
            "Ramos",
            "Morales",
            "Dela Cruz",
            "Fernandez",
            "Torres",
            "",
        ]

        for i in range(num_people):
            # 80% Filipino, 20% international
            is_filipino = random.random() < 0.8

            if is_filipino:
                first_name = random.choice(filipino_first_names)
                last_name = random.choice(filipino_last_names)
                middle_name = random.choice(filipino_middle_names)
                phone = f"+63-9{random.randint(10, 99)}-{random.randint(100, 999)}-{random.randint(1000, 9999)}"
                country = "PH"
                # Filipino addresses
                streets = [
                    "Rizal",
                    "Bonifacio",
                    "Aguinaldo",
                    "Luna",
                    "Quezon",
                    "Roxas",
                    "Marcos",
                    "Mabini",
                    "Burgos",
                    "Jacinto",
                ]
                address_types = ["Avenue", "Street", "Boulevard", "Road", "Drive"]
                barangays = [
                    "Poblacion",
                    "San Jose",
                    "Santa Maria",
                    "San Miguel",
                    "San Juan",
                    "San Pedro",
                    "Santo Niño",
                    "Santo Cristo",
                    "Bagong Barrio",
                    "Maharlika",
                ]
                address = (
                    f"#{random.randint(1, 999)} {random.choice(streets)} {random.choice(address_types)}, "
                    f"Brgy. {random.choice(barangays)}"
                )
            else:
                first_name = random.choice(international_first_names)
                last_name = random.choice(international_last_names)
                middle_name = random.choice(
                    ["", "Marie", "Anne", "Joseph", "Michael", "Jean"]
                )
                phone = f"+1-{random.randint(200, 999)}-{random.randint(100, 999)}-{random.randint(1000, 9999)}"
                # Various countries for minority
                countries = ["US", "CA", "AU", "GB", "NZ"]
                country = random.choice(countries)
                address = f"{random.randint(100, 9999)} {random.choice(['Main', 'Oak', 'Elm', 'Park', 'First', 'Maple'])} St."

            username = f"{first_name.lower().replace(' ', '')}.{last_name.lower().replace(' ', '')}{i}"

            # Create date within last 5 years
            years_ago = random.randint(0, 5)
            first_attended = datetime.now() - timedelta(days=years_ago * 365)

            # Determine baptism dates
            role_choice = random.choice(roles)
            water_date = None
            spirit_date = None
            if role_choice in ["MEMBER", "COORDINATOR", "PASTOR"]:
                # Ensure both baptism dates exist for core roles
                water_date = first_attended.date() + timedelta(
                    days=random.randint(30, 180)
                )
                spirit_date = water_date + timedelta(days=random.randint(30, 240))
            else:
                # Visitors may or may not have baptism dates
                if random.random() > 0.5:
                    water_date = first_attended.date() + timedelta(
                        days=random.randint(60, 240)
                    )
                if water_date and random.random() > 0.5:
                    spirit_date = water_date + timedelta(days=random.randint(30, 240))

            person = Person(
                username=username,
                first_name=first_name,
                last_name=last_name,
                middle_name=middle_name,
                email=f"{username}@example.com",
                role=role_choice,
                status=random.choice(statuses),
                gender=random.choice(genders),
                phone=phone,
                address=address,
                country=country,
                date_of_birth=datetime.now().date()
                - timedelta(days=random.randint(18 * 365, 70 * 365)),
                date_first_attended=first_attended.date(),
                water_baptism_date=water_date,
                spirit_baptism_date=spirit_date,
                first_activity_attended=random.choice(activities),
                member_id=(
                    f"MEM-{random.randint(1000, 9999)}" if random.random() > 0.3 else ""
                ),
                facebook_name=f"{first_name} {last_name}",
                password=make_password("password123"),
            )
            person.save()
            people.append(person)

            # Create some milestones for each person
            if random.random() > 0.5:
                milestone = Milestone(
                    user=person,
                    title=random.choice(
                        [
                            "Water Baptism",
                            "Spirit Baptism",
                            "Cluster Meeting",
                            "Testimony",
                        ]
                    ),
                    date=person.date_first_attended
                    + timedelta(days=random.randint(1, 365)),
                    type=random.choice(
                        ["LESSON", "BAPTISM", "SPIRIT", "CLUSTER", "NOTE"]
                    ),
                    description=f"Milestone for {person.first_name} {person.last_name}",
                )
                milestone.save()

        self.stdout.write(self.style.SUCCESS(f"✓ Created {len(people)} people"))

        # Create Families
        families = []
        for i in range(num_families):
            family_name = random.choice(filipino_last_names)

            # Select a leader from members
            potential_leaders = [
                p for p in people if p.role in ["MEMBER", "COORDINATOR"]
            ]
            leader = (
                random.choice(potential_leaders) if potential_leaders else people[0]
            )

            family = Family(
                name=family_name,
                leader=leader,
                address=f"{random.randint(100, 9999)} {random.choice(['Family', 'Lane', 'Drive', 'Avenue'])}",
                notes=f"Family established in {random.choice(['2020', '2021', '2022', '2023', '2024'])}",
            )
            family.save()

            # Add 2-5 members to each family
            num_members = random.randint(2, 5)
            family_members = random.sample(
                [p for p in people if p.id != leader.id],
                min(num_members - 1, len(people) - 1),
            )
            family.members.add(leader)
            family.members.add(*family_members)

            families.append(family)

        self.stdout.write(self.style.SUCCESS(f"✓ Created {len(families)} families"))

        # Create Clusters
        clusters = []
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

        for i in range(num_clusters):
            cluster_name = cluster_names[i % len(cluster_names)]
            cluster_code = f"CLU-{random.randint(100, 999)}"

            # Select a coordinator
            coordinators = [p for p in people if p.role in ["COORDINATOR", "PASTOR"]]
            coordinator = random.choice(coordinators) if coordinators else people[0]

            cluster = Cluster(
                name=cluster_name,
                code=cluster_code,
                coordinator=coordinator,
                location=random.choice(
                    ["Community Center", "Church Hall", "Member Home", "Park Pavilion"]
                ),
                meeting_schedule=random.choice(
                    [
                        "Sunday 2:00 PM",
                        "Saturday 3:00 PM",
                        "Wednesday 7:00 PM",
                        "Tuesday 6:00 PM",
                    ]
                ),
                description=f"{cluster_name} focuses on community building and spiritual growth",
            )
            cluster.save()

            # Add 1-3 families to cluster
            num_families_in_cluster = random.randint(1, min(3, len(families)))
            cluster_families = random.sample(families, num_families_in_cluster)
            cluster.families.add(*cluster_families)

            # Add some individual members
            num_individual_members = random.randint(3, 8)
            individual_members = random.sample(
                [p for p in people if p not in cluster.members.all()],
                min(num_individual_members, len(people) - cluster.members.count()),
            )
            cluster.members.add(*individual_members)

            clusters.append(cluster)

        self.stdout.write(self.style.SUCCESS(f"✓ Created {len(clusters)} clusters"))

        # Create Cluster Weekly Reports
        for cluster in clusters:
            # Create reports for the last 4 weeks
            for week_offset in range(4):
                from datetime import date

                today = date.today()
                current_date = today - timedelta(weeks=week_offset)
                year, week_num, _ = current_date.isocalendar()

                # Select some attendees
                cluster_all_members = list(cluster.members.all())
                members_attended = random.sample(
                    [m for m in cluster_all_members if m.role == "MEMBER"],
                    min(
                        random.randint(2, 8),
                        len([m for m in cluster_all_members if m.role == "MEMBER"]),
                    ),
                )

                visitors_attended = random.sample(
                    [m for m in cluster_all_members if m.role == "VISITOR"],
                    min(
                        random.randint(0, 3),
                        len([m for m in cluster_all_members if m.role == "VISITOR"]),
                    ),
                )

                report = ClusterWeeklyReport(
                    cluster=cluster,
                    year=year,
                    week_number=week_num,
                    meeting_date=current_date - timedelta(days=random.randint(0, 6)),
                    gathering_type=random.choice(["PHYSICAL", "ONLINE", "HYBRID"]),
                    activities_held=random.choice(
                        [
                            "Bible study on the book of John",
                            "Prayer and worship session",
                            "Testimony sharing and fellowship",
                            "Guest speaker on evangelism",
                            "Community outreach planning",
                        ]
                    ),
                    prayer_requests=random.choice(
                        [
                            "Pray for healing for member families",
                            "Pray for guidance in upcoming events",
                            "Pray for the community",
                            "Pray for spiritual growth",
                        ]
                    ),
                    testimonies=random.choice(
                        [
                            "Member shared about recent blessing",
                            "Testimony of answered prayers",
                            "Story of personal transformation",
                        ]
                    ),
                    offerings=Decimal(f"{random.uniform(50, 500):.2f}"),
                    highlights=random.choice(
                        [
                            "Great attendance this week",
                            "New members joined the cluster",
                            "Wonderful time of fellowship",
                            "Powerful prayer session",
                        ]
                    ),
                    lowlights=random.choice(
                        [
                            "Some members unable to attend",
                            "Need more volunteers for events",
                            "",
                        ]
                    ),
                    submitted_by=cluster.coordinator,
                )
                report.save()

                # Add attendees
                report.members_attended.add(*members_attended)
                report.visitors_attended.add(*visitors_attended)

        self.stdout.write(self.style.SUCCESS("✓ Created cluster weekly reports"))

        # Summary
        self.stdout.write(self.style.SUCCESS("\nSample data created successfully!"))
        self.stdout.write(f"  • People: {Person.objects.count()}")
        self.stdout.write(f"  • Families: {Family.objects.count()}")
        self.stdout.write(f"  • Clusters: {Cluster.objects.count()}")
        self.stdout.write(f"  • Milestones: {Milestone.objects.count()}")
        self.stdout.write(f"  • Weekly Reports: {ClusterWeeklyReport.objects.count()}")
