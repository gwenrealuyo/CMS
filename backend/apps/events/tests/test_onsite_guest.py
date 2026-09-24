from datetime import date, datetime
from unittest.mock import patch
from zoneinfo import ZoneInfo

from rest_framework.test import APITestCase

from apps.attendance.models import AttendanceRecord
from apps.clusters.models import Cluster
from apps.evangelism.models import Prospect
from apps.events.models import Event, EventType
from apps.people.models import Branch, Journey, ModuleCoordinator, Person


TODAY = date(2026, 9, 13)  # Sunday
MANILA = ZoneInfo("Asia/Manila")


def manila_dt(year, month, day, hour=9):
    return datetime(year, month, day, hour, 0, 0, tzinfo=MANILA)


class OnsiteGuestAPITests(APITestCase):
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
        self.hq = Branch.objects.create(
            name="HQ Onsite Guest",
            code="HQOSG",
            is_headquarters=True,
            is_active=True,
        )
        self.admin = Person.objects.create_user(
            username="osgadmin",
            password="pass12345",
            first_name="Admin",
            last_name="User",
            role="ADMIN",
            status="ACTIVE",
            branch=self.hq,
        )
        self.member = Person.objects.create_user(
            username="osgmember",
            password="pass12345",
            first_name="Mina",
            last_name="Member",
            role="MEMBER",
            status="ACTIVE",
            branch=self.hq,
            member_id="LAMP20001",
            water_baptism_date=date(2020, 1, 1),
        )
        self.coordinator = Person.objects.create_user(
            username="osgcoord",
            password="pass12345",
            first_name="Eve",
            last_name="Coord",
            role="MEMBER",
            status="ACTIVE",
            branch=self.hq,
            water_baptism_date=date(2020, 1, 1),
        )
        ModuleCoordinator.objects.create(
            person=self.coordinator,
            module=ModuleCoordinator.ModuleType.EVENTS,
            level=ModuleCoordinator.CoordinatorLevel.COORDINATOR,
        )
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
            self_checkin_enabled=True,
            created_by=self.coordinator,
        )
        self.church_today_patch = patch(
            "apps.events.services.self_checkin.church_today",
            return_value=TODAY,
        )
        self.people_utils_today_patch = patch(
            "apps.people.utils.church_today",
            return_value=TODAY,
        )
        self.church_today_patch.start()
        self.people_utils_today_patch.start()
        self.addCleanup(self.church_today_patch.stop)
        self.addCleanup(self.people_utils_today_patch.stop)

        from apps.people.models import PeopleAutomationSetting

        PeopleAutomationSetting.get_solo()
        PeopleAutomationSetting.objects.filter(
            pk=PeopleAutomationSetting.SOLO_PK
        ).update(auto_status_updates_enabled=False)

    def test_plain_member_denied(self):
        self.client.force_authenticate(self.member)
        response = self.client.get("/api/events/onsite-guest/session/")
        self.assertEqual(response.status_code, 403)

    def test_coordinator_session_available(self):
        self.client.force_authenticate(self.coordinator)
        response = self.client.get("/api/events/onsite-guest/session/")
        self.assertEqual(response.status_code, 200, response.data)
        self.assertTrue(response.data["available"])
        self.assertFalse(response.data["needs_selection"])
        self.assertEqual(
            response.data["session"]["event"]["id"], self.event.id
        )
        self.assertTrue(response.data["can_encode_visitors"])

    def test_create_onsite_guest_without_inviter(self):
        self.client.force_authenticate(self.coordinator)
        response = self.client.post(
            "/api/events/onsite-guest/visitors/",
            {
                "first_name": "walky",
                "last_name": "guest",
                "gender": "MALE",
                "age_group": "ADULT",
                "phone": "+639171234567",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.data)
        visitor = Person.objects.get(first_name="Walky", last_name="Guest")
        self.assertEqual(visitor.role, "VISITOR")
        self.assertEqual(visitor.status, "ONGOING")
        self.assertIsNone(visitor.inviter_id)
        self.assertEqual(visitor.branch_id, self.hq.id)
        self.assertEqual(visitor.first_activity_attended_id, "SUNDAY_SERVICE")
        self.assertEqual(visitor.date_first_attended, TODAY)
        self.assertEqual(visitor.date_first_invited, TODAY)
        record = AttendanceRecord.objects.get(
            event=self.event, person=visitor, occurrence_date=TODAY
        )
        self.assertEqual(record.attendance_mode, "ONSITE")
        self.assertIsNone(record.attendance_venue_id)
        self.assertTrue(
            Journey.objects.filter(
                user=visitor, type="NOTE", title="Visitor note"
            ).exists()
        )
        self.assertEqual(
            response.data["attendance_record"]["attendance_mode"], "ONSITE"
        )

    def test_create_onsite_guest_with_optional_inviter(self):
        self.client.force_authenticate(self.coordinator)
        response = self.client.post(
            "/api/events/onsite-guest/visitors/",
            {
                "first_name": "Invited",
                "last_name": "Guest",
                "gender": "FEMALE",
                "age_group": "YOUTH",
                "inviter_id": self.member.id,
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.data)
        visitor = Person.objects.get(first_name="Invited", last_name="Guest")
        self.assertEqual(visitor.inviter_id, self.member.id)
        self.assertNotEqual(visitor.inviter_id, self.coordinator.id)

    def test_create_first_time_attending_sets_invited_date(self):
        self.client.force_authenticate(self.coordinator)
        response = self.client.post(
            "/api/events/onsite-guest/visitors/",
            {
                "first_name": "Firsty",
                "last_name": "Time",
                "gender": "FEMALE",
                "age_group": "ADULT",
                "first_time_attending": True,
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.data)
        visitor = Person.objects.get(first_name="Firsty", last_name="Time")
        self.assertEqual(visitor.date_first_attended, TODAY)
        self.assertEqual(visitor.date_first_invited, TODAY)

    def test_create_not_first_time_leaves_invited_null(self):
        self.client.force_authenticate(self.coordinator)
        response = self.client.post(
            "/api/events/onsite-guest/visitors/",
            {
                "first_name": "Return",
                "last_name": "Encode",
                "gender": "MALE",
                "age_group": "YOUTH",
                "first_time_attending": False,
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.data)
        visitor = Person.objects.get(first_name="Return", last_name="Encode")
        self.assertEqual(visitor.date_first_attended, TODAY)
        self.assertIsNone(visitor.date_first_invited)

    def test_duplicate_name_returns_409(self):
        Person.objects.create_user(
            username="existingguest",
            password="pass12345",
            first_name="Dup",
            last_name="Guest",
            role="VISITOR",
            status="ONGOING",
            branch=self.hq,
        )
        self.client.force_authenticate(self.coordinator)
        response = self.client.post(
            "/api/events/onsite-guest/visitors/",
            {
                "first_name": "Dup",
                "last_name": "Guest",
                "gender": "FEMALE",
                "age_group": "ADULT",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 409, response.data)
        self.assertTrue(response.data.get("matches"))

    def test_check_in_existing_visitor(self):
        visitor = Person.objects.create_user(
            username="returnguest",
            password="pass12345",
            first_name="Return",
            last_name="Guest",
            role="VISITOR",
            status="ONGOING",
            branch=self.hq,
        )
        self.client.force_authenticate(self.coordinator)
        search = self.client.get(
            "/api/events/onsite-guest/visitors/?q=return"
        )
        self.assertEqual(search.status_code, 200, search.data)
        ids = {row["id"] for row in search.data["results"]}
        self.assertIn(visitor.id, ids)

        response = self.client.post(
            "/api/events/onsite-guest/visitors/",
            {"person_id": visitor.id},
            format="json",
        )
        self.assertEqual(response.status_code, 200, response.data)
        record = AttendanceRecord.objects.get(
            event=self.event, person=visitor, occurrence_date=TODAY
        )
        self.assertEqual(record.attendance_mode, "ONSITE")

    def test_check_in_prospect(self):
        cluster = Cluster.objects.create(
            name="OSG Cluster", code="OSGCL", branch=self.hq
        )
        prospect = Prospect.objects.create(
            first_name="Cora",
            last_name="Invite",
            invited_by=self.member,
            inviter_cluster=cluster,
            pipeline_stage=Prospect.PipelineStage.INVITED,
        )
        self.client.force_authenticate(self.coordinator)
        response = self.client.post(
            "/api/events/onsite-guest/visitors/",
            {"prospect_id": prospect.id},
            format="json",
        )
        self.assertEqual(response.status_code, 200, response.data)
        prospect.refresh_from_db()
        self.assertEqual(prospect.pipeline_stage, Prospect.PipelineStage.ATTENDED)
        person = prospect.person
        self.assertIsNotNone(person)
        record = AttendanceRecord.objects.get(
            event=self.event, person=person, occurrence_date=TODAY
        )
        self.assertEqual(record.attendance_mode, "ONSITE")

    def test_session_with_event_and_occurrence_params(self):
        self.client.force_authenticate(self.admin)
        response = self.client.get(
            "/api/events/onsite-guest/session/",
            {"event": self.event.id, "occurrence": TODAY.isoformat()},
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.assertTrue(response.data["available"])
        self.assertEqual(response.data["session"]["event"]["id"], self.event.id)

    def test_inviter_search(self):
        self.client.force_authenticate(self.coordinator)
        empty = self.client.get("/api/events/onsite-guest/inviters/")
        self.assertEqual(empty.status_code, 200, empty.data)
        self.assertEqual(empty.data["results"], [])

        response = self.client.get(
            "/api/events/onsite-guest/inviters/?q=mina"
        )
        self.assertEqual(response.status_code, 200, response.data)
        ids = {row["id"] for row in response.data["results"]}
        self.assertIn(self.member.id, ids)


    def test_staff_guest_from_checkin_without_self_checkin_flag(self):
        """Staff may encode guests for any approved activity via event+occurrence."""
        concert_type, _ = EventType.objects.get_or_create(
            code="CONCERT_CRUSADE",
            defaults={
                "label": "Concert/Crusade",
                "sort_order": 150,
                "color": "#7c2d12",
                "is_system": True,
                "counts_as_activity": True,
            },
        )
        concert = Event.objects.create(
            title="Crusade Onsite",
            description="",
            start_date=manila_dt(2026, 9, 13, 18),
            end_date=manila_dt(2026, 9, 13, 21),
            event_type=concert_type,
            location="Arena",
            branch=self.hq,
            is_recurring=False,
            self_checkin_enabled=False,
            created_by=self.coordinator,
        )
        self.client.force_authenticate(self.coordinator)
        session = self.client.get(
            "/api/events/onsite-guest/session/",
            {"event": concert.id, "occurrence": TODAY.isoformat()},
        )
        self.assertEqual(session.status_code, 200, session.data)
        self.assertTrue(session.data["available"])
        self.assertEqual(session.data["session"]["event"]["id"], concert.id)

        response = self.client.post(
            f"/api/events/onsite-guest/visitors/?event={concert.id}&occurrence={TODAY.isoformat()}",
            {
                "first_name": "arena",
                "last_name": "guest",
                "gender": "MALE",
                "age_group": "YOUTH",
                "event_id": concert.id,
                "occurrence_date": TODAY.isoformat(),
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.data)
        visitor = Person.objects.get(first_name="Arena", last_name="Guest")
        self.assertEqual(visitor.first_activity_attended_id, "CONCERT_CRUSADE")
        record = AttendanceRecord.objects.get(
            event=concert, person=visitor, occurrence_date=TODAY
        )
        self.assertEqual(record.attendance_mode, "ONSITE")


    def test_online_only_guest_writes_online_without_venue(self):
        self.event.attendance_format = "online_only"
        self.event.save(update_fields=["attendance_format"])
        self.client.force_authenticate(self.coordinator)
        response = self.client.post(
            "/api/events/onsite-guest/visitors/",
            {
                "first_name": "online",
                "last_name": "guest",
                "gender": "FEMALE",
                "age_group": "ADULT",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.data)
        visitor = Person.objects.get(first_name="Online", last_name="Guest")
        record = AttendanceRecord.objects.get(
            event=self.event, person=visitor, occurrence_date=TODAY
        )
        self.assertEqual(record.attendance_mode, "ONLINE")
        self.assertIsNone(record.attendance_venue_id)
        self.assertEqual(
            response.data["attendance_record"]["attendance_mode"], "ONLINE"
        )
