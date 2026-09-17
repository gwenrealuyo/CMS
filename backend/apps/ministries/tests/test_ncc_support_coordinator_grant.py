from rest_framework.test import APITestCase

from apps.ministries.models import Ministry, MinistryMember, MinistryRole
from apps.ministries.ncc import (
    ensure_ncc_ministry,
    grant_lessons_coordinator_access,
    revoke_lessons_coordinator_access,
)
from apps.people.models import Branch, ModuleCoordinator, Person


class NccSupportCoordinatorGrantTests(APITestCase):
    def setUp(self):
        self.branch = Branch.objects.create(
            name="Muntinlupa",
            code="MUNTNCCSUP",
            is_active=True,
        )
        self.support = Person.objects.create_user(
            username="nccsupcoord",
            password="pass12345",
            first_name="Sonia",
            last_name="Support",
            role="MEMBER",
            status="ACTIVE",
            branch=self.branch,
        )
        self.ministry = ensure_ncc_ministry(self.branch)

    def _lessons_assignment(self, person=None):
        return ModuleCoordinator.objects.filter(
            person=person or self.support,
            module=ModuleCoordinator.ModuleType.LESSONS,
            resource_id=None,
        ).first()

    def test_adding_ncc_support_creates_lessons_coordinator(self):
        self.ministry.support_coordinators.add(self.support)
        assignment = self._lessons_assignment()
        self.assertIsNotNone(assignment)
        self.assertEqual(
            assignment.level, ModuleCoordinator.CoordinatorLevel.COORDINATOR
        )
        self.assertEqual(
            ModuleCoordinator.objects.filter(
                person=self.support,
                module=ModuleCoordinator.ModuleType.LESSONS,
            ).count(),
            1,
        )

    def test_existing_coordinator_is_not_duplicated(self):
        ModuleCoordinator.objects.create(
            person=self.support,
            module=ModuleCoordinator.ModuleType.LESSONS,
            level=ModuleCoordinator.CoordinatorLevel.COORDINATOR,
            resource_id=None,
        )
        self.ministry.support_coordinators.add(self.support)
        self.assertEqual(
            ModuleCoordinator.objects.filter(
                person=self.support,
                module=ModuleCoordinator.ModuleType.LESSONS,
            ).count(),
            1,
        )
        self.assertEqual(
            self._lessons_assignment().level,
            ModuleCoordinator.CoordinatorLevel.COORDINATOR,
        )

    def test_senior_assignment_is_not_overwritten(self):
        ModuleCoordinator.objects.create(
            person=self.support,
            module=ModuleCoordinator.ModuleType.LESSONS,
            level=ModuleCoordinator.CoordinatorLevel.SENIOR_COORDINATOR,
            resource_id=None,
        )
        self.ministry.support_coordinators.add(self.support)
        self.assertEqual(
            self._lessons_assignment().level,
            ModuleCoordinator.CoordinatorLevel.SENIOR_COORDINATOR,
        )

    def test_teacher_row_is_upgraded_to_coordinator(self):
        ModuleCoordinator.objects.create(
            person=self.support,
            module=ModuleCoordinator.ModuleType.LESSONS,
            level=ModuleCoordinator.CoordinatorLevel.TEACHER,
            resource_id=None,
        )
        self.ministry.support_coordinators.add(self.support)
        assignment = self._lessons_assignment()
        self.assertEqual(
            assignment.level, ModuleCoordinator.CoordinatorLevel.COORDINATOR
        )
        self.assertEqual(
            ModuleCoordinator.objects.filter(
                person=self.support,
                module=ModuleCoordinator.ModuleType.LESSONS,
            ).count(),
            1,
        )

    def test_removing_support_demotes_to_teacher_when_roster_membership_remains(self):
        self.ministry.support_coordinators.add(self.support)
        self.assertTrue(
            MinistryMember.objects.filter(
                ministry=self.ministry, member=self.support, is_active=True
            ).exists()
        )
        self.ministry.support_coordinators.remove(self.support)
        assignment = self._lessons_assignment()
        self.assertIsNotNone(assignment)
        self.assertEqual(
            assignment.level, ModuleCoordinator.CoordinatorLevel.TEACHER
        )
        membership = MinistryMember.objects.get(
            ministry=self.ministry, member=self.support
        )
        self.assertEqual(membership.role, MinistryRole.TEAM_MEMBER)

    def test_removing_support_deletes_coordinator_without_active_membership(self):
        self.ministry.support_coordinators.add(self.support)
        MinistryMember.objects.filter(
            ministry=self.ministry, member=self.support
        ).delete()
        self.ministry.support_coordinators.remove(self.support)
        self.assertIsNone(self._lessons_assignment())

    def test_removing_support_does_not_demote_senior(self):
        ModuleCoordinator.objects.create(
            person=self.support,
            module=ModuleCoordinator.ModuleType.LESSONS,
            level=ModuleCoordinator.CoordinatorLevel.SENIOR_COORDINATOR,
            resource_id=None,
        )
        self.ministry.support_coordinators.add(self.support)
        self.ministry.support_coordinators.remove(self.support)
        self.assertEqual(
            self._lessons_assignment().level,
            ModuleCoordinator.CoordinatorLevel.SENIOR_COORDINATOR,
        )

    def test_non_ncc_support_does_not_grant_lessons_coordinator(self):
        other = Ministry.objects.create(
            name="Worship Team",
            code="WORSHIPNCCSUP",
            branch=self.branch,
            is_system=False,
        )
        other.support_coordinators.add(self.support)
        self.assertIsNone(self._lessons_assignment())

    def test_revoke_helper_deletes_when_no_roster_membership(self):
        grant_lessons_coordinator_access(self.support)
        self.assertIsNotNone(self._lessons_assignment())
        revoke_lessons_coordinator_access(self.support)
        self.assertIsNone(self._lessons_assignment())
