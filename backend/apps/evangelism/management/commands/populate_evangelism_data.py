"""
Management command to populate the database with sample evangelism data
Usage: python manage.py populate_evangelism_data
"""

from django.core.management.base import BaseCommand
from django.utils import timezone
from apps.evangelism.models import (
    EvangelismGroup,
    EvangelismGroupMember,
    EvangelismSession,
    Prospect,
    Conversion,
    MonthlyConversionTracking,
    Each1Reach1Goal,
    FollowUpTask,
    DropOff,
    EvangelismWeeklyReport,
)
from apps.people.models import Person, ModuleCoordinator
from apps.clusters.models import Cluster
from apps.events.models import Event
from datetime import datetime, timedelta, date
import random


class Command(BaseCommand):
    help = "Populates the database with sample evangelism data for testing"

    def add_arguments(self, parser):
        parser.add_argument(
            "--groups",
            type=int,
            default=8,
            help="Number of evangelism groups to create (default: 8)",
        )
        parser.add_argument(
            "--prospects",
            type=int,
            default=30,
            help="Number of prospects to create (default: 30)",
        )
        parser.add_argument(
            "--sessions",
            type=int,
            default=20,
            help="Number of sessions per group (default: 20)",
        )
        parser.add_argument(
            "--clear",
            action="store_true",
            help="Clear existing evangelism data before populating",
        )

    def handle(self, *args, **options):
        num_groups = options["groups"]
        num_prospects = options["prospects"]
        num_sessions = options["sessions"]
        clear_existing = options["clear"]

        if clear_existing:
            self.stdout.write("Clearing existing evangelism data...")
            DropOff.objects.all().delete()
            FollowUpTask.objects.all().delete()
            MonthlyConversionTracking.objects.all().delete()
            Conversion.objects.all().delete()
            Prospect.objects.all().delete()
            EvangelismWeeklyReport.objects.all().delete()
            EvangelismSession.objects.all().delete()
            EvangelismGroupMember.objects.all().delete()
            Each1Reach1Goal.objects.all().delete()
            EvangelismGroup.objects.all().delete()

        # Check if we have people and clusters (exclude ADMIN users)
        people = list(Person.objects.exclude(role="ADMIN"))
        clusters = list(Cluster.objects.all())

        if not people:
            self.stdout.write(
                self.style.ERROR(
                    "No people found in database. Please run populate_sample_data first."
                )
            )
            return

        if not clusters:
            self.stdout.write(
                self.style.WARNING(
                    "No clusters found. Some groups will be created without cluster affiliation."
                )
            )

        # Group names
        group_names = [
            "North Bible Study",
            "South Bible Study",
            "East Bible Study",
            "West Bible Study",
            "Central Bible Study",
            "Riverside Bible Study",
            "Hillside Bible Study",
            "Valley Bible Study",
            "Bible Sharers Main",
            "Bible Sharers Advanced",
        ]

        # Create Evangelism Groups
        groups = []
        bible_sharers_groups = []
        for i in range(num_groups):
            group_name = group_names[i % len(group_names)]
            is_bible_sharers = "Bible Sharers" in group_name

            # Select a random coordinator
            coordinators = [p for p in people if p.role in ["COORDINATOR", "MEMBER", "PASTOR"]]
            if not coordinators:
                coordinators = people
            coordinator = random.choice(coordinators) if coordinators else None

            # Select a random cluster (or None)
            cluster = random.choice(clusters) if clusters and random.random() > 0.3 else None

            group = EvangelismGroup(
                name=group_name,
                description=f"{group_name} focuses on evangelism and discipleship",
                coordinator=coordinator,
                cluster=cluster,
                location=f"{group_name} Location" if cluster else f"Community Center {i+1}",
                meeting_time=datetime.strptime(
                    f"{random.randint(6, 8)}:00 PM", "%I:00 %p"
                ).time(),
                meeting_day=random.choice(
                    ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"]
                ),
                is_active=random.random() > 0.1,  # 90% active
                is_bible_sharers_group=is_bible_sharers,
            )
            group.save()
            
            # Create ModuleCoordinator assignment for evangelism group coordinator
            if coordinator:
                level = (
                    ModuleCoordinator.CoordinatorLevel.BIBLE_SHARER
                    if is_bible_sharers
                    else ModuleCoordinator.CoordinatorLevel.COORDINATOR
                )
                ModuleCoordinator.objects.get_or_create(
                    person=coordinator,
                    module=ModuleCoordinator.ModuleType.EVANGELISM,
                    resource_id=group.id,
                    defaults={
                        "level": level,
                        "resource_type": "EvangelismGroup",
                    }
                )

            # Add 3-8 members to the group
            available_people = [p for p in people if p != coordinator]
            num_members = random.randint(3, min(8, len(available_people)))
            members = random.sample(available_people, num_members) if available_people else []

            for idx, member in enumerate(members):
                role = (
                    "ASSISTANT_LEADER"
                    if idx == 0 and coordinator
                    else "MEMBER"
                )
                EvangelismGroupMember.objects.get_or_create(
                    evangelism_group=group,
                    person=member,
                    defaults={
                        "role": role,
                        "joined_date": timezone.now().date() - timedelta(days=random.randint(30, 365)),
                        "is_active": True,
                    },
                )

            groups.append(group)
            if is_bible_sharers:
                bible_sharers_groups.append(group)

        self.stdout.write(self.style.SUCCESS(f"✓ Created {len(groups)} evangelism groups"))
        self.stdout.write(
            self.style.SUCCESS(f"  • Bible Sharers groups: {len(bible_sharers_groups)}")
        )

        # Create Evangelism Sessions
        today = date.today()
        topics = [
            "The Gospel Message",
            "Salvation Through Faith",
            "The Holy Spirit",
            "Baptism",
            "Discipleship",
            "Prayer Life",
            "Reading the Bible",
            "Christian Living",
            "Witnessing to Others",
            "The Church",
        ]

        total_sessions = 0
        for group in groups:
            for i in range(num_sessions):
                session_date = today - timedelta(days=random.randint(0, 180))
                session_time = datetime.strptime(
                    f"{random.randint(6, 8)}:00 PM", "%I:00 %p"
                ).time()

                session = EvangelismSession(
                    evangelism_group=group,
                    session_date=session_date,
                    session_time=session_time,
                    topic=random.choice(topics),
                    notes=f"Session notes for {session_date.strftime('%B %d, %Y')}",
                )
                session.save()
                total_sessions += 1

        self.stdout.write(
            self.style.SUCCESS(f"✓ Created {total_sessions} evangelism sessions")
        )

        # Create Prospects
        prospect_names = [
            "John Smith", "Mary Johnson", "David Brown", "Sarah Williams",
            "Michael Davis", "Emily Miller", "James Wilson", "Jessica Moore",
            "Robert Taylor", "Amanda Anderson", "William Thomas", "Michelle Jackson",
            "Christopher White", "Ashley Harris", "Daniel Martin", "Stephanie Thompson",
            "Matthew Garcia", "Nicole Martinez", "Anthony Robinson", "Lauren Clark",
            "Mark Rodriguez", "Samantha Lewis", "Donald Walker", "Brittany Hall",
            "Steven Young", "Rachel Allen", "Paul King", "Megan Wright",
            "Andrew Lopez", "Kayla Hill",
        ]

        pipeline_stages = [
            Prospect.PipelineStage.INVITED,
            Prospect.PipelineStage.ATTENDED,
            Prospect.PipelineStage.BAPTIZED,
            Prospect.PipelineStage.RECEIVED_HG,
            Prospect.PipelineStage.CONVERTED,
        ]

        prospects = []
        for i in range(num_prospects):
            name = prospect_names[i % len(prospect_names)]
            if i >= len(prospect_names):
                name = f"Prospect {i+1}"

            # Select random inviter
            inviter = random.choice(people)
            # Try to get inviter's cluster from their cluster memberships
            inviter_cluster = None
            if clusters:
                # Check if person is a member of any cluster
                person_clusters = Cluster.objects.filter(members=inviter)
                if person_clusters.exists():
                    inviter_cluster = person_clusters.first()
                else:
                    # If not found, assign a random cluster
                    inviter_cluster = random.choice(clusters)

            # Select random group
            group = random.choice(groups) if groups else None

            # Determine pipeline stage (weighted towards earlier stages)
            stage_weights = [0.3, 0.3, 0.2, 0.15, 0.05]  # More INVITED and ATTENDED
            stage = random.choices(pipeline_stages, weights=stage_weights)[0]

            # Set dates based on stage
            first_contact = today - timedelta(days=random.randint(7, 180))
            last_activity = first_contact + timedelta(days=random.randint(0, 30))

            # Create prospect
            prospect = Prospect(
                name=name,
                contact_info=f"phone-{random.randint(1000000, 9999999)}" if random.random() > 0.2 else "",
                invited_by=inviter,
                inviter_cluster=inviter_cluster,
                evangelism_group=group,
                pipeline_stage=stage,
                first_contact_date=first_contact,
                last_activity_date=last_activity,
                is_attending_cluster=stage in [
                    Prospect.PipelineStage.ATTENDED,
                    Prospect.PipelineStage.BAPTIZED,
                    Prospect.PipelineStage.RECEIVED_HG,
                    Prospect.PipelineStage.CONVERTED,
                ],
                has_finished_lessons=stage in [
                    Prospect.PipelineStage.BAPTIZED,
                    Prospect.PipelineStage.RECEIVED_HG,
                    Prospect.PipelineStage.CONVERTED,
                ],
                commitment_form_signed=stage in [
                    Prospect.PipelineStage.BAPTIZED,
                    Prospect.PipelineStage.RECEIVED_HG,
                    Prospect.PipelineStage.CONVERTED,
                ],
                fast_track_reason=random.choice([
                    Prospect.FastTrackReason.NONE,
                    Prospect.FastTrackReason.NONE,
                    Prospect.FastTrackReason.NONE,
                    Prospect.FastTrackReason.GOING_ABROAD,
                    Prospect.FastTrackReason.HEALTH_ISSUES,
                ]),
                notes=f"Prospect notes for {name}",
            )

            # If ATTENDED or later, create a Person record
            if stage != Prospect.PipelineStage.INVITED:
                person, created = Person.objects.get_or_create(
                    username=f"{name.lower().replace(' ', '.')}",
                    defaults={
                        "first_name": name.split()[0],
                        "last_name": name.split()[-1] if len(name.split()) > 1 else "",
                        "role": "VISITOR",
                        "email": f"{name.lower().replace(' ', '.')}@example.com",
                        "must_change_password": True,
                        "first_login": True,
                    },
                )
                if created:
                    person.set_unusable_password()
                    person.save()
                prospect.person = person
                if inviter:
                    person.inviter = inviter
                    person.save()

            prospect.save()
            prospects.append(prospect)

        self.stdout.write(self.style.SUCCESS(f"✓ Created {len(prospects)} prospects"))

        # Create Conversions
        converted_prospects = [
            p for p in prospects
            if p.pipeline_stage in [
                Prospect.PipelineStage.BAPTIZED,
                Prospect.PipelineStage.RECEIVED_HG,
                Prospect.PipelineStage.CONVERTED,
            ]
            and p.person
        ]

        conversions = []
        for prospect in converted_prospects[:min(10, len(converted_prospects))]:
            conversion_date = prospect.first_contact_date + timedelta(
                days=random.randint(30, 120)
            )

            # Determine if water and spirit baptism happened
            has_water = prospect.pipeline_stage in [
                Prospect.PipelineStage.BAPTIZED,
                Prospect.PipelineStage.RECEIVED_HG,
                Prospect.PipelineStage.CONVERTED,
            ]
            has_spirit = prospect.pipeline_stage in [
                Prospect.PipelineStage.RECEIVED_HG,
                Prospect.PipelineStage.CONVERTED,
            ]

            water_date = conversion_date + timedelta(days=random.randint(0, 14)) if has_water else None
            spirit_date = (
                (water_date or conversion_date) + timedelta(days=random.randint(0, 30))
                if has_spirit
                else None
            )

            conversion = Conversion(
                person=prospect.person,
                prospect=prospect,
                converted_by=prospect.invited_by,
                evangelism_group=prospect.evangelism_group,
                cluster=prospect.inviter_cluster,
                conversion_date=conversion_date,
                water_baptism_date=water_date,
                spirit_baptism_date=spirit_date,
                is_complete=has_water and has_spirit,
                notes=f"Conversion notes for {prospect.name}",
            )
            conversion.save()
            conversions.append(conversion)

        self.stdout.write(self.style.SUCCESS(f"✓ Created {len(conversions)} conversions"))

        # Create Monthly Conversion Tracking
        current_year = today.year
        for month in range(1, 13):
            month_prospects = [
                p for p in prospects
                if p.inviter_cluster
                and p.first_contact_date.year == current_year
                and p.first_contact_date.month <= month
            ]

            for prospect in month_prospects[:min(20, len(month_prospects))]:
                # Determine which stage to track for this month
                first_contact_month = prospect.first_contact_date.month
                if month < first_contact_month:
                    continue

                # Simple logic: progress through stages over months
                months_since_contact = month - first_contact_month
                if months_since_contact == 0:
                    stage = MonthlyConversionTracking.Stage.INVITED
                elif months_since_contact == 1:
                    stage = MonthlyConversionTracking.Stage.ATTENDED
                elif months_since_contact >= 2:
                    if prospect.pipeline_stage in [
                        Prospect.PipelineStage.BAPTIZED,
                        Prospect.PipelineStage.RECEIVED_HG,
                        Prospect.PipelineStage.CONVERTED,
                    ]:
                        stage = MonthlyConversionTracking.Stage.BAPTIZED
                    else:
                        stage = MonthlyConversionTracking.Stage.ATTENDED
                else:
                    continue

                MonthlyConversionTracking.objects.get_or_create(
                    cluster=prospect.inviter_cluster,
                    prospect=prospect,
                    person=prospect.person,
                    year=current_year,
                    month=month,
                    stage=stage,
                    defaults={
                        "count": 1,
                        "first_date_in_stage": date(current_year, month, 1),
                    },
                )

        self.stdout.write(
            self.style.SUCCESS(
                f"✓ Created monthly conversion tracking for {current_year}"
            )
        )

        # Create Each 1 Reach 1 Goals
        for cluster in clusters:
            goal = Each1Reach1Goal.objects.get_or_create(
                cluster=cluster,
                year=current_year,
                defaults={
                    "target_conversions": random.randint(5, 15),
                    "achieved_conversions": random.randint(0, 10),
                    "status": random.choice([
                        Each1Reach1Goal.Status.NOT_STARTED,
                        Each1Reach1Goal.Status.IN_PROGRESS,
                        Each1Reach1Goal.Status.COMPLETED,
                    ]),
                },
            )[0]
            # Update status based on progress
            if goal.achieved_conversions >= goal.target_conversions:
                goal.status = Each1Reach1Goal.Status.COMPLETED
            elif goal.achieved_conversions > 0:
                goal.status = Each1Reach1Goal.Status.IN_PROGRESS
            goal.save()

        self.stdout.write(
            self.style.SUCCESS(
                f"✓ Created Each 1 Reach 1 goals for {len(clusters)} clusters"
            )
        )

        # Create Follow-up Tasks
        active_prospects = [
            p for p in prospects
            if not p.is_dropped_off
            and p.pipeline_stage in [
                Prospect.PipelineStage.INVITED,
                Prospect.PipelineStage.ATTENDED,
            ]
        ]

        task_types = [
            FollowUpTask.TaskType.PHONE_CALL,
            FollowUpTask.TaskType.TEXT_MESSAGE,
            FollowUpTask.TaskType.VISIT,
            FollowUpTask.TaskType.EMAIL,
            FollowUpTask.TaskType.PRAYER,
        ]

        for prospect in active_prospects[:min(15, len(active_prospects))]:
            task = FollowUpTask(
                prospect=prospect,
                assigned_to=prospect.invited_by,
                task_type=random.choice(task_types),
                due_date=today + timedelta(days=random.randint(1, 14)),
                status=random.choice([
                    FollowUpTask.Status.PENDING,
                    FollowUpTask.Status.IN_PROGRESS,
                    FollowUpTask.Status.COMPLETED,
                ]),
                priority=random.choice([
                    FollowUpTask.Priority.LOW,
                    FollowUpTask.Priority.MEDIUM,
                    FollowUpTask.Priority.HIGH,
                ]),
                notes=f"Follow-up task for {prospect.name}",
                created_by=prospect.invited_by,
            )
            if task.status == FollowUpTask.Status.COMPLETED:
                task.completed_date = today - timedelta(days=random.randint(1, 7))
            task.save()

        self.stdout.write(
            self.style.SUCCESS(f"✓ Created follow-up tasks for prospects")
        )

        # Create Drop-offs
        drop_off_prospects = prospects[:min(5, len(prospects))]
        for prospect in drop_off_prospects:
            if prospect.pipeline_stage == Prospect.PipelineStage.CONVERTED:
                continue

            drop_off_date = prospect.last_activity_date + timedelta(days=35)
            if drop_off_date > today:
                continue

            prospect.is_dropped_off = True
            prospect.drop_off_date = drop_off_date
            prospect.drop_off_stage = prospect.pipeline_stage
            prospect.save()

            drop_off = DropOff(
                prospect=prospect,
                drop_off_date=drop_off_date,
                drop_off_stage=prospect.pipeline_stage,
                days_inactive=35,
                reason=random.choice([
                    DropOff.DropOffReason.NO_CONTACT,
                    DropOff.DropOffReason.NO_SHOW,
                    DropOff.DropOffReason.LOST_INTEREST,
                    DropOff.DropOffReason.OTHER,
                ]),
                reason_details=f"Drop-off reason for {prospect.name}",
            )
            drop_off.save()

        self.stdout.write(self.style.SUCCESS(f"✓ Created drop-off records"))

        # Create Weekly Reports
        gathering_types = ["PHYSICAL", "ONLINE", "HYBRID"]
        activities = [
            "Bible Study",
            "Prayer Meeting",
            "Fellowship",
            "Worship",
            "Testimony Sharing",
            "Evangelism Training",
        ]

        for group in groups:
            group_members = list(group.members.filter(is_active=True).values_list("person", flat=True))
            group_prospects = list(group.prospects.all())

            for week_offset in range(12):
                week_date = today - timedelta(weeks=week_offset)
                year = week_date.year
                week_number = week_date.isocalendar()[1]

                # Get members and visitors
                members_attended_ids = random.sample(
                    group_members,
                    min(random.randint(2, len(group_members)), len(group_members)),
                ) if group_members else []

                visitors_attended_ids = [
                    p.person.id
                    for p in random.sample(
                        group_prospects,
                        min(random.randint(0, 3), len(group_prospects)),
                    )
                    if p.person
                ]

                report = EvangelismWeeklyReport(
                    evangelism_group=group,
                    year=year,
                    week_number=week_number,
                    meeting_date=week_date,
                    gathering_type=random.choice(gathering_types),
                    topic=random.choice(topics),
                    activities_held=random.choice(activities),
                    prayer_requests=random.choice([
                        "Prayer for new prospects",
                        "Prayer for conversions",
                        "Prayer for group members",
                        "",
                    ]),
                    testimonies=random.choice([
                        "New member shared conversion story",
                        "Member shared answered prayer",
                        "",
                    ]),
                    new_prospects=random.randint(0, 3),
                    conversions_this_week=random.randint(0, 2),
                    notes=f"Weekly report for {week_date.strftime('%B %d, %Y')}",
                    submitted_by=group.coordinator,
                )
                report.save()
                report.members_attended.add(*members_attended_ids)
                report.visitors_attended.add(*visitors_attended_ids)

        self.stdout.write(
            self.style.SUCCESS(f"✓ Created weekly reports for groups")
        )

        # Summary
        self.stdout.write(self.style.SUCCESS("\n✓ Evangelism data population complete!"))
        self.stdout.write(f"  • Groups: {EvangelismGroup.objects.count()}")
        self.stdout.write(f"  • Group Members: {EvangelismGroupMember.objects.count()}")
        self.stdout.write(f"  • Sessions: {EvangelismSession.objects.count()}")
        self.stdout.write(f"  • Prospects: {Prospect.objects.count()}")
        self.stdout.write(f"  • Conversions: {Conversion.objects.count()}")
        self.stdout.write(f"  • Monthly Tracking: {MonthlyConversionTracking.objects.count()}")
        self.stdout.write(f"  • Each 1 Reach 1 Goals: {Each1Reach1Goal.objects.count()}")
        self.stdout.write(f"  • Follow-up Tasks: {FollowUpTask.objects.count()}")
        self.stdout.write(f"  • Drop-offs: {DropOff.objects.count()}")
        self.stdout.write(f"  • Weekly Reports: {EvangelismWeeklyReport.objects.count()}")
        self.stdout.write(
            f"  • Evangelism Module Coordinator Assignments: {ModuleCoordinator.objects.filter(module=ModuleCoordinator.ModuleType.EVANGELISM, resource_type='EvangelismGroup').count()}"
        )

