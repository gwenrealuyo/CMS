from datetime import date

from rest_framework.test import APITestCase

from apps.lessons.models import (
    Lesson,
    LessonAssignmentRequest,
    LessonStudentEnrollment,
    PersonLessonProgress,
)
from apps.ministries.models import MinistryMember
from apps.ministries.ncc import ensure_ncc_ministry
from apps.notifications.services import build_notification_feed
from apps.people.models import Branch, ModuleCoordinator, Person


class LessonAssignmentRequestAPITests(APITestCase):
    def setUp(self):
        self.branch = Branch.objects.create(
            name="Assignment Branch",
            code="ASGBR",
            is_active=True,
        )
        self.other_branch = Branch.objects.create(
            name="Other Assignment Branch",
            code="ASGOTH",
            is_active=True,
        )
        self.lesson = Lesson.objects.create(
            code="assign-request-01",
            title="Request Lesson",
            order=1,
            is_latest=True,
            is_active=True,
        )
        self.coordinator = self._person("assigncoord", "Cora", "Coord", self.branch)
        self.teacher = self._person("assignteacher", "Tessa", "Teacher", self.branch)
        self.other_teacher = self._person(
            "assignteacher2", "Theo", "Teacher", self.branch
        )
        self.student = self._person("assignstudent", "Sam", "Student", self.branch)
        self.other_branch_student = self._person(
            "assignotherstu", "Omar", "Other", self.other_branch
        )
        self._lessons_role(
            self.coordinator, ModuleCoordinator.CoordinatorLevel.COORDINATOR
        )
        self._lessons_role(self.teacher, ModuleCoordinator.CoordinatorLevel.TEACHER)
        self._lessons_role(
            self.other_teacher, ModuleCoordinator.CoordinatorLevel.TEACHER
        )
        ministry = ensure_ncc_ministry(self.branch)
        MinistryMember.objects.create(ministry=ministry, member=self.teacher)
        MinistryMember.objects.create(ministry=ministry, member=self.other_teacher)

    def _person(self, username, first_name, last_name, branch):
        return Person.objects.create_user(
            username=username,
            password="pass12345",
            first_name=first_name,
            last_name=last_name,
            role="MEMBER",
            water_baptism_date=date(2020, 1, 1),
            status="ACTIVE",
            branch=branch,
        )

    def _lessons_role(self, person, level):
        ModuleCoordinator.objects.create(
            person=person,
            module=ModuleCoordinator.ModuleType.LESSONS,
            level=level,
            resource_id=None,
        )

    def _request_payload(self, student, teacher, lesson_ids=None):
        return {
            "student_id": student.id,
            "teacher_id": teacher.id,
            "lesson_ids": lesson_ids if lesson_ids is not None else [self.lesson.id],
        }

    def test_teacher_request_does_not_enroll_or_assign_progress(self):
        self.client.force_authenticate(self.teacher)
        response = self.client.post(
            "/api/lessons/assignment-requests/",
            self._request_payload(self.student, self.teacher),
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data["status"], "pending")
        self.assertFalse(
            LessonStudentEnrollment.objects.filter(student=self.student).exists()
        )
        self.assertFalse(
            PersonLessonProgress.objects.filter(person=self.student).exists()
        )

        progress = self.client.get("/api/lessons/progress/")
        self.assertEqual(progress.status_code, 200, progress.data)
        self.assertEqual(progress.data, [])
        enrollments = self.client.get("/api/lessons/enrollments/")
        self.assertEqual(enrollments.status_code, 200, enrollments.data)
        self.assertEqual(enrollments.data, [])

    def test_teacher_assign_endpoint_creates_request_not_enrollment(self):
        self.client.force_authenticate(self.teacher)
        response = self.client.post(
            "/api/lessons/progress/assign/",
            {
                "lesson_id": self.lesson.id,
                "person_ids": [self.student.id],
                "teacher_id": self.teacher.id,
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data["created"], 0)
        self.assertEqual(
            LessonAssignmentRequest.objects.filter(
                student=self.student,
                teacher=self.teacher,
                status=LessonAssignmentRequest.Status.PENDING,
            ).count(),
            1,
        )
        self.assertFalse(
            LessonStudentEnrollment.objects.filter(student=self.student).exists()
        )
        self.assertFalse(
            PersonLessonProgress.objects.filter(person=self.student).exists()
        )

    def test_teacher_cannot_name_another_teacher(self):
        self.client.force_authenticate(self.teacher)
        response = self.client.post(
            "/api/lessons/assignment-requests/",
            self._request_payload(self.student, self.other_teacher),
            format="json",
        )
        self.assertEqual(response.status_code, 403, response.data)

        assign_response = self.client.post(
            "/api/lessons/progress/assign/",
            {
                "lesson_id": self.lesson.id,
                "person_ids": [self.student.id],
                "teacher_id": self.other_teacher.id,
            },
            format="json",
        )
        self.assertEqual(assign_response.status_code, 403, assign_response.data)

        enrollment_response = self.client.post(
            "/api/lessons/enrollments/",
            {
                "student_id": self.student.id,
                "teacher_id": self.other_teacher.id,
            },
            format="json",
        )
        self.assertEqual(enrollment_response.status_code, 403, enrollment_response.data)
        self.assertFalse(LessonAssignmentRequest.objects.exists())
        self.assertFalse(LessonStudentEnrollment.objects.exists())

    def test_teacher_enrollment_create_becomes_request(self):
        self.client.force_authenticate(self.teacher)
        response = self.client.post(
            "/api/lessons/enrollments/",
            {"student_id": self.student.id, "teacher_id": self.teacher.id},
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data["status"], "pending")
        self.assertEqual(response.data["lessons"], [])
        self.assertFalse(LessonStudentEnrollment.objects.exists())

    def test_approve_creates_enrollment_and_rejects_sibling_requests(self):
        self.client.force_authenticate(self.teacher)
        first = self.client.post(
            "/api/lessons/assignment-requests/",
            self._request_payload(self.student, self.teacher),
            format="json",
        )
        self.assertEqual(first.status_code, 201, first.data)
        self.client.force_authenticate(self.other_teacher)
        second = self.client.post(
            "/api/lessons/assignment-requests/",
            self._request_payload(self.student, self.other_teacher),
            format="json",
        )
        self.assertEqual(second.status_code, 201, second.data)

        self.client.force_authenticate(self.coordinator)
        approve = self.client.post(
            f"/api/lessons/assignment-requests/{first.data['id']}/approve/",
            {"review_note": "Looks good"},
            format="json",
        )
        self.assertEqual(approve.status_code, 200, approve.data)
        self.assertEqual(approve.data["status"], "approved")

        enrollment = LessonStudentEnrollment.objects.get(student=self.student)
        self.assertEqual(enrollment.teacher_id, self.teacher.id)
        self.assertTrue(
            PersonLessonProgress.objects.filter(
                person=self.student, lesson=self.lesson
            ).exists()
        )
        sibling = LessonAssignmentRequest.objects.get(pk=second.data["id"])
        self.assertEqual(sibling.status, LessonAssignmentRequest.Status.REJECTED)

        self.client.force_authenticate(self.teacher)
        progress = self.client.get("/api/lessons/progress/")
        self.assertEqual(len(progress.data), 1)

    def test_reject_leaves_student_unassigned_and_allows_a_later_request(self):
        self.client.force_authenticate(self.teacher)
        created = self.client.post(
            "/api/lessons/assignment-requests/",
            self._request_payload(self.student, self.teacher),
            format="json",
        )
        self.client.force_authenticate(self.coordinator)
        rejected = self.client.post(
            f"/api/lessons/assignment-requests/{created.data['id']}/reject/",
            {"review_note": "Not now"},
            format="json",
        )
        self.assertEqual(rejected.status_code, 200, rejected.data)
        self.assertEqual(rejected.data["status"], "rejected")
        self.assertFalse(LessonStudentEnrollment.objects.exists())
        self.assertFalse(PersonLessonProgress.objects.exists())

        self.client.force_authenticate(self.teacher)
        again = self.client.post(
            "/api/lessons/assignment-requests/",
            self._request_payload(self.student, self.teacher),
            format="json",
        )
        self.assertEqual(again.status_code, 201, again.data)
        self.assertEqual(again.data["status"], "pending")

    def test_coordinator_assign_is_immediate(self):
        self.client.force_authenticate(self.teacher)
        pending = self.client.post(
            "/api/lessons/assignment-requests/",
            self._request_payload(self.student, self.teacher),
            format="json",
        )
        self.assertEqual(pending.status_code, 201, pending.data)

        self.client.force_authenticate(self.coordinator)
        response = self.client.post(
            "/api/lessons/progress/assign/",
            {
                "lesson_id": self.lesson.id,
                "person_ids": [self.student.id],
                "teacher_id": self.teacher.id,
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data["created"], 1)
        enrollment = LessonStudentEnrollment.objects.get(student=self.student)
        self.assertEqual(enrollment.teacher_id, self.teacher.id)
        self.assertTrue(
            PersonLessonProgress.objects.filter(
                person=self.student, lesson=self.lesson
            ).exists()
        )
        request_row = LessonAssignmentRequest.objects.get(pk=pending.data["id"])
        self.assertEqual(request_row.status, LessonAssignmentRequest.Status.REJECTED)

    def test_pending_request_notifies_coordinator(self):
        self.client.force_authenticate(self.teacher)
        created = self.client.post(
            "/api/lessons/assignment-requests/",
            self._request_payload(self.student, self.teacher),
            format="json",
        )
        self.assertEqual(created.status_code, 201, created.data)
        items = build_notification_feed(self.coordinator)
        match = [
            item
            for item in items
            if item.type == "lesson_assignment_pending"
            and item.key == f"lesson_assignment_pending:{created.data['id']}"
        ]
        self.assertEqual(len(match), 1)
        self.assertEqual(match[0].href, "/lessons?tab=teachers&approval=pending")
        teacher_items = [
            item
            for item in build_notification_feed(self.teacher)
            if item.type == "lesson_assignment_pending"
        ]
        self.assertEqual(teacher_items, [])

    def test_teacher_cannot_request_student_outside_branch(self):
        self.client.force_authenticate(self.teacher)
        response = self.client.post(
            "/api/lessons/assignment-requests/",
            self._request_payload(self.other_branch_student, self.teacher),
            format="json",
        )
        self.assertEqual(response.status_code, 400, response.data)
        self.assertFalse(LessonAssignmentRequest.objects.exists())
