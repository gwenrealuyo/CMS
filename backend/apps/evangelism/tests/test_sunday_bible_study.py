from datetime import date

from rest_framework.test import APITestCase

from apps.evangelism.models import (
    EvangelismGroup,
    EvangelismWeeklyReport,
    Prospect,
    SundayBibleStudyReport,
    SundayBibleStudyVisitor,
)
from apps.ministries.bible_sharers import ensure_bible_sharers_ministry
from apps.ministries.models import MinistryMember
from apps.people.models import Branch, Journey, Person

URL = "/api/evangelism/sunday-bible-studies/"
SUNDAY = "2026-10-18"


class SundayBibleStudyReportTests(APITestCase):
    def setUp(self):
        self.branch = Branch.objects.create(
            name="Headquarters",
            code="HQ-SBS",
            is_headquarters=True,
            is_active=True,
        )
        self.other_branch = Branch.objects.create(
            name="East Campus",
            code="EAST-SBS",
            is_active=True,
        )
        self.admin = Person.objects.create_user(
            username="sbsadmin",
            password="pass12345",
            first_name="Ada",
            last_name="Admin",
            role="ADMIN",
            status="ACTIVE",
            branch=self.branch,
        )
        self.member = self._member("sbsmember", "Mia", "Member")
        self.other_member = self._member("sbsmember2", "Owen", "Member")
        self.sharer = self._member("sbssharer", "Sara", "Sharer")
        self.other_sharer = self._member("sbssharer2", "Seth", "Sharer")
        self.viewer = self._member("sbsviewer", "Vera", "Viewer")
        self.outsider = self._member("sbsoutsider", "Otto", "Outsider")
        self.ministry = ensure_bible_sharers_ministry()
        for person in (self.sharer, self.other_sharer, self.viewer):
            MinistryMember.objects.create(ministry=self.ministry, member=person)
        self.group = EvangelismGroup.objects.create(
            name="North Circle",
            branch=self.branch,
            coordinator=self.member,
            is_active=True,
        )
        self.other_group = EvangelismGroup.objects.create(
            name="South Circle",
            branch=self.branch,
            coordinator=self.other_member,
            is_active=True,
        )
        self.group.members.add(self.member, self.sharer)
        self.other_group.members.add(self.other_member, self.other_sharer)
        self.client.force_authenticate(self.admin)

    def _member(self, username, first_name, last_name, branch=None):
        return Person.objects.create_user(
            username=username,
            password="pass12345",
            first_name=first_name,
            last_name=last_name,
            role="MEMBER",
            status="ACTIVE",
            water_baptism_date=date(2020, 1, 1),
            branch=branch or self.branch,
        )

    def _payload(self, **overrides):
        data = {
            "session_date": SUNDAY,
            "session_type": "BEFORE_SERVICE",
            "gathering_type": "PHYSICAL",
            "topic": "Godhead",
            "scripture_reference": "John 1:1",
            "study_summary": "Introduced Jesus and listened to their questions.",
            "observation": "The visitors were comfortable during worship.",
            "facilitators": [{"person_id": self.sharer.id, "is_lead": True}],
            "members_attended": [self.member.id],
        }
        data.update(overrides)
        return data

    def test_create_uses_submitter_branch_without_evangelism_group(self):
        response = self.client.post(URL, self._payload(), format="json")
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data["branch"], self.branch.id)
        self.assertEqual(response.data["branch_name"], self.branch.name)
        self.assertNotIn("evangelism_group_id", response.data)
        self.assertNotIn("progress", response.data)
        report = SundayBibleStudyReport.objects.get(pk=response.data["id"])
        self.assertEqual(report.branch_id, self.branch.id)

    def test_admin_can_create_for_a_selected_branch(self):
        response = self.client.post(
            URL,
            self._payload(branch_id=self.other_branch.id, members_attended=[]),
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data["branch"], self.other_branch.id)

    def test_admin_without_branch_must_select_one(self):
        self.admin.branch = None
        self.admin.save(update_fields=["branch"])
        response = self.client.post(URL, self._payload(), format="json")
        self.assertEqual(response.status_code, 400, response.data)

        with_branch = self.client.post(
            URL,
            self._payload(branch_id=self.other_branch.id, members_attended=[]),
            format="json",
        )
        self.assertEqual(with_branch.status_code, 201, with_branch.data)
        self.assertEqual(with_branch.data["branch"], self.other_branch.id)

    def test_non_admin_branch_id_is_ignored(self):
        self.client.force_authenticate(self.sharer)
        response = self.client.post(
            URL,
            self._payload(branch_id=self.other_branch.id, members_attended=[]),
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data["branch"], self.branch.id)

    def test_many_circles_on_the_same_sunday(self):
        first = self.client.post(URL, self._payload(), format="json")
        self.assertEqual(first.status_code, 201, first.data)
        second = self.client.post(
            URL,
            self._payload(
                facilitators=[{"person_id": self.other_sharer.id, "is_lead": True}],
                members_attended=[self.other_member.id],
                topic="Gospel of Salvation",
            ),
            format="json",
        )
        self.assertEqual(second.status_code, 201, second.data)
        third = self.client.post(
            URL,
            self._payload(
                facilitators=[{"person_id": self.other_sharer.id, "is_lead": False}],
                topic="A second circle",
                members_attended=[],
            ),
            format="json",
        )
        self.assertEqual(third.status_code, 201, third.data)
        self.assertEqual(
            SundayBibleStudyReport.objects.filter(session_date=SUNDAY).count(),
            3,
        )
        self.assertEqual(first.data["facilitator_warnings"], [])

    def test_before_and_after_for_the_same_facilitator_has_no_warning(self):
        before = self.client.post(URL, self._payload(), format="json")
        after = self.client.post(
            URL,
            self._payload(session_type="AFTER_SERVICE", topic="After service study"),
            format="json",
        )
        self.assertEqual(before.status_code, 201, before.data)
        self.assertEqual(after.status_code, 201, after.data)
        self.assertEqual(after.data["facilitator_warnings"], [])

    def test_second_before_warns_and_still_saves(self):
        self.client.post(URL, self._payload(), format="json")
        again = self.client.post(
            URL,
            self._payload(
                members_attended=[self.other_member.id],
                topic="Another before service",
            ),
            format="json",
        )
        self.assertEqual(again.status_code, 201, again.data)
        self.assertTrue(again.data["facilitator_warnings"])
        self.assertIn("Before Service", again.data["facilitator_warnings"][0])
        self.assertIn("Sara Sharer", again.data["facilitator_warnings"][0])
        self.assertNotIn("North Circle", again.data["facilitator_warnings"][0])

    def test_second_after_warns_and_cancelled_report_does_not(self):
        self.client.post(
            URL,
            self._payload(session_type="AFTER_SERVICE"),
            format="json",
        )
        cancelled = self.client.post(
            URL,
            {
                "session_date": SUNDAY,
                "session_type": "AFTER_SERVICE",
                "cancelled": True,
                "cancellation_reason": "Typhoon",
                "facilitators": [{"person_id": self.sharer.id}],
            },
            format="json",
        )
        self.assertEqual(cancelled.status_code, 201, cancelled.data)
        self.assertEqual(cancelled.data["facilitator_warnings"], [])
        self.assertEqual(cancelled.data["visitor_details"], [])

        active = self.client.post(
            URL,
            self._payload(
                session_type="AFTER_SERVICE",
                members_attended=[self.other_member.id],
                topic="Held after all",
            ),
            format="json",
        )
        self.assertEqual(active.status_code, 201, active.data)
        self.assertTrue(active.data["facilitator_warnings"])
        self.assertIn("After Service", active.data["facilitator_warnings"][0])

    def test_editing_a_report_does_not_warn_about_itself(self):
        created = self.client.post(URL, self._payload(), format="json")
        updated = self.client.patch(
            f"{URL}{created.data['id']}/",
            {"topic": "Godhead, continued"},
            format="json",
        )
        self.assertEqual(updated.status_code, 200, updated.data)
        self.assertEqual(updated.data["facilitator_warnings"], [])
        self.assertEqual(updated.data["topic"], "Godhead, continued")

    def test_new_guest_becomes_a_visitor_with_a_journey_note(self):
        response = self.client.post(
            URL,
            self._payload(
                members_attended=[self.member.id],
                new_visitors=[
                    {
                        "first_name": "Juan",
                        "last_name": "Dela Cruz",
                        "inviter_id": self.member.id,
                        "attendance_kind": "FIRST_TIME",
                        "progress": "FOR_FOLLOW_UP",
                        "note": "Came from a trinitarian church.",
                    }
                ],
            ),
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data["first_time_count"], 1)
        self.assertEqual(response.data["total_attendance"], 2)
        visitor = Person.objects.get(first_name="Juan", last_name="Dela Cruz")
        self.assertEqual(visitor.role, "VISITOR")
        self.assertEqual(visitor.status, "ONGOING")
        self.assertEqual(visitor.date_first_attended, date(2026, 10, 18))
        self.assertEqual(visitor.first_activity_attended_id, "SUNDAY_SERVICE")
        self.assertEqual(visitor.inviter_id, self.member.id)
        self.assertEqual(visitor.branch_id, self.branch.id)
        row = response.data["visitor_details"][0]
        self.assertEqual(row["person_id"], visitor.id)
        self.assertEqual(row["date_attended"], SUNDAY)
        self.assertEqual(row["progress"], "FOR_FOLLOW_UP")
        journeys = Journey.objects.filter(
            user=visitor, type="NOTE", title="Sunday Bible Study"
        )
        self.assertEqual(journeys.count(), 1)
        journey = journeys.get()
        self.assertEqual(journey.description, "Came from a trinitarian church.")
        self.assertEqual(journey.date, date(2026, 10, 18))

        edited = self.client.patch(
            f"{URL}{response.data['id']}/",
            {
                "visitors": [
                    {
                        "person_id": visitor.id,
                        "attendance_kind": "FIRST_TIME",
                        "progress": "ATTENDS_CLUSTERING",
                        "note": "Asked to study again next week.",
                        "inviter_id": self.other_member.id,
                    }
                ]
            },
            format="json",
        )
        self.assertEqual(edited.status_code, 200, edited.data)
        visitor.refresh_from_db()
        self.assertEqual(visitor.inviter_id, self.other_member.id)
        journeys = Journey.objects.filter(user=visitor, title="Sunday Bible Study")
        self.assertEqual(journeys.count(), 1)
        self.assertEqual(
            journeys.get().description, "Asked to study again next week."
        )
        visit_row = SundayBibleStudyVisitor.objects.get(person=visitor)
        self.assertEqual(visit_row.progress, "ATTENDS_CLUSTERING")
        self.assertEqual(visit_row.journey_id, journeys.get().id)

    def test_prospect_linked_new_visitor_creates_person_on_branch(self):
        prospect = Prospect.objects.create(
            first_name="Pat",
            last_name="Prospect",
            invited_by=self.member,
            pipeline_stage=Prospect.PipelineStage.INVITED,
        )
        response = self.client.post(
            URL,
            self._payload(
                members_attended=[],
                new_visitors=[
                    {
                        "prospect_id": prospect.id,
                        "attendance_kind": "FIRST_TIME",
                        "progress": "ENDORSED_NCC",
                        "note": "Ready for NCC.",
                    }
                ],
            ),
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.data)
        prospect.refresh_from_db()
        self.assertIsNotNone(prospect.person_id)
        person = prospect.person
        self.assertEqual(person.role, "VISITOR")
        self.assertEqual(person.branch_id, self.branch.id)
        self.assertEqual(person.first_name, "Pat")
        self.assertEqual(
            response.data["visitor_details"][0]["progress"], "ENDORSED_NCC"
        )
        self.assertEqual(
            SundayBibleStudyVisitor.objects.get(person=person).progress,
            "ENDORSED_NCC",
        )

    def test_returning_prospect_uses_date_first_attended_and_activity(self):
        prospect = Prospect.objects.create(
            first_name="Riley",
            last_name="Return",
            invited_by=self.member,
            pipeline_stage=Prospect.PipelineStage.INVITED,
        )
        response = self.client.post(
            URL,
            self._payload(
                members_attended=[],
                new_visitors=[
                    {
                        "prospect_id": prospect.id,
                        "attendance_kind": "RETURNING",
                        "date_first_attended": "2026-09-07",
                        "first_activity_attended": "CLUSTERING",
                        "progress": "FOR_FOLLOW_UP",
                    }
                ],
            ),
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.data)
        prospect.refresh_from_db()
        self.assertIsNotNone(prospect.person_id)
        person = prospect.person
        self.assertEqual(person.date_first_attended, date(2026, 9, 7))
        self.assertEqual(person.first_activity_attended_id, "CLUSTERING")
        self.assertEqual(
            SundayBibleStudyVisitor.objects.get(person=person).attendance_kind,
            "RETURNING",
        )

    def test_returning_visitor_fills_missing_first_attendance(self):
        visitor = Person.objects.create_user(
            username="sbsnovisitor",
            password="pass12345",
            first_name="Nora",
            last_name="NoDates",
            role="VISITOR",
            status="ONGOING",
            branch=self.branch,
        )
        self.assertIsNone(visitor.date_first_attended)
        self.assertIsNone(visitor.first_activity_attended_id)
        response = self.client.post(
            URL,
            self._payload(
                members_attended=[],
                visitors=[
                    {
                        "person_id": visitor.id,
                        "attendance_kind": "RETURNING",
                        "date_first_attended": "2026-08-10",
                        "first_activity_attended": "SUNDAY_SERVICE",
                    }
                ],
            ),
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.data)
        visitor.refresh_from_db()
        self.assertEqual(visitor.date_first_attended, date(2026, 8, 10))
        self.assertEqual(visitor.first_activity_attended_id, "SUNDAY_SERVICE")

    def test_member_from_other_branch_is_rejected(self):
        foreign = self._member(
            "sbsforeign", "Fran", "Foreign", branch=self.other_branch
        )
        response = self.client.post(
            URL,
            self._payload(members_attended=[foreign.id]),
            format="json",
        )
        self.assertEqual(response.status_code, 400, response.data)

    def test_visitor_from_other_branch_is_rejected(self):
        foreign_visitor = Person.objects.create_user(
            username="sbsforeignguest",
            password="pass12345",
            first_name="Gina",
            last_name="Guest",
            role="VISITOR",
            status="ONGOING",
            branch=self.other_branch,
        )
        response = self.client.post(
            URL,
            self._payload(
                visitors=[
                    {
                        "person_id": foreign_visitor.id,
                        "attendance_kind": "FIRST_TIME",
                        "progress": "NO_FURTHER_ACTION",
                    }
                ]
            ),
            format="json",
        )
        self.assertEqual(response.status_code, 400, response.data)

    def test_existing_visitor_is_linked_instead_of_duplicated(self):
        existing = Person.objects.create_user(
            username="sbsguest",
            password="pass12345",
            first_name="Ana",
            last_name="Guest",
            role="VISITOR",
            status="ONGOING",
            branch=self.branch,
            inviter=self.member,
        )
        before = Person.objects.filter(role="VISITOR").count()
        response = self.client.post(
            URL,
            self._payload(
                visitors=[
                    {
                        "person_id": existing.id,
                        "attendance_kind": "RETURNING",
                        "progress": "ENDORSED_BIBLE_STUDY",
                        "note": "Second Sunday.",
                    }
                ]
            ),
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(Person.objects.filter(role="VISITOR").count(), before)
        self.assertEqual(response.data["returning_count"], 1)
        self.assertEqual(
            response.data["visitor_details"][0]["progress"],
            "ENDORSED_BIBLE_STUDY",
        )

    def test_same_person_cannot_be_listed_twice(self):
        visitor = Person.objects.create_user(
            username="sbsonce",
            password="pass12345",
            first_name="Liza",
            last_name="Once",
            role="VISITOR",
            status="ONGOING",
            branch=self.branch,
        )
        duplicate = self.client.post(
            URL,
            self._payload(
                visitors=[
                    {
                        "person_id": visitor.id,
                        "attendance_kind": "FIRST_TIME",
                    },
                    {
                        "person_id": visitor.id,
                        "attendance_kind": "RETURNING",
                    },
                ]
            ),
            format="json",
        )
        self.assertEqual(duplicate.status_code, 400, duplicate.data)

    def test_cancelled_report_requires_a_reason_and_skips_attendance(self):
        missing = self.client.post(
            URL,
            {
                "session_date": SUNDAY,
                "session_type": "BEFORE_SERVICE",
                "cancelled": True,
            },
            format="json",
        )
        self.assertEqual(missing.status_code, 400, missing.data)

        saved = self.client.post(
            URL,
            {
                "session_date": SUNDAY,
                "session_type": "BEFORE_SERVICE",
                "cancelled": True,
                "cancellation_reason": "Facilitator was ill",
                "new_visitors": [
                    {"first_name": "Should", "last_name": "Notexist"}
                ],
            },
            format="json",
        )
        self.assertEqual(saved.status_code, 201, saved.data)
        self.assertFalse(
            Person.objects.filter(first_name="Should", last_name="Notexist").exists()
        )
        self.assertEqual(saved.data["total_attendance"], 0)
        weekday = self.client.post(
            URL,
            self._payload(session_date="2026-10-24"),
            format="json",
        )
        self.assertEqual(weekday.status_code, 400, weekday.data)

    def test_summary_separates_session_totals_from_unique_people(self):
        self.client.post(URL, self._payload(), format="json")
        self.client.post(
            URL,
            self._payload(
                session_type="AFTER_SERVICE",
                topic="After",
                members_attended=[self.member.id],
            ),
            format="json",
        )
        self.client.post(
            URL,
            {
                "session_date": SUNDAY,
                "session_type": "BEFORE_SERVICE",
                "cancelled": True,
                "cancellation_reason": "No visitors came",
            },
            format="json",
        )
        summary = self.client.get(f"{URL}summary/", {"session_date": SUNDAY})
        self.assertEqual(summary.status_code, 200, summary.data)
        self.assertEqual(summary.data["report_count"], 3)
        self.assertEqual(summary.data["cancelled_count"], 1)
        self.assertEqual(summary.data["member_attendance"], 2)
        self.assertEqual(summary.data["unique_people"], 1)
        self.assertEqual(
            summary.data["by_session_type"]["BEFORE_SERVICE"]["cancelled_count"],
            1,
        )

    def test_prayer_requests_and_notes_are_hidden_from_other_bible_sharers(self):
        created = self.client.post(
            URL,
            self._payload(
                prayer_requests="Pray for healing.",
                notes="Pastoral follow-up.",
                testimonies="Shared during praise.",
            ),
            format="json",
        )
        self.assertEqual(created.status_code, 201, created.data)
        self.assertEqual(created.data["prayer_requests"], "Pray for healing.")

        self.client.force_authenticate(self.viewer)
        hidden = self.client.get(f"{URL}{created.data['id']}/")
        self.assertEqual(hidden.status_code, 200, hidden.data)
        self.assertNotIn("prayer_requests", hidden.data)
        self.assertNotIn("notes", hidden.data)
        self.assertEqual(hidden.data["testimonies"], "Shared during praise.")

        self.client.force_authenticate(self.sharer)
        visible = self.client.get(f"{URL}{created.data['id']}/")
        self.assertEqual(visible.data["prayer_requests"], "Pray for healing.")
        self.assertEqual(visible.data["notes"], "Pastoral follow-up.")

    def test_outsider_cannot_list_reports(self):
        self.client.force_authenticate(self.outsider)
        response = self.client.get(URL)
        self.assertEqual(response.status_code, 403, response.data)

    def test_only_active_bible_sharers_can_be_newly_assigned(self):
        response = self.client.post(
            URL,
            self._payload(facilitators=[{"person_id": self.member.id, "is_lead": True}]),
            format="json",
        )
        self.assertEqual(response.status_code, 400, response.data)

        created = self.client.post(URL, self._payload(), format="json")
        membership = MinistryMember.objects.get(
            ministry=self.ministry, member=self.sharer
        )
        membership.is_active = False
        membership.save()
        kept = self.client.patch(
            f"{URL}{created.data['id']}/",
            {"facilitators": [{"person_id": self.sharer.id, "is_lead": True}]},
            format="json",
        )
        self.assertEqual(kept.status_code, 200, kept.data)

    def test_roster_designation_keeps_evangelism_group_membership(self):
        self.group.members.add(self.outsider)
        response = self.client.post(
            "/api/ministries/members/",
            {
                "ministry": self.ministry.id,
                "member_id": self.outsider.id,
                "role": "team_member",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.data)
        self.assertIn("North Circle", response.data["evangelism_group_names"])
        self.assertIn(self.outsider, self.group.members.all())

    def test_facilitator_snapshot_is_not_rewritten_when_groups_change(self):
        created = self.client.post(URL, self._payload(), format="json")
        self.assertEqual(
            created.data["facilitator_details"][0]["evangelism_group_names"],
            ["North Circle"],
        )
        self.group.members.remove(self.sharer)
        self.other_group.members.add(self.sharer)
        again = self.client.get(f"{URL}{created.data['id']}/")
        self.assertEqual(
            again.data["facilitator_details"][0]["evangelism_group_names"],
            ["North Circle"],
        )

    def test_weekly_evangelism_report_still_saves_prospects_invited(self):
        prospect = Prospect.objects.create(
            first_name="Pete",
            last_name="Prospect",
            invited_by=self.member,
            evangelism_group=self.group,
            pipeline_stage=Prospect.PipelineStage.INVITED,
        )
        response = self.client.post(
            "/api/evangelism/weekly-reports/",
            {
                "evangelism_group_id": self.group.id,
                "meeting_date": "2026-10-21",
                "gathering_type": "PHYSICAL",
                "topic": "Midweek",
                "prospects_invited": [prospect.id],
                "members_attended": [self.member.id],
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.data)
        report = EvangelismWeeklyReport.objects.get(pk=response.data["id"])
        self.assertEqual(
            list(report.prospects_invited.values_list("id", flat=True)),
            [prospect.id],
        )

    def test_week_number_filter_keeps_the_selected_weeks(self):
        first = self.client.post(URL, self._payload(), format="json")
        self.assertEqual(first.status_code, 201, first.data)
        second = self.client.post(
            URL,
            self._payload(session_date="2026-10-11", topic="Earlier Sunday"),
            format="json",
        )
        self.assertEqual(second.status_code, 201, second.data)
        self.assertNotEqual(first.data["week_number"], second.data["week_number"])

        listed = self.client.get(
            URL,
            {
                "year": first.data["year"],
                "week_number": f"{first.data['week_number']},{second.data['week_number']}",
            },
        )
        self.assertEqual(listed.status_code, 200, listed.data)
        self.assertEqual(listed.data["count"], 2)

        one_week = self.client.get(
            URL,
            {"year": first.data["year"], "week_number": str(first.data["week_number"])},
        )
        self.assertEqual(one_week.data["count"], 1)
        self.assertEqual(one_week.data["results"][0]["id"], first.data["id"])
