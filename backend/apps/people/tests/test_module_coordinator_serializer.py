from django.test import TestCase

from apps.people.models import Branch, ModuleCoordinator, Person
from apps.people.serializers import (
    ModuleCoordinatorBulkCreateSerializer,
    ModuleCoordinatorSerializer,
)
from apps.clusters.models import Cluster


class ModuleCoordinatorResourceScopeLabelTests(TestCase):
    """resource_scope_label for senior coordinators (oversight + optional branch)."""

    def test_senior_coordinator_branch_scoped_includes_branch_name(self):
        branch = Branch.objects.create(
            name="Regional Site",
            code="REG_BR",
            is_headquarters=False,
            is_active=True,
        )
        user = Person.objects.create_user(
            username="senior_reg",
            email="sr@example.com",
            password="password123",
            role="MEMBER",
            branch=branch,
        )
        mc = ModuleCoordinator.objects.create(
            person=user,
            module=ModuleCoordinator.ModuleType.CLUSTER,
            level=ModuleCoordinator.CoordinatorLevel.SENIOR_COORDINATOR,
            resource_id=None,
        )
        label = ModuleCoordinatorSerializer(mc).data["resource_scope_label"]
        self.assertIn("(oversight)", label)
        self.assertIn("Regional Site", label)
        self.assertTrue(label.startswith("All "))

    def test_senior_coordinator_sees_all_branches_omits_branch_suffix(self):
        branch = Branch.objects.create(
            name="Any Branch",
            code="ANY_BR",
            is_active=True,
        )
        admin = Person.objects.create_user(
            username="senior_admin",
            email="sa@example.com",
            password="password123",
            role="ADMIN",
            branch=branch,
        )
        mc = ModuleCoordinator.objects.create(
            person=admin,
            module=ModuleCoordinator.ModuleType.CLUSTER,
            level=ModuleCoordinator.CoordinatorLevel.SENIOR_COORDINATOR,
            resource_id=None,
        )
        label = ModuleCoordinatorSerializer(mc).data["resource_scope_label"]
        self.assertEqual(label, "All Cluster (oversight)")
        self.assertNotIn("Any Branch", label)


class ModuleCoordinatorAssignmentValidationTests(TestCase):
    def setUp(self):
        self.branch_a = Branch.objects.create(name="Branch A", code="BR_A")
        self.branch_b = Branch.objects.create(name="Branch B", code="BR_B")
        self.person_a = Person.objects.create_user(
            username="assign_a",
            email="a@example.com",
            password="password123",
            role="MEMBER",
            branch=self.branch_a,
        )
        self.cluster_b = Cluster.objects.create(
            code="CLU-B",
            name="Cluster B",
            branch=self.branch_b,
        )

    def test_module_wide_coordinator_assignment_rejected(self):
        serializer = ModuleCoordinatorSerializer(
            data={
                "person": self.person_a.id,
                "module": ModuleCoordinator.ModuleType.CLUSTER,
                "level": ModuleCoordinator.CoordinatorLevel.COORDINATOR,
                "resource_id": None,
            }
        )
        self.assertFalse(serializer.is_valid())
        self.assertIn("resource_id", serializer.errors)

    def test_resource_wrong_branch_rejected(self):
        serializer = ModuleCoordinatorSerializer(
            data={
                "person": self.person_a.id,
                "module": ModuleCoordinator.ModuleType.CLUSTER,
                "level": ModuleCoordinator.CoordinatorLevel.COORDINATOR,
                "resource_id": self.cluster_b.id,
                "resource_type": "Cluster",
            }
        )
        self.assertFalse(serializer.is_valid())
        self.assertIn("resource_id", serializer.errors)

    def test_senior_module_wide_assignment_allowed(self):
        serializer = ModuleCoordinatorSerializer(
            data={
                "person": self.person_a.id,
                "module": ModuleCoordinator.ModuleType.CLUSTER,
                "level": ModuleCoordinator.CoordinatorLevel.SENIOR_COORDINATOR,
                "resource_id": None,
            }
        )
        self.assertTrue(serializer.is_valid(), serializer.errors)
        instance = serializer.save()
        self.assertIsNone(instance.resource_id)

    def test_bulk_module_wide_coordinator_rejected(self):
        serializer = ModuleCoordinatorBulkCreateSerializer(
            data={
                "assignments": [
                    {
                        "person": self.person_a.id,
                        "module": ModuleCoordinator.ModuleType.CLUSTER,
                        "level": ModuleCoordinator.CoordinatorLevel.COORDINATOR,
                        "resource_id": None,
                    }
                ]
            }
        )
        self.assertFalse(serializer.is_valid())

    def test_bulk_resource_specific_same_branch_allowed(self):
        cluster_a = Cluster.objects.create(
            code="CLU-A",
            name="Cluster A",
            branch=self.branch_a,
        )
        serializer = ModuleCoordinatorBulkCreateSerializer(
            data={
                "assignments": [
                    {
                        "person": self.person_a.id,
                        "module": ModuleCoordinator.ModuleType.CLUSTER,
                        "level": ModuleCoordinator.CoordinatorLevel.COORDINATOR,
                        "resource_id": cluster_a.id,
                        "resource_type": "Cluster",
                    }
                ]
            }
        )
        self.assertTrue(serializer.is_valid(), serializer.errors)
