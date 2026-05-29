from datetime import date, timedelta

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from apps.authentication.models import PasswordResetRequest
from apps.clusters.models import Cluster, ClusterWeeklyReport
from apps.evangelism.models import EvangelismGroup, EvangelismWeeklyReport
from apps.notifications.models import NotificationDismissal
from apps.people.models import ModuleCoordinator, ModuleSetting

Person = get_user_model()


class NotificationFeedTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = Person.objects.create_user(
            username="notif_admin",
            email="notif_admin@example.com",
            password="password123",
            role="ADMIN",
        )
        self.cluster_coord = Person.objects.create_user(
            username="cluster_coord",
            email="cluster_coord@example.com",
            password="password123",
            role="COORDINATOR",
        )
        self.evan_coord = Person.objects.create_user(
            username="evan_coord",
            email="evan_coord@example.com",
            password="password123",
            role="COORDINATOR",
        )
        self.cluster_a = Cluster.objects.create(
            code="NA",
            name="Cluster Alpha",
            coordinator=self.cluster_coord,
        )
        self.cluster_b = Cluster.objects.create(
            code="NB",
            name="Cluster Beta",
            coordinator=self.cluster_coord,
        )
        self.evan_group = EvangelismGroup.objects.create(
            name="BS Group One",
            coordinator=self.evan_coord,
            is_active=True,
        )
        ModuleSetting.objects.update_or_create(
            module=ModuleCoordinator.ModuleType.CLUSTER,
            defaults={"is_enabled": True},
        )
        ModuleSetting.objects.update_or_create(
            module=ModuleCoordinator.ModuleType.EVANGELISM,
            defaults={"is_enabled": True},
        )

    def _auth(self, user):
        self.client.force_authenticate(user=user)

    def _get_items(self):
        response = self.client.get("/api/notifications/")
        self.assertEqual(response.status_code, 200)
        return response.data

    def test_cluster_coordinator_gets_due_items_per_managed_cluster(self):
        self._auth(self.cluster_coord)
        data = self._get_items()
        due_types = [i["type"] for i in data["items"] if i["type"] == "cluster_report_due"]
        self.assertEqual(len(due_types), 2)
        self.assertGreater(data["unread_count"], 0)

    def test_evangelism_coordinator_gets_evangelism_due_only(self):
        self._auth(self.evan_coord)
        data = self._get_items()
        types = {i["type"] for i in data["items"]}
        self.assertIn("evangelism_report_due", types)
        self.assertNotIn("cluster_report_due", types)

    def test_submitting_cluster_report_removes_due_and_adds_activity(self):
        today = timezone.now().date()
        year, week = today.isocalendar()[0], today.isocalendar()[1]
        ClusterWeeklyReport.objects.create(
            cluster=self.cluster_a,
            year=year,
            week_number=week,
            meeting_date=today,
            gathering_type="PHYSICAL",
            submitted_by=self.cluster_coord,
        )
        self._auth(self.cluster_coord)
        data = self._get_items()
        due_cluster_ids = [
            i["href"]
            for i in data["items"]
            if i["type"] == "cluster_report_due"
        ]
        self.assertEqual(len(due_cluster_ids), 1)
        activity = [
            i for i in data["items"] if i["type"] == "cluster_report_submitted"
        ]
        self.assertEqual(len(activity), 1)
        self.assertEqual(data["unread_count"], 1)

    def test_activity_does_not_increase_unread_when_only_activity(self):
        today = timezone.now().date()
        year, week = today.isocalendar()[0], today.isocalendar()[1]
        for cluster in (self.cluster_a, self.cluster_b):
            ClusterWeeklyReport.objects.create(
                cluster=cluster,
                year=year,
                week_number=week,
                meeting_date=today,
                gathering_type="PHYSICAL",
                submitted_by=self.cluster_coord,
            )
        self._auth(self.cluster_coord)
        data = self._get_items()
        self.assertEqual(data["unread_count"], 0)
        self.assertGreater(data["activity_count"], 0)

    def test_dismissal_hides_item(self):
        self._auth(self.cluster_coord)
        data = self._get_items()
        key = data["items"][0]["key"]
        dismiss = self.client.post(f"/api/notifications/{key}/dismiss/")
        self.assertEqual(dismiss.status_code, 200)
        returned_keys = [i["key"] for i in dismiss.data["items"]]
        self.assertNotIn(key, returned_keys)
        self.assertTrue(
            NotificationDismissal.objects.filter(
                user=self.cluster_coord, notification_key=key
            ).exists()
        )

    def test_admin_password_reset_alert(self):
        member = Person.objects.create_user(
            username="reset_user",
            email="reset@example.com",
            password="password123",
            role="MEMBER",
        )
        PasswordResetRequest.objects.create(user=member, status="PENDING")
        self._auth(self.admin)
        data = self._get_items()
        types = {i["type"] for i in data["items"]}
        self.assertIn("password_reset_pending", types)

    def test_dismiss_all_clears_visible_feed(self):
        self._auth(self.cluster_coord)
        first = self._get_items()
        self.assertGreater(len(first["items"]), 0)
        response = self.client.post("/api/notifications/dismiss-all/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["unread_count"], 0)
        self.assertEqual(len(response.data["items"]), 0)

    def test_visitor_cannot_access(self):
        visitor = Person.objects.create_user(
            username="visitor_notif",
            email="visitor@example.com",
            password="password123",
            role="VISITOR",
        )
        self._auth(visitor)
        response = self.client.get("/api/notifications/")
        self.assertEqual(response.status_code, 403)
