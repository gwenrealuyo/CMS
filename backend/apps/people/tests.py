from django.test import TestCase
from django.contrib.auth import get_user_model
from datetime import date
from django.utils import timezone
from rest_framework.test import APIRequestFactory
from rest_framework.test import APIClient
from rest_framework import status
from .models import Branch, Person, Journey, Family, ModuleCoordinator

User = get_user_model()


class BranchModelTest(TestCase):
    """Test Branch model functionality"""

    def setUp(self):
        self.branch = Branch.objects.create(
            name="Main Branch",
            code="MAIN",
            address="123 Main St",
            phone="123-456-7890",
            email="main@church.com",
            is_headquarters=True,
            is_active=True,
        )
        self.branch2 = Branch.objects.create(
            name="Second Branch",
            code="BRANCH2",
            is_headquarters=False,
            is_active=True,
        )

    def test_branch_creation(self):
        """Test that branch can be created with all fields"""
        self.assertEqual(self.branch.name, "Main Branch")
        self.assertEqual(self.branch.code, "MAIN")
        self.assertTrue(self.branch.is_headquarters)
        self.assertTrue(self.branch.is_active)

    def test_branch_str(self):
        """Test branch string representation"""
        self.assertEqual(str(self.branch), "Main Branch")

    def test_branch_ordering(self):
        """Test that branches are ordered by name"""
        branches = list(Branch.objects.all())
        self.assertEqual(branches[0].name, "Main Branch")
        self.assertEqual(branches[1].name, "Second Branch")


class PersonBranchTest(TestCase):
    """Test Person branch assignment and methods"""

    def setUp(self):
        self.headquarters = Branch.objects.create(
            name="Headquarters",
            code="HQ",
            is_headquarters=True,
        )
        self.regular_branch = Branch.objects.create(
            name="Regular Branch",
            code="REG",
            is_headquarters=False,
        )

        self.admin = Person.objects.create_user(
            username="admin",
            email="admin@test.com",
            password="testpass123",
            first_name="Admin",
            last_name="User",
            role="ADMIN",
        )

        self.hq_pastor = Person.objects.create_user(
            username="hqpastor",
            email="hqpastor@test.com",
            password="testpass123",
            first_name="HQ",
            last_name="Pastor",
            role="PASTOR",
            branch=self.headquarters,
        )

        self.regular_pastor = Person.objects.create_user(
            username="regpastor",
            email="regpastor@test.com",
            password="testpass123",
            first_name="Regular",
            last_name="Pastor",
            role="PASTOR",
            branch=self.regular_branch,
        )

        self.member = Person.objects.create_user(
            username="member",
            email="member@test.com",
            password="testpass123",
            first_name="Test",
            last_name="Member",
            role="MEMBER",
            branch=self.regular_branch,
        )

    def test_can_see_all_branches_admin(self):
        """Test that ADMIN can see all branches"""
        self.assertTrue(self.admin.can_see_all_branches())

    def test_can_see_all_branches_hq_pastor(self):
        """Test that PASTOR from headquarters can see all branches"""
        self.assertTrue(self.hq_pastor.can_see_all_branches())

    def test_can_see_all_branches_regular_pastor(self):
        """Test that PASTOR from regular branch cannot see all branches"""
        self.assertFalse(self.regular_pastor.can_see_all_branches())

    def test_can_see_all_branches_member(self):
        """Test that MEMBER cannot see all branches"""
        self.assertFalse(self.member.can_see_all_branches())

    def test_person_branch_assignment(self):
        """Test that person can be assigned to a branch"""
        self.assertEqual(self.member.branch, self.regular_branch)
        self.assertEqual(self.member.branch.name, "Regular Branch")


class BranchTransferTest(TestCase):
    """Test branch transfer tracking via Journey"""

    def setUp(self):
        self.branch1 = Branch.objects.create(name="Branch 1", code="B1")
        self.branch2 = Branch.objects.create(name="Branch 2", code="B2")

        self.person = Person.objects.create_user(
            username="testuser",
            email="test@test.com",
            password="testpass123",
            first_name="Test",
            last_name="User",
            role="MEMBER",
            branch=self.branch1,
        )

    def test_branch_transfer_creates_journey(self):
        """Test that changing branch via serializer creates a Journey entry"""
        from .serializers import PersonSerializer
        from rest_framework.test import APIRequestFactory

        initial_journey_count = Journey.objects.filter(user=self.person).count()

        # Update branch via serializer (which triggers Journey creation)
        factory = APIRequestFactory()
        request = factory.patch("/api/people/{}/".format(self.person.id))
        request.user = Person.objects.create_user(
            username="admin",
            email="admin@test.com",
            password="testpass123",
            first_name="Admin",
            last_name="User",
            role="ADMIN",
        )

        serializer = PersonSerializer(
            self.person,
            data={"branch": self.branch2.id},
            partial=True,
            context={"request": request},
        )
        serializer.is_valid()
        serializer.save()

        # Check that a new journey was created
        journeys = Journey.objects.filter(user=self.person, type="BRANCH_TRANSFER")
        self.assertEqual(journeys.count(), initial_journey_count + 1)

        # Check the journey details
        transfer_journey = journeys.first()
        self.assertIsNotNone(transfer_journey)
        self.assertEqual(transfer_journey.type, "BRANCH_TRANSFER")
        self.assertEqual(transfer_journey.title, "Branch Transfer")
        self.assertIn("Branch 1", transfer_journey.description)
        self.assertIn("Branch 2", transfer_journey.description)
        self.assertIsNone(transfer_journey.verified_by)


class FirstAttendedJourneySyncTest(TestCase):
    """Regression tests for first-attended journey synchronization."""

    def setUp(self):
        from .serializers import PersonSerializer

        self.PersonSerializer = PersonSerializer
        self.factory = APIRequestFactory()
        self.admin = Person.objects.create_user(
            username="admin_journey",
            email="admin_journey@test.com",
            password="testpass123",
            first_name="Admin",
            last_name="Journey",
            role="ADMIN",
        )

    def _request(self):
        request = self.factory.patch("/api/people/people/")
        request.user = self.admin
        return request

    def _partial_update(self, person, payload):
        serializer = self.PersonSerializer(
            person,
            data=payload,
            partial=True,
            context={"request": self._request()},
        )
        self.assertTrue(serializer.is_valid(), serializer.errors)
        return serializer.save()

    def test_editing_activity_updates_same_first_attended_journey(self):
        person = Person.objects.create_user(
            username="activity_sync",
            email="activity_sync@test.com",
            password="testpass123",
            first_name="Activity",
            last_name="Sync",
            role="MEMBER",
            date_first_attended=date(2026, 1, 5),
        )

        original_journey = Journey.objects.get(
            user=person, type="EVENT_ATTENDANCE", title="First Attended"
        )
        self.assertEqual(original_journey.description, "First attendance")

        self._partial_update(person, {"first_activity_attended": "SUNDAY_SERVICE"})
        updated_journey = Journey.objects.get(id=original_journey.id)
        self.assertEqual(updated_journey.description, "First attendance: Sunday Service")
        self.assertEqual(
            Journey.objects.filter(
                user=person, type="EVENT_ATTENDANCE", title="First Attended"
            ).count(),
            1,
        )

        self._partial_update(person, {"first_activity_attended": "DOCTRINAL_CLASS"})
        updated_again = Journey.objects.get(id=original_journey.id)
        self.assertEqual(updated_again.description, "First attendance: Doctrinal Class")
        self.assertEqual(
            Journey.objects.filter(
                user=person, type="EVENT_ATTENDANCE", title="First Attended"
            ).count(),
            1,
        )

    def test_clearing_first_attended_date_deletes_first_attended_journey(self):
        person = Person.objects.create_user(
            username="clear_first_attended",
            email="clear_first_attended@test.com",
            password="testpass123",
            first_name="Clear",
            last_name="Journey",
            role="MEMBER",
            date_first_attended=date(2026, 2, 2),
            first_activity_attended="CLUSTERING",
        )
        self.assertTrue(
            Journey.objects.filter(
                user=person, type="EVENT_ATTENDANCE", title="First Attended"
            ).exists()
        )

        self._partial_update(person, {"date_first_attended": None})
        self.assertFalse(
            Journey.objects.filter(
                user=person, type="EVENT_ATTENDANCE", title="First Attended"
            ).exists()
        )

    def test_updating_first_activity_does_not_modify_visitor_note(self):
        serializer = self.PersonSerializer(
            data={
                "first_name": "Visitor",
                "last_name": "Note",
                "role": "VISITOR",
                "status": "INVITED",
                "date_first_attended": date(2026, 3, 3),
                "note": "Initial visitor note",
            },
            context={"request": self._request()},
        )
        self.assertTrue(serializer.is_valid(), serializer.errors)
        person = serializer.save()

        visitor_note = Journey.objects.get(user=person, type="NOTE", title="Visitor note")
        self.assertEqual(visitor_note.description, "Initial visitor note")

        self._partial_update(person, {"first_activity_attended": "PRAYER_MEETING"})

        visitor_note.refresh_from_db()
        self.assertEqual(visitor_note.description, "Initial visitor note")
        first_attended = Journey.objects.get(
            user=person, type="EVENT_ATTENDANCE", title="First Attended"
        )
        self.assertEqual(first_attended.description, "First attendance: Prayer Meeting")


class InvitedJourneySyncTest(TestCase):
    """Regression tests for invited journey lifecycle behavior."""

    def setUp(self):
        from .serializers import PersonSerializer

        self.PersonSerializer = PersonSerializer
        self.factory = APIRequestFactory()
        self.admin = Person.objects.create_user(
            username="admin_invited",
            email="admin_invited@test.com",
            password="testpass123",
            first_name="Admin",
            last_name="Invited",
            role="ADMIN",
        )
        self.inviter1 = Person.objects.create_user(
            username="inviter_one",
            email="inviter_one@test.com",
            password="testpass123",
            first_name="Inviter",
            last_name="One",
            role="MEMBER",
            status="ACTIVE",
        )
        self.inviter2 = Person.objects.create_user(
            username="inviter_two",
            email="inviter_two@test.com",
            password="testpass123",
            first_name="Inviter",
            last_name="Two",
            role="MEMBER",
            status="ACTIVE",
        )

    def _request(self):
        request = self.factory.patch("/api/people/people/")
        request.user = self.admin
        return request

    def _partial_update(self, person, payload):
        serializer = self.PersonSerializer(
            person,
            data=payload,
            partial=True,
            context={"request": self._request()},
        )
        self.assertTrue(serializer.is_valid(), serializer.errors)
        return serializer.save()

    def test_create_visitor_invited_creates_invited_journey(self):
        invited_date = date(2026, 4, 20)
        serializer = self.PersonSerializer(
            data={
                "first_name": "Visitor",
                "last_name": "Invited",
                "role": "VISITOR",
                "status": "INVITED",
                "inviter": self.inviter1.id,
                "date_first_invited": invited_date,
            },
            context={"request": self._request()},
        )
        self.assertTrue(serializer.is_valid(), serializer.errors)
        person = serializer.save()

        invited_journey = Journey.objects.get(user=person, type="NOTE", title="Invited")
        self.assertEqual(invited_journey.description, "Invited by Inviter One.")
        self.assertEqual(invited_journey.date, invited_date)

    def test_inviter_update_updates_same_journey_for_invited_visitor(self):
        invited_date = date(2026, 4, 21)
        person = Person.objects.create_user(
            username="visitor_invited",
            email="visitor_invited@test.com",
            password="testpass123",
            first_name="Visitor",
            last_name="Person",
            role="VISITOR",
            status="INVITED",
            inviter=self.inviter1,
            date_first_invited=invited_date,
        )
        original_journey = Journey.objects.get(user=person, type="NOTE", title="Invited")
        self.assertEqual(original_journey.description, "Invited by Inviter One.")
        self.assertEqual(original_journey.date, invited_date)

        self._partial_update(person, {"inviter": self.inviter2.id})

        updated_journey = Journey.objects.get(id=original_journey.id)
        self.assertEqual(updated_journey.description, "Invited by Inviter Two.")
        self.assertEqual(updated_journey.date, invited_date)
        self.assertEqual(
            Journey.objects.filter(user=person, type="NOTE", title="Invited").count(),
            1,
        )

    def test_updating_date_first_invited_updates_existing_journey_date(self):
        person = Person.objects.create_user(
            username="visitor_date_update",
            email="visitor_date_update@test.com",
            password="testpass123",
            first_name="Visitor",
            last_name="DateUpdate",
            role="VISITOR",
            status="INVITED",
            inviter=self.inviter1,
            date_first_invited=date(2026, 4, 10),
        )
        invited_journey = Journey.objects.get(user=person, type="NOTE", title="Invited")
        self.assertEqual(invited_journey.date, date(2026, 4, 10))

        self._partial_update(person, {"date_first_invited": date(2026, 4, 15)})

        invited_journey.refresh_from_db()
        self.assertEqual(invited_journey.date, date(2026, 4, 15))
        self.assertEqual(
            Journey.objects.filter(user=person, type="NOTE", title="Invited").count(),
            1,
        )

    def test_inviter_update_on_non_visitor_still_updates_existing_invited_journey(self):
        invited_date = date(2026, 4, 8)
        person = Person.objects.create_user(
            username="visitor_for_transition",
            email="visitor_for_transition@test.com",
            password="testpass123",
            first_name="Visitor",
            last_name="Transition",
            role="VISITOR",
            status="INVITED",
            inviter=self.inviter1,
            date_first_invited=invited_date,
        )
        invited_journey = Journey.objects.get(user=person, type="NOTE", title="Invited")

        # Move away from visitor/invited and still expect inviter sync updates on existing journey.
        self._partial_update(person, {"role": "MEMBER", "status": "ACTIVE"})
        self._partial_update(person, {"inviter": self.inviter2.id})

        invited_journey.refresh_from_db()
        self.assertEqual(invited_journey.description, "Invited by Inviter Two.")
        self.assertEqual(invited_journey.date, invited_date)
        self.assertEqual(
            Journey.objects.filter(user=person, type="NOTE", title="Invited").count(),
            1,
        )

    def test_status_change_away_from_invited_keeps_invited_journey_history(self):
        person = Person.objects.create_user(
            username="visitor_history",
            email="visitor_history@test.com",
            password="testpass123",
            first_name="Visitor",
            last_name="History",
            role="VISITOR",
            status="INVITED",
            inviter=self.inviter1,
        )
        invited_journey = Journey.objects.get(user=person, type="NOTE", title="Invited")

        self._partial_update(person, {"status": "ATTENDED"})

        invited_journey.refresh_from_db()
        self.assertEqual(invited_journey.title, "Invited")
        self.assertEqual(invited_journey.description, "Invited by Inviter One.")

    def test_invited_journey_uses_today_when_date_first_invited_not_set(self):
        person = Person.objects.create_user(
            username="visitor_no_invited_date",
            email="visitor_no_invited_date@test.com",
            password="testpass123",
            first_name="Visitor",
            last_name="NoDate",
            role="VISITOR",
            status="INVITED",
            inviter=self.inviter1,
        )
        invited_journey = Journey.objects.get(user=person, type="NOTE", title="Invited")
        self.assertEqual(invited_journey.date, timezone.now().date())

    def test_model_save_path_updates_inviter_on_existing_invited_journey(self):
        invited_date = date(2026, 4, 22)
        person = Person.objects.create_user(
            username="visitor_model_save",
            email="visitor_model_save@test.com",
            password="testpass123",
            first_name="Visitor",
            last_name="ModelSave",
            role="VISITOR",
            status="INVITED",
            inviter=self.inviter1,
            date_first_invited=invited_date,
        )
        invited_journey = Journey.objects.get(user=person, type="NOTE", title="Invited")

        person.inviter = self.inviter2
        person.save(update_fields=["inviter"])

        invited_journey.refresh_from_db()
        self.assertEqual(invited_journey.description, "Invited by Inviter Two.")
        self.assertEqual(invited_journey.date, invited_date)
        self.assertEqual(
            Journey.objects.filter(user=person, type="NOTE", title="Invited").count(),
            1,
        )


class FamilyJourneyTest(TestCase):
    """Test family journey creation in serializer hooks"""

    def setUp(self):
        self.factory = APIRequestFactory()
        self.admin = Person.objects.create_user(
            username="admin",
            email="admin@test.com",
            password="testpass123",
            first_name="Admin",
            last_name="User",
            role="ADMIN",
        )
        self.leader = Person.objects.create_user(
            username="leader",
            email="leader@test.com",
            password="testpass123",
            first_name="Leader",
            last_name="Person",
            role="MEMBER",
        )
        self.member1 = Person.objects.create_user(
            username="member1",
            email="member1@test.com",
            password="testpass123",
            first_name="Member",
            last_name="One",
            role="MEMBER",
        )
        self.member2 = Person.objects.create_user(
            username="member2",
            email="member2@test.com",
            password="testpass123",
            first_name="Member",
            last_name="Two",
            role="MEMBER",
        )

    def _build_request(self):
        request = self.factory.post("/api/people/families/")
        request.user = self.admin
        return request

    def test_family_create_creates_journeys_for_members_and_leader(self):
        from .serializers import FamilySerializer

        serializer = FamilySerializer(
            data={
                "name": "Test Family",
                "leader": self.leader.id,
                "members": [self.member1.id, self.member2.id],
                "address": "123 Main St",
            },
            context={"request": self._build_request()},
        )
        self.assertTrue(serializer.is_valid(), serializer.errors)
        family = serializer.save()

        self.assertEqual(family.members.count(), 2)
        self.assertEqual(
            Journey.objects.filter(user=self.leader, type="NOTE").count(), 1
        )
        self.assertEqual(
            Journey.objects.filter(user=self.member1, type="NOTE").count(), 1
        )
        self.assertEqual(
            Journey.objects.filter(user=self.member2, type="NOTE").count(), 1
        )
        journey = Journey.objects.filter(user=self.member1).first()
        self.assertEqual(journey.title, "Family created: Test Family")
        self.assertIn("Leader: Leader Person", journey.description)

    def test_family_member_added_creates_journey_for_new_member(self):
        from .serializers import FamilySerializer

        family = Family.objects.create(
            name="Test Family",
            leader=self.leader,
            address="123 Main St",
        )
        family.members.set([self.member1])

        serializer = FamilySerializer(
            family,
            data={"members": [self.member1.id, self.member2.id]},
            partial=True,
            context={"request": self._build_request()},
        )
        self.assertTrue(serializer.is_valid(), serializer.errors)
        serializer.save()

        self.assertEqual(
            Journey.objects.filter(user=self.member1, type="NOTE").count(), 0
        )
        self.assertEqual(
            Journey.objects.filter(user=self.member2, type="NOTE").count(), 1
        )
        journey = Journey.objects.filter(user=self.member2).first()
        self.assertEqual(journey.title, "Added to family: Test Family")
        self.assertIn("Leader Person", journey.description)

    def test_family_address_update_creates_journeys_for_members(self):
        from .serializers import FamilySerializer

        family = Family.objects.create(
            name="Test Family",
            leader=None,
            address="Old Address",
        )
        family.members.set([self.member1, self.member2])

        serializer = FamilySerializer(
            family,
            data={"address": "New Address"},
            partial=True,
            context={"request": self._build_request()},
        )
        self.assertTrue(serializer.is_valid(), serializer.errors)
        serializer.save()

        self.assertEqual(
            Journey.objects.filter(user=self.member1, type="NOTE").count(), 1
        )
        self.assertEqual(
            Journey.objects.filter(user=self.member2, type="NOTE").count(), 1
        )
        journey = Journey.objects.filter(user=self.member1).first()
        self.assertEqual(journey.title, "Family address updated: Test Family")
        self.assertIn("Old Address", journey.description)
        self.assertIn("New Address", journey.description)


class BranchAPITest(TestCase):
    """Test Branch API endpoints"""

    def setUp(self):
        self.client = APIClient()
        self.admin = Person.objects.create_user(
            username="admin",
            email="admin@test.com",
            password="testpass123",
            first_name="Admin",
            last_name="User",
            role="ADMIN",
        )
        self.member = Person.objects.create_user(
            username="member",
            email="member@test.com",
            password="testpass123",
            first_name="Test",
            last_name="Member",
            role="MEMBER",
        )

    def test_list_branches_authenticated(self):
        """Test that authenticated users can list branches"""
        self.client.force_authenticate(user=self.member)
        response = self.client.get("/api/people/branches/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_create_branch_admin_only(self):
        """Test that only ADMIN can create branches"""
        # Try as member (should fail)
        self.client.force_authenticate(user=self.member)
        response = self.client.post(
            "/api/people/branches/",
            {
                "name": "New Branch",
                "code": "NEW",
                "is_headquarters": False,
            },
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        # Try as admin (should succeed)
        self.client.force_authenticate(user=self.admin)
        response = self.client.post(
            "/api/people/branches/",
            {
                "name": "New Branch",
                "code": "NEW",
                "is_headquarters": False,
            },
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["name"], "New Branch")

    def test_update_person_branch_creates_journey(self):
        """Test that updating person branch via API creates Journey"""
        branch1 = Branch.objects.create(name="Branch 1", code="B1")
        branch2 = Branch.objects.create(name="Branch 2", code="B2")

        person = Person.objects.create_user(
            username="testuser",
            email="test@test.com",
            password="testpass123",
            first_name="Test",
            last_name="User",
            role="MEMBER",
            branch=branch1,
        )

        self.client.force_authenticate(user=self.admin)
        initial_journey_count = Journey.objects.filter(
            user=person, type="BRANCH_TRANSFER"
        ).count()

        # Update branch via API
        response = self.client.patch(
            "/api/people/people/{}/".format(person.id),
            {"branch": branch2.id},
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
            f"Expected 200, got {response.status_code}. Response: {getattr(response, 'data', 'No data')}",
        )

        # Check that journey was created
        journeys = Journey.objects.filter(user=person, type="BRANCH_TRANSFER")
        self.assertEqual(journeys.count(), initial_journey_count + 1)


class BranchFilteringTest(TestCase):
    """Test branch-based filtering in views"""

    def setUp(self):
        self.headquarters = Branch.objects.create(
            name="Headquarters",
            code="HQ",
            is_headquarters=True,
        )
        self.branch1 = Branch.objects.create(name="Branch 1", code="B1")
        self.branch2 = Branch.objects.create(name="Branch 2", code="B2")

        # Create pastors
        self.hq_pastor = Person.objects.create_user(
            username="hqpastor",
            email="hqpastor@test.com",
            password="testpass123",
            first_name="HQ",
            last_name="Pastor",
            role="PASTOR",
            branch=self.headquarters,
        )

        self.regular_pastor = Person.objects.create_user(
            username="regpastor",
            email="regpastor@test.com",
            password="testpass123",
            first_name="Regular",
            last_name="Pastor",
            role="PASTOR",
            branch=self.branch1,
        )

        # Create members in different branches
        self.member1 = Person.objects.create_user(
            username="member1",
            email="member1@test.com",
            password="testpass123",
            first_name="Member",
            last_name="One",
            role="MEMBER",
            branch=self.branch1,
        )

        self.member2 = Person.objects.create_user(
            username="member2",
            email="member2@test.com",
            password="testpass123",
            first_name="Member",
            last_name="Two",
            role="MEMBER",
            branch=self.branch2,
        )

        self.client = APIClient()

    def test_hq_pastor_sees_all_people(self):
        """Test that HQ pastor sees people from all branches"""
        self.client.force_authenticate(user=self.hq_pastor)
        response = self.client.get("/api/people/people/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Extract usernames from response - handle pagination
        data = response.data
        if isinstance(data, dict) and "results" in data:
            # Paginated response
            usernames = [p["username"] for p in data["results"]]
        elif isinstance(data, list):
            usernames = [p["username"] for p in data]
        else:
            usernames = []

        # HQ pastor should see members from all branches (excluding ADMINs)
        # They should see both pastors and members
        # Note: HQ pastor sees all non-ADMIN people regardless of branch
        self.assertIn("member1", usernames, f"member1 not found in {usernames}")
        self.assertIn("member2", usernames, f"member2 not found in {usernames}")

    def test_regular_pastor_sees_only_own_branch(self):
        """Test that regular pastor only sees people from their branch"""
        self.client.force_authenticate(user=self.regular_pastor)
        response = self.client.get("/api/people/people/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Extract usernames from response - handle pagination
        data = response.data
        if isinstance(data, dict) and "results" in data:
            # Paginated response
            usernames = [p["username"] for p in data["results"]]
        elif isinstance(data, list):
            usernames = [p["username"] for p in data]
        else:
            usernames = []

        # Should only see member1 (same branch), not member2
        # Regular pastor should see themselves and member1, but not member2
        self.assertIn("member1", usernames, f"member1 not found in {usernames}")
        self.assertNotIn("member2", usernames, f"member2 should not be in {usernames}")


class PersonBranchRequiredApiTest(TestCase):
    """Person create requires branch at serializer/API layer."""

    def setUp(self):
        Branch.objects.create(
            name="Api Branch",
            code="API_BR",
            is_active=True,
        )
        self.admin = Person.objects.create_user(
            username="branch_admin",
            email="branch_admin@test.com",
            password="testpass123",
            first_name="Branch",
            last_name="Admin",
            role="ADMIN",
        )
        self.client = APIClient()

    def test_create_without_branch_returns_400(self):
        self.client.force_authenticate(user=self.admin)
        payload = {
            "first_name": "Jane",
            "last_name": "Doe",
            "role": "MEMBER",
            "status": "ACTIVE",
        }
        response = self.client.post("/api/people/people/", payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("branch", response.data)


class ClusterCoordinatorCrossBranchPeopleVisibilityTest(TestCase):
    """Cluster coordinators see cluster members whose branch differs from theirs."""

    def setUp(self):
        from apps.clusters.models import Cluster

        self.branch_a = Branch.objects.create(
            name="Branch A",
            code="COORD_A",
            is_active=True,
        )
        self.branch_b = Branch.objects.create(
            name="Branch B",
            code="COORD_B",
            is_active=True,
        )

        self.coord = Person.objects.create_user(
            username="cluster_coord",
            email="cluster_coord@test.com",
            password="testpass123",
            first_name="Coord",
            last_name="Inator",
            role="COORDINATOR",
            branch=self.branch_a,
        )

        self.cross_member = Person.objects.create_user(
            username="cross_member",
            email="cross_member@test.com",
            password="testpass123",
            first_name="Cross",
            last_name="Member",
            role="MEMBER",
            branch=self.branch_b,
        )

        self.cluster = Cluster.objects.create(
            code="VIS_TEST_CLUST",
            name="Visibility Test Cluster",
            coordinator=self.coord,
        )
        self.cluster.members.add(self.cross_member)

        ModuleCoordinator.objects.create(
            person=self.coord,
            module=ModuleCoordinator.ModuleType.CLUSTER,
            level=ModuleCoordinator.CoordinatorLevel.COORDINATOR,
            resource_id=self.cluster.id,
            resource_type="Cluster",
        )

        self.client = APIClient()

    def test_coord_sees_cross_branch_cluster_member(self):
        self.client.force_authenticate(user=self.coord)
        response = self.client.get("/api/people/people/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        data = response.data
        if isinstance(data, dict) and "results" in data:
            usernames = [p["username"] for p in data["results"]]
        elif isinstance(data, list):
            usernames = [p["username"] for p in data]
        else:
            usernames = []

        self.assertIn(
            "cross_member",
            usernames,
            "Cross-branch cluster member should appear for cluster coordinator",
        )
