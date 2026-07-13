import json

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.exceptions import ValidationError

from .models import Ministry, MinistryMember, MinistryRole
from .serializers import MinistrySerializer


class MinistrySerializerTests(TestCase):
    def setUp(self):
        self.User = get_user_model()
        self.primary = self.User.objects.create_user(
            username="primary@example.com",
            email="primary@example.com",
            password="test1234",
            first_name="Primary",
            last_name="Coordinator",
        )
        self.support = self.User.objects.create_user(
            username="support@example.com",
            email="support@example.com",
            password="test1234",
            first_name="Support",
            last_name="Coordinator",
        )

    def test_serializer_accepts_full_payload(self):
        payload = {
            "name": "Worship Team",
            "description": "Handles music for Sunday services.",
            "category": "worship",
            "activity_cadence": "weekly",
            "primary_coordinator_id": self.primary.pk,
            "support_coordinator_ids": [self.support.pk, self.primary.pk],
            "meeting_location": "Main Sanctuary",
            "meeting_schedule": {"day": "Sunday", "time": "09:00"},
            "communication_channel": "https://example.com/chat",
            "is_active": True,
        }

        serializer = MinistrySerializer(data=payload)
        self.assertTrue(serializer.is_valid(), serializer.errors)
        ministry = serializer.save()

        self.assertEqual(Ministry.objects.count(), 1)
        self.assertEqual(ministry.name, payload["name"])
        self.assertEqual(ministry.primary_coordinator, self.primary)
        self.assertEqual(ministry.category, "worship")
        self.assertEqual(ministry.activity_cadence, "weekly")
        self.assertEqual(ministry.meeting_schedule, {"day": "Sunday", "time": "09:00"})
        self.assertEqual(ministry.support_coordinators.count(), 1)
        self.assertEqual(ministry.support_coordinators.first(), self.support)

    def test_serializer_accepts_schedule_as_json_string(self):
        payload = {
            "name": "Logistics Team",
            "activity_cadence": "event_driven",
            "meeting_schedule": json.dumps({"season": "Holy Week"}),
            "is_active": False,
        }

        serializer = MinistrySerializer(data=payload)
        self.assertTrue(serializer.is_valid(), serializer.errors)
        ministry = serializer.save()

        self.assertEqual(ministry.meeting_schedule, {"season": "Holy Week"})

    def test_serializer_rejects_invalid_schedule(self):
        payload = {
            "name": "Invalid Schedule Team",
            "activity_cadence": "ad_hoc",
            "meeting_schedule": "not-json",
        }

        serializer = MinistrySerializer(data=payload)
        with self.assertRaises(ValidationError):
            serializer.is_valid(raise_exception=True)


class CoordinatorSyncTests(TestCase):
    """Tests for coordinator synchronization with MinistryMember entries."""

    def setUp(self):
        self.User = get_user_model()
        self.primary = self.User.objects.create_user(
            username="primary@example.com",
            email="primary@example.com",
            password="test1234",
            first_name="Primary",
            last_name="Coordinator",
        )
        self.support1 = self.User.objects.create_user(
            username="support1@example.com",
            email="support1@example.com",
            password="test1234",
            first_name="Support",
            last_name="One",
        )
        self.support2 = self.User.objects.create_user(
            username="support2@example.com",
            email="support2@example.com",
            password="test1234",
            first_name="Support",
            last_name="Two",
        )
        self.team_member = self.User.objects.create_user(
            username="member@example.com",
            email="member@example.com",
            password="test1234",
            first_name="Team",
            last_name="Member",
        )

    def test_primary_coordinator_sync_on_create(self):
        """Test that primary coordinator is synced to MinistryMember on create."""
        payload = {
            "name": "Worship Team",
            "activity_cadence": "weekly",
            "primary_coordinator_id": self.primary.pk,
        }

        serializer = MinistrySerializer(data=payload)
        self.assertTrue(serializer.is_valid(), serializer.errors)
        ministry = serializer.save()

        # Check that MinistryMember was created
        membership = MinistryMember.objects.get(ministry=ministry, member=self.primary)
        self.assertEqual(membership.role, MinistryRole.PRIMARY_COORDINATOR)
        self.assertTrue(membership.is_active)

    def test_support_coordinators_sync_on_create(self):
        """Test that support coordinators are synced to MinistryMember on create."""
        payload = {
            "name": "Outreach Team",
            "activity_cadence": "monthly",
            "support_coordinator_ids": [self.support1.pk, self.support2.pk],
        }

        serializer = MinistrySerializer(data=payload)
        self.assertTrue(serializer.is_valid(), serializer.errors)
        ministry = serializer.save()

        # Check that MinistryMember entries were created
        membership1 = MinistryMember.objects.get(
            ministry=ministry, member=self.support1
        )
        membership2 = MinistryMember.objects.get(
            ministry=ministry, member=self.support2
        )

        self.assertEqual(membership1.role, MinistryRole.COORDINATOR)
        self.assertEqual(membership2.role, MinistryRole.COORDINATOR)
        self.assertTrue(membership1.is_active)
        self.assertTrue(membership2.is_active)

    def test_both_coordinators_sync_on_create(self):
        """Test that both primary and support coordinators sync correctly."""
        payload = {
            "name": "Care Team",
            "activity_cadence": "weekly",
            "primary_coordinator_id": self.primary.pk,
            "support_coordinator_ids": [self.support1.pk],
        }

        serializer = MinistrySerializer(data=payload)
        self.assertTrue(serializer.is_valid(), serializer.errors)
        ministry = serializer.save()

        # Check primary coordinator
        primary_membership = MinistryMember.objects.get(
            ministry=ministry, member=self.primary
        )
        self.assertEqual(primary_membership.role, MinistryRole.PRIMARY_COORDINATOR)

        # Check support coordinator
        support_membership = MinistryMember.objects.get(
            ministry=ministry, member=self.support1
        )
        self.assertEqual(support_membership.role, MinistryRole.COORDINATOR)

    def test_primary_coordinator_sync_on_update(self):
        """Test that primary coordinator is synced on update."""
        ministry = Ministry.objects.create(
            name="Test Ministry",
            activity_cadence="weekly",
            scope="NATIONAL",
            code="TEST-MIN",
        )

        payload = {
            "name": "Test Ministry",
            "activity_cadence": "weekly",
            "primary_coordinator_id": self.primary.pk,
        }

        serializer = MinistrySerializer(ministry, data=payload)
        self.assertTrue(serializer.is_valid(), serializer.errors)
        serializer.save()

        # Check that MinistryMember was created/updated
        membership = MinistryMember.objects.get(ministry=ministry, member=self.primary)
        self.assertEqual(membership.role, MinistryRole.PRIMARY_COORDINATOR)

    def test_support_coordinators_sync_on_update(self):
        """Test that support coordinators are synced on update."""
        ministry = Ministry.objects.create(
            name="Test Ministry",
            activity_cadence="weekly",
            scope="NATIONAL",
            code="TEST-MIN",
        )

        payload = {
            "name": "Test Ministry",
            "activity_cadence": "weekly",
            "support_coordinator_ids": [self.support1.pk, self.support2.pk],
        }

        serializer = MinistrySerializer(ministry, data=payload)
        self.assertTrue(serializer.is_valid(), serializer.errors)
        serializer.save()

        # Check that MinistryMember entries were created
        self.assertEqual(
            MinistryMember.objects.filter(
                ministry=ministry, role=MinistryRole.COORDINATOR
            ).count(),
            2,
        )

    def test_coordinator_removal_updates_role(self):
        """Test that removing a coordinator updates their role to TEAM_MEMBER."""
        ministry = Ministry.objects.create(
            name="Test Ministry",
            activity_cadence="weekly",
            scope="NATIONAL",
            code="TEST-MIN-P",
            primary_coordinator=self.primary,
        )
        ministry.support_coordinators.add(self.support1)

        # Sync should have created memberships
        primary_membership = MinistryMember.objects.get(
            ministry=ministry, member=self.primary
        )
        support_membership = MinistryMember.objects.get(
            ministry=ministry, member=self.support1
        )

        self.assertEqual(primary_membership.role, MinistryRole.PRIMARY_COORDINATOR)
        self.assertEqual(support_membership.role, MinistryRole.COORDINATOR)

        # Remove primary coordinator
        payload = {
            "name": "Test Ministry",
            "activity_cadence": "weekly",
            "primary_coordinator_id": None,
        }

        serializer = MinistrySerializer(ministry, data=payload)
        self.assertTrue(serializer.is_valid(), serializer.errors)
        serializer.save()

        # Primary coordinator role should be updated to TEAM_MEMBER
        primary_membership.refresh_from_db()
        self.assertEqual(primary_membership.role, MinistryRole.TEAM_MEMBER)

        # Support coordinator should still be COORDINATOR
        support_membership.refresh_from_db()
        self.assertEqual(support_membership.role, MinistryRole.COORDINATOR)

    def test_support_coordinator_removal_updates_role(self):
        """Test that removing a support coordinator updates their role."""
        ministry = Ministry.objects.create(
            name="Test Ministry",
            activity_cadence="weekly",
            scope="NATIONAL",
            code="TEST-MIN",
        )
        ministry.support_coordinators.add(self.support1, self.support2)

        # Sync should have created memberships
        support1_membership = MinistryMember.objects.get(
            ministry=ministry, member=self.support1
        )
        support2_membership = MinistryMember.objects.get(
            ministry=ministry, member=self.support2
        )

        # Remove one support coordinator
        payload = {
            "name": "Test Ministry",
            "activity_cadence": "weekly",
            "support_coordinator_ids": [self.support2.pk],
        }

        serializer = MinistrySerializer(ministry, data=payload)
        self.assertTrue(serializer.is_valid(), serializer.errors)
        serializer.save()

        # Removed coordinator should be updated to TEAM_MEMBER
        support1_membership.refresh_from_db()
        self.assertEqual(support1_membership.role, MinistryRole.TEAM_MEMBER)

        # Remaining coordinator should still be COORDINATOR
        support2_membership.refresh_from_db()
        self.assertEqual(support2_membership.role, MinistryRole.COORDINATOR)

    def test_primary_to_support_coordinator_change(self):
        """Test changing primary coordinator to support coordinator."""
        ministry = Ministry.objects.create(
            name="Test Ministry",
            activity_cadence="weekly",
            scope="NATIONAL",
            code="TEST-MIN-P",
            primary_coordinator=self.primary,
        )

        # Change primary to support coordinator
        payload = {
            "name": "Test Ministry",
            "activity_cadence": "weekly",
            "primary_coordinator_id": self.support1.pk,
            "support_coordinator_ids": [self.primary.pk],
        }

        serializer = MinistrySerializer(ministry, data=payload)
        self.assertTrue(serializer.is_valid(), serializer.errors)
        serializer.save()

        # Old primary should now be support coordinator
        old_primary_membership = MinistryMember.objects.get(
            ministry=ministry, member=self.primary
        )
        self.assertEqual(old_primary_membership.role, MinistryRole.COORDINATOR)

        # New primary should be primary coordinator
        new_primary_membership = MinistryMember.objects.get(
            ministry=ministry, member=self.support1
        )
        self.assertEqual(new_primary_membership.role, MinistryRole.PRIMARY_COORDINATOR)

    def test_existing_member_becomes_coordinator(self):
        """Test that existing team member can become a coordinator."""
        ministry = Ministry.objects.create(
            name="Test Ministry",
            activity_cadence="weekly",
            scope="NATIONAL",
            code="TEST-MIN",
        )

        # Create existing membership as team member
        existing_membership = MinistryMember.objects.create(
            ministry=ministry,
            member=self.team_member,
            role=MinistryRole.TEAM_MEMBER,
        )

        # Set as primary coordinator
        payload = {
            "name": "Test Ministry",
            "activity_cadence": "weekly",
            "primary_coordinator_id": self.team_member.pk,
        }

        serializer = MinistrySerializer(ministry, data=payload)
        self.assertTrue(serializer.is_valid(), serializer.errors)
        serializer.save()

        # Existing membership should be updated to PRIMARY_COORDINATOR
        existing_membership.refresh_from_db()
        self.assertEqual(existing_membership.role, MinistryRole.PRIMARY_COORDINATOR)

    def test_primary_not_in_support_coordinators(self):
        """Test that primary coordinator is not added to support_coordinators."""
        payload = {
            "name": "Test Ministry",
            "activity_cadence": "weekly",
            "primary_coordinator_id": self.primary.pk,
            "support_coordinator_ids": [self.primary.pk, self.support1.pk],
        }

        serializer = MinistrySerializer(data=payload)
        self.assertTrue(serializer.is_valid(), serializer.errors)
        ministry = serializer.save()

        # Primary should not be in support_coordinators
        self.assertNotIn(self.primary, ministry.support_coordinators.all())
        self.assertIn(self.support1, ministry.support_coordinators.all())

        # Primary should have PRIMARY_COORDINATOR role
        primary_membership = MinistryMember.objects.get(
            ministry=ministry, member=self.primary
        )
        self.assertEqual(primary_membership.role, MinistryRole.PRIMARY_COORDINATOR)

        # Support should have COORDINATOR role
        support_membership = MinistryMember.objects.get(
            ministry=ministry, member=self.support1
        )
        self.assertEqual(support_membership.role, MinistryRole.COORDINATOR)


class MinistryScopeVisibilityAPITests(TestCase):
    """Branch vs national list/create rules for ministries."""

    def setUp(self):
        from rest_framework.test import APIClient

        from apps.people.models import Branch, ModuleCoordinator

        self.client = APIClient()
        self.User = get_user_model()
        self.branch_a = Branch.objects.create(
            name="Branch A", code="MIN_A", is_active=True
        )
        self.branch_b = Branch.objects.create(
            name="Branch B", code="MIN_B", is_active=True
        )
        self.hq = Branch.objects.create(
            name="HQ", code="MIN_HQ", is_active=True, is_headquarters=True
        )

        self.member_a = self.User.objects.create_user(
            username="min_member_a",
            email="min_member_a@test.com",
            password="testpass123",
            role="MEMBER",
            branch=self.branch_a,
        )
        self.pastor_a = self.User.objects.create_user(
            username="min_pastor_a",
            email="min_pastor_a@test.com",
            password="testpass123",
            role="PASTOR",
            branch=self.branch_a,
        )
        self.hq_pastor = self.User.objects.create_user(
            username="min_hq_pastor",
            email="min_hq_pastor@test.com",
            password="testpass123",
            role="PASTOR",
            branch=self.hq,
        )
        self.admin = self.User.objects.create_user(
            username="min_admin",
            email="min_admin@test.com",
            password="testpass123",
            role="ADMIN",
            branch=self.hq,
        )
        self.coord_a = self.User.objects.create_user(
            username="min_coord_a",
            email="min_coord_a@test.com",
            password="testpass123",
            role="MEMBER",
            branch=self.branch_a,
        )
        self.senior = self.User.objects.create_user(
            username="min_senior",
            email="min_senior@test.com",
            password="testpass123",
            role="MEMBER",
            branch=self.branch_a,
        )
        ModuleCoordinator.objects.create(
            person=self.coord_a,
            module=ModuleCoordinator.ModuleType.MINISTRIES,
            level=ModuleCoordinator.CoordinatorLevel.COORDINATOR,
        )
        ModuleCoordinator.objects.create(
            person=self.senior,
            module=ModuleCoordinator.ModuleType.MINISTRIES,
            level=ModuleCoordinator.CoordinatorLevel.SENIOR_COORDINATOR,
        )

        self.local_a = Ministry.objects.create(
            name="Local A Worship",
            code="LOC-A",
            scope="BRANCH",
            branch=self.branch_a,
            primary_coordinator=self.coord_a,
        )
        self.local_b = Ministry.objects.create(
            name="Local B Worship",
            code="LOC-B",
            scope="BRANCH",
            branch=self.branch_b,
        )
        self.national = Ministry.objects.create(
            name="National Youth",
            code="NAT-YTH",
            scope="NATIONAL",
            branch=None,
            primary_coordinator=self.coord_a,
        )

    def _names(self, response):
        data = response.data
        rows = data["results"] if isinstance(data, dict) and "results" in data else data
        return [row["name"] for row in rows]

    def test_member_sees_own_branch_and_national_not_other_branch(self):
        self.client.force_authenticate(user=self.member_a)
        response = self.client.get("/api/ministries/")
        self.assertEqual(response.status_code, 200)
        names = self._names(response)
        self.assertIn("Local A Worship", names)
        self.assertIn("National Youth", names)
        self.assertNotIn("Local B Worship", names)

    def test_branch_pastor_cannot_create_national(self):
        self.client.force_authenticate(user=self.pastor_a)
        response = self.client.post(
            "/api/ministries/",
            {
                "name": "Should Fail National",
                "activity_cadence": "weekly",
                "scope": "NATIONAL",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 400)
        details = response.data.get("details") or response.data
        self.assertIn("scope", details)

    def test_hq_pastor_can_create_national(self):
        self.client.force_authenticate(user=self.hq_pastor)
        response = self.client.post(
            "/api/ministries/",
            {
                "name": "HQ National Choir",
                "activity_cadence": "weekly",
                "scope": "NATIONAL",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data["scope"], "NATIONAL")
        self.assertIsNone(response.data["branch"])

    def test_admin_can_create_national(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.post(
            "/api/ministries/",
            {
                "name": "Admin National",
                "activity_cadence": "weekly",
                "scope": "NATIONAL",
                "branch": self.branch_a.pk,
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data["scope"], "NATIONAL")
        self.assertIsNone(response.data["branch"])

    def test_senior_can_create_national(self):
        self.client.force_authenticate(user=self.senior)
        response = self.client.post(
            "/api/ministries/",
            {
                "name": "Senior National",
                "activity_cadence": "weekly",
                "scope": "NATIONAL",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data["scope"], "NATIONAL")

    def test_branch_pastor_creates_branch_ministry_for_own_branch(self):
        self.client.force_authenticate(user=self.pastor_a)
        response = self.client.post(
            "/api/ministries/",
            {
                "name": "Pastor Local",
                "activity_cadence": "weekly",
                "scope": "BRANCH",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data["scope"], "BRANCH")
        self.assertEqual(response.data["branch"], self.branch_a.pk)

    def test_coord_does_not_see_other_branch_local_even_if_primary(self):
        self.local_b.primary_coordinator = self.coord_a
        self.local_b.save(update_fields=["primary_coordinator"])
        self.client.force_authenticate(user=self.coord_a)
        response = self.client.get("/api/ministries/")
        self.assertEqual(response.status_code, 200)
        names = self._names(response)
        self.assertIn("Local A Worship", names)
        self.assertIn("National Youth", names)
        self.assertNotIn("Local B Worship", names)

    def test_national_create_forbids_keeping_branch(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.post(
            "/api/ministries/",
            {
                "name": "National Clears Branch",
                "activity_cadence": "weekly",
                "scope": "NATIONAL",
                "branch": self.branch_a.pk,
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.data)
        self.assertIsNone(response.data["branch"])

