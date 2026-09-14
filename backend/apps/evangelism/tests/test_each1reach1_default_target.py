from django.test import TestCase

from apps.clusters.models import Cluster
from apps.evangelism.models import Each1Reach1Goal
from apps.evangelism.services import (
    get_default_each1reach1_target,
    recalculate_each1reach1_goal_targets,
)
from apps.people.models import Branch, Person


class Each1Reach1DefaultTargetTests(TestCase):
    def setUp(self):
        self.branch = Branch.objects.create(
            name="Muntinlupa",
            code="MUNTE1R1",
            is_active=True,
        )
        self.cluster = Cluster.objects.create(
            name="East Cluster",
            code="E1R1-EAST",
            branch=self.branch,
            is_active=True,
        )

    def _person(self, username, status="ACTIVE", role="MEMBER"):
        return Person.objects.create_user(
            username=username,
            password="pass12345",
            first_name=username.title(),
            last_name="Test",
            role=role,
            status=status,
            branch=self.branch,
        )

    def test_counts_only_active_semiactive_inactive(self):
        active = self._person("e1r1active", "ACTIVE")
        semi = self._person("e1r1semi", "SEMIACTIVE")
        inactive = self._person("e1r1inactive", "INACTIVE")
        dormant = self._person("e1r1dormant", "DORMANT")
        fallaway = self._person("e1r1fallaway", "FALLAWAY")
        deceased = self._person("e1r1deceased", "DECEASED")
        blank = self._person("e1r1blank", "")
        self.cluster.members.add(
            active, semi, inactive, dormant, fallaway, deceased, blank
        )

        self.assertEqual(get_default_each1reach1_target(self.cluster), 6)

    def test_excludes_admin_even_when_status_is_active(self):
        member = self._person("e1r1member", "ACTIVE")
        admin = self._person("e1r1admin", "ACTIVE", role="ADMIN")
        self.cluster.members.add(member, admin)

        self.assertEqual(get_default_each1reach1_target(self.cluster), 2)

    def test_zero_when_no_counted_roster(self):
        dormant = self._person("e1r1onlydormant", "DORMANT")
        self.cluster.members.add(dormant)

        self.assertEqual(get_default_each1reach1_target(self.cluster), 0)

    def test_recalculate_updates_target_and_status(self):
        active = self._person("e1r1recalc", "ACTIVE")
        dormant = self._person("e1r1dormantmember", "DORMANT")
        self.cluster.members.add(active, dormant)

        not_started = Each1Reach1Goal.objects.create(
            cluster=self.cluster,
            year=2025,
            target_conversions=10,
            achieved_conversions=0,
            status=Each1Reach1Goal.Status.IN_PROGRESS,
        )
        in_progress = Each1Reach1Goal.objects.create(
            cluster=self.cluster,
            year=2026,
            target_conversions=10,
            achieved_conversions=1,
            status=Each1Reach1Goal.Status.COMPLETED,
        )
        completed = Each1Reach1Goal.objects.create(
            cluster=self.cluster,
            year=2024,
            target_conversions=10,
            achieved_conversions=2,
            status=Each1Reach1Goal.Status.NOT_STARTED,
        )

        updated = recalculate_each1reach1_goal_targets()
        self.assertEqual(updated, 3)

        not_started.refresh_from_db()
        in_progress.refresh_from_db()
        completed.refresh_from_db()

        self.assertEqual(not_started.target_conversions, 2)
        self.assertEqual(not_started.status, Each1Reach1Goal.Status.NOT_STARTED)
        self.assertEqual(in_progress.target_conversions, 2)
        self.assertEqual(in_progress.status, Each1Reach1Goal.Status.IN_PROGRESS)
        self.assertEqual(completed.target_conversions, 2)
        self.assertEqual(completed.status, Each1Reach1Goal.Status.COMPLETED)
