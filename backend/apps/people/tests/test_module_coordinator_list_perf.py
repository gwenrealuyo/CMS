from django.db import connection
from django.test.utils import CaptureQueriesContext
from rest_framework.test import APITestCase

from apps.clusters.models import Cluster
from apps.people.models import Branch, ModuleCoordinator, Person


class ModuleCoordinatorListPerfTests(APITestCase):
    def setUp(self):
        self.branch = Branch.objects.create(
            name="Muntinlupa",
            code="MUNTPERF",
            is_active=True,
        )
        self.admin = Person.objects.create_user(
            username="perfadmin",
            password="pass12345",
            first_name="Ada",
            last_name="Admin",
            role="ADMIN",
            status="ACTIVE",
            branch=self.branch,
        )
        self.members = []
        self.clusters = []
        for i in range(8):
            member = Person.objects.create_user(
                username=f"perfmember{i}",
                password="pass12345",
                first_name=f"Member{i}",
                last_name="Test",
                role="MEMBER",
                status="ACTIVE",
                branch=self.branch,
            )
            cluster = Cluster.objects.create(
                name=f"Cluster {i}",
                code=f"C-{i}",
                branch=self.branch,
                is_active=True,
            )
            ModuleCoordinator.objects.create(
                person=member,
                module=ModuleCoordinator.ModuleType.CLUSTER,
                level=ModuleCoordinator.CoordinatorLevel.COORDINATOR,
                resource_id=cluster.id,
                resource_type="Cluster",
            )
            self.members.append(member)
            self.clusters.append(cluster)
        self.client.force_authenticate(user=self.admin)

    def test_list_includes_batched_resource_scope_labels(self):
        response = self.client.get("/api/people/module-coordinators/")
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(len(payload), 8)
        labels = {row["resource_scope_label"] for row in payload}
        for cluster in self.clusters:
            self.assertIn(cluster.code, labels)

    def test_list_resource_labels_do_not_query_per_assignment(self):
        # Warm auth / contenttypes so they do not inflate the measured set.
        self.client.get("/api/people/module-coordinators/")

        with CaptureQueriesContext(connection) as ctx:
            response = self.client.get("/api/people/module-coordinators/")

        self.assertEqual(response.status_code, 200)
        # One assignments query (+ optional count) and at most one cluster batch —
        # not one cluster lookup per row (would be 8+).
        cluster_lookups = [
            q["sql"]
            for q in ctx.captured_queries
            if "clusters_cluster" in q["sql"].lower()
        ]
        self.assertLessEqual(
            len(cluster_lookups),
            2,
            f"Expected batched cluster lookups, got {len(cluster_lookups)}: "
            f"{cluster_lookups}",
        )
        self.assertLess(
            len(ctx.captured_queries),
            20,
            f"List used too many queries ({len(ctx.captured_queries)})",
        )
