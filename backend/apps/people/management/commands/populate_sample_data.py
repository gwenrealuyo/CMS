"""
Management command to populate the database with sample data
Usage: python manage.py populate_sample_data
"""

from django.core.management.base import BaseCommand
from django.contrib.auth.hashers import make_password
from apps.people.models import Person, Family, Milestone, ModuleCoordinator
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
            "--clear", action="store_true", help="Clear existing data before populating"
        )

    def handle(self, *args, **options):
        num_people = options["people"]
        num_families = options["families"]
        clear_existing = options["clear"]

        if clear_existing:
            self.stdout.write("Clearing existing data...")
            Milestone.objects.all().delete()
            Family.objects.all().delete()
            # Clear ModuleCoordinator assignments for non-ADMIN users
            ModuleCoordinator.objects.filter(
                person__role__in=["MEMBER", "VISITOR", "COORDINATOR", "PASTOR"]
            ).delete()
            # Only delete non-ADMIN users
            Person.objects.filter(
                role__in=["MEMBER", "VISITOR", "COORDINATOR", "PASTOR"]
            ).delete()
            self.stdout.write(
                self.style.WARNING(
                    "Note: Cluster data should be created separately using populate_clusters_data command."
                )
            )

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
        visitor_statuses = [
            "INVITED",
            "ATTENDED",
        ]  # Visitors can only be INVITED or ATTENDED
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

            # Set status based on role: visitors can only be INVITED or ATTENDED
            if role_choice == "VISITOR":
                person_status = random.choice(visitor_statuses)
            else:
                person_status = random.choice(statuses)

            person = Person(
                username=username,
                first_name=first_name,
                last_name=last_name,
                middle_name=middle_name,
                email=f"{username}@example.com",
                role=role_choice,
                status=person_status,
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
                must_change_password=True,  # Force password change on first login
                first_login=True,  # Mark as first login
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

        # Create ModuleCoordinator assignments for coordinators
        coordinators = [p for p in people if p.role == "COORDINATOR"]
        module_assignments_created = 0
        
        # Assign some coordinators to different modules
        modules = [
            ModuleCoordinator.ModuleType.CLUSTER,
            ModuleCoordinator.ModuleType.FINANCE,
            ModuleCoordinator.ModuleType.EVANGELISM,
            ModuleCoordinator.ModuleType.SUNDAY_SCHOOL,
            ModuleCoordinator.ModuleType.LESSONS,
            ModuleCoordinator.ModuleType.EVENTS,
        ]
        
        for coordinator in coordinators:
            # Each coordinator gets 1-2 module assignments
            num_assignments = random.randint(1, 2)
            assigned_modules = random.sample(modules, min(num_assignments, len(modules)))
            
            for module_type in assigned_modules:
                # Most are regular coordinators, some are senior coordinators
                level = (
                    ModuleCoordinator.CoordinatorLevel.SENIOR_COORDINATOR
                    if random.random() < 0.2
                    else ModuleCoordinator.CoordinatorLevel.COORDINATOR
                )
                
                ModuleCoordinator.objects.get_or_create(
                    person=coordinator,
                    module=module_type,
                    resource_id=None,  # General module access
                    defaults={
                        "level": level,
                        "resource_type": "",
                    }
                )
                module_assignments_created += 1
        
        if module_assignments_created > 0:
            self.stdout.write(
                self.style.SUCCESS(
                    f"✓ Created {module_assignments_created} module coordinator assignments"
                )
            )

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

        # Summary
        self.stdout.write(self.style.SUCCESS("\nSample data created successfully!"))
        self.stdout.write(
            f"  • People: {Person.objects.exclude(role='ADMIN').count()} (excluding ADMIN)"
        )
        self.stdout.write(f"  • Families: {Family.objects.count()}")
        self.stdout.write(f"  • Milestones: {Milestone.objects.count()}")
        self.stdout.write(
            f"  • Module Coordinator Assignments: {ModuleCoordinator.objects.count()}"
        )
        self.stdout.write(
            self.style.WARNING(
                "\nNote: To create cluster data, run: python manage.py populate_clusters_data"
            )
        )
