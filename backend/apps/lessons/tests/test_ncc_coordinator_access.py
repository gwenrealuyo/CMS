from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from apps.lessons.coordinator_access import (
    can_pick_lessons_branch,
    has_lessons_browse_all,
    ncc_lessons_role,
)
from apps.lessons.models import Lesson, PersonLessonProgress
from apps.ministries.ncc import ensure_ncc_ministry
from apps.people.models import Branch, ModuleCoordinator, ModuleSetting, Person
from django.test import TestCase


class NccCoordinatorLessonsAccessTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        ModuleSetting.objects.update_or_create(
            module=ModuleCoordinator.ModuleType.LESSONS,
            defaults={"is_enabled": True},
        )
        self.hq = Branch.objects.create(
            name="NCC Access HQ",
            code="NCAHQ",
            is_active=True,
            is_headquarters=True,
        )
        self.satellite = Branch.objects.create(
            name="NCC Access Satellite",
            code="NCASAT",
            is_active=True,
        )
        self.lesson = Lesson.objects.filter(is_latest=True, is_active=True).first()
        if self.lesson is None:
            self.lesson = Lesson.objects.create(
                code="ncc-access-lesson",
                version_label="v1",
                title="NCC Access Lesson",
                order=50,
                is_latest=True,
                is_active=True,
            )
        self.student_hq = self._member("nccacc_stud_hq", self.hq, "Hqstud")
        self.student_sat = self._member("nccacc_stud_sat", self.satellite, "Satstud")
        PersonLessonProgress.objects.create(
            person=self.student_hq,
            lesson=self.lesson,
            status=PersonLessonProgress.Status.ASSIGNED,
            assigned_at=timezone.now(),
        )
        PersonLessonProgress.objects.create(
            person=self.student_sat,
            lesson=self.lesson,
            status=PersonLessonProgress.Status.ASSIGNED,
            assigned_at=timezone.now(),
        )
        self.progress_url = reverse("lessons:lesson-progress-list")
        self.session_url = reverse("lessons:lesson-session-report-list")
        self.assign_url = reverse("lessons:lesson-progress-assign")
        self.me_url = reverse("authentication:current_user")
        self.lesson_list_url = reverse("lessons:lesson-list")

    def _member(self, username, branch, first_name):
        return Person.objects.create_user(
            username=username,
            password="password",
            first_name=first_name,
            last_name="Access",
            role="MEMBER",
            status="ACTIVE",
            branch=branch,
        )

    def _ncc_support(self, branch, username):
        person = self._member(username, branch, "Support")
        ministry = ensure_ncc_ministry(branch)
        ministry.support_coordinators.add(person)
        return person

    def _ncc_primary(self, branch, username):
        person = self._member(username, branch, "Primary")
        ministry = ensure_ncc_ministry(branch)
        ministry.primary_coordinator = person
        ministry.save(update_fields=["primary_coordinator", "updated_at"])
        return person

    def _progress_person_ids(self):
        response = self.client.get(self.progress_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        return {
            row["person"]["id"] for row in response.data if row.get("person")
        }

    def test_support_sees_all_branch_students_not_other_branch(self):
        support = self._ncc_support(self.satellite, "nccacc_sup_sat")
        self.client.force_authenticate(user=support)
        person_ids = self._progress_person_ids()
        self.assertIn(self.student_sat.id, person_ids)
        self.assertNotIn(self.student_hq.id, person_ids)

        response = self.client.get(
            self.progress_url, {"branch_id": self.hq.id}
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        person_ids = {
            row["person"]["id"] for row in response.data if row.get("person")
        }
        self.assertIn(self.student_sat.id, person_ids)
        self.assertNotIn(self.student_hq.id, person_ids)
        self.assertFalse(can_pick_lessons_branch(support))

    def test_support_can_assign_and_log_session(self):
        support = self._ncc_support(self.satellite, "nccacc_sup_write")
        student = self._member("nccacc_new_stud", self.satellite, "Newstud")
        self.client.force_authenticate(user=support)
        assign = self.client.post(
            self.assign_url,
            {
                "lesson_id": self.lesson.id,
                "person_ids": [student.id],
                "teacher_id": support.id,
            },
            format="json",
        )
        self.assertIn(
            assign.status_code,
            (status.HTTP_200_OK, status.HTTP_201_CREATED),
            assign.data,
        )
        session = self.client.post(
            self.session_url,
            {
                "student_id": student.id,
                "teacher_id": support.id,
                "lesson_id": self.lesson.id,
                "session_type": "LESSON",
                "session_date": "2025-06-01",
                "session_start": timezone.now().isoformat(),
            },
            format="json",
        )
        self.assertEqual(session.status_code, status.HTTP_201_CREATED, session.data)

    def test_satellite_primary_cannot_see_other_branch(self):
        primary = self._ncc_primary(self.satellite, "nccacc_pri_sat")
        self.client.force_authenticate(user=primary)
        self.assertFalse(can_pick_lessons_branch(primary))
        person_ids = self._progress_person_ids()
        self.assertIn(self.student_sat.id, person_ids)
        self.assertNotIn(self.student_hq.id, person_ids)

        response = self.client.get(
            self.progress_url, {"branch_id": self.hq.id}
        )
        person_ids = {
            row["person"]["id"] for row in response.data if row.get("person")
        }
        self.assertNotIn(self.student_hq.id, person_ids)

    def test_hq_primary_can_filter_other_branch(self):
        primary = self._ncc_primary(self.hq, "nccacc_pri_hq")
        self.client.force_authenticate(user=primary)
        self.assertTrue(can_pick_lessons_branch(primary))
        response = self.client.get(
            self.progress_url, {"branch_id": self.satellite.id}
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        person_ids = {
            row["person"]["id"] for row in response.data if row.get("person")
        }
        self.assertIn(self.student_sat.id, person_ids)
        self.assertNotIn(self.student_hq.id, person_ids)

        all_branches = self.client.get(self.progress_url)
        all_ids = {
            row["person"]["id"]
            for row in all_branches.data
            if row.get("person")
        }
        self.assertIn(self.student_sat.id, all_ids)
        self.assertIn(self.student_hq.id, all_ids)

    def test_auth_me_exposes_ncc_lessons_role(self):
        support = self._ncc_support(self.satellite, "nccacc_me_sup")
        self.client.force_authenticate(user=support)
        response = self.client.get(self.me_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["ncc_lessons_role"], "SUPPORT")
        self.assertFalse(response.data["ncc_primary_at_headquarters"])

        primary = self._ncc_primary(self.hq, "nccacc_me_pri")
        self.client.force_authenticate(user=primary)
        response = self.client.get(self.me_url)
        self.assertEqual(response.data["ncc_lessons_role"], "PRIMARY")
        self.assertTrue(response.data["ncc_primary_at_headquarters"])

    def test_removing_support_drops_derived_access(self):
        support = self._ncc_support(self.satellite, "nccacc_revoked")
        ministry = ensure_ncc_ministry(self.satellite)
        self.assertEqual(ncc_lessons_role(support), "SUPPORT")
        self.assertTrue(has_lessons_browse_all(support))
        ministry.support_coordinators.remove(support)
        self.assertIsNone(ncc_lessons_role(support))
        self.assertFalse(has_lessons_browse_all(support))

        self.client.force_authenticate(user=support)
        assign = self.client.post(
            self.assign_url,
            {
                "lesson_id": self.lesson.id,
                "person_ids": [self.student_sat.id],
                "teacher_id": support.id,
            },
            format="json",
        )
        self.assertEqual(assign.status_code, status.HTTP_403_FORBIDDEN)

    def test_kept_admin_settings_assignment_after_ncc_removal(self):
        support = self._ncc_support(self.satellite, "nccacc_keep_assign")
        ModuleCoordinator.objects.create(
            person=support,
            module=ModuleCoordinator.ModuleType.LESSONS,
            level=ModuleCoordinator.CoordinatorLevel.COORDINATOR,
        )
        ministry = ensure_ncc_ministry(self.satellite)
        ministry.support_coordinators.remove(support)
        self.assertTrue(has_lessons_browse_all(support))

    def test_lessons_senior_assignment_sees_all_branch_students(self):
        senior = self._member("nccacc_senior", self.satellite, "Senior")
        ModuleCoordinator.objects.create(
            person=senior,
            module=ModuleCoordinator.ModuleType.LESSONS,
            level=ModuleCoordinator.CoordinatorLevel.SENIOR_COORDINATOR,
        )
        other = self._member("nccacc_senior_peer", self.satellite, "Peer")
        PersonLessonProgress.objects.create(
            person=other,
            lesson=self.lesson,
            status=PersonLessonProgress.Status.ASSIGNED,
            assigned_at=timezone.now(),
        )
        self.client.force_authenticate(user=senior)
        self.assertFalse(can_pick_lessons_branch(senior))
        person_ids = self._progress_person_ids()
        self.assertIn(self.student_sat.id, person_ids)
        self.assertIn(other.id, person_ids)
        self.assertNotIn(self.student_hq.id, person_ids)

    def test_hq_support_can_create_lesson_catalog(self):
        support = self._ncc_support(self.hq, "nccacc_hq_sup_cat")
        self.client.force_authenticate(user=support)
        response = self.client.post(
            self.lesson_list_url,
            {
                "code": "ncc-access-catalog",
                "version_label": "v1",
                "title": "NCC Access Catalog",
                "order": 300,
                "is_latest": True,
                "is_active": True,
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)

    def test_satellite_primary_cannot_create_lesson_catalog(self):
        primary = self._ncc_primary(self.satellite, "nccacc_sat_pri_cat")
        self.client.force_authenticate(user=primary)
        response = self.client.post(
            self.lesson_list_url,
            {
                "code": "ncc-access-sat-catalog",
                "version_label": "v1",
                "title": "NCC Access Sat Catalog",
                "order": 301,
                "is_latest": True,
                "is_active": True,
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
