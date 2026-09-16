from datetime import date, datetime
from unittest.mock import patch
from zoneinfo import ZoneInfo

from rest_framework.test import APITestCase

from apps.attendance.models import AttendanceRecord
from apps.clusters.models import Cluster
from apps.evangelism.models import Prospect
from apps.events.models import AttendanceVenue, Event, EventSetting, EventType
from apps.people.models import Branch, Family, ModuleCoordinator, Person


TODAY = date(2026, 9, 13)  # Sunday
MANILA = ZoneInfo("Asia/Manila")


def manila_dt(year, month, day, hour=9):
    return datetime(year, month, day, hour, 0, 0, tzinfo=MANILA)


class SelfCheckInAPITests(APITestCase):
    def setUp(self):
        self.event_type, _ = EventType.objects.get_or_create(
            code="SUNDAY_SERVICE",
            defaults={
                "label": "Sunday Service",
                "sort_order": 10,
                "color": "#1e40af",
                "is_system": True,
            },
        )
        AttendanceVenue.objects.get_or_create(
            code="HOME_ALTAR",
            defaults={
                "label": "Home altar",
                "sort_order": 10,
                "color": "#0EA5E9",
                "is_active": True,
                "is_system": True,
            },
        )
        AttendanceVenue.objects.get_or_create(
            code="CLUSTER_HOUSE",
            defaults={
                "label": "Cluster house",
                "sort_order": 20,
                "color": "#8B5CF6",
                "is_active": True,
                "is_system": True,
            },
        )
        self.hq = Branch.objects.create(
            name="HQ Self Check-In",
            code="HQSCI",
            is_headquarters=True,
            is_active=True,
        )
        self.other_branch = Branch.objects.create(
            name="Other Branch",
            code="OTHERSCI",
            is_headquarters=False,
            is_active=True,
        )
        self.admin = Person.objects.create_user(
            username="sciadmin",
            password="pass12345",
            first_name="Admin",
            last_name="User",
            role="ADMIN",
            status="ACTIVE",
            branch=self.hq,
        )
        self.member = Person.objects.create_user(
            username="scimember",
            password="pass12345",
            first_name="Mina",
            last_name="Member",
            role="MEMBER",
            status="ACTIVE",
            branch=self.hq,
            member_id="LAMP10001",
        )
        self.spouse = Person.objects.create_user(
            username="scispouse",
            password="pass12345",
            first_name="Sam",
            last_name="Spouse",
            role="MEMBER",
            status="ACTIVE",
            branch=self.hq,
        )
        self.outsider = Person.objects.create_user(
            username="scioutsider",
            password="pass12345",
            first_name="Omar",
            last_name="Outsider",
            role="MEMBER",
            status="ACTIVE",
            branch=self.hq,
        )
        self.deceased = Person.objects.create_user(
            username="scidec",
            password="pass12345",
            first_name="Dee",
            last_name="Ceased",
            role="MEMBER",
            status="DECEASED",
            branch=self.hq,
        )
        self.other_member = Person.objects.create_user(
            username="sciothermember",
            password="pass12345",
            first_name="Ollie",
            last_name="Other",
            role="MEMBER",
            status="ACTIVE",
            branch=self.other_branch,
        )
        self.coordinator = Person.objects.create_user(
            username="scicoord",
            password="pass12345",
            first_name="Eve",
            last_name="Coord",
            role="MEMBER",
            status="ACTIVE",
            branch=self.hq,
        )
        ModuleCoordinator.objects.create(
            person=self.coordinator,
            module=ModuleCoordinator.ModuleType.EVENTS,
            level=ModuleCoordinator.CoordinatorLevel.COORDINATOR,
        )
        self.family = Family.objects.create(name="Member Family", branch=self.hq)
        self.family.members.add(self.member, self.spouse, self.deceased)

        self.event = Event.objects.create(
            title="Sunday Service",
            description="",
            start_date=manila_dt(2026, 9, 13, 9),
            end_date=manila_dt(2026, 9, 13, 11),
            event_type=self.event_type,
            location="Main Hall",
            branch=self.hq,
            is_recurring=True,
            recurrence_pattern={
                "frequency": "weekly",
                "weekdays": [6],
                "through": "2026-12-27",
                "excluded_dates": [],
            },
            created_by=self.coordinator,
        )
        self.other_event = Event.objects.create(
            title="Other Branch Service",
            description="",
            start_date=manila_dt(2026, 9, 13, 9),
            end_date=manila_dt(2026, 9, 13, 11),
            event_type=self.event_type,
            location="Annex",
            branch=self.other_branch,
            is_recurring=False,
            created_by=self.coordinator,
        )
        self.church_today_patch = patch(
            "apps.events.services.self_checkin.church_today",
            return_value=TODAY,
        )
        self.views_today_patch = patch(
            "apps.events.self_checkin_views.church_today",
            return_value=TODAY,
        )
        self.people_utils_today_patch = patch(
            "apps.people.utils.church_today",
            return_value=TODAY,
        )
        self.church_today_patch.start()
        self.views_today_patch.start()
        self.people_utils_today_patch.start()
        self.addCleanup(self.church_today_patch.stop)
        self.addCleanup(self.views_today_patch.stop)
        self.addCleanup(self.people_utils_today_patch.stop)
        EventSetting.get_solo()
        EventSetting.objects.filter(pk=EventSetting.SOLO_PK).update(
            member_self_checkin_enabled=True
        )
        from apps.people.models import PeopleAutomationSetting

        PeopleAutomationSetting.get_solo()
        PeopleAutomationSetting.objects.filter(
            pk=PeopleAutomationSetting.SOLO_PK
        ).update(auto_status_updates_enabled=False)

    def test_unauthenticated_rejected(self):
        response = self.client.get("/api/events/self-check-in/session/")
        self.assertEqual(response.status_code, 401)

    def test_member_self_checkin_hidden_when_setting_off(self):
        EventSetting.objects.filter(pk=EventSetting.SOLO_PK).update(
            member_self_checkin_enabled=False
        )
        self.client.force_authenticate(self.member)
        session = self.client.get("/api/events/self-check-in/session/")
        self.assertEqual(session.status_code, 200, session.data)
        self.assertFalse(session.data["available"])
        self.assertEqual(session.data["reason"], "restricted")
        blocked = self.client.post(
            "/api/events/self-check-in/",
            {"person_ids": [self.member.id], "attendance_venue": "HOME_ALTAR"},
            format="json",
        )
        self.assertEqual(blocked.status_code, 403)

    def test_coordinator_can_use_self_checkin_when_setting_off(self):
        EventSetting.objects.filter(pk=EventSetting.SOLO_PK).update(
            member_self_checkin_enabled=False
        )
        self.client.force_authenticate(self.coordinator)
        session = self.client.get("/api/events/self-check-in/session/")
        self.assertEqual(session.status_code, 200, session.data)
        self.assertTrue(session.data["available"])

    def test_admin_can_toggle_member_self_checkin_setting(self):
        EventSetting.objects.filter(pk=EventSetting.SOLO_PK).update(
            member_self_checkin_enabled=False
        )
        self.client.force_authenticate(self.member)
        forbidden = self.client.get("/api/events/settings/")
        self.assertEqual(forbidden.status_code, 403)
        self.client.force_authenticate(self.admin)
        current = self.client.get("/api/events/settings/")
        self.assertEqual(current.status_code, 200, current.data)
        self.assertFalse(current.data["member_self_checkin_enabled"])
        updated = self.client.patch(
            "/api/events/settings/",
            {"member_self_checkin_enabled": True},
            format="json",
        )
        self.assertEqual(updated.status_code, 200, updated.data)
        self.assertTrue(updated.data["member_self_checkin_enabled"])

    def test_no_service_on_weekday(self):
        with patch(
            "apps.events.services.self_checkin.church_today",
            return_value=date(2026, 9, 14),
        ):
            self.client.force_authenticate(self.member)
            response = self.client.get("/api/events/self-check-in/session/")
        self.assertEqual(response.status_code, 200, response.data)
        self.assertFalse(response.data["available"])
        self.assertEqual(response.data["reason"], "no_service_today")

    def test_member_gets_branch_service(self):
        self.client.force_authenticate(self.member)
        response = self.client.get("/api/events/self-check-in/session/")
        self.assertEqual(response.status_code, 200, response.data)
        self.assertTrue(response.data["available"])
        self.assertFalse(response.data["needs_selection"])
        self.assertEqual(response.data["session"]["event"]["id"], self.event.id)
        self.assertTrue(response.data["can_encode_visitors"])
        household_ids = {row["id"] for row in response.data["session"]["household"]}
        self.assertIn(self.member.id, household_ids)
        self.assertIn(self.spouse.id, household_ids)
        self.assertNotIn(self.deceased.id, household_ids)
        self.assertNotIn(self.outsider.id, household_ids)

    def test_member_cannot_see_other_branch_service(self):
        self.event.delete()
        self.client.force_authenticate(self.member)
        response = self.client.get("/api/events/self-check-in/session/")
        self.assertEqual(response.status_code, 200, response.data)
        self.assertFalse(response.data["available"])

    def test_admin_picks_when_multiple_branches(self):
        self.client.force_authenticate(self.admin)
        response = self.client.get("/api/events/self-check-in/session/")
        self.assertEqual(response.status_code, 200, response.data)
        self.assertTrue(response.data["available"])
        self.assertTrue(response.data["needs_selection"])
        option_ids = {row["event_id"] for row in response.data["options"]}
        self.assertEqual(option_ids, {self.event.id, self.other_event.id})

        chosen = self.client.get(
            f"/api/events/self-check-in/session/?event={self.event.id}"
        )
        self.assertEqual(chosen.status_code, 200, chosen.data)
        self.assertFalse(chosen.data["needs_selection"])
        self.assertEqual(chosen.data["session"]["event"]["id"], self.event.id)

    def test_member_checks_in_household(self):
        self.client.force_authenticate(self.member)
        response = self.client.post(
            "/api/events/self-check-in/",
            {"person_ids": [self.member.id, self.spouse.id], "attendance_venue": "HOME_ALTAR"},
            format="json",
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(
            AttendanceRecord.objects.filter(
                event=self.event, occurrence_date=TODAY
            ).count(),
            2,
        )
        checked = set(response.data["session"]["already_checked_in_ids"])
        self.assertIn(self.member.id, checked)
        self.assertIn(self.spouse.id, checked)

        again = self.client.post(
            "/api/events/self-check-in/",
            {"person_ids": [self.member.id], "attendance_venue": "HOME_ALTAR"},
            format="json",
        )
        self.assertEqual(again.status_code, 409, again.data)
        self.assertEqual(
            AttendanceRecord.objects.filter(
                event=self.event, person=self.member, occurrence_date=TODAY
            ).count(),
            1,
        )

    def test_member_cannot_check_in_non_household(self):
        self.client.force_authenticate(self.member)
        response = self.client.post(
            "/api/events/self-check-in/",
            {"person_ids": [self.outsider.id], "attendance_venue": "HOME_ALTAR"},
            format="json",
        )
        self.assertEqual(response.status_code, 403)
        self.assertFalse(
            AttendanceRecord.objects.filter(
                event=self.event, person=self.outsider
            ).exists()
        )

    def test_plain_member_can_search_visitors(self):
        self.client.force_authenticate(self.member)
        response = self.client.get("/api/events/self-check-in/visitors/?q=sam")
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["results"], [])

    def test_visitor_search_same_branch_visitors_only(self):
        same_branch = Person.objects.create_user(
            username="samevis",
            password="pass12345",
            first_name="Vee",
            last_name="Local",
            role="VISITOR",
            status="ONGOING",
            branch=self.hq,
        )
        other_branch = Person.objects.create_user(
            username="othervis",
            password="pass12345",
            first_name="Vee",
            last_name="Away",
            role="VISITOR",
            status="ONGOING",
            branch=self.other_branch,
        )
        self.client.force_authenticate(self.coordinator)
        response = self.client.get("/api/events/self-check-in/visitors/?q=vee")
        self.assertEqual(response.status_code, 200, response.data)
        ids = {row["id"] for row in response.data["results"]}
        self.assertIn(same_branch.id, ids)
        self.assertNotIn(other_branch.id, ids)
        self.assertNotIn(self.member.id, ids)

        blocked = self.client.post(
            "/api/events/self-check-in/visitors/",
            {"person_id": self.member.id,
            "attendance_venue": "HOME_ALTAR",
        },
            format="json",
        )
        self.assertEqual(blocked.status_code, 404)

    def test_search_includes_invited_prospects_same_branch(self):
        cluster = Cluster.objects.create(
            name="HQ Cluster SCI", code="HQCLSCI", branch=self.hq
        )
        invited = Prospect.objects.create(
            first_name="Pia",
            last_name="Invite",
            invited_by=self.member,
            inviter_cluster=cluster,
            pipeline_stage=Prospect.PipelineStage.INVITED,
        )
        via_inviter_branch = Prospect.objects.create(
            first_name="Pia",
            last_name="InviterOnly",
            invited_by=self.member,
            pipeline_stage=Prospect.PipelineStage.INVITED,
        )
        other_branch = Prospect.objects.create(
            first_name="Pia",
            last_name="Away",
            invited_by=self.other_member,
            pipeline_stage=Prospect.PipelineStage.INVITED,
        )
        dropped = Prospect.objects.create(
            first_name="Pia",
            last_name="Dropped",
            invited_by=self.member,
            inviter_cluster=cluster,
            pipeline_stage=Prospect.PipelineStage.INVITED,
            is_dropped_off=True,
        )
        visitor = Person.objects.create_user(
            username="piagone",
            password="pass12345",
            first_name="Pia",
            last_name="Gone",
            role="VISITOR",
            status="ONGOING",
            branch=self.hq,
        )
        Prospect.objects.create(
            first_name="Pia",
            last_name="Gone",
            invited_by=self.member,
            inviter_cluster=cluster,
            pipeline_stage=Prospect.PipelineStage.ATTENDED,
            person=visitor,
        )
        self.client.force_authenticate(self.coordinator)
        response = self.client.get("/api/events/self-check-in/visitors/?q=pia")
        self.assertEqual(response.status_code, 200, response.data)
        prospect_ids = {
            row["prospect_id"]
            for row in response.data["results"]
            if row.get("kind") == "prospect"
        }
        visitor_ids = {
            row["id"]
            for row in response.data["results"]
            if row.get("kind") != "prospect"
        }
        self.assertIn(invited.id, prospect_ids)
        self.assertIn(via_inviter_branch.id, prospect_ids)
        self.assertNotIn(other_branch.id, prospect_ids)
        self.assertNotIn(dropped.id, prospect_ids)
        self.assertIn(visitor.id, visitor_ids)

    def test_check_in_prospect_creates_person_and_attendance(self):
        cluster = Cluster.objects.create(
            name="HQ Cluster Attend", code="HQCLATT", branch=self.hq
        )
        prospect = Prospect.objects.create(
            first_name="Cora",
            last_name="Invite",
            invited_by=self.member,
            inviter_cluster=cluster,
            pipeline_stage=Prospect.PipelineStage.INVITED,
        )
        self.client.force_authenticate(self.member)
        response = self.client.post(
            "/api/events/self-check-in/visitors/",
            {"prospect_id": prospect.id,
            "attendance_venue": "HOME_ALTAR",
        },
            format="json",
        )
        self.assertEqual(response.status_code, 200, response.data)
        prospect.refresh_from_db()
        self.assertEqual(prospect.pipeline_stage, Prospect.PipelineStage.ATTENDED)
        person = prospect.person
        self.assertIsNotNone(person)
        self.assertEqual(person.role, "VISITOR")
        self.assertEqual(person.status, "ONGOING")
        self.assertEqual(person.branch_id, self.hq.id)
        self.assertEqual(person.inviter_id, self.member.id)
        self.assertEqual(person.first_activity_attended_id, "SUNDAY_SERVICE")
        self.assertTrue(
            AttendanceRecord.objects.filter(
                event=self.event, person=person, occurrence_date=TODAY
            ).exists()
        )
        self.assertEqual(response.data["person"]["id"], person.id)

        search = self.client.get("/api/events/self-check-in/visitors/?q=cora")
        prospect_ids = {
            row["prospect_id"]
            for row in search.data["results"]
            if row.get("kind") == "prospect"
        }
        self.assertNotIn(prospect.id, prospect_ids)

    def test_encode_duplicate_prospect_name_returns_409(self):
        Prospect.objects.create(
            first_name="Lina",
            last_name="Invite",
            invited_by=self.member,
            pipeline_stage=Prospect.PipelineStage.INVITED,
        )
        self.client.force_authenticate(self.coordinator)
        response = self.client.post(
            "/api/events/self-check-in/visitors/",
            {
                "first_name": "Lina",
                "last_name": "Invite",
                "gender": "FEMALE",
                "age_group": "ADULT",
            "attendance_venue": "HOME_ALTAR",
        },
            format="json",
        )
        self.assertEqual(response.status_code, 409, response.data)
        kinds = {row.get("kind") for row in response.data["matches"]}
        self.assertIn("prospect", kinds)

    def test_event_coordinator_can_encode_visitor(self):
        existing_visitor = Person.objects.create_user(
            username="ninaguest",
            password="pass12345",
            first_name="Nina",
            last_name="Guest",
            role="VISITOR",
            status="ONGOING",
            branch=self.hq,
        )
        self.client.force_authenticate(self.coordinator)
        search = self.client.get("/api/events/self-check-in/visitors/?q=nina")
        self.assertEqual(search.status_code, 200, search.data)
        ids = {row["id"] for row in search.data["results"]}
        self.assertIn(existing_visitor.id, ids)
        self.assertNotIn(self.member.id, ids)

        create = self.client.post(
            "/api/events/self-check-in/visitors/",
            {
                "first_name": "Vina",
                "last_name": "Guest",
                "gender": "FEMALE",
                "age_group": "ADULT",
                "inviter_id": self.member.id,
            "attendance_venue": "HOME_ALTAR",
        },
            format="json",
        )
        self.assertEqual(create.status_code, 201, create.data)
        visitor = Person.objects.get(first_name="Vina", last_name="Guest")
        self.assertEqual(visitor.role, "VISITOR")
        self.assertEqual(visitor.status, "ONGOING")
        self.assertEqual(visitor.inviter_id, self.coordinator.id)
        self.assertEqual(visitor.date_first_attended, TODAY)
        self.assertTrue(
            AttendanceRecord.objects.filter(
                event=self.event, person=visitor, occurrence_date=TODAY
            ).exists()
        )
        self.assertTrue(
            visitor.journeys.filter(
                type="NOTE", description__icontains="Adult"
            ).exists()
        )

    def test_new_visitor_names_are_title_cased(self):
        self.client.force_authenticate(self.coordinator)
        response = self.client.post(
            "/api/events/self-check-in/visitors/",
            {
                "first_name": "ana",
                "last_name": "fdsafds",
                "gender": "FEMALE",
                "age_group": "ADULT",
            "attendance_venue": "HOME_ALTAR",
        },
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.data)
        visitor = Person.objects.get(pk=response.data["person"]["id"])
        self.assertEqual(visitor.first_name, "Ana")
        self.assertEqual(visitor.last_name, "Fdsafds")
        self.assertEqual(response.data["person"]["first_name"], "Ana")
        self.assertEqual(response.data["person"]["last_name"], "Fdsafds")

    def test_duplicate_visitor_name_returns_409(self):
        existing = Person.objects.create_user(
            username="vinag",
            password="pass12345",
            first_name="Vina",
            last_name="Guest",
            role="VISITOR",
            status="ONGOING",
            branch=self.hq,
        )
        self.client.force_authenticate(self.coordinator)
        response = self.client.post(
            "/api/events/self-check-in/visitors/",
            {
                "first_name": "Vina",
                "last_name": "Guest",
                "gender": "FEMALE",
                "age_group": "YOUTH",
            "attendance_venue": "HOME_ALTAR",
        },
            format="json",
        )
        self.assertEqual(response.status_code, 409, response.data)
        match_ids = {row["id"] for row in response.data["matches"]}
        self.assertIn(existing.id, match_ids)

        check_existing = self.client.post(
            "/api/events/self-check-in/visitors/",
            {"person_id": existing.id,
            "attendance_venue": "HOME_ALTAR",
        },
            format="json",
        )
        self.assertEqual(check_existing.status_code, 200, check_existing.data)
        self.assertTrue(
            AttendanceRecord.objects.filter(
                event=self.event, person=existing, occurrence_date=TODAY
            ).exists()
        )

    def test_member_encode_locks_inviter_to_self(self):
        self.client.force_authenticate(self.member)
        response = self.client.post(
            "/api/events/self-check-in/visitors/",
            {
                "first_name": "Gia",
                "last_name": "Guest",
                "gender": "FEMALE",
                "age_group": "ADULT",
                "inviter_id": self.admin.id,
                "attendance_venue": "HOME_ALTAR",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.data)
        visitor = Person.objects.get(pk=response.data["person"]["id"])
        self.assertEqual(visitor.inviter_id, self.member.id)

    def test_member_can_undo_own_guest_not_others(self):
        self.client.force_authenticate(self.member)
        mine = self.client.post(
            "/api/events/self-check-in/visitors/",
            {
                "first_name": "Mia",
                "last_name": "Guest",
                "gender": "FEMALE",
                "age_group": "ADULT",
                "attendance_venue": "HOME_ALTAR",
            },
            format="json",
        )
        self.assertEqual(mine.status_code, 201, mine.data)
        mine_id = mine.data["person"]["id"]

        self.client.force_authenticate(self.coordinator)
        theirs = self.client.post(
            "/api/events/self-check-in/visitors/",
            {
                "first_name": "Tia",
                "last_name": "Guest",
                "gender": "FEMALE",
                "age_group": "ADULT",
                "attendance_venue": "HOME_ALTAR",
            },
            format="json",
        )
        self.assertEqual(theirs.status_code, 201, theirs.data)
        theirs_id = theirs.data["person"]["id"]

        self.client.force_authenticate(self.member)
        blocked = self.client.post(
            "/api/events/self-check-in/undo/",
            {"person_ids": [theirs_id]},
            format="json",
        )
        self.assertEqual(blocked.status_code, 403)
        undo_mine = self.client.post(
            "/api/events/self-check-in/undo/",
            {"person_ids": [mine_id]},
            format="json",
        )
        self.assertEqual(undo_mine.status_code, 200, undo_mine.data)
        self.assertFalse(
            AttendanceRecord.objects.filter(
                event=self.event, person_id=mine_id, occurrence_date=TODAY
            ).exists()
        )
        self.assertTrue(
            AttendanceRecord.objects.filter(
                event=self.event, person_id=theirs_id, occurrence_date=TODAY
            ).exists()
        )

    def test_check_in_requires_service_selection_when_ambiguous(self):
        Event.objects.create(
            title="Evening Service",
            description="",
            start_date=manila_dt(2026, 9, 13, 17),
            end_date=manila_dt(2026, 9, 13, 19),
            event_type=self.event_type,
            location="Hall 2",
            branch=self.hq,
            is_recurring=False,
            created_by=self.coordinator,
        )
        self.client.force_authenticate(self.member)
        session = self.client.get("/api/events/self-check-in/session/")
        self.assertTrue(session.data["needs_selection"])
        response = self.client.post(
            "/api/events/self-check-in/",
            {"person_ids": [self.member.id], "attendance_venue": "HOME_ALTAR"},
            format="json",
        )
        self.assertEqual(response.status_code, 400)
        chosen = self.client.post(
            "/api/events/self-check-in/",
            {"person_ids": [self.member.id], "event_id": self.event.id, "attendance_venue": "HOME_ALTAR"},
            format="json",
        )
        self.assertEqual(chosen.status_code, 200, chosen.data)

    def test_member_can_undo_household_check_in(self):
        self.client.force_authenticate(self.member)
        self.client.post(
            "/api/events/self-check-in/",
            {"person_ids": [self.member.id, self.spouse.id], "attendance_venue": "HOME_ALTAR"},
            format="json",
        )
        response = self.client.post(
            "/api/events/self-check-in/undo/",
            {"person_ids": [self.member.id, self.spouse.id], "attendance_venue": "HOME_ALTAR"},
            format="json",
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.assertFalse(
            AttendanceRecord.objects.filter(
                event=self.event, occurrence_date=TODAY
            ).exists()
        )
        checked = set(response.data["session"]["already_checked_in_ids"])
        self.assertNotIn(self.member.id, checked)
        self.assertNotIn(self.spouse.id, checked)

    def test_member_cannot_undo_non_household(self):
        AttendanceRecord.objects.create(
            event=self.event,
            person=self.outsider,
            occurrence_date=TODAY,
            status=AttendanceRecord.AttendanceStatus.PRESENT,
        )
        self.client.force_authenticate(self.member)
        response = self.client.post(
            "/api/events/self-check-in/undo/",
            {"person_ids": [self.outsider.id], "attendance_venue": "HOME_ALTAR"},
            format="json",
        )
        self.assertEqual(response.status_code, 403)
        self.assertTrue(
            AttendanceRecord.objects.filter(
                event=self.event, person=self.outsider, occurrence_date=TODAY
            ).exists()
        )

    def test_coordinator_can_undo_visitor_check_in_without_deleting_person(self):
        self.client.force_authenticate(self.coordinator)
        create = self.client.post(
            "/api/events/self-check-in/visitors/",
            {
                "first_name": "Cara",
                "last_name": "Guest",
                "gender": "FEMALE",
                "age_group": "ADULT",
            "attendance_venue": "HOME_ALTAR",
        },
            format="json",
        )
        self.assertEqual(create.status_code, 201, create.data)
        visitor_id = create.data["person"]["id"]
        self.assertTrue(
            AttendanceRecord.objects.filter(
                event=self.event, person_id=visitor_id, occurrence_date=TODAY
            ).exists()
        )

        self.client.force_authenticate(self.member)
        blocked = self.client.post(
            "/api/events/self-check-in/undo/",
            {"person_ids": [visitor_id], "attendance_venue": "HOME_ALTAR"},
            format="json",
        )
        self.assertEqual(blocked.status_code, 403)

        self.client.force_authenticate(self.coordinator)
        undo = self.client.post(
            "/api/events/self-check-in/undo/",
            {"person_ids": [visitor_id], "attendance_venue": "HOME_ALTAR"},
            format="json",
        )
        self.assertEqual(undo.status_code, 200, undo.data)
        self.assertTrue(Person.objects.filter(pk=visitor_id, role="VISITOR").exists())
        self.assertFalse(
            AttendanceRecord.objects.filter(
                event=self.event, person_id=visitor_id, occurrence_date=TODAY
            ).exists()
        )
        self.assertTrue(
            Person.objects.get(pk=visitor_id).journeys.filter(type="NOTE").exists()
        )

    def test_public_session_allows_anonymous(self):
        response = self.client.get("/api/events/self-check-in/public/session/")
        self.assertEqual(response.status_code, 200, response.data)
        self.assertTrue(response.data["available"])
        self.assertNotIn("household", response.data)
        self.assertFalse(response.data["can_encode_visitors"])
        self.assertGreaterEqual(len(response.data["options"]), 1)
        self.assertIn("attendance_venues", response.data)

    def test_public_session_restricted_when_setting_off(self):
        EventSetting.objects.filter(pk=EventSetting.SOLO_PK).update(
            member_self_checkin_enabled=False
        )
        session = self.client.get("/api/events/self-check-in/public/session/")
        self.assertEqual(session.status_code, 200, session.data)
        self.assertFalse(session.data["available"])
        self.assertEqual(session.data["reason"], "restricted")
        blocked = self.client.post(
            "/api/events/self-check-in/public/",
            {"member_id": "LAMP10001", "attendance_venue": "HOME_ALTAR"},
            format="json",
        )
        self.assertEqual(blocked.status_code, 400, blocked.data)
        self.client.force_authenticate(self.coordinator)
        staff = self.client.get("/api/events/self-check-in/session/")
        self.assertEqual(staff.status_code, 200, staff.data)
        self.assertTrue(staff.data["available"])

    def test_public_identify_by_lamp_id_and_numeric(self):
        full = self.client.post(
            "/api/events/self-check-in/public/identify/",
            {"member_id": "LAMP10001"},
            format="json",
        )
        self.assertEqual(full.status_code, 200, full.data)
        self.assertEqual(full.data["person"]["member_id"], "LAMP10001")
        self.assertEqual(full.data["person"]["first_name"], "Mina")
        self.assertNotIn("household", full.data)
        self.assertNotIn("status", full.data["person"])
        self.assertFalse(full.data["already_checked_in"])

        numeric = self.client.post(
            "/api/events/self-check-in/public/identify/",
            {"member_id": "10001"},
            format="json",
        )
        self.assertEqual(numeric.status_code, 200, numeric.data)
        self.assertEqual(numeric.data["person"]["member_id"], "LAMP10001")

    def test_public_identify_by_guest_id_and_numeric(self):
        guest = Person.objects.create_user(
            username="sciguestid",
            password="pass12345",
            first_name="Gina",
            last_name="Guest",
            role="VISITOR",
            status="ONGOING",
            branch=self.hq,
            member_id="GUEST20001",
        )
        full = self.client.post(
            "/api/events/self-check-in/public/identify/",
            {"member_id": "GUEST20001"},
            format="json",
        )
        self.assertEqual(full.status_code, 200, full.data)
        self.assertEqual(full.data["person"]["member_id"], "GUEST20001")
        self.assertEqual(full.data["person"]["id"], guest.id)

        numeric = self.client.post(
            "/api/events/self-check-in/public/identify/",
            {"member_id": "20001"},
            format="json",
        )
        self.assertEqual(numeric.status_code, 200, numeric.data)
        self.assertEqual(numeric.data["person"]["member_id"], "GUEST20001")

    def test_public_identify_unknown_and_ineligible(self):
        unknown = self.client.post(
            "/api/events/self-check-in/public/identify/",
            {"member_id": "LAMP99999"},
            format="json",
        )
        self.assertEqual(unknown.status_code, 404, unknown.data)
        self.assertEqual(unknown.data["detail"], "No member found for this LAMP ID.")

        self.admin.member_id = "LAMPADMIN1"
        self.admin.save(update_fields=["member_id"])
        admin = self.client.post(
            "/api/events/self-check-in/public/identify/",
            {"member_id": "LAMPADMIN1"},
            format="json",
        )
        self.assertEqual(admin.status_code, 404, admin.data)

        self.deceased.member_id = "LAMPDEAD1"
        self.deceased.save(update_fields=["member_id"])
        deceased = self.client.post(
            "/api/events/self-check-in/public/identify/",
            {"member_id": "LAMPDEAD1"},
            format="json",
        )
        self.assertEqual(deceased.status_code, 404, deceased.data)

    def test_public_identify_duplicate_member_id(self):
        Person.objects.create_user(
            username="scidup",
            password="pass12345",
            first_name="Dup",
            last_name="Member",
            role="MEMBER",
            status="ACTIVE",
            branch=self.hq,
            member_id="LAMP10001",
        )
        response = self.client.post(
            "/api/events/self-check-in/public/identify/",
            {"member_id": "LAMP10001"},
            format="json",
        )
        self.assertEqual(response.status_code, 409, response.data)
        self.assertIn("more than one person", response.data["detail"])

    def test_public_checkin_writes_online_and_second_post_conflicts(self):
        missing = self.client.post(
            "/api/events/self-check-in/public/",
            {"member_id": "LAMP10001"},
            format="json",
        )
        self.assertEqual(missing.status_code, 400, missing.data)
        self.assertIn("attendance_venue", missing.data)

        first = self.client.post(
            "/api/events/self-check-in/public/",
            {"member_id": "LAMP10001", "attendance_venue": "HOME_ALTAR"},
            format="json",
        )
        self.assertEqual(first.status_code, 200, first.data)
        self.assertNotIn("household", first.data)
        self.assertTrue(first.data["person"]["already_checked_in"])
        record = AttendanceRecord.objects.get(
            event=self.event, person=self.member, occurrence_date=TODAY
        )
        self.assertEqual(record.attendance_mode, "ONLINE")
        self.assertEqual(record.attendance_venue_id, "HOME_ALTAR")
        self.assertEqual(Person.objects.filter(role="VISITOR").count(), 0)

        second = self.client.post(
            "/api/events/self-check-in/public/",
            {"member_id": "LAMP10001", "attendance_venue": "CLUSTER_HOUSE"},
            format="json",
        )
        self.assertEqual(second.status_code, 409, second.data)
        record.refresh_from_db()
        self.assertEqual(record.attendance_venue_id, "HOME_ALTAR")
