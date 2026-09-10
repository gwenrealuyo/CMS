from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from apps.clusters.models import Cluster
from apps.evangelism.models import EvangelismGroup
from apps.people.models import Branch, ModuleCoordinator, Person


class PeopleCreateAccessTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.branch = Branch.objects.create(
            name="HQ",
            code="HQ-PCA",
            is_headquarters=True,
            is_active=True,
        )
        cls.cluster = Cluster.objects.create(
            code="PCA1",
            name="Create Access Cluster",
            branch=cls.branch,
        )
        cls.group = EvangelismGroup.objects.create(
            name="Create Access Group",
            cluster=cls.cluster,
        )

    def setUp(self):
        self.client = APIClient()

    def _member(self, username, **kwargs):
        defaults = dict(
            email=f"{username}@test.com",
            password="x",
            first_name="Test",
            last_name=username,
            role="MEMBER",
            branch=self.branch,
            status="ACTIVE",
        )
        defaults.update(kwargs)
        return Person.objects.create_user(username=username, **defaults)

    def _assign(self, person, module, level, resource_id=None, resource_type=""):
        return ModuleCoordinator.objects.create(
            person=person,
            module=module,
            level=level,
            resource_id=resource_id,
            resource_type=resource_type,
        )

    def _post(self, user, role="MEMBER"):
        self.client.force_authenticate(user=user)
        return self.client.post(
            "/api/people/people/",
            {
                "first_name": "New",
                "last_name": role.title(),
                "role": role,
                "branch": self.branch.id,
                "status": "ACTIVE" if role == "MEMBER" else "ONGOING",
            },
            format="json",
        )

    def test_cluster_coordinator_can_create_member(self):
        coord = self._member("pca_cluster_coord")
        self._assign(
            coord,
            ModuleCoordinator.ModuleType.CLUSTER,
            ModuleCoordinator.CoordinatorLevel.COORDINATOR,
            resource_id=self.cluster.id,
            resource_type="Cluster",
        )
        res = self._post(coord, "MEMBER")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED, res.data)
        self.assertEqual(res.data["role"], "MEMBER")

    def test_cluster_fk_coordinator_can_create_member(self):
        coord = self._member("pca_fk_coord")
        Cluster.objects.create(
            code="PCAFK",
            name="FK Coordinator Cluster",
            branch=self.branch,
            coordinator=coord,
        )
        res = self._post(coord, "MEMBER")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED, res.data)

    def test_cluster_senior_coordinator_can_create_member(self):
        senior = self._member("pca_cluster_senior")
        self._assign(
            senior,
            ModuleCoordinator.ModuleType.CLUSTER,
            ModuleCoordinator.CoordinatorLevel.SENIOR_COORDINATOR,
        )
        res = self._post(senior, "MEMBER")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED, res.data)

    def test_cluster_coordinator_plus_teacher_can_create_member(self):
        coord = self._member("pca_dual")
        self._assign(
            coord,
            ModuleCoordinator.ModuleType.CLUSTER,
            ModuleCoordinator.CoordinatorLevel.COORDINATOR,
            resource_id=self.cluster.id,
            resource_type="Cluster",
        )
        self._assign(
            coord,
            ModuleCoordinator.ModuleType.LESSONS,
            ModuleCoordinator.CoordinatorLevel.TEACHER,
        )
        res = self._post(coord, "MEMBER")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED, res.data)

    def test_bible_sharer_can_create_visitor_not_member(self):
        sharer = self._member("pca_sharer")
        self._assign(
            sharer,
            ModuleCoordinator.ModuleType.EVANGELISM,
            ModuleCoordinator.CoordinatorLevel.BIBLE_SHARER,
            resource_id=self.group.id,
            resource_type="EvangelismGroup",
        )
        visitor_res = self._post(sharer, "VISITOR")
        self.assertEqual(visitor_res.status_code, status.HTTP_201_CREATED, visitor_res.data)
        self.assertEqual(visitor_res.data["role"], "VISITOR")
        member_res = self._post(sharer, "MEMBER")
        self.assertEqual(member_res.status_code, status.HTTP_403_FORBIDDEN)

    def test_evangelism_coordinator_can_create_visitor_not_member(self):
        ev_coord = self._member("pca_ev_coord")
        self._assign(
            ev_coord,
            ModuleCoordinator.ModuleType.EVANGELISM,
            ModuleCoordinator.CoordinatorLevel.COORDINATOR,
            resource_id=self.group.id,
            resource_type="EvangelismGroup",
        )
        self.assertEqual(self._post(ev_coord, "VISITOR").status_code, status.HTTP_201_CREATED)
        self.assertEqual(self._post(ev_coord, "MEMBER").status_code, status.HTTP_403_FORBIDDEN)

    def test_evangelism_senior_coordinator_can_create_visitor_not_member(self):
        senior = self._member("pca_ev_senior")
        self._assign(
            senior,
            ModuleCoordinator.ModuleType.EVANGELISM,
            ModuleCoordinator.CoordinatorLevel.SENIOR_COORDINATOR,
        )
        self.assertEqual(self._post(senior, "VISITOR").status_code, status.HTTP_201_CREATED)
        self.assertEqual(self._post(senior, "MEMBER").status_code, status.HTTP_403_FORBIDDEN)

    def test_lessons_teacher_cannot_create(self):
        teacher = self._member("pca_lessons_teacher")
        self._assign(
            teacher,
            ModuleCoordinator.ModuleType.LESSONS,
            ModuleCoordinator.CoordinatorLevel.TEACHER,
        )
        self.assertEqual(self._post(teacher, "VISITOR").status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(self._post(teacher, "MEMBER").status_code, status.HTTP_403_FORBIDDEN)

    def test_sunday_school_teacher_cannot_create(self):
        teacher = self._member("pca_ss_teacher")
        self._assign(
            teacher,
            ModuleCoordinator.ModuleType.SUNDAY_SCHOOL,
            ModuleCoordinator.CoordinatorLevel.TEACHER,
            resource_id=1,
            resource_type="SundaySchoolClass",
        )
        self.assertEqual(self._post(teacher, "VISITOR").status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(self._post(teacher, "MEMBER").status_code, status.HTTP_403_FORBIDDEN)

    def test_plain_member_cannot_create(self):
        member = self._member("pca_plain")
        self.assertEqual(self._post(member, "VISITOR").status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(self._post(member, "MEMBER").status_code, status.HTTP_403_FORBIDDEN)

    def test_evangelism_reporter_cannot_create(self):
        reporter = self._member("pca_ev_reporter")
        self._assign(
            reporter,
            ModuleCoordinator.ModuleType.EVANGELISM,
            ModuleCoordinator.CoordinatorLevel.REPORTER,
            resource_id=self.group.id,
            resource_type="EvangelismGroup",
        )
        self.assertEqual(self._post(reporter, "VISITOR").status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(self._post(reporter, "MEMBER").status_code, status.HTTP_403_FORBIDDEN)

    def test_lessons_senior_coordinator_cannot_create(self):
        senior = self._member("pca_lessons_senior")
        self._assign(
            senior,
            ModuleCoordinator.ModuleType.LESSONS,
            ModuleCoordinator.CoordinatorLevel.SENIOR_COORDINATOR,
        )
        self.assertEqual(self._post(senior, "VISITOR").status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(self._post(senior, "MEMBER").status_code, status.HTTP_403_FORBIDDEN)
