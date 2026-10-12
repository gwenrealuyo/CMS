from datetime import date, datetime
from unittest.mock import patch
from zoneinfo import ZoneInfo

from rest_framework.test import APITestCase

from apps.attendance.models import AttendanceRecord
from apps.clusters.models import Cluster
from apps.events.models import AttendanceVenue, Event, EventType
from apps.people.models import Branch, ModuleCoordinator, Person

MANILA = ZoneInfo("Asia/Manila")
SUNDAY = date(2026, 9, 13)
OPEN_DAY = date(2026, 9, 16)
CLOSED_DAY = date(2026, 9, 20)


def manila_dt(year, month, day, hour=9):
    return datetime(year, month, day, hour, 0, 0, tzinfo=MANILA)


class SundayCatchupAPITests(APITestCase):
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
        self.home_altar, _ = AttendanceVenue.objects.get_or_create(
            code="HOME_ALTAR",
            defaults={
                "label": "Home altar",
                "sort_order": 10,
                "color": "#0EA5E9",
                "is_active": True,
                "is_system": True,
            },
        )
        self.branch = Branch.objects.create(
            name="Catchup Branch",
            code="CATCH",
            is_active=True,
        )
        self.other_branch = Branch.objects.create(
            name="Other Catchup",
            code="CATCH2",
            is_active=True,
        )
        self.coordinator = self._user("catchcoord", "Cora", "Coord")
        self.reporter = self._user("catchreport", "Rita", "Report")
        self.other_coordinator = self._user("catchother", "Otto", "Other")
        self.other_reporter = self._user("catchorep", "Owen", "Reporter")
        self.member = self._user("catchmember", "Mina", "Member", member_id="LAMP31001")
        self.outsider = self._user(
            "catchout", "Olivia", "Outsider", member_id="LAMP31002"
        )
        self.visitor = self._user(
            "catchvis", "Vera", "Visitor", role="VISITOR", member_id="LAMP31003"
        )
        self.deceased = self._user(
            "catchdec", "Drew", "Deceased", status="DECEASED", member_id="LAMP31004"
        )
        self.plain = self._user("catchplain", "Pat", "Plain", member_id="LAMP31005")
        self.admin = self._user("catchadmin", "Ada", "Admin", role="ADMIN")
        self.pastor = self._user("catchpastor", "Paul", "Pastor", role="PASTOR")
        self.senior = self._user("catchsenior", "Sam", "Senior")
        self.events_senior = self._user("catcheventssenior", "Eve", "Events")
        self.cluster = Cluster.objects.create(
            name="North Catchup",
            code="CATCH-N",
            branch=self.branch,
            coordinator=self.coordinator,
            is_active=True,
        )
        self.other_cluster = Cluster.objects.create(
            name="South Catchup",
            code="CATCH-S",
            branch=self.branch,
            coordinator=self.other_coordinator,
            is_active=True,
        )
        for person in (
            self.member,
            self.visitor,
            self.deceased,
            self.plain,
        ):
            self.cluster.members.add(person)
        ModuleCoordinator.objects.create(
            person=self.reporter,
            module=ModuleCoordinator.ModuleType.CLUSTER,
            level=ModuleCoordinator.CoordinatorLevel.REPORTER,
            resource_id=self.cluster.id,
            resource_type="Cluster",
        )
        ModuleCoordinator.objects.create(
            person=self.other_reporter,
            module=ModuleCoordinator.ModuleType.CLUSTER,
            level=ModuleCoordinator.CoordinatorLevel.REPORTER,
            resource_id=self.other_cluster.id,
            resource_type="Cluster",
        )
        ModuleCoordinator.objects.create(
            person=self.senior,
            module=ModuleCoordinator.ModuleType.CLUSTER,
            level=ModuleCoordinator.CoordinatorLevel.SENIOR_COORDINATOR,
        )
        ModuleCoordinator.objects.create(
            person=self.events_senior,
            module=ModuleCoordinator.ModuleType.EVENTS,
            level=ModuleCoordinator.CoordinatorLevel.SENIOR_COORDINATOR,
        )
        self.event = Event.objects.create(
            title="Sunday Service",
            description="",
            start_date=manila_dt(2026, 9, 13, 9),
            end_date=manila_dt(2026, 9, 13, 12),
            event_type=self.event_type,
            location="Main Hall",
            branch=self.branch,
            is_recurring=False,
            booking_status=Event.BookingStatus.APPROVED,
            attendance_format=Event.AttendanceFormat.HYBRID,
            created_by=self.admin,
        )
        self.today_patch = patch(
            "apps.clusters.sunday_catchup.church_today",
            return_value=OPEN_DAY,
        )
        self.today_patch.start()
        self.addCleanup(self.today_patch.stop)

    def _user(
        self,
        username,
        first_name,
        last_name,
        role="MEMBER",
        status="ACTIVE",
        member_id="",
        branch=None,
    ):
        return Person.objects.create_user(
            username=username,
            password="pass12345",
            first_name=first_name,
            last_name=last_name,
            role=role,
            status=status,
            branch=branch or self.branch,
            member_id=member_id,
            water_baptism_date=date(2020, 1, 1) if role == "MEMBER" else None,
        )

    def _url(self, cluster=None):
        cluster = cluster or self.cluster
        return f"/api/clusters/clusters/{cluster.id}/sunday-catchup/"

    def _mark(self, person, reason="REPLAY", note="", cluster=None):
        return self.client.post(
            self._url(cluster),
            {"person_id": person.id, "reason": reason, "note": note},
            format="json",
        )

    def test_coordinator_marks_member_online_inside_the_window(self):
        self.member.nickname = "Mimi"
        self.member.save(update_fields=["nickname"])
        self.client.force_authenticate(self.coordinator)
        response = self._mark(self.member, reason="TIMEZONE")
        self.assertEqual(response.status_code, 201, response.data)
        record = AttendanceRecord.objects.get(person=self.member, event=self.event)
        self.assertEqual(record.occurrence_date, SUNDAY)
        self.assertEqual(record.status, AttendanceRecord.AttendanceStatus.PRESENT)
        self.assertEqual(record.attendance_mode, AttendanceRecord.AttendanceMode.ONLINE)
        self.assertEqual(record.attendance_venue_id, "HOME_ALTAR")
        self.assertEqual(record.catchup_reason, "TIMEZONE")
        self.assertEqual(record.recorded_by_id, self.coordinator.id)
        self.assertEqual(record.journey.date, SUNDAY)
        self.assertIn("Catch-up: Another timezone.", record.journey.description)
        row = next(
            item
            for item in response.data["roster"]
            if item["person_id"] == self.member.id
        )
        self.assertTrue(row["attendance"]["can_remove"])
        self.assertEqual(row["name"], "Mimi")
        plain = next(
            item
            for item in response.data["roster"]
            if item["person_id"] == self.plain.id
        )
        self.assertEqual(plain["name"], "Pat")

    def test_reporter_can_mark_and_other_cluster_staff_cannot(self):
        self.client.force_authenticate(self.reporter)
        response = self._mark(self.member, reason="FORGOT_CHECKIN")
        self.assertEqual(response.status_code, 201, response.data)

        self.client.force_authenticate(self.other_coordinator)
        denied = self._mark(self.member)
        self.assertEqual(denied.status_code, 403, denied.data)

        self.client.force_authenticate(self.other_reporter)
        denied_reporter = self._mark(self.member)
        self.assertEqual(
            denied_reporter.status_code, 404, denied_reporter.data
        )

    def test_admin_pastor_and_cluster_senior_can_mark_without_a_cluster_assignment(self):
        for user in (self.admin, self.pastor, self.senior):
            self.client.force_authenticate(user)
            response = self._mark(self.member, reason="REPLAY")
            self.assertEqual(response.status_code, 201, (user.username, response.data))
            AttendanceRecord.objects.filter(person=self.member, event=self.event).delete()

    def test_plain_member_and_non_cluster_senior_cannot_mark(self):
        for user in (self.plain, self.events_senior):
            self.client.force_authenticate(user)
            response = self._mark(self.member)
            self.assertEqual(response.status_code, 403, (user.username, response.data))

    def test_other_requires_a_note_and_stores_it(self):
        self.client.force_authenticate(self.coordinator)
        missing = self._mark(self.member, reason="OTHER")
        self.assertEqual(missing.status_code, 400, missing.data)

        saved = self._mark(
            self.member,
            reason="OTHER",
            note="Watched with family after work",
        )
        self.assertEqual(saved.status_code, 201, saved.data)
        record = AttendanceRecord.objects.get(person=self.member)
        self.assertEqual(record.catchup_note, "Watched with family after work")
        self.assertIn("Watched with family after work", record.journey.description)

    def test_rejects_ineligible_people_and_a_closed_window(self):
        self.client.force_authenticate(self.coordinator)
        for person in (self.visitor, self.deceased, self.outsider):
            response = self._mark(person)
            self.assertEqual(response.status_code, 400, (person.username, response.data))

        with patch(
            "apps.clusters.sunday_catchup.church_today",
            return_value=CLOSED_DAY,
        ):
            closed = self._mark(self.member)
        self.assertEqual(closed.status_code, 400, closed.data)
        self.assertFalse(AttendanceRecord.objects.filter(person=self.member).exists())

    def test_onsite_only_service_rejects_writes(self):
        self.event.attendance_format = Event.AttendanceFormat.ONSITE_ONLY
        self.event.save(update_fields=["attendance_format"])
        self.client.force_authenticate(self.coordinator)
        listing = self.client.get(self._url())
        self.assertEqual(listing.status_code, 200, listing.data)
        self.assertFalse(listing.data["writes_enabled"])
        self.assertEqual(listing.data["read_only_reason"], "onsite_only")
        response = self._mark(self.member)
        self.assertEqual(response.status_code, 400, response.data)

    def test_existing_check_in_is_unchanged(self):
        AttendanceRecord.objects.create(
            event=self.event,
            person=self.member,
            occurrence_date=SUNDAY,
            status=AttendanceRecord.AttendanceStatus.PRESENT,
            attendance_mode=AttendanceRecord.AttendanceMode.ONSITE,
        )
        self.client.force_authenticate(self.reporter)
        response = self._mark(self.member, reason="REPLAY")
        self.assertEqual(response.status_code, 409, response.data)
        record = AttendanceRecord.objects.get(person=self.member)
        self.assertEqual(record.attendance_mode, AttendanceRecord.AttendanceMode.ONSITE)
        self.assertEqual(record.catchup_reason, "")
        self.assertIsNone(record.attendance_venue_id)

    def test_delete_removes_catchup_and_leaves_door_check_in(self):
        self.client.force_authenticate(self.coordinator)
        created = self._mark(self.member, reason="REPLAY")
        self.assertEqual(created.status_code, 201, created.data)
        attendance_id = AttendanceRecord.objects.get(person=self.member).id
        removed = self.client.delete(f"{self._url()}{attendance_id}/")
        self.assertEqual(removed.status_code, 200, removed.data)
        self.assertFalse(AttendanceRecord.objects.filter(pk=attendance_id).exists())

        door = AttendanceRecord.objects.create(
            event=self.event,
            person=self.member,
            occurrence_date=SUNDAY,
            status=AttendanceRecord.AttendanceStatus.PRESENT,
            attendance_mode=AttendanceRecord.AttendanceMode.ONSITE,
        )
        blocked = self.client.delete(f"{self._url()}{door.id}/")
        self.assertEqual(blocked.status_code, 400, blocked.data)
        self.assertTrue(AttendanceRecord.objects.filter(pk=door.id).exists())

    def test_online_registration_is_not_bypassed(self):
        self.event.registration_enabled = True
        self.event.online_registration_required = True
        self.event.save(
            update_fields=["registration_enabled", "online_registration_required"]
        )
        self.client.force_authenticate(self.coordinator)
        response = self._mark(self.member)
        self.assertEqual(response.status_code, 400, response.data)
        self.assertFalse(AttendanceRecord.objects.filter(person=self.member).exists())
