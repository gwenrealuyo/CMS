from datetime import date

from rest_framework.test import APITestCase

from apps.ministries.models import (
    CLUSTER_COMMITTEE_MINISTRY_CODE,
    Ministry,
    MinistryMember,
    MinistryRole,
    MinistryScope,
    MinistryVisibility,
)
from apps.people.models import Branch, ModuleCoordinator, Person


class MinistryVisibilityAndCoordinatorAccessTests(APITestCase):
    def setUp(self):
        self.branch = Branch.objects.create(
            name="Visibility Branch",
            code="VISBR",
            is_active=True,
            is_headquarters=False,
        )
        self.admin = self._person("visadmin", "ADMIN", self.branch)
        self.pastor = self._person("vispastor", "PASTOR", self.branch)
        self.member = self._person("vismember", "MEMBER", self.branch)
        self.primary = self._person("visprimary", "MEMBER", self.branch)
        self.support = self._person("vissupport", "MEMBER", self.branch)
        self.outsider = self._person("visoutsider", "MEMBER", self.branch)
        self.team = self._person("visteam", "MEMBER", self.branch)

        self.worship = Ministry.objects.create(
            name="Worship Team",
            code="WORSHIP_VIS",
            scope=MinistryScope.BRANCH,
            branch=self.branch,
            is_active=True,
            visibility=MinistryVisibility.DIRECTORY,
            primary_coordinator=self.primary,
        )
        self.worship.support_coordinators.add(self.support)
        MinistryMember.objects.create(
            ministry=self.worship,
            member=self.team,
            role=MinistryRole.TEAM_MEMBER,
            is_active=True,
        )

        self.internal = Ministry.objects.create(
            name="Internal Care",
            code="INTERNAL_CARE",
            scope=MinistryScope.BRANCH,
            branch=self.branch,
            is_active=True,
            visibility=MinistryVisibility.INTERNAL,
            primary_coordinator=self.primary,
        )
        self.internal.support_coordinators.add(self.support)

        self.committee = Ministry.objects.get(
            code=CLUSTER_COMMITTEE_MINISTRY_CODE,
            branch=self.branch,
        )
        # Leave committee DIRECTORY by default (no seed to INTERNAL).
        self.committee.primary_coordinator = self.primary
        self.committee.save()
        self.committee.support_coordinators.add(self.support)

    def _person(self, username, role, branch):
        return Person.objects.create_user(
            username=username,
            password="pass12345",
            first_name=username,
            last_name="Vis",
            role=role,
            status="ACTIVE",
            branch=branch,
            water_baptism_date=date(2020, 1, 1),
        )

    def _ids(self, response):
        data = response.data
        if isinstance(data, dict) and "results" in data:
            data = data["results"]
        return {row["id"] for row in data}

    def test_visibility_defaults_to_directory(self):
        self.assertEqual(self.committee.visibility, MinistryVisibility.DIRECTORY)
        self.assertEqual(self.worship.visibility, MinistryVisibility.DIRECTORY)

    def test_member_list_hides_internal_by_default(self):
        self.client.force_authenticate(self.member)
        response = self.client.get("/api/ministries/", {"branch": self.branch.id})
        self.assertEqual(response.status_code, 200, response.data)
        ids = self._ids(response)
        self.assertIn(self.worship.id, ids)
        self.assertNotIn(self.internal.id, ids)

    def test_support_lists_internal_with_visibility_param(self):
        self.client.force_authenticate(self.support)
        default = self.client.get("/api/ministries/", {"branch": self.branch.id})
        self.assertNotIn(self.internal.id, self._ids(default))
        internal = self.client.get(
            "/api/ministries/",
            {"branch": self.branch.id, "visibility": "internal"},
        )
        self.assertEqual(internal.status_code, 200, internal.data)
        self.assertIn(self.internal.id, self._ids(internal))

        self.client.force_authenticate(self.outsider)
        denied = self.client.get(
            "/api/ministries/",
            {"branch": self.branch.id, "visibility": "internal"},
        )
        self.assertEqual(denied.status_code, 200, denied.data)
        self.assertNotIn(self.internal.id, self._ids(denied))

    def test_member_retrieve_omits_roster(self):
        self.client.force_authenticate(self.outsider)
        response = self.client.get(f"/api/ministries/{self.worship.id}/")
        self.assertEqual(response.status_code, 200, response.data)
        self.assertFalse(response.data.get("viewer_can_view_roster"))
        self.assertEqual(response.data.get("memberships"), [])
        self.assertEqual(response.data.get("support_coordinators"), [])

        members = self.client.get(
            "/api/ministries/members/", {"ministry": self.worship.id}
        )
        self.assertEqual(members.status_code, 200, members.data)
        data = members.data
        if isinstance(data, dict) and "results" in data:
            data = data["results"]
        self.assertEqual(len(data), 0)

    def test_team_member_and_coordinators_see_roster(self):
        for user in (self.team, self.primary, self.support, self.admin, self.pastor):
            self.client.force_authenticate(user)
            response = self.client.get(f"/api/ministries/{self.worship.id}/")
            self.assertEqual(response.status_code, 200, response.data)
            self.assertTrue(
                response.data.get("viewer_can_view_roster"),
                msg=f"expected roster for {user.username}",
            )
            self.assertGreater(len(response.data.get("memberships") or []), 0)

    def test_coordinator_can_patch_description_and_manage_team_members(self):
        self.client.force_authenticate(self.support)
        patched = self.client.patch(
            f"/api/ministries/{self.worship.id}/",
            {"description": "Updated by support"},
            format="json",
        )
        self.assertEqual(patched.status_code, 200, patched.data)
        self.worship.refresh_from_db()
        self.assertEqual(self.worship.description, "Updated by support")

        new_member = self._person("visnewteam", "MEMBER", self.branch)
        created = self.client.post(
            "/api/ministries/members/",
            {
                "ministry": self.worship.id,
                "member_id": new_member.id,
                "role": MinistryRole.TEAM_MEMBER,
            },
            format="json",
        )
        self.assertEqual(created.status_code, 201, created.data)
        membership_id = created.data["id"]
        deleted = self.client.delete(f"/api/ministries/members/{membership_id}/")
        self.assertEqual(deleted.status_code, 204, deleted.data)

    def test_coordinator_cannot_change_locked_fields_or_other_ministry(self):
        self.client.force_authenticate(self.support)
        locked = self.client.patch(
            f"/api/ministries/{self.worship.id}/",
            {
                "visibility": MinistryVisibility.INTERNAL,
                "scope": MinistryScope.NATIONAL,
                "support_coordinator_ids": [],
            },
            format="json",
        )
        # Permission layer rejects leadership changes; serializer rejects other locks.
        self.assertIn(locked.status_code, (400, 403), locked.data)

        other = Ministry.objects.create(
            name="Other Ministry",
            code="OTHER_VIS",
            scope=MinistryScope.BRANCH,
            branch=self.branch,
            is_active=True,
            visibility=MinistryVisibility.DIRECTORY,
        )
        denied = self.client.patch(
            f"/api/ministries/{other.id}/",
            {"description": "nope"},
            format="json",
        )
        self.assertEqual(denied.status_code, 403, denied.data)

    def test_cluster_committee_support_cannot_clear_leadership(self):
        self.client.force_authenticate(self.support)
        leadership = self.client.patch(
            f"/api/ministries/{self.committee.id}/",
            {"support_coordinator_ids": []},
            format="json",
        )
        self.assertEqual(leadership.status_code, 403, leadership.data)

    def test_ministries_write_can_create_internal_hidden_from_members(self):
        ModuleCoordinator.objects.create(
            person=self.primary,
            module=ModuleCoordinator.ModuleType.MINISTRIES,
            level=ModuleCoordinator.CoordinatorLevel.COORDINATOR,
            resource_id=None,
        )
        self.client.force_authenticate(self.primary)
        created = self.client.post(
            "/api/ministries/",
            {
                "name": "Secret Logistics",
                "code": "SECRET_LOG",
                "activity_cadence": "weekly",
                "scope": "BRANCH",
                "branch": self.branch.id,
                "visibility": MinistryVisibility.INTERNAL,
            },
            format="json",
        )
        self.assertEqual(created.status_code, 201, created.data)
        ministry_id = created.data["id"]

        self.client.force_authenticate(self.outsider)
        listed = self.client.get("/api/ministries/", {"branch": self.branch.id})
        self.assertNotIn(ministry_id, self._ids(listed))
        retrieve = self.client.get(f"/api/ministries/{ministry_id}/")
        self.assertEqual(retrieve.status_code, 404)

    def test_can_view_internal_ministries_on_user_payload(self):
        from apps.authentication.serializers import UserSerializer

        data = UserSerializer(self.primary).data
        self.assertTrue(data.get("can_view_internal_ministries"))
        outsider = UserSerializer(self.outsider).data
        self.assertFalse(outsider.get("can_view_internal_ministries"))

    def test_admin_can_delete_ministry_pastor_cannot(self):
        victim = Ministry.objects.create(
            name="Disposable",
            code="DISPOSABLE",
            scope=MinistryScope.BRANCH,
            branch=self.branch,
            is_active=True,
            visibility=MinistryVisibility.DIRECTORY,
        )
        self.client.force_authenticate(self.pastor)
        denied = self.client.delete(f"/api/ministries/{victim.id}/")
        self.assertEqual(denied.status_code, 403, denied.data)

        self.client.force_authenticate(self.admin)
        deleted = self.client.delete(f"/api/ministries/{victim.id}/")
        self.assertEqual(deleted.status_code, 204, deleted.data)
        self.assertFalse(Ministry.objects.filter(pk=victim.id).exists())

    def test_admin_can_delete_internal_ministry(self):
        victim = Ministry.objects.create(
            name="Disposable Internal",
            code="DISP_INT",
            scope=MinistryScope.BRANCH,
            branch=self.branch,
            is_active=True,
            visibility=MinistryVisibility.INTERNAL,
        )
        self.client.force_authenticate(self.admin)
        deleted = self.client.delete(f"/api/ministries/{victim.id}/")
        self.assertEqual(deleted.status_code, 204, deleted.data)
        self.assertFalse(Ministry.objects.filter(pk=victim.id).exists())

    def test_admin_can_delete_system_ministry_pastor_cannot(self):
        committee_id = self.committee.id
        self.client.force_authenticate(self.pastor)
        denied = self.client.delete(f"/api/ministries/{committee_id}/")
        self.assertEqual(denied.status_code, 403, denied.data)
        self.assertTrue(Ministry.objects.filter(pk=committee_id).exists())

        self.client.force_authenticate(self.admin)
        deleted = self.client.delete(f"/api/ministries/{committee_id}/")
        self.assertEqual(deleted.status_code, 204, deleted.data)
        self.assertFalse(Ministry.objects.filter(pk=committee_id).exists())
