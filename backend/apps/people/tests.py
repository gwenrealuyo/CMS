from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIRequestFactory
from rest_framework.test import APIClient
from rest_framework import status
from .models import Branch, Person, Journey, Family

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
