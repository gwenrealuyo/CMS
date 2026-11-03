from datetime import date, timedelta

from django.utils import timezone
from rest_framework.test import APITestCase

from apps.evangelism.models import FollowUpTask, Prospect, VisitorFollowUpCase
from apps.evangelism.visitor_follow_up import (
    ensure_visitor_follow_up_case,
    touch_prospect_activity,
)
from apps.lessons.models import LessonStudentEnrollment
from apps.lessons.services import ensure_lesson_enrollment, stop_remaining_lessons
from apps.people.models import Branch, ModuleSetting, Person

CASES_URL = "/api/evangelism/visitor-follow-up-cases/"
TASKS_URL = "/api/evangelism/follow-up-tasks/"


class VisitorFollowUpWorkflowTests(APITestCase):
    def setUp(self):
        ModuleSetting.objects.update_or_create(
            module="EVANGELISM",
            defaults={"is_enabled": True},
        )
        ModuleSetting.objects.update_or_create(
            module="LESSONS",
            defaults={"is_enabled": True},
        )
        self.branch = Branch.objects.create(
            name="HQ VFU",
            code="HQ-VFU",
            is_headquarters=True,
            is_active=True,
        )
        baptism = date(2020, 1, 1)
        self.inviter = Person.objects.create_user(
            username="inviter_vfu",
            password="pass12345",
            first_name="Ivy",
            last_name="Inviter",
            role="MEMBER",
            status="ACTIVE",
            water_baptism_date=baptism,
            branch=self.branch,
        )
        self.other = Person.objects.create_user(
            username="other_vfu",
            password="pass12345",
            first_name="Other",
            last_name="Member",
            role="MEMBER",
            status="ACTIVE",
            water_baptism_date=baptism,
            branch=self.branch,
        )
        self.teacher = Person.objects.create_user(
            username="teacher_vfu",
            password="pass12345",
            first_name="Ted",
            last_name="Teacher",
            role="MEMBER",
            status="ACTIVE",
            water_baptism_date=baptism,
            branch=self.branch,
        )
        self.admin = Person.objects.create_user(
            username="admin_vfu",
            password="pass12345",
            first_name="Ada",
            last_name="Admin",
            role="ADMIN",
            status="ACTIVE",
            water_baptism_date=baptism,
            branch=self.branch,
        )

    def _invite_prospect(self, **kwargs):
        defaults = dict(
            first_name="Pat",
            last_name="Prospect",
            invited_by=self.inviter,
            pipeline_stage=Prospect.PipelineStage.INVITED,
            date_first_invited=church_today_safe(),
            last_activity_date=church_today_safe(),
        )
        defaults.update(kwargs)
        prospect = Prospect.objects.create(**defaults)
        ensure_visitor_follow_up_case(prospect)
        return prospect

    def test_auto_open_on_invited_create_helpers(self):
        from apps.evangelism.services import create_invited_prospect_for_evangelism_group
        from apps.evangelism.models import EvangelismGroup

        group = EvangelismGroup.objects.create(
            name="VFU Group",
            coordinator=self.inviter,
            branch=self.branch,
            approval_status=EvangelismGroup.ApprovalStatus.APPROVED,
            is_active=True,
        )
        prospect = create_invited_prospect_for_evangelism_group(
            group,
            first_name="New",
            last_name="Invite",
            invited_by=self.inviter,
        )
        case = VisitorFollowUpCase.objects.get(prospect=prospect)
        self.assertEqual(case.case_status, VisitorFollowUpCase.CaseStatus.OPEN)
        self.assertEqual(case.assigned_to_id, self.inviter.id)

    def test_invited_only_eligible_without_person(self):
        prospect = self._invite_prospect()
        self.assertIsNone(prospect.person_id)
        self.assertTrue(
            VisitorFollowUpCase.objects.filter(
                prospect=prospect,
                case_status=VisitorFollowUpCase.CaseStatus.OPEN,
            ).exists()
        )

    def test_close_on_active_enrollment_and_cancel_tasks(self):
        prospect = self._invite_prospect()
        from apps.evangelism.services import mark_prospect_attended

        mark_prospect_attended(prospect, activity_date=church_today_safe())
        prospect.refresh_from_db()
        case = VisitorFollowUpCase.objects.get(prospect=prospect)
        self.assertEqual(case.case_status, VisitorFollowUpCase.CaseStatus.OPEN)

        task = FollowUpTask.objects.create(
            prospect=prospect,
            case=case,
            assigned_to=self.inviter,
            task_type=FollowUpTask.TaskType.PHONE_CALL,
            due_date=church_today_safe() + timedelta(days=2),
            status=FollowUpTask.Status.PENDING,
        )
        ensure_lesson_enrollment(
            prospect.person,
            self.teacher,
            assigned_by=self.admin,
        )
        case.refresh_from_db()
        task.refresh_from_db()
        self.assertEqual(case.case_status, VisitorFollowUpCase.CaseStatus.CLOSED)
        self.assertEqual(case.closed_reason, VisitorFollowUpCase.ClosedReason.ENROLLED)
        self.assertEqual(task.status, FollowUpTask.Status.CANCELLED)

    def test_reopen_when_enrollment_inactive(self):
        prospect = self._invite_prospect()
        from apps.evangelism.services import mark_prospect_attended

        mark_prospect_attended(prospect, activity_date=church_today_safe())
        ensure_lesson_enrollment(
            prospect.person,
            self.teacher,
            assigned_by=self.admin,
        )
        case = VisitorFollowUpCase.objects.get(prospect=prospect)
        self.assertEqual(case.case_status, VisitorFollowUpCase.CaseStatus.CLOSED)

        stop_remaining_lessons(prospect.person)
        case.refresh_from_db()
        self.assertEqual(case.case_status, VisitorFollowUpCase.CaseStatus.OPEN)
        enrollment = LessonStudentEnrollment.objects.get(student=prospect.person)
        self.assertFalse(enrollment.is_active)

    def test_touch_activity_clears_needs_attention_window(self):
        old = church_today_safe() - timedelta(days=20)
        prospect = self._invite_prospect(
            last_activity_date=old,
            date_first_invited=old,
        )
        case = VisitorFollowUpCase.objects.get(prospect=prospect)
        self.client.force_authenticate(self.inviter)
        response = self.client.get(CASES_URL, {"needs_attention": "1", "scope": "mine"})
        self.assertEqual(response.status_code, 200)
        ids = [row["id"] for row in response.data["results"]]
        self.assertIn(case.id, ids)

        touch_prospect_activity(prospect, church_today_safe())
        response = self.client.get(CASES_URL, {"needs_attention": "1", "scope": "mine"})
        ids = [row["id"] for row in response.data["results"]]
        self.assertNotIn(case.id, ids)

    def test_other_task_requires_custom_label(self):
        prospect = self._invite_prospect()
        self.client.force_authenticate(self.inviter)
        response = self.client.post(
            TASKS_URL,
            {
                "prospect_id": prospect.id,
                "task_type": "OTHER",
                "due_date": str(church_today_safe() + timedelta(days=1)),
                "status": "PENDING",
                "priority": "MEDIUM",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 400)
        details = response.data.get("details") or response.data
        self.assertIn("custom_label", details)

        response = self.client.post(
            TASKS_URL,
            {
                "prospect_id": prospect.id,
                "task_type": "OTHER",
                "custom_label": "Send grocery invite",
                "due_date": str(church_today_safe() + timedelta(days=1)),
                "status": "PENDING",
                "priority": "MEDIUM",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["custom_label"], "Send grocery invite")

    def test_member_sees_only_own_cases(self):
        own = self._invite_prospect(first_name="Own", last_name="Guest")
        other_prospect = Prospect.objects.create(
            first_name="Not",
            last_name="Mine",
            invited_by=self.other,
            pipeline_stage=Prospect.PipelineStage.INVITED,
            date_first_invited=church_today_safe(),
            last_activity_date=church_today_safe(),
        )
        ensure_visitor_follow_up_case(other_prospect)

        self.assertEqual(self.inviter.role, "MEMBER")
        self.client.force_authenticate(user=self.inviter)
        # Admin can list (sanity); then member scope.
        self.client.force_authenticate(user=self.admin)
        admin_ok = self.client.get(CASES_URL, {"scope": "branch"})
        self.assertEqual(admin_ok.status_code, 200, admin_ok.data)
        self.client.force_authenticate(user=self.inviter)
        response = self.client.get(CASES_URL, {"scope": "mine"})
        self.assertEqual(response.status_code, 200, response.data)
        ids = {row["prospect"]["id"] for row in response.data["results"]}
        self.assertIn(own.id, ids)
        self.assertNotIn(other_prospect.id, ids)

        other_case = VisitorFollowUpCase.objects.get(prospect=other_prospect)
        denied = self.client.patch(
            f"{CASES_URL}{other_case.id}/",
            {"remarks": "nope"},
            format="json",
        )
        self.assertEqual(denied.status_code, 404)

    def test_drop_off_closes_case(self):
        prospect = self._invite_prospect()
        self.client.force_authenticate(self.admin)
        response = self.client.post(
            f"/api/evangelism/prospects/{prospect.id}/mark_dropped_off/",
            {"reason": "NO_CONTACT"},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        case = VisitorFollowUpCase.objects.get(prospect=prospect)
        self.assertEqual(case.case_status, VisitorFollowUpCase.CaseStatus.CLOSED)
        self.assertEqual(
            case.closed_reason, VisitorFollowUpCase.ClosedReason.DROPPED_OFF
        )

    def test_encoded_visitor_person_without_prospect_appears_on_my_visitors(self):
        """Person.inviter VISITOR with no Prospect still gets a case on list."""
        visitor = Person.objects.create_user(
            username="encoded_vfu_visitor",
            password="pass12345",
            first_name="Encoded",
            last_name="Visitor",
            role="VISITOR",
            status="ONGOING",
            inviter=self.inviter,
            date_first_attended=church_today_safe(),
            branch=self.branch,
        )
        self.assertFalse(Prospect.objects.filter(person=visitor).exists())

        self.client.force_authenticate(user=self.inviter)
        response = self.client.get(CASES_URL, {"scope": "mine"})
        self.assertEqual(response.status_code, 200, response.data)
        nested_ids = []
        for row in response.data["results"]:
            person = row["prospect"].get("person")
            if isinstance(person, dict):
                nested_ids.append(person.get("id"))
            elif person is not None:
                nested_ids.append(person)
        self.assertTrue(
            Prospect.objects.filter(person=visitor, invited_by=self.inviter).exists()
        )
        self.assertTrue(
            VisitorFollowUpCase.objects.filter(
                prospect__person=visitor,
                case_status=VisitorFollowUpCase.CaseStatus.OPEN,
            ).exists()
        )
        self.assertIn(visitor.id, nested_ids)

    def test_setting_person_inviter_opens_my_visitors_case_immediately(self):
        """Changing Person.inviter on a VISITOR opens a case without waiting for list."""
        from apps.evangelism.visitor_follow_up import (
            sync_visitor_follow_up_after_person_inviter_change,
        )

        visitor = Person.objects.create_user(
            username="inviter_change_vfu",
            password="pass12345",
            first_name="Soon",
            last_name="Invited",
            role="VISITOR",
            status="ONGOING",
            inviter=None,
            date_first_attended=church_today_safe(),
            branch=self.branch,
        )
        self.assertFalse(Prospect.objects.filter(person=visitor).exists())

        visitor.inviter = self.inviter
        visitor.save(update_fields=["inviter"])
        case = sync_visitor_follow_up_after_person_inviter_change(
            visitor, previous_inviter_id=None, updated_by=self.inviter
        )
        self.assertIsNotNone(case)
        self.assertEqual(case.case_status, VisitorFollowUpCase.CaseStatus.OPEN)
        self.assertEqual(case.assigned_to_id, self.inviter.id)
        self.assertTrue(
            Prospect.objects.filter(person=visitor, invited_by=self.inviter).exists()
        )

    def test_setting_member_inviter_does_not_open_my_visitors_case(self):
        from apps.evangelism.visitor_follow_up import (
            sync_visitor_follow_up_after_person_inviter_change,
        )

        member = Person.objects.create_user(
            username="member_inviter_vfu",
            password="pass12345",
            first_name="Already",
            last_name="Member",
            role="MEMBER",
            status="SEMIACTIVE",
            water_baptism_date=date(2020, 1, 1),
            inviter=None,
            branch=self.branch,
        )
        member.inviter = self.inviter
        member.save(update_fields=["inviter"])
        case = sync_visitor_follow_up_after_person_inviter_change(
            member, previous_inviter_id=None, updated_by=self.inviter
        )
        self.assertIsNone(case)
        self.assertFalse(Prospect.objects.filter(person=member).exists())

    def test_ensure_closes_case_when_linked_person_is_member(self):
        visitor = Person.objects.create_user(
            username="promo_vfu_visitor",
            password="pass12345",
            first_name="Promo",
            last_name="Visitor",
            role="VISITOR",
            status="ONGOING",
            inviter=self.inviter,
            branch=self.branch,
        )
        prospect = self._invite_prospect(
            first_name="Promo",
            last_name="Visitor",
            person=visitor,
        )
        case = VisitorFollowUpCase.objects.get(prospect=prospect)
        self.assertEqual(case.case_status, VisitorFollowUpCase.CaseStatus.OPEN)

        visitor.role = "MEMBER"
        visitor.status = "ACTIVE"
        visitor.water_baptism_date = date(2020, 1, 1)
        visitor.save(update_fields=["role", "status", "water_baptism_date"])

        result = ensure_visitor_follow_up_case(prospect)
        self.assertIsNone(result)
        case.refresh_from_db()
        self.assertEqual(case.case_status, VisitorFollowUpCase.CaseStatus.CLOSED)
        self.assertEqual(case.closed_reason, VisitorFollowUpCase.ClosedReason.MANUAL)

        self.client.force_authenticate(user=self.inviter)
        response = self.client.get(CASES_URL, {"scope": "mine"})
        self.assertEqual(response.status_code, 200, response.data)
        ids = [row["id"] for row in response.data["results"]]
        self.assertNotIn(case.id, ids)

    def test_affiliations_include_sibling_prospect_evangelism_groups(self):
        from apps.evangelism.models import EvangelismGroup

        visitor = Person.objects.create_user(
            username="sib_vfu_visitor",
            password="pass12345",
            first_name="Sib",
            last_name="Visitor",
            role="VISITOR",
            status="ONGOING",
            inviter=self.inviter,
            date_first_attended=church_today_safe(),
            branch=self.branch,
        )
        group_a = EvangelismGroup.objects.create(
            name="Group Alpha",
            coordinator=self.inviter,
            branch=self.branch,
            approval_status=EvangelismGroup.ApprovalStatus.APPROVED,
            is_active=True,
        )
        group_b = EvangelismGroup.objects.create(
            name="Group Beta",
            coordinator=self.inviter,
            branch=self.branch,
            approval_status=EvangelismGroup.ApprovalStatus.APPROVED,
            is_active=True,
        )
        first = Prospect.objects.create(
            first_name="Sib",
            last_name="Visitor",
            invited_by=self.inviter,
            person=visitor,
            evangelism_group=group_a,
            pipeline_stage=Prospect.PipelineStage.ATTENDED,
            date_first_invited=church_today_safe(),
            last_activity_date=church_today_safe(),
        )
        ensure_visitor_follow_up_case(first)
        Prospect.objects.create(
            first_name="Sib",
            last_name="Visitor",
            invited_by=self.inviter,
            person=visitor,
            evangelism_group=group_b,
            pipeline_stage=Prospect.PipelineStage.ATTENDED,
            date_first_invited=church_today_safe(),
            last_activity_date=church_today_safe(),
        )

        self.client.force_authenticate(user=self.inviter)
        response = self.client.get(CASES_URL, {"scope": "mine"})
        self.assertEqual(response.status_code, 200, response.data)
        summary = self.client.get(f"{CASES_URL}summary/", {"scope": "mine"})
        self.assertEqual(summary.status_code, 200, summary.data)
        person_rows = [
            row
            for row in response.data["results"]
            if (row.get("prospect") or {}).get("first_name") == "Sib"
        ]
        self.assertEqual(len(person_rows), 1)
        names = {
            g.get("name") for g in person_rows[0]["affiliations"]["evangelism_groups"]
        }
        self.assertIn("Group Alpha", names)
        self.assertIn("Group Beta", names)
        self.assertEqual(summary.data["open_caseload"], response.data["count"])

    def test_my_visitors_dedupes_cases_for_same_person(self):
        from apps.evangelism.models import EvangelismGroup

        visitor = Person.objects.create_user(
            username="dup_vfu_visitor",
            password="pass12345",
            first_name="Dup",
            last_name="Visitor",
            role="VISITOR",
            status="ONGOING",
            inviter=self.inviter,
            date_first_attended=church_today_safe(),
            branch=self.branch,
        )
        first = Prospect.objects.create(
            first_name="Dup",
            last_name="Visitor",
            invited_by=self.inviter,
            person=visitor,
            pipeline_stage=Prospect.PipelineStage.ATTENDED,
            date_first_invited=church_today_safe(),
            last_activity_date=church_today_safe(),
        )
        ensure_visitor_follow_up_case(first)
        group = EvangelismGroup.objects.create(
            name="Dup Group",
            coordinator=self.inviter,
            branch=self.branch,
            approval_status=EvangelismGroup.ApprovalStatus.APPROVED,
            is_active=True,
        )
        second = Prospect.objects.create(
            first_name="Dup",
            last_name="Visitor",
            invited_by=self.inviter,
            person=visitor,
            evangelism_group=group,
            pipeline_stage=Prospect.PipelineStage.ATTENDED,
            date_first_invited=church_today_safe(),
            last_activity_date=church_today_safe(),
        )
        # Adding another group prospect must not open a second My visitors case.
        reused = ensure_visitor_follow_up_case(second)
        self.assertEqual(
            VisitorFollowUpCase.objects.filter(prospect__person=visitor).count(),
            1,
        )
        self.assertEqual(reused.prospect_id, first.id)

        # Legacy duplicate cases (if present) still collapse in the list.
        VisitorFollowUpCase.objects.create(
            prospect=second,
            assigned_to=self.inviter,
            case_status=VisitorFollowUpCase.CaseStatus.OPEN,
        )
        self.assertEqual(
            VisitorFollowUpCase.objects.filter(prospect__person=visitor).count(),
            2,
        )

        self.client.force_authenticate(user=self.inviter)
        response = self.client.get(CASES_URL, {"scope": "mine"})
        self.assertEqual(response.status_code, 200, response.data)
        person_rows = [
            row
            for row in response.data["results"]
            if (row.get("prospect") or {}).get("person")
            and (
                row["prospect"]["person"].get("id")
                if isinstance(row["prospect"]["person"], dict)
                else row["prospect"]["person"]
            )
            == visitor.id
        ]
        self.assertEqual(len(person_rows), 1)
        self.assertEqual(person_rows[0]["prospect"]["id"], second.id)
        summary = self.client.get(f"{CASES_URL}summary/", {"scope": "mine"})
        self.assertEqual(summary.status_code, 200, summary.data)
        self.assertEqual(summary.data["open_caseload"], response.data["count"])

    def test_affiliations_include_person_cluster_and_group_membership(self):
        from apps.clusters.models import Cluster
        from apps.evangelism.models import EvangelismGroup

        visitor = Person.objects.create_user(
            username="affil_vfu_visitor",
            password="pass12345",
            first_name="Affil",
            last_name="Visitor",
            role="VISITOR",
            status="ONGOING",
            inviter=self.inviter,
            date_first_attended=church_today_safe(),
            branch=self.branch,
        )
        cluster = Cluster.objects.create(
            name="East Affil",
            code="EAFF",
            branch=self.branch,
            is_active=True,
        )
        cluster.members.add(visitor)
        group = EvangelismGroup.objects.create(
            name="Hope Group Affil",
            coordinator=self.inviter,
            branch=self.branch,
            approval_status=EvangelismGroup.ApprovalStatus.APPROVED,
            is_active=True,
        )
        group.members.add(visitor)

        self.client.force_authenticate(user=self.inviter)
        response = self.client.get(CASES_URL, {"scope": "mine", "search": "Affil"})
        self.assertEqual(response.status_code, 200, response.data)
        row = next(
            (
                r
                for r in response.data["results"]
                if (r.get("prospect") or {}).get("first_name") == "Affil"
            ),
            None,
        )
        self.assertIsNotNone(row)
        affiliations = row["affiliations"]
        codes = {c.get("code") for c in affiliations["clusters"]}
        group_names = {g.get("name") for g in affiliations["evangelism_groups"]}
        self.assertIn("EAFF", codes)
        self.assertIn("Hope Group Affil", group_names)

    def test_task_create_sets_ongoing_and_complete_returns_open(self):
        prospect = self._invite_prospect()
        case = VisitorFollowUpCase.objects.get(prospect=prospect)
        self.assertEqual(case.case_status, VisitorFollowUpCase.CaseStatus.OPEN)

        self.client.force_authenticate(self.inviter)
        created = self.client.post(
            TASKS_URL,
            {
                "prospect_id": prospect.id,
                "task_type": "PHONE_CALL",
                "due_date": str(church_today_safe() + timedelta(days=1)),
                "status": "PENDING",
                "priority": "MEDIUM",
            },
            format="json",
        )
        self.assertEqual(created.status_code, 201, created.data)
        case.refresh_from_db()
        self.assertEqual(
            case.case_status, VisitorFollowUpCase.CaseStatus.IN_PROGRESS
        )

        done = self.client.post(f"{TASKS_URL}{created.data['id']}/complete/")
        self.assertEqual(done.status_code, 200, done.data)
        case.refresh_from_db()
        self.assertEqual(case.case_status, VisitorFollowUpCase.CaseStatus.OPEN)

    def test_mark_low_priority_resume_and_exclude_from_needs_attention(self):
        old = church_today_safe() - timedelta(days=20)
        prospect = self._invite_prospect(
            last_activity_date=old,
            date_first_invited=old,
        )
        case = VisitorFollowUpCase.objects.get(prospect=prospect)
        self.client.force_authenticate(self.inviter)

        needs = self.client.get(
            CASES_URL, {"needs_attention": "1", "scope": "mine"}
        )
        self.assertIn(case.id, [row["id"] for row in needs.data["results"]])

        paused = self.client.post(
            f"{CASES_URL}{case.id}/mark_low_priority/",
            {"reason": "Asked for space"},
            format="json",
        )
        self.assertEqual(paused.status_code, 200, paused.data)
        self.assertEqual(paused.data["case_status"], "NO_ACTION")
        self.assertEqual(paused.data["remarks"], "Asked for space")
        self.assertFalse(paused.data["needs_attention"])

        needs = self.client.get(
            CASES_URL, {"needs_attention": "1", "scope": "mine"}
        )
        self.assertNotIn(case.id, [row["id"] for row in needs.data["results"]])

        resumed = self.client.post(f"{CASES_URL}{case.id}/resume/")
        self.assertEqual(resumed.status_code, 200, resumed.data)
        self.assertEqual(resumed.data["case_status"], "OPEN")
        self.assertEqual(resumed.data["remarks"], "")

    def test_mark_deceased_closes_case_and_updates_person(self):
        from apps.evangelism.services import mark_prospect_attended
        from apps.people.models import PersonStatusChange

        prospect = self._invite_prospect()
        mark_prospect_attended(prospect, activity_date=church_today_safe())
        prospect.refresh_from_db()
        person = prospect.person
        self.assertIsNotNone(person)
        self.assertNotEqual(person.status, "DECEASED")

        case = VisitorFollowUpCase.objects.get(prospect=prospect)
        self.client.force_authenticate(self.inviter)
        response = self.client.post(f"{CASES_URL}{case.id}/mark_deceased/")
        self.assertEqual(response.status_code, 200, response.data)
        case.refresh_from_db()
        person.refresh_from_db()
        self.assertEqual(case.case_status, VisitorFollowUpCase.CaseStatus.CLOSED)
        self.assertEqual(
            case.closed_reason, VisitorFollowUpCase.ClosedReason.DECEASED
        )
        self.assertEqual(person.status, "DECEASED")
        self.assertTrue(
            PersonStatusChange.objects.filter(
                person=person, to_status="DECEASED"
            ).exists()
        )

        # Ensure must not reopen deceased cases
        ensure_visitor_follow_up_case(prospect)
        case.refresh_from_db()
        self.assertEqual(case.case_status, VisitorFollowUpCase.CaseStatus.CLOSED)


def church_today_safe():
    from core.datetime_utils import church_today

    return church_today()
