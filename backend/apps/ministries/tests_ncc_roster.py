from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from apps.lessons.models import LessonStudentEnrollment
from apps.ministries.models import Ministry, MinistryMember, NCC_MINISTRY_CODE
from apps.ministries.ncc import (
    ensure_ncc_ministry,
    person_has_lessons_teacher_access,
    person_on_ncc_roster,
    seed_ncc_ministries_for_all_branches,
)
from apps.people.models import Branch, ModuleCoordinator, Person


class NccMinistryRosterTests(TestCase):
    def setUp(self):
        self.branch = Branch.objects.create(
            name="NCC Branch",
            code="NCCB1",
            is_active=True,
        )
        self.other_branch = Branch.objects.create(
            name="Other Branch",
            code="NCCB2",
            is_active=True,
        )
        self.admin = Person.objects.create_user(
            username="ncc_admin",
            email="ncc_admin@test.com",
            password="testpass123",
            first_name="Ncc",
            last_name="Admin",
            role="ADMIN",
            branch=self.branch,
            status="ACTIVE",
        )
        self.lessons_coord = Person.objects.create_user(
            username="ncc_lcoord",
            email="ncc_lcoord@test.com",
            password="testpass123",
            first_name="Lessons",
            last_name="Coord",
            role="MEMBER",
            branch=self.branch,
            status="ACTIVE",
        )
        ModuleCoordinator.objects.create(
            person=self.lessons_coord,
            module=ModuleCoordinator.ModuleType.LESSONS,
            level=ModuleCoordinator.CoordinatorLevel.COORDINATOR,
        )
        self.teacher = Person.objects.create_user(
            username="ncc_teacher",
            email="ncc_teacher@test.com",
            password="testpass123",
            first_name="Ncc",
            last_name="Teacher",
            role="MEMBER",
            branch=self.branch,
            status="ACTIVE",
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.admin)

    def test_ensure_ncc_ministry_idempotent(self):
        first = ensure_ncc_ministry(self.branch)
        second = ensure_ncc_ministry(self.branch)
        self.assertEqual(first.id, second.id)
        self.assertEqual(first.code, NCC_MINISTRY_CODE)
        self.assertTrue(first.is_system)
        self.assertEqual(first.branch_id, self.branch.id)

    def test_seed_creates_for_all_branches(self):
        Ministry.objects.filter(code=NCC_MINISTRY_CODE).delete()
        created = seed_ncc_ministries_for_all_branches()
        self.assertGreaterEqual(created, 2)
        self.assertEqual(
            Ministry.objects.filter(code=NCC_MINISTRY_CODE, is_system=True).count(),
            Branch.objects.filter(is_active=True).count(),
        )

    def test_add_member_with_grant_creates_teacher_access(self):
        ministry = ensure_ncc_ministry(self.branch)
        response = self.client.post(
            "/api/ministries/members/",
            {
                "ministry": ministry.id,
                "member_id": self.teacher.id,
                "role": "team_member",
                "grant_lessons_teacher_access": True,
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertTrue(response.data["has_lessons_teacher_access"])
        self.assertTrue(person_has_lessons_teacher_access(self.teacher))
        self.assertTrue(person_on_ncc_roster(self.teacher, self.branch))

    def test_add_member_without_grant_skips_access(self):
        ministry = ensure_ncc_ministry(self.branch)
        response = self.client.post(
            "/api/ministries/members/",
            {
                "ministry": ministry.id,
                "member_id": self.teacher.id,
                "role": "team_member",
                "grant_lessons_teacher_access": False,
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertFalse(response.data["has_lessons_teacher_access"])
        self.assertFalse(
            ModuleCoordinator.objects.filter(
                person=self.teacher,
                module=ModuleCoordinator.ModuleType.LESSONS,
                level=ModuleCoordinator.CoordinatorLevel.TEACHER,
            ).exists()
        )
        teachers = self.client.get(
            "/api/lessons/teachers/",
            {"branch_id": self.branch.id},
        )
        self.assertEqual(teachers.status_code, status.HTTP_200_OK)
        row = next(r for r in teachers.data if r["id"] == self.teacher.id)
        self.assertFalse(row["has_lessons_teacher_access"])

    def test_teachers_endpoint_access_flag_matches_grant(self):
        ministry = ensure_ncc_ministry(self.branch)
        granted = Person.objects.create_user(
            username="ncc_granted",
            email="ncc_granted@test.com",
            password="testpass123",
            first_name="Granted",
            last_name="Teacher",
            role="MEMBER",
            branch=self.branch,
            status="ACTIVE",
        )
        roster_only = Person.objects.create_user(
            username="ncc_roster_only",
            email="ncc_roster_only@test.com",
            password="testpass123",
            first_name="Roster",
            last_name="Only",
            role="MEMBER",
            branch=self.branch,
            status="ACTIVE",
        )
        self.client.post(
            "/api/ministries/members/",
            {
                "ministry": ministry.id,
                "member_id": granted.id,
                "role": "team_member",
                "grant_lessons_teacher_access": True,
            },
            format="json",
        )
        self.client.post(
            "/api/ministries/members/",
            {
                "ministry": ministry.id,
                "member_id": roster_only.id,
                "role": "team_member",
                "grant_lessons_teacher_access": False,
            },
            format="json",
        )
        teachers = self.client.get(
            "/api/lessons/teachers/",
            {"branch_id": self.branch.id},
        )
        self.assertEqual(teachers.status_code, status.HTTP_200_OK)
        by_id = {row["id"]: row for row in teachers.data}
        self.assertTrue(by_id[granted.id]["has_lessons_teacher_access"])
        self.assertFalse(by_id[roster_only.id]["has_lessons_teacher_access"])

    def test_mark_inactive_revokes_teacher_access(self):
        ministry = ensure_ncc_ministry(self.branch)
        membership = MinistryMember.objects.create(
            ministry=ministry,
            member=self.teacher,
            role="team_member",
            is_active=True,
        )
        ModuleCoordinator.objects.create(
            person=self.teacher,
            module=ModuleCoordinator.ModuleType.LESSONS,
            level=ModuleCoordinator.CoordinatorLevel.TEACHER,
        )
        response = self.client.patch(
            f"/api/ministries/members/{membership.id}/",
            {"is_active": False},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertFalse(
            ModuleCoordinator.objects.filter(
                person=self.teacher,
                module=ModuleCoordinator.ModuleType.LESSONS,
                level=ModuleCoordinator.CoordinatorLevel.TEACHER,
            ).exists()
        )
        teachers = self.client.get(
            "/api/lessons/teachers/",
            {"branch_id": self.branch.id},
        )
        self.assertEqual(teachers.status_code, status.HTTP_200_OK)
        ids = [row["id"] for row in teachers.data]
        self.assertIn(self.teacher.id, ids)
        inactive = next(row for row in teachers.data if row["id"] == self.teacher.id)
        self.assertFalse(inactive["is_active"])
        self.assertFalse(inactive["has_lessons_teacher_access"])

    def test_lessons_coordinator_can_manage_own_branch_ncc(self):
        ministry = ensure_ncc_ministry(self.branch)
        self.client.force_authenticate(user=self.lessons_coord)
        response = self.client.post(
            "/api/ministries/members/",
            {
                "ministry": ministry.id,
                "member_id": self.teacher.id,
                "role": "team_member",
                "grant_lessons_teacher_access": True,
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)

    def test_lessons_coordinator_cannot_manage_other_ministry(self):
        other = Ministry.objects.create(
            name="Worship",
            code="WORSHIP-NCCB1",
            scope="BRANCH",
            branch=self.branch,
            is_active=True,
        )
        self.client.force_authenticate(user=self.lessons_coord)
        response = self.client.post(
            "/api/ministries/members/",
            {
                "ministry": other.id,
                "member_id": self.teacher.id,
                "role": "team_member",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_teachers_endpoint_and_enrollment_accepts_inactive(self):
        ministry = ensure_ncc_ministry(self.branch)
        MinistryMember.objects.create(
            ministry=ministry,
            member=self.teacher,
            role="team_member",
            is_active=False,
        )
        student = Person.objects.create_user(
            username="ncc_student",
            email="ncc_student@test.com",
            password="testpass123",
            first_name="Ncc",
            last_name="Student",
            role="MEMBER",
            branch=self.branch,
            status="ACTIVE",
        )
        response = self.client.post(
            "/api/lessons/enrollments/",
            {
                "student_id": student.id,
                "teacher_id": self.teacher.id,
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertTrue(
            LessonStudentEnrollment.objects.filter(
                student=student, teacher=self.teacher
            ).exists()
        )

    def test_enrollment_rejects_non_roster_teacher(self):
        ensure_ncc_ministry(self.branch)
        stranger = Person.objects.create_user(
            username="ncc_stranger",
            email="ncc_stranger@test.com",
            password="testpass123",
            first_name="Not",
            last_name="Roster",
            role="MEMBER",
            branch=self.branch,
            status="ACTIVE",
        )
        student = Person.objects.create_user(
            username="ncc_student2",
            email="ncc_student2@test.com",
            password="testpass123",
            first_name="Ncc",
            last_name="Student2",
            role="MEMBER",
            branch=self.branch,
            status="ACTIVE",
        )
        response = self.client.post(
            "/api/lessons/enrollments/",
            {
                "student_id": student.id,
                "teacher_id": stranger.id,
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_system_ministry_cannot_be_deleted(self):
        ministry = ensure_ncc_ministry(self.branch)
        response = self.client.delete(f"/api/ministries/{ministry.id}/")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertTrue(Ministry.objects.filter(pk=ministry.id).exists())

    def test_teachers_endpoint_includes_branch_id(self):
        ministry = ensure_ncc_ministry(self.branch)
        MinistryMember.objects.create(
            ministry=ministry,
            member=self.teacher,
            role="team_member",
            is_active=True,
        )
        teachers = self.client.get(
            "/api/lessons/teachers/",
            {"branch_id": self.branch.id},
        )
        self.assertEqual(teachers.status_code, status.HTTP_200_OK)
        row = next(r for r in teachers.data if r["id"] == self.teacher.id)
        self.assertEqual(row["branch"], self.branch.id)
        self.assertEqual(row["branch_id"], self.branch.id)

    def test_hq_admin_without_branch_lists_all_branch_rosters(self):
        hq_admin = Person.objects.create_user(
            username="ncc_hq_admin",
            email="ncc_hq_admin@test.com",
            password="testpass123",
            first_name="Hq",
            last_name="Admin",
            role="ADMIN",
            branch=None,
            status="ACTIVE",
        )
        other_teacher = Person.objects.create_user(
            username="ncc_other_teacher",
            email="ncc_other_teacher@test.com",
            password="testpass123",
            first_name="Other",
            last_name="Teacher",
            role="MEMBER",
            branch=self.other_branch,
            status="ACTIVE",
        )
        MinistryMember.objects.create(
            ministry=ensure_ncc_ministry(self.branch),
            member=self.teacher,
            role="team_member",
            is_active=True,
        )
        MinistryMember.objects.create(
            ministry=ensure_ncc_ministry(self.other_branch),
            member=other_teacher,
            role="team_member",
            is_active=True,
        )
        self.client.force_authenticate(user=hq_admin)
        teachers = self.client.get("/api/lessons/teachers/")
        self.assertEqual(teachers.status_code, status.HTTP_200_OK)
        by_id = {row["id"]: row for row in teachers.data}
        self.assertEqual(by_id[self.teacher.id]["branch_id"], self.branch.id)
        self.assertEqual(by_id[other_teacher.id]["branch_id"], self.other_branch.id)

        scoped = self.client.get(
            "/api/lessons/teachers/",
            {"branch_id": self.other_branch.id},
        )
        self.assertEqual(scoped.status_code, status.HTTP_200_OK)
        scoped_ids = [row["id"] for row in scoped.data]
        self.assertEqual(scoped_ids, [other_teacher.id])

    def test_non_privileged_without_branch_gets_empty_roster(self):
        member = Person.objects.create_user(
            username="ncc_no_branch_member",
            email="ncc_no_branch_member@test.com",
            password="testpass123",
            first_name="No",
            last_name="Branch",
            role="MEMBER",
            branch=None,
            status="ACTIVE",
        )
        self.client.force_authenticate(user=member)
        teachers = self.client.get("/api/lessons/teachers/")
        self.assertEqual(teachers.status_code, status.HTTP_200_OK)
        self.assertEqual(teachers.data, [])

    def test_backfill_adds_coordinators_and_enrollment_teachers(self):
        from apps.ministries.ncc import backfill_ncc_roster_from_lessons_teachers

        ModuleCoordinator.objects.create(
            person=self.teacher,
            module=ModuleCoordinator.ModuleType.LESSONS,
            level=ModuleCoordinator.CoordinatorLevel.TEACHER,
        )
        other_teacher = Person.objects.create_user(
            username="ncc_enroll_teacher",
            email="ncc_enroll_teacher@test.com",
            password="testpass123",
            first_name="Enroll",
            last_name="Teacher",
            role="MEMBER",
            branch=self.other_branch,
            status="ACTIVE",
        )
        student = Person.objects.create_user(
            username="ncc_backfill_student",
            email="ncc_backfill_student@test.com",
            password="testpass123",
            first_name="Backfill",
            last_name="Student",
            role="MEMBER",
            branch=self.branch,
            status="ACTIVE",
        )
        LessonStudentEnrollment.objects.create(
            student=student,
            teacher=other_teacher,
        )
        created = backfill_ncc_roster_from_lessons_teachers()
        self.assertGreaterEqual(created, 2)
        self.assertTrue(person_on_ncc_roster(self.teacher, self.branch))
        self.assertTrue(person_on_ncc_roster(self.lessons_coord, self.branch))
        self.assertTrue(person_on_ncc_roster(other_teacher, self.branch))
        self.assertEqual(
            backfill_ncc_roster_from_lessons_teachers(),
            0,
        )
