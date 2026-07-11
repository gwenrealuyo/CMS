from datetime import datetime

from django.test import TestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from apps.clusters.models import Cluster
from apps.evangelism.models import Conversion, Prospect
from apps.evangelism.services import (
    person_meets_all_reached_milestones,
    sync_conversion_pipeline,
)
from apps.lessons.models import Lesson, LessonSessionReport
from apps.people.models import Branch, Person


class PipelineReachedMilestoneTests(TestCase):
    def setUp(self):
        self.branch = Branch.objects.create(name="Main", code="MAIN")
        self.inviter = Person.objects.create_user(
            username="inviter",
            password="pw",
            role="MEMBER",
            status="ACTIVE",
            branch=self.branch,
        )
        self.cluster = Cluster.objects.create(
            code="C1",
            name="Cluster One",
            branch=self.branch,
            coordinator=self.inviter,
        )
        self.person = Person.objects.create_user(
            username="prospect_person",
            password="pw",
            role="VISITOR",
            status="ATTENDED",
            branch=self.branch,
            date_first_invited=timezone.now().date().replace(month=1, day=5),
            date_first_attended=timezone.now().date().replace(month=2, day=5),
        )
        self.prospect = Prospect.objects.create(
            first_name="Test",
            last_name="Prospect",
            invited_by=self.inviter,
            inviter_cluster=self.cluster,
            person=self.person,
            pipeline_stage=Prospect.PipelineStage.ATTENDED,
            is_dropped_off=False,
        )

    def test_baptism_only_does_not_meet_reached(self):
        self.person.water_baptism_date = timezone.now().date().replace(month=3, day=1)
        self.person.spirit_baptism_date = timezone.now().date().replace(month=4, day=1)
        self.person.save(
            update_fields=["water_baptism_date", "spirit_baptism_date"]
        )
        self.assertFalse(person_meets_all_reached_milestones(self.person))

    def test_full_milestones_with_lesson_session_meet_reached(self):
        self.person.water_baptism_date = timezone.now().date().replace(month=3, day=1)
        self.person.spirit_baptism_date = timezone.now().date().replace(month=4, day=1)
        self.person.save(
            update_fields=["water_baptism_date", "spirit_baptism_date"]
        )
        lesson = Lesson.objects.create(
            code="l1",
            version_label="v1",
            title="Lesson 1",
            order=1,
            is_latest=True,
            is_active=True,
        )
        LessonSessionReport.objects.create(
            teacher=self.inviter,
            student=self.person,
            lesson=lesson,
            session_date=timezone.now().date().replace(month=2, day=20),
            session_start=timezone.make_aware(datetime(2026, 2, 20, 10, 0)),
        )
        self.prospect.refresh_from_db()
        self.assertEqual(
            self.prospect.pipeline_stage, Prospect.PipelineStage.TAKEN_NCC
        )
        self.assertTrue(person_meets_all_reached_milestones(self.person))

    def test_sync_conversion_sets_reached_only_with_ncc_session(self):
        lesson = Lesson.objects.create(
            code="l2",
            version_label="v1",
            title="Lesson 2",
            order=1,
            is_latest=True,
            is_active=True,
        )
        LessonSessionReport.objects.create(
            teacher=self.inviter,
            student=self.person,
            lesson=lesson,
            session_date=timezone.now().date().replace(month=2, day=20),
            session_start=timezone.make_aware(datetime(2026, 2, 20, 10, 0)),
        )
        conversion = Conversion.objects.create(
            person=self.person,
            prospect=self.prospect,
            cluster=self.cluster,
            converted_by=self.inviter,
            conversion_date=timezone.now().date().replace(month=4, day=1),
            water_baptism_date=timezone.now().date().replace(month=3, day=1),
            spirit_baptism_date=timezone.now().date().replace(month=4, day=1),
        )
        sync_conversion_pipeline(conversion)
        conversion.refresh_from_db()
        self.prospect.refresh_from_db()
        self.assertTrue(conversion.is_complete)
        self.assertEqual(
            self.prospect.pipeline_stage, Prospect.PipelineStage.REACHED
        )

    def test_lesson_start_date_alone_does_not_complete_conversion(self):
        conversion = Conversion.objects.create(
            person=self.person,
            prospect=self.prospect,
            cluster=self.cluster,
            converted_by=self.inviter,
            conversion_date=timezone.now().date().replace(month=2, day=10),
            lesson_start_date=timezone.now().date().replace(month=2, day=10),
            water_baptism_date=timezone.now().date().replace(month=3, day=1),
            spirit_baptism_date=timezone.now().date().replace(month=4, day=1),
        )
        sync_conversion_pipeline(
            conversion, lesson_start_date=conversion.lesson_start_date
        )
        conversion.refresh_from_db()
        self.prospect.refresh_from_db()
        self.assertFalse(conversion.is_complete)
        self.assertNotEqual(
            self.prospect.pipeline_stage, Prospect.PipelineStage.REACHED
        )
        self.assertEqual(
            self.prospect.pipeline_stage, Prospect.PipelineStage.RECEIVED_HG
        )


class PeopleTallyReachedTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = Person.objects.create_user(
            username="admin_reached",
            password="pw",
            role="ADMIN",
            status="ACTIVE",
        )
        self.client.force_authenticate(user=self.admin)
        self.branch = Branch.objects.create(name="Tally Branch", code="TB")
        self.inviter = Person.objects.create_user(
            username="tally_inviter",
            password="pw",
            role="MEMBER",
            status="ACTIVE",
            branch=self.branch,
        )
        self.cluster = Cluster.objects.create(
            code="TC",
            name="Tally Cluster",
            branch=self.branch,
            coordinator=self.inviter,
        )

    def test_reached_tally_excludes_baptism_only_without_ncc(self):
        Person.objects.create_user(
            username="baptized_only",
            password="pw",
            role="MEMBER",
            status="ACTIVE",
            branch=self.branch,
            date_first_invited=timezone.now().date().replace(month=1, day=1),
            date_first_attended=timezone.now().date().replace(month=2, day=1),
            water_baptism_date=timezone.now().date().replace(
                year=timezone.now().year, month=3, day=1
            ),
            spirit_baptism_date=timezone.now().date().replace(
                year=timezone.now().year, month=3, day=15
            ),
        )
        year = timezone.now().year
        response = self.client.get(
            "/api/evangelism/weekly-reports/people_tally/",
            {"year": year},
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        march = next(row for row in response.data if row["month"] == 3)
        self.assertEqual(march["reached_count"], 0)

    def test_reached_tally_counts_full_milestones_in_latest_month(self):
        person = Person.objects.create_user(
            username="fully_reached",
            password="pw",
            role="MEMBER",
            status="ACTIVE",
            branch=self.branch,
            date_first_invited=timezone.now().date().replace(
                year=timezone.now().year, month=1, day=1
            ),
            date_first_attended=timezone.now().date().replace(
                year=timezone.now().year, month=2, day=1
            ),
            water_baptism_date=timezone.now().date().replace(
                year=timezone.now().year, month=3, day=1
            ),
            spirit_baptism_date=timezone.now().date().replace(
                year=timezone.now().year, month=4, day=1
            ),
        )
        lesson = Lesson.objects.create(
            code="tl1",
            version_label="v1",
            title="Tally Lesson",
            order=1,
            is_latest=True,
            is_active=True,
        )
        LessonSessionReport.objects.create(
            teacher=self.inviter,
            student=person,
            lesson=lesson,
            session_date=timezone.now().date().replace(
                year=timezone.now().year, month=2, day=10
            ),
            session_start=timezone.make_aware(
                datetime(
                    timezone.now().year,
                    2,
                    10,
                    10,
                    0,
                )
            ),
        )
        year = timezone.now().year
        response = self.client.get(
            "/api/evangelism/weekly-reports/people_tally/",
            {"year": year},
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        april = next(row for row in response.data if row["month"] == 4)
        self.assertEqual(april["reached_count"], 1)
        march = next(row for row in response.data if row["month"] == 3)
        self.assertEqual(march["reached_count"], 0)


class PeopleTallyUniqueHcTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = Person.objects.create_user(
            username="admin_unique_hc",
            password="pw",
            role="ADMIN",
            status="ACTIVE",
        )
        self.client.force_authenticate(user=self.admin)
        self.branch = Branch.objects.create(name="Unique HC Branch", code="UHC")
        self.teacher = Person.objects.create_user(
            username="uhc_teacher",
            password="pw",
            role="MEMBER",
            status="ACTIVE",
            branch=self.branch,
        )
        self.cluster = Cluster.objects.create(
            code="UHC",
            name="Unique HC Cluster",
            branch=self.branch,
            coordinator=self.teacher,
        )
        self.year = 2026
        self.month = 5

    def test_same_month_ncc_baptism_hg_counts_each_column_and_unique_hc_once(self):
        person = Person.objects.create_user(
            username="multi_stage_may",
            password="pw",
            first_name="Multi",
            last_name="Stage",
            role="MEMBER",
            status="ACTIVE",
            branch=self.branch,
            date_first_invited=timezone.now().date().replace(
                year=self.year, month=1, day=1
            ),
            date_first_attended=timezone.now().date().replace(
                year=self.year, month=2, day=1
            ),
            water_baptism_date=timezone.now().date().replace(
                year=self.year, month=self.month, day=10
            ),
            spirit_baptism_date=timezone.now().date().replace(
                year=self.year, month=self.month, day=15
            ),
            lessons_finished_at=timezone.now().date().replace(
                year=self.year, month=self.month, day=5
            ),
        )
        Prospect.objects.create(
            first_name="Multi",
            last_name="Stage",
            person=person,
            invited_by=self.teacher,
            inviter_cluster=self.cluster,
            commitment_form_signed=True,
        )
        lesson = Lesson.objects.create(
            code="uhc-l1",
            version_label="v1",
            title="Unique HC Lesson",
            order=1,
            is_latest=True,
            is_active=True,
        )
        LessonSessionReport.objects.create(
            teacher=self.teacher,
            student=person,
            lesson=lesson,
            session_date=timezone.now().date().replace(
                year=self.year, month=self.month, day=5
            ),
            session_start=timezone.make_aware(
                datetime(self.year, self.month, 5, 10, 0)
            ),
        )

        response = self.client.get(
            "/api/evangelism/weekly-reports/people_tally/",
            {"year": self.year},
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        may = next(row for row in response.data if row["month"] == self.month)
        self.assertEqual(may["students_count"], 1)
        self.assertEqual(may["baptized_count"], 1)
        self.assertEqual(may["received_hg_count"], 1)
        self.assertEqual(may["reached_count"], 1)
        self.assertEqual(may["unique_hc_count"], 1)

        detail = self.client.get(
            "/api/evangelism/weekly-reports/people_tally_detail/",
            {
                "year": self.year,
                "month": self.month,
                "metric": "unique_hc",
            },
        )
        self.assertEqual(detail.status_code, status.HTTP_200_OK)
        self.assertEqual(detail.data["count"], 1)
        self.assertEqual(len(detail.data["results"]), 1)
        self.assertEqual(detail.data["results"][0]["person_id"], person.id)
        self.assertEqual(detail.data["results"][0]["metric"], "unique_hc")

        students_detail = self.client.get(
            "/api/evangelism/weekly-reports/people_tally_detail/",
            {
                "year": self.year,
                "month": self.month,
                "metric": "students",
            },
        )
        self.assertEqual(students_detail.status_code, status.HTTP_200_OK)
        self.assertEqual(students_detail.data["count"], 1)
        self.assertEqual(students_detail.data["results"][0]["person_id"], person.id)

