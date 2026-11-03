from datetime import date, datetime, timezone

from rest_framework.test import APITestCase

from apps.clusters.models import Cluster
from apps.evangelism.models import EvangelismGroup, Prospect
from apps.lessons.models import Lesson, LessonSessionReport
from apps.people.models import Branch, Person


class PersonEvangelismPipelineSyncAPITests(APITestCase):
    def setUp(self):
        self.branch = Branch.objects.create(
            name="Muntinlupa",
            code="MUNTPIPESYNC",
            is_active=True,
        )
        self.admin = Person.objects.create_user(
            username="pipesyncadmin",
            password="pass12345",
            first_name="Ada",
            last_name="Admin",
            role="ADMIN",
            status="ACTIVE",
            branch=self.branch,
        )
        self.inviter = Person.objects.create_user(
            username="pipesyncinviter",
            password="pass12345",
            first_name="Ivy",
            last_name="Inviter",
            role="MEMBER",
            status="ACTIVE",
            branch=self.branch,
        )
        self.visitor = Person.objects.create_user(
            username="pipesyncvisitor",
            password="pass12345",
            first_name="Vic",
            last_name="Visitor",
            role="VISITOR",
            status="ONGOING",
            branch=self.branch,
            date_first_invited=date(2026, 1, 5),
            date_first_attended=date(2026, 1, 12),
        )
        self.cluster = Cluster.objects.create(
            name="Pipe Cluster",
            code="PIPE-01",
            branch=self.branch,
            is_active=True,
        )
        self.group = EvangelismGroup.objects.create(
            name="Pipe Study",
            coordinator=self.inviter,
            cluster=self.cluster,
            branch=self.branch,
            is_active=True,
            approval_status=EvangelismGroup.ApprovalStatus.APPROVED,
        )
        self.prospect = Prospect.objects.create(
            first_name="Vic",
            last_name="Visitor",
            invited_by=self.inviter,
            evangelism_group=self.group,
            person=self.visitor,
            pipeline_stage=Prospect.PipelineStage.ATTENDED,
        )
        self.lesson = Lesson.objects.create(
            code="PIPE-NCC-1",
            title="NCC 1",
            order=1,
            is_active=True,
        )
        self.client.force_authenticate(self.admin)

    def _add_ncc_session(self):
        LessonSessionReport.objects.create(
            teacher=self.inviter,
            student=self.visitor,
            lesson=self.lesson,
            session_date=date(2026, 1, 20),
            session_start=datetime(2026, 1, 20, 10, 0, tzinfo=timezone.utc),
            submitted_by=self.admin,
        )

    def test_person_patch_advances_prospect_after_baptism(self):
        self._add_ncc_session()
        response = self.client.patch(
            f"/api/people/people/{self.visitor.id}/",
            {"water_baptism_date": "2026-02-01"},
            format="json",
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.prospect.refresh_from_db()
        self.assertEqual(
            self.prospect.pipeline_stage,
            Prospect.PipelineStage.BAPTIZED,
        )

    def test_person_reached_milestones_set_prospect_reached(self):
        self._add_ncc_session()
        response = self.client.patch(
            f"/api/people/people/{self.visitor.id}/",
            {
                "water_baptism_date": "2026-02-01",
                "spirit_baptism_date": "2026-02-08",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.prospect.refresh_from_db()
        self.assertEqual(
            self.prospect.pipeline_stage,
            Prospect.PipelineStage.REACHED,
        )

    def test_session_report_alone_without_lessons_started_is_not_taken_ncc(self):
        from apps.evangelism.services import sync_person_evangelism_pipeline
        from apps.lessons.models import LessonSessionReport

        # Seed-style report without going through the create signal path.
        LessonSessionReport.objects.bulk_create(
            [
                LessonSessionReport(
                    teacher=self.inviter,
                    student=self.visitor,
                    lesson=self.lesson,
                    session_date=date(2026, 1, 20),
                    session_start=datetime(2026, 1, 20, 10, 0, tzinfo=timezone.utc),
                    submitted_by=self.admin,
                )
            ]
        )
        self.visitor.lessons_started_at = None
        self.visitor.save(update_fields=["lessons_started_at"])
        self.prospect.pipeline_stage = Prospect.PipelineStage.TAKEN_NCC
        self.prospect.save(update_fields=["pipeline_stage"])

        sync_person_evangelism_pipeline(self.visitor, prospect=self.prospect)
        self.prospect.refresh_from_db()
        self.visitor.refresh_from_db()
        self.assertIsNone(self.visitor.lessons_started_at)
        self.assertEqual(
            self.prospect.pipeline_stage,
            Prospect.PipelineStage.ATTENDED,
        )

    def test_active_teacher_enrollment_counts_as_taken_ncc(self):
        from apps.evangelism.services import sync_person_evangelism_pipeline
        from apps.lessons.models import LessonStudentEnrollment

        LessonStudentEnrollment.objects.create(
            student=self.visitor,
            teacher=self.inviter,
            is_active=True,
            assigned_by=self.admin,
        )
        sync_person_evangelism_pipeline(self.visitor, prospect=self.prospect)
        self.prospect.refresh_from_db()
        self.assertEqual(
            self.prospect.pipeline_stage,
            Prospect.PipelineStage.TAKEN_NCC,
        )
