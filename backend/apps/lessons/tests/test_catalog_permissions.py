from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from apps.lessons.models import Lesson, LessonSessionReport
from apps.people.models import Branch, ModuleCoordinator, ModuleSetting, Person


class LessonCatalogPermissionTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        ModuleSetting.objects.update_or_create(
            module=ModuleCoordinator.ModuleType.LESSONS,
            defaults={"is_enabled": True},
        )
        self.hq = Branch.objects.create(
            name="HQ Branch",
            code="LCHQ",
            is_active=True,
            is_headquarters=True,
        )
        self.satellite = Branch.objects.create(
            name="Satellite Branch",
            code="LCST",
            is_active=True,
            is_headquarters=False,
        )

        self.admin = Person.objects.create_user(
            username="catalogadmin",
            password="password",
            first_name="Catalog",
            last_name="Admin",
            role="ADMIN",
            status="ACTIVE",
            branch=self.satellite,
        )
        self.hq_pastor = Person.objects.create_user(
            username="hqpastor",
            password="password",
            first_name="HQ",
            last_name="Pastor",
            role="PASTOR",
            status="ACTIVE",
            branch=self.hq,
        )
        self.non_hq_pastor = Person.objects.create_user(
            username="satpastor",
            password="password",
            first_name="Sat",
            last_name="Pastor",
            role="PASTOR",
            status="ACTIVE",
            branch=self.satellite,
        )
        self.hq_coordinator = Person.objects.create_user(
            username="hqcoord",
            password="password",
            first_name="HQ",
            last_name="Coord",
            role="MEMBER",
            status="ACTIVE",
            branch=self.hq,
        )
        ModuleCoordinator.objects.create(
            person=self.hq_coordinator,
            module=ModuleCoordinator.ModuleType.LESSONS,
            level=ModuleCoordinator.CoordinatorLevel.COORDINATOR,
        )
        self.hq_teacher = Person.objects.create_user(
            username="hqteacher",
            password="password",
            first_name="HQ",
            last_name="Teacher",
            role="MEMBER",
            status="ACTIVE",
            branch=self.hq,
        )
        ModuleCoordinator.objects.create(
            person=self.hq_teacher,
            module=ModuleCoordinator.ModuleType.LESSONS,
            level=ModuleCoordinator.CoordinatorLevel.TEACHER,
        )
        self.plain_member = Person.objects.create_user(
            username="plainmember",
            password="password",
            first_name="Plain",
            last_name="Member",
            role="MEMBER",
            status="ACTIVE",
            branch=self.hq,
        )
        self.student = Person.objects.create_user(
            username="catalogstudent",
            password="password",
            first_name="Catalog",
            last_name="Student",
            role="MEMBER",
            status="ACTIVE",
            branch=self.hq,
        )

        self.lesson_list_url = reverse("lessons:lesson-list")
        self.commitment_url = reverse("lessons:lesson-commitment-form")
        self.session_url = reverse("lessons:lesson-session-report-list")
        self.assign_url = reverse("lessons:lesson-progress-assign")

        self.existing_lesson = Lesson.objects.filter(
            is_latest=True, is_active=True
        ).first()
        if self.existing_lesson is None:
            self.existing_lesson = Lesson.objects.create(
                code="catalog-seed",
                version_label="v1",
                title="Seed Lesson",
                order=1,
                is_latest=True,
                is_active=True,
            )

        self._lesson_payload_counter = 0

    def _lesson_payload(self):
        self._lesson_payload_counter += 1
        n = self._lesson_payload_counter
        return {
            "code": f"catalog-test-{n}",
            "version_label": "v1",
            "title": f"Catalog Test Lesson {n}",
            "order": 200 + n,
            "is_latest": True,
            "is_active": True,
        }

    def _assert_can_create_lesson(self, user):
        self.client.force_authenticate(user=user)
        response = self.client.post(
            self.lesson_list_url, self._lesson_payload(), format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)

    def _assert_cannot_create_lesson(self, user):
        self.client.force_authenticate(user=user)
        response = self.client.post(
            self.lesson_list_url, self._lesson_payload(), format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def _assert_can_post_commitment(self, user):
        self.client.force_authenticate(user=user)
        pdf = SimpleUploadedFile(
            "commitment.pdf", b"%PDF-1.4 test", content_type="application/pdf"
        )
        response = self.client.post(
            self.commitment_url, {"commitment_form": pdf}, format="multipart"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)

    def _assert_cannot_post_commitment(self, user):
        self.client.force_authenticate(user=user)
        pdf = SimpleUploadedFile(
            "commitment.pdf", b"%PDF-1.4 test", content_type="application/pdf"
        )
        response = self.client.post(
            self.commitment_url, {"commitment_form": pdf}, format="multipart"
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_hq_admin_can_create_lesson_and_post_commitment(self):
        self._assert_can_create_lesson(self.admin)
        self._assert_can_post_commitment(self.admin)

    def test_hq_pastor_can_create_lesson_and_post_commitment(self):
        self._assert_can_create_lesson(self.hq_pastor)
        self._assert_can_post_commitment(self.hq_pastor)

    def test_hq_coordinator_can_create_lesson_and_post_commitment(self):
        self._assert_can_create_lesson(self.hq_coordinator)
        self._assert_can_post_commitment(self.hq_coordinator)

    def test_non_hq_pastor_cannot_create_or_post_commitment(self):
        self._assert_cannot_create_lesson(self.non_hq_pastor)
        self._assert_cannot_post_commitment(self.non_hq_pastor)

    def test_hq_teacher_cannot_create_or_post_commitment(self):
        self._assert_cannot_create_lesson(self.hq_teacher)
        self._assert_cannot_post_commitment(self.hq_teacher)

    def test_plain_member_cannot_create_or_post_commitment(self):
        self._assert_cannot_create_lesson(self.plain_member)
        self._assert_cannot_post_commitment(self.plain_member)

    def test_commitment_get_allowed_for_member(self):
        self.client.force_authenticate(user=self.plain_member)
        response = self.client.get(self.commitment_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_hq_teacher_can_log_session(self):
        self.client.force_authenticate(user=self.hq_teacher)
        response = self.client.post(
            self.session_url,
            {
                "student_id": self.student.id,
                "teacher_id": self.hq_teacher.id,
                "lesson_id": self.existing_lesson.id,
                "session_type": LessonSessionReport.SessionType.LESSON,
                "session_date": "2025-06-01",
                "session_start": timezone.now().isoformat(),
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)

    def test_hq_teacher_can_assign_lessons(self):
        self.client.force_authenticate(user=self.hq_teacher)
        response = self.client.post(
            self.assign_url,
            {
                "lesson_id": self.existing_lesson.id,
                "person_ids": [self.student.id],
                "teacher_id": self.hq_teacher.id,
            },
            format="json",
        )
        self.assertIn(
            response.status_code,
            (status.HTTP_200_OK, status.HTTP_201_CREATED),
            response.data,
        )
