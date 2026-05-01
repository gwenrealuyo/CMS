"""Tests for multi-resource (non-senior) module coordinators."""

from datetime import date

from django.test import RequestFactory, TestCase
from rest_framework.test import APIClient
from rest_framework.views import APIView

from apps.authentication.permissions import HasModuleAccess
from apps.clusters.models import Cluster
from apps.clusters.permissions import managed_cluster_ids_for_coordinator
from apps.evangelism.models import EvangelismGroup
from apps.people.coordinator_scope import coordinator_assigned_resource_ids_when_all_scoped
from apps.people.models import Journey, ModuleCoordinator, Person
from apps.people.serializers import PersonSerializer
from apps.sunday_school.models import SundaySchoolCategory, SundaySchoolClass


class CoordinatorScopeHelpersTests(TestCase):
    def test_coordinator_assigned_resource_ids_none_when_module_wide_row(self):
        user = Person.objects.create_user(
            username="mc_wide",
            password="x",
            role="COORDINATOR",
            status="ACTIVE",
        )
        ModuleCoordinator.objects.create(
            person=user,
            module=ModuleCoordinator.ModuleType.EVANGELISM,
            level=ModuleCoordinator.CoordinatorLevel.COORDINATOR,
            resource_id=None,
            resource_type="",
        )
        ModuleCoordinator.objects.create(
            person=user,
            module=ModuleCoordinator.ModuleType.EVANGELISM,
            level=ModuleCoordinator.CoordinatorLevel.COORDINATOR,
            resource_id=99,
            resource_type="EvangelismGroup",
        )
        result = coordinator_assigned_resource_ids_when_all_scoped(
            user,
            ModuleCoordinator.ModuleType.EVANGELISM,
            ModuleCoordinator.CoordinatorLevel.COORDINATOR,
        )
        self.assertIsNone(result)

    def test_coordinator_assigned_resource_ids_union_when_all_scoped(self):
        user = Person.objects.create_user(
            username="mc_scoped",
            password="x",
            role="COORDINATOR",
            status="ACTIVE",
        )
        ModuleCoordinator.objects.create(
            person=user,
            module=ModuleCoordinator.ModuleType.EVANGELISM,
            level=ModuleCoordinator.CoordinatorLevel.COORDINATOR,
            resource_id=10,
            resource_type="EvangelismGroup",
        )
        ModuleCoordinator.objects.create(
            person=user,
            module=ModuleCoordinator.ModuleType.EVANGELISM,
            level=ModuleCoordinator.CoordinatorLevel.COORDINATOR,
            resource_id=20,
            resource_type="EvangelismGroup",
        )
        result = coordinator_assigned_resource_ids_when_all_scoped(
            user,
            ModuleCoordinator.ModuleType.EVANGELISM,
            ModuleCoordinator.CoordinatorLevel.COORDINATOR,
        )
        self.assertCountEqual(result, [10, 20])


class ManagedClusterIdsTests(TestCase):
    def setUp(self):
        self.coord = Person.objects.create_user(
            username="cl_mc",
            password="x",
            role="COORDINATOR",
            status="ACTIVE",
        )
        self.member = Person.objects.create_user(
            username="cl_mem",
            password="x",
            role="MEMBER",
            status="ACTIVE",
        )
        self.cluster_a = Cluster.objects.create(
            code="MCA",
            name="A",
            coordinator=self.coord,
        )
        self.cluster_b = Cluster.objects.create(code="MCB", name="B")
        ModuleCoordinator.objects.create(
            person=self.coord,
            module=ModuleCoordinator.ModuleType.CLUSTER,
            level=ModuleCoordinator.CoordinatorLevel.COORDINATOR,
            resource_id=self.cluster_b.id,
            resource_type="Cluster",
        )

    def test_managed_cluster_ids_union_fk_and_module_coordinator(self):
        ids = managed_cluster_ids_for_coordinator(self.coord)
        self.assertCountEqual(ids, [self.cluster_a.id, self.cluster_b.id])


class JourneyTimelineModuleCoordinatorTests(TestCase):
    def setUp(self):
        self.coord = Person.objects.create_user(
            username="jt_mc",
            password="x",
            role="COORDINATOR",
            status="ACTIVE",
        )
        self.member = Person.objects.create_user(
            username="jt_mem",
            password="x",
            role="MEMBER",
            status="ACTIVE",
        )
        self.cluster = Cluster.objects.create(code="JT", name="JT")
        self.cluster.members.add(self.member)
        ModuleCoordinator.objects.create(
            person=self.coord,
            module=ModuleCoordinator.ModuleType.CLUSTER,
            level=ModuleCoordinator.CoordinatorLevel.COORDINATOR,
            resource_id=self.cluster.id,
            resource_type="Cluster",
        )

    def test_can_view_journey_timeline_scoped_cluster_without_fk(self):
        factory = RequestFactory()
        request = factory.get("/people/")
        request.user = self.coord
        ser = PersonSerializer(
            self.member,
            context={"request": request},
        )
        self.assertTrue(ser.data["can_view_journey_timeline"])


class HasModuleAccessMultiAssignmentTests(TestCase):
    def test_write_allowed_if_any_assignment_qualifies(self):
        user = Person.objects.create_user(
            username="hma_multi",
            password="x",
            role="COORDINATOR",
            status="ACTIVE",
        )
        ModuleCoordinator.objects.create(
            person=user,
            module=ModuleCoordinator.ModuleType.CLUSTER,
            level=ModuleCoordinator.CoordinatorLevel.TEACHER,
            resource_id=1,
            resource_type="Cluster",
        )
        ModuleCoordinator.objects.create(
            person=user,
            module=ModuleCoordinator.ModuleType.CLUSTER,
            level=ModuleCoordinator.CoordinatorLevel.COORDINATOR,
            resource_id=2,
            resource_type="Cluster",
        )

        class _View(APIView):
            action = "partial_update"

        factory = RequestFactory()
        request = factory.patch("/fake/")
        request.user = user
        perm = HasModuleAccess(ModuleCoordinator.ModuleType.CLUSTER, "write")
        self.assertTrue(perm.has_permission(request, _View()))


class JourneyListMultiClusterCoordinatorTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.coord = Person.objects.create_user(
            username="jl_mc",
            password="x",
            role="COORDINATOR",
            status="ACTIVE",
        )
        self.m1 = Person.objects.create_user(
            username="jl_m1",
            password="x",
            role="MEMBER",
            status="ACTIVE",
        )
        self.m2 = Person.objects.create_user(
            username="jl_m2",
            password="x",
            role="MEMBER",
            status="ACTIVE",
        )
        self.c1 = Cluster.objects.create(code="J1", name="J1")
        self.c2 = Cluster.objects.create(code="J2", name="J2")
        self.c1.members.add(self.m1)
        self.c2.members.add(self.m2)
        ModuleCoordinator.objects.create(
            person=self.coord,
            module=ModuleCoordinator.ModuleType.CLUSTER,
            level=ModuleCoordinator.CoordinatorLevel.COORDINATOR,
            resource_id=self.c1.id,
            resource_type="Cluster",
        )
        ModuleCoordinator.objects.create(
            person=self.coord,
            module=ModuleCoordinator.ModuleType.CLUSTER,
            level=ModuleCoordinator.CoordinatorLevel.COORDINATOR,
            resource_id=self.c2.id,
            resource_type="Cluster",
        )
        Journey.objects.create(
            user=self.m1,
            title="j1",
            date=date(2025, 1, 1),
            type="NOTE",
        )
        Journey.objects.create(
            user=self.m2,
            title="j2",
            date=date(2025, 1, 2),
            type="NOTE",
        )

    def test_journey_list_includes_members_from_all_managed_clusters(self):
        self.client.force_authenticate(user=self.coord)
        r = self.client.get("/api/people/journeys/")
        self.assertEqual(r.status_code, 200)
        payload = r.data.get("results", r.data)
        titles = {row.get("title") for row in payload}
        self.assertIn("j1", titles)
        self.assertIn("j2", titles)


class EvangelismCoordinatorScopedListTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.coord = Person.objects.create_user(
            username="eg_scope",
            password="x",
            role="COORDINATOR",
            status="ACTIVE",
        )
        self.other = Person.objects.create_user(
            username="eg_other",
            password="x",
            role="MEMBER",
            status="ACTIVE",
        )
        self.cluster = Cluster.objects.create(
            code="EG",
            name="EG",
            coordinator=self.other,
        )
        self.g1 = EvangelismGroup.objects.create(
            name="G1",
            cluster=self.cluster,
            coordinator=self.other,
            is_active=True,
        )
        self.g2 = EvangelismGroup.objects.create(
            name="G2",
            cluster=self.cluster,
            coordinator=self.other,
            is_active=True,
        )
        self.g3 = EvangelismGroup.objects.create(
            name="G3",
            cluster=self.cluster,
            coordinator=self.other,
            is_active=True,
        )
        ModuleCoordinator.objects.create(
            person=self.coord,
            module=ModuleCoordinator.ModuleType.EVANGELISM,
            level=ModuleCoordinator.CoordinatorLevel.COORDINATOR,
            resource_id=self.g1.id,
            resource_type="EvangelismGroup",
        )
        ModuleCoordinator.objects.create(
            person=self.coord,
            module=ModuleCoordinator.ModuleType.EVANGELISM,
            level=ModuleCoordinator.CoordinatorLevel.COORDINATOR,
            resource_id=self.g2.id,
            resource_type="EvangelismGroup",
        )

    def test_list_returns_only_assigned_groups_when_all_scoped(self):
        self.client.force_authenticate(user=self.coord)
        r = self.client.get("/api/evangelism/groups/")
        self.assertEqual(r.status_code, 200)
        payload = r.data.get("results", r.data)
        ids = {row["id"] for row in payload}
        self.assertEqual(ids, {self.g1.id, self.g2.id})


class SundaySchoolCoordinatorScopedListTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.coord = Person.objects.create_user(
            username="ss_scope",
            password="x",
            role="COORDINATOR",
            status="ACTIVE",
        )
        self.cat = SundaySchoolCategory.objects.create(name="Cat", order=1)
        self.c1 = SundaySchoolClass.objects.create(
            name="C1",
            category=self.cat,
        )
        self.c2 = SundaySchoolClass.objects.create(
            name="C2",
            category=self.cat,
        )
        SundaySchoolClass.objects.create(
            name="C3",
            category=self.cat,
        )
        ModuleCoordinator.objects.create(
            person=self.coord,
            module=ModuleCoordinator.ModuleType.SUNDAY_SCHOOL,
            level=ModuleCoordinator.CoordinatorLevel.COORDINATOR,
            resource_id=self.c1.id,
            resource_type="SundaySchoolClass",
        )
        ModuleCoordinator.objects.create(
            person=self.coord,
            module=ModuleCoordinator.ModuleType.SUNDAY_SCHOOL,
            level=ModuleCoordinator.CoordinatorLevel.COORDINATOR,
            resource_id=self.c2.id,
            resource_type="SundaySchoolClass",
        )

    def test_list_returns_only_assigned_classes_when_all_scoped(self):
        self.client.force_authenticate(user=self.coord)
        r = self.client.get("/api/sunday-school/classes/")
        self.assertEqual(r.status_code, 200)
        payload = r.data.get("results", r.data)
        ids = {row["id"] for row in payload}
        self.assertEqual(ids, {self.c1.id, self.c2.id})
