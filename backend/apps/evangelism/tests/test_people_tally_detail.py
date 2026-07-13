from datetime import datetime

from django.test import TestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from apps.clusters.models import Cluster
from apps.lessons.models import Lesson, LessonSessionReport
from apps.people.models import Branch, Person


class PeopleTallyDetailTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = Person.objects.create_user(
            username="admin_tally",
            password="password123",
            first_name="Admin",
            last_name="Tally",
            role="ADMIN",
            status="ACTIVE",
        )
        self.client.force_authenticate(user=self.admin)

    def test_invited_drilldown_coerces_date_joined_datetime(self):
        joined = timezone.make_aware(datetime(2026, 3, 15, 14, 30, 0))
        Person.objects.create_user(
            username="invited_visitor",
            password="password123",
            first_name="Invited",
            last_name="Visitor",
            role="VISITOR",
            status="ONGOING",
            date_joined=joined,
        )

        response = self.client.get(
            "/api/evangelism/weekly-reports/people_tally_detail/",
            {"year": 2026, "month": 3, "metric": "invited"},
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data["results"]), 1)
        self.assertEqual(response.data["results"][0]["event_date"], "2026-03-15")

    def test_baptized_drilldown_omits_lessons_finished_without_person_field(self):
        branch = Branch.objects.create(name="Tally Branch", code="TB")
        inviter = Person.objects.create_user(
            username="ncc_teacher",
            password="password123",
            role="MEMBER",
            status="ACTIVE",
            branch=branch,
        )
        cluster = Cluster.objects.create(
            code="TC",
            name="Tally Cluster",
            branch=branch,
            coordinator=inviter,
        )
        baptized = Person.objects.create_user(
            username="baptized_with_ncc",
            password="password123",
            first_name="Baptized",
            last_name="WithNcc",
            role="MEMBER",
            status="ACTIVE",
            branch=branch,
            water_baptism_date=timezone.now().date().replace(year=2026, month=10, day=26),
        )
        cluster.members.add(baptized)
        lesson = Lesson.objects.create(
            code="drilldown-l1",
            version_label="v1",
            title="Drilldown Lesson",
            order=1,
            is_latest=True,
            is_active=True,
        )
        LessonSessionReport.objects.create(
            teacher=inviter,
            student=baptized,
            lesson=lesson,
            session_date=timezone.now().date().replace(year=2026, month=3, day=10),
            session_start=timezone.make_aware(datetime(2026, 3, 10, 10, 0)),
        )

        response = self.client.get(
            "/api/evangelism/weekly-reports/people_tally_detail/",
            {"year": 2026, "month": 10, "metric": "baptized"},
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data["results"]), 1)
        self.assertIsNone(response.data["results"][0]["lessons_finished_at"])

    def test_baptized_drilldown_includes_lessons_finished_when_set(self):
        Person.objects.create_user(
            username="baptized_finished",
            password="password123",
            first_name="Finished",
            last_name="Lessons",
            role="MEMBER",
            status="ACTIVE",
            lessons_finished_at=timezone.now().date().replace(
                year=2026, month=5, day=1
            ),
            water_baptism_date=timezone.now().date().replace(
                year=2026, month=10, day=26
            ),
        )

        response = self.client.get(
            "/api/evangelism/weekly-reports/people_tally_detail/",
            {"year": 2026, "month": 10, "metric": "baptized"},
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data["results"]), 1)
        self.assertEqual(
            response.data["results"][0]["lessons_finished_at"], "2026-05-01"
        )
