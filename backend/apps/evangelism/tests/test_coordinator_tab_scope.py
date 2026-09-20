from datetime import date

from rest_framework.test import APITestCase

from apps.clusters.models import Cluster
from apps.evangelism.models import (
    Conversion,
    Each1Reach1Goal,
    EvangelismGroup,
    EvangelismWeeklyReport,
    Prospect,
)
from apps.ministries.bible_sharers import ensure_bible_sharers_ministry
from apps.ministries.models import MinistryMember
from apps.people.models import Branch, ModuleCoordinator, Person

GOALS_URL = "/api/evangelism/each1reach1-goals/"
REPORTS_URL = "/api/evangelism/weekly-reports/"
TALLY_URL = "/api/evangelism/weekly-reports/tally/"
PEOPLE_TALLY_URL = "/api/evangelism/weekly-reports/people_tally/"
PROSPECTS_URL = "/api/evangelism/prospects/"
CONVERSIONS_URL = "/api/evangelism/conversions/"
ME_URL = "/api/auth/me/"


class CoordinatorTabScopeAPITests(APITestCase):
    def setUp(self):
        self.branch = Branch.objects.create(
            name="Muntinlupa",
            code="MUNTTABSCOPE",
            is_active=True,
        )
        self.senior = Person.objects.create_user(
            username="tabsenior",
            password="pass12345",
            first_name="Sam",
            last_name="Senior",
            role="MEMBER",
            status="ACTIVE",
            branch=self.branch,
        )
        self.coordinator = Person.objects.create_user(
            username="tabcoord",
            password="pass12345",
            first_name="Cora",
            last_name="Coord",
            role="MEMBER",
            status="ACTIVE",
            branch=self.branch,
        )
        self.east = Cluster.objects.create(
            name="East Cluster",
            code="TAB-EAST",
            branch=self.branch,
            is_active=True,
        )
        self.west = Cluster.objects.create(
            name="West Cluster",
            code="TAB-WEST",
            branch=self.branch,
            is_active=True,
        )
        self.owned_group = EvangelismGroup.objects.create(
            name="Cora Study",
            coordinator=self.coordinator,
            cluster=self.east,
            branch=self.branch,
            is_active=True,
            approval_status=EvangelismGroup.ApprovalStatus.APPROVED,
        )
        self.other_group = EvangelismGroup.objects.create(
            name="West Study",
            coordinator=self.senior,
            cluster=self.west,
            branch=self.branch,
            is_active=True,
            approval_status=EvangelismGroup.ApprovalStatus.APPROVED,
        )
        self.owned_group.members.add(self.coordinator)
        self.other_group.members.add(self.coordinator)
        ModuleCoordinator.objects.create(
            person=self.senior,
            module=ModuleCoordinator.ModuleType.EVANGELISM,
            level=ModuleCoordinator.CoordinatorLevel.SENIOR_COORDINATOR,
        )
        ModuleCoordinator.objects.create(
            person=self.coordinator,
            module=ModuleCoordinator.ModuleType.EVANGELISM,
            level=ModuleCoordinator.CoordinatorLevel.COORDINATOR,
            resource_id=self.owned_group.id,
            resource_type="EvangelismGroup",
        )

    def test_coordinator_can_create_and_edit_own_cluster_goal_not_others(self):
        self.client.force_authenticate(self.coordinator)
        listed = self.client.get(GOALS_URL, {"year": 2027, "page_size": 100})
        self.assertEqual(listed.status_code, 200, listed.data)

        created = self.client.post(
            GOALS_URL,
            {
                "cluster_id": self.east.id,
                "year": 2028,
                "target_conversions": 4,
            },
            format="json",
        )
        self.assertEqual(created.status_code, 201, created.data)
        self.assertEqual(created.data["target_conversions"], 4)

        denied = self.client.post(
            GOALS_URL,
            {
                "cluster_id": self.west.id,
                "year": 2028,
                "target_conversions": 8,
            },
            format="json",
        )
        self.assertEqual(denied.status_code, 403)

        patched = self.client.patch(
            f"{GOALS_URL}{created.data['id']}/",
            {"target_conversions": 6},
            format="json",
        )
        self.assertEqual(patched.status_code, 200, patched.data)
        self.assertEqual(patched.data["target_conversions"], 6)

        other_goal = Each1Reach1Goal.objects.create(
            cluster=self.west,
            year=2028,
            target_conversions=2,
        )
        other_patch = self.client.patch(
            f"{GOALS_URL}{other_goal.id}/",
            {"target_conversions": 99},
            format="json",
        )
        self.assertEqual(other_patch.status_code, 403)

        self.client.force_authenticate(self.senior)
        senior = self.client.post(
            GOALS_URL,
            {
                "cluster_id": self.west.id,
                "year": 2029,
                "target_conversions": 10,
            },
            format="json",
        )
        self.assertEqual(senior.status_code, 201, senior.data)

    def test_coordinator_reports_exclude_membership_only_groups(self):
        own_report = EvangelismWeeklyReport.objects.create(
            evangelism_group=self.owned_group,
            year=2026,
            week_number=1,
            meeting_date=date(2026, 1, 5),
            gathering_type="PHYSICAL",
            submitted_by=self.coordinator,
        )
        other_report = EvangelismWeeklyReport.objects.create(
            evangelism_group=self.other_group,
            year=2026,
            week_number=1,
            meeting_date=date(2026, 1, 6),
            gathering_type="PHYSICAL",
            submitted_by=self.senior,
        )
        self.client.force_authenticate(self.coordinator)
        response = self.client.get(REPORTS_URL, {"page_size": 100, "year": 2026})
        self.assertEqual(response.status_code, 200, response.data)
        ids = {row["id"] for row in response.data["results"]}
        self.assertIn(own_report.id, ids)
        self.assertNotIn(other_report.id, ids)

    def test_coordinator_tally_omits_other_groups(self):
        EvangelismWeeklyReport.objects.create(
            evangelism_group=self.owned_group,
            year=2026,
            week_number=2,
            meeting_date=date(2026, 1, 12),
            gathering_type="PHYSICAL",
            submitted_by=self.coordinator,
        )
        EvangelismWeeklyReport.objects.create(
            evangelism_group=self.other_group,
            year=2026,
            week_number=2,
            meeting_date=date(2026, 1, 13),
            gathering_type="PHYSICAL",
            submitted_by=self.senior,
        )
        self.client.force_authenticate(self.coordinator)
        tally = self.client.get(TALLY_URL, {"year": 2026})
        self.assertEqual(tally.status_code, 200, tally.data)
        cluster_ids = {row.get("cluster_id") for row in tally.data}
        self.assertIn(self.east.id, cluster_ids)
        self.assertNotIn(self.west.id, cluster_ids)

        allowed = self.client.get(
            PEOPLE_TALLY_URL,
            {
                "year": 2026,
                "branch": self.branch.id,
                "evangelism_group": self.owned_group.id,
            },
        )
        self.assertEqual(allowed.status_code, 200, allowed.data)

        denied = self.client.get(
            PEOPLE_TALLY_URL,
            {
                "year": 2026,
                "branch": self.branch.id,
                "evangelism_group": self.other_group.id,
            },
        )
        self.assertEqual(denied.status_code, 403)

    def test_me_on_bible_sharers_roster_flag(self):
        self.client.force_authenticate(self.coordinator)
        off_roster = self.client.get(ME_URL)
        self.assertEqual(off_roster.status_code, 200, off_roster.data)
        self.assertFalse(off_roster.data.get("on_bible_sharers_roster"))

        ministry = ensure_bible_sharers_ministry()
        self.assertIsNotNone(ministry)
        MinistryMember.objects.create(ministry=ministry, member=self.coordinator)
        on_roster = self.client.get(ME_URL)
        self.assertEqual(on_roster.status_code, 200, on_roster.data)
        self.assertTrue(on_roster.data.get("on_bible_sharers_roster"))

    def test_coordinator_cannot_add_visitor_or_conversion_on_other_groups(self):
        convert_person = Person.objects.create_user(
            username="tabconvert",
            password="pass12345",
            first_name="Val",
            last_name="Convert",
            role="VISITOR",
            status="ONGOING",
            branch=self.branch,
        )
        other_prospect = Prospect.objects.create(
            first_name="Oli",
            last_name="Other",
            invited_by=self.senior,
            evangelism_group=self.other_group,
            pipeline_stage=Prospect.PipelineStage.INVITED,
        )
        other_conversion = Conversion.objects.create(
            person=convert_person,
            converted_by=self.senior,
            evangelism_group=self.other_group,
            conversion_date=date(2026, 2, 1),
        )

        self.client.force_authenticate(self.coordinator)
        own_visitor = self.client.post(
            PROSPECTS_URL,
            {
                "first_name": "Vee",
                "last_name": "Visitor",
                "invited_by_id": self.coordinator.id,
                "evangelism_group_id": self.owned_group.id,
            },
            format="json",
        )
        self.assertEqual(own_visitor.status_code, 201, own_visitor.data)

        denied_visitor = self.client.post(
            PROSPECTS_URL,
            {
                "first_name": "Ned",
                "last_name": "Nope",
                "invited_by_id": self.coordinator.id,
                "evangelism_group_id": self.other_group.id,
            },
            format="json",
        )
        self.assertEqual(denied_visitor.status_code, 403)

        denied_progress = self.client.post(
            f"{PROSPECTS_URL}{other_prospect.id}/update_progress/",
            {"pipeline_stage": "ATTENDED"},
            format="json",
        )
        self.assertEqual(denied_progress.status_code, 403)

        # Conversion writes are deprecated (410); use Person PATCH instead.
        deprecated_create = self.client.post(
            CONVERSIONS_URL,
            {
                "person_id": convert_person.id,
                "converted_by_id": self.coordinator.id,
                "evangelism_group_id": self.owned_group.id,
                "conversion_date": "2026-03-01",
            },
            format="json",
        )
        self.assertEqual(deprecated_create.status_code, 410)

        denied_edit = self.client.patch(
            f"{CONVERSIONS_URL}{other_conversion.id}/",
            {"notes": "should not stick"},
            format="json",
        )
        # Write path is gone for everyone (including group owners).
        self.assertEqual(denied_edit.status_code, 410)
