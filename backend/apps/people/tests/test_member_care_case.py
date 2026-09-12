from unittest.mock import patch

from rest_framework.test import APITestCase

from apps.clusters.models import Cluster
from apps.people.models import (
    Branch,
    MemberCareCase,
    ModuleCoordinator,
    PeopleAutomationSetting,
    Person,
    PersonStatusChange,
)
from apps.people.utils import record_person_status_change, update_person_status


class MemberCareCaseTests(APITestCase):
    def setUp(self):
        self.branch = Branch.objects.create(
            name="Muntinlupa Care",
            code="MUNTCARE",
            is_active=True,
        )
        self.admin = Person.objects.create_user(
            username="careadmin",
            password="pass12345",
            first_name="Ada",
            last_name="Admin",
            role="ADMIN",
            status="ACTIVE",
            branch=self.branch,
        )
        self.coord = Person.objects.create_user(
            username="carecoord",
            password="pass12345",
            first_name="Cora",
            last_name="Coord",
            role="MEMBER",
            status="ACTIVE",
            branch=self.branch,
        )
        self.other_coord = Person.objects.create_user(
            username="carecoord2",
            password="pass12345",
            first_name="Omar",
            last_name="Other",
            role="MEMBER",
            status="ACTIVE",
            branch=self.branch,
        )
        self.member = Person.objects.create_user(
            username="caremember",
            password="pass12345",
            first_name="Mina",
            last_name="Member",
            role="MEMBER",
            status="ACTIVE",
            branch=self.branch,
        )
        self.other_member = Person.objects.create_user(
            username="caremember2",
            password="pass12345",
            first_name="Ned",
            last_name="Neighbor",
            role="MEMBER",
            status="ACTIVE",
            branch=self.branch,
        )
        self.visitor = Person.objects.create_user(
            username="carevisitor",
            password="pass12345",
            first_name="Vina",
            last_name="Visitor",
            role="VISITOR",
            status="ONGOING",
            branch=self.branch,
        )
        self.plain = Person.objects.create_user(
            username="careplain",
            password="pass12345",
            first_name="Pam",
            last_name="Plain",
            role="MEMBER",
            status="ACTIVE",
            branch=self.branch,
        )
        self.reporter = Person.objects.create_user(
            username="carereporter",
            password="pass12345",
            first_name="Rita",
            last_name="Reporter",
            role="MEMBER",
            status="ACTIVE",
            branch=self.branch,
        )

        self.cluster_a = Cluster.objects.create(
            name="Alpha Care",
            code="ALPHA-CARE",
            branch=self.branch,
            coordinator=self.coord,
        )
        self.cluster_a.members.add(self.member, self.coord)
        self.cluster_b = Cluster.objects.create(
            name="Beta Care",
            code="BETA-CARE",
            branch=self.branch,
            coordinator=self.other_coord,
        )
        self.cluster_b.members.add(self.other_member, self.other_coord)

        ModuleCoordinator.objects.create(
            person=self.reporter,
            module=ModuleCoordinator.ModuleType.CLUSTER,
            level=ModuleCoordinator.CoordinatorLevel.REPORTER,
            resource_id=self.cluster_a.id,
            resource_type="Cluster",
        )

        self.client.force_authenticate(self.admin)

    def _patch_person(self, person, **payload):
        return self.client.patch(
            f"/api/people/people/{person.id}/",
            payload,
            format="json",
        )

    def test_manual_dormant_opens_care_case(self):
        response = self._patch_person(
            self.member,
            status="DORMANT",
            status_change_reason="Moved to the province for work.",
        )
        self.assertEqual(response.status_code, 200, response.data)
        case = MemberCareCase.objects.get(person=self.member)
        self.assertEqual(case.case_status, MemberCareCase.CaseStatus.OPEN)
        self.assertEqual(case.details, "Moved to the province for work.")
        self.assertTrue(response.data.get("open_care_case"))
        self.assertEqual(
            response.data["open_care_case"]["details"],
            "Moved to the province for work.",
        )
        self.assertTrue(response.data["open_care_case"]["needs_attention"])

    @patch(
        "apps.people.utils.calculate_person_attendance_status",
        return_value="INACTIVE",
    )
    def test_auto_inactive_opens_care_case(self, _mock):
        PeopleAutomationSetting.get_solo()
        updated = update_person_status(self.member)
        self.assertTrue(updated)
        case = MemberCareCase.objects.get(person=self.member)
        self.assertEqual(case.case_status, MemberCareCase.CaseStatus.OPEN)
        self.assertIn("attendance patterns", case.details)
        change = PersonStatusChange.objects.get(person=self.member)
        self.assertEqual(case.source_status_change_id, change.id)

    def test_visitor_does_not_open_care_case(self):
        record_person_status_change(
            person=self.visitor,
            from_status="ONGOING",
            to_status="DORMANT",
            source=PersonStatusChange.Source.MANUAL,
            reason="Stopped coming.",
            changed_by=self.admin,
        )
        self.assertFalse(
            MemberCareCase.objects.filter(person=self.visitor).exists()
        )

    def test_active_recovers_open_case(self):
        self._patch_person(
            self.member,
            status="DORMANT",
            status_change_reason="Away for work.",
        )
        response = self._patch_person(self.member, status="ACTIVE")
        self.assertEqual(response.status_code, 200, response.data)
        case = MemberCareCase.objects.get(person=self.member)
        self.assertEqual(case.case_status, MemberCareCase.CaseStatus.RECOVERED)
        self.assertIsNone(response.data.get("open_care_case"))

        listed = self.client.get("/api/people/care-cases/")
        self.assertEqual(listed.status_code, 200, listed.data)
        ids = [row["id"] for row in listed.data.get("results", listed.data)]
        self.assertNotIn(case.id, ids)

        closed = self.client.get("/api/people/care-cases/?include_closed=1")
        closed_ids = [row["id"] for row in closed.data.get("results", closed.data)]
        self.assertIn(case.id, closed_ids)

    def test_deceased_completes_existing_case_and_does_not_open_new(self):
        self._patch_person(
            self.member,
            status="INACTIVE",
            status_change_reason="Has not attended.",
        )
        response = self._patch_person(
            self.member,
            status="DECEASED",
            status_change_reason="Funeral this week.",
        )
        self.assertEqual(response.status_code, 200, response.data)
        case = MemberCareCase.objects.get(person=self.member)
        self.assertEqual(case.case_status, MemberCareCase.CaseStatus.COMPLETED)

        other = Person.objects.create_user(
            username="caredeceased",
            password="pass12345",
            first_name="Dee",
            last_name="Ceased",
            role="MEMBER",
            status="ACTIVE",
            branch=self.branch,
        )
        self._patch_person(
            other,
            status="DECEASED",
            status_change_reason="Passed away.",
        )
        self.assertFalse(MemberCareCase.objects.filter(person=other).exists())

    def test_no_action_stays_on_open_caseload(self):
        self._patch_person(
            self.member,
            status="SEMIACTIVE",
            status_change_reason="Will let them be for now.",
        )
        case = MemberCareCase.objects.get(person=self.member)
        patch = self.client.patch(
            f"/api/people/care-cases/{case.id}/",
            {"recommended_action": "NO_ACTION"},
            format="json",
        )
        self.assertEqual(patch.status_code, 200, patch.data)
        self.assertEqual(patch.data["case_status"], "NO_ACTION")
        self.assertEqual(patch.data["recommended_action"], "NO_ACTION")
        self.assertFalse(patch.data["needs_attention"])

        listed = self.client.get("/api/people/care-cases/")
        ids = [row["id"] for row in listed.data.get("results", listed.data)]
        self.assertIn(case.id, ids)

    def test_other_action_requires_custom_text(self):
        self._patch_person(
            self.member,
            status="SEMIACTIVE",
            status_change_reason="Needs a different follow-up.",
        )
        case = MemberCareCase.objects.get(person=self.member)
        missing = self.client.patch(
            f"/api/people/care-cases/{case.id}/",
            {"recommended_action": "OTHER"},
            format="json",
        )
        self.assertEqual(missing.status_code, 400, missing.data)
        self.assertIn(
            "recommended_action_other",
            missing.data.get("details", missing.data),
        )

        saved = self.client.patch(
            f"/api/people/care-cases/{case.id}/",
            {
                "recommended_action": "OTHER",
                "recommended_action_other": "  Pray with the family  ",
            },
            format="json",
        )
        self.assertEqual(saved.status_code, 200, saved.data)
        self.assertEqual(saved.data["recommended_action"], "OTHER")
        self.assertEqual(saved.data["recommended_action_other"], "Pray with the family")

        cleared = self.client.patch(
            f"/api/people/care-cases/{case.id}/",
            {"recommended_action": "VISITATION"},
            format="json",
        )
        self.assertEqual(cleared.status_code, 200, cleared.data)
        self.assertEqual(cleared.data["recommended_action"], "VISITATION")
        self.assertEqual(cleared.data["recommended_action_other"], "")

    def test_coordinator_list_is_scoped_and_cannot_patch_other_cluster(self):
        self._patch_person(
            self.member,
            status="DORMANT",
            status_change_reason="Alpha dormant.",
        )
        self._patch_person(
            self.other_member,
            status="INACTIVE",
            status_change_reason="Beta inactive.",
        )
        own = MemberCareCase.objects.get(person=self.member)
        other = MemberCareCase.objects.get(person=self.other_member)

        self.client.force_authenticate(self.coord)
        listed = self.client.get("/api/people/care-cases/")
        self.assertEqual(listed.status_code, 200, listed.data)
        ids = [row["id"] for row in listed.data.get("results", listed.data)]
        self.assertEqual(ids, [own.id])

        blocked = self.client.patch(
            f"/api/people/care-cases/{other.id}/",
            {"remarks": "Should not work"},
            format="json",
        )
        self.assertEqual(blocked.status_code, 404)

        allowed = self.client.patch(
            f"/api/people/care-cases/{own.id}/",
            {
                "recommended_action": "VISITATION",
                "remarks": "Visit this week",
            },
            format="json",
        )
        self.assertEqual(allowed.status_code, 200, allowed.data)
        self.assertEqual(allowed.data["recommended_action"], "VISITATION")

    def test_coordinator_can_patch_member_status_from_cluster_scope(self):
        self.client.force_authenticate(self.coord)
        response = self.client.patch(
            f"/api/people/people/{self.member.id}/",
            {
                "status": "DORMANT",
                "status_change_reason": "From cluster details.",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 200, response.data)
        case = MemberCareCase.objects.get(person=self.member)
        self.assertEqual(case.case_status, MemberCareCase.CaseStatus.OPEN)
        self.assertEqual(case.details, "From cluster details.")

    def test_reporter_and_plain_member_cannot_list_care_cases(self):
        self._patch_person(
            self.member,
            status="DORMANT",
            status_change_reason="Away.",
        )
        self.client.force_authenticate(self.reporter)
        reporter_res = self.client.get("/api/people/care-cases/")
        self.assertEqual(reporter_res.status_code, 403)

        self.client.force_authenticate(self.plain)
        plain_res = self.client.get("/api/people/care-cases/")
        self.assertEqual(plain_res.status_code, 403)

    def test_list_omits_open_care_case_on_people_directory(self):
        self._patch_person(
            self.member,
            status="FALLAWAY",
            status_change_reason="Left fellowship.",
        )
        response = self.client.get("/api/people/people/")
        self.assertEqual(response.status_code, 200, response.data)
        results = response.data.get("results", response.data)
        member_row = next(
            row for row in results if str(row["id"]) == str(self.member.id)
        )
        self.assertNotIn("open_care_case", member_row)
        self.assertNotIn("latest_status_change", member_row)
