from django.test import TestCase

from apps.people.models import Branch, ModuleCoordinator, Person
from apps.people.serializers import ModuleCoordinatorSerializer


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
            role="COORDINATOR",
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
