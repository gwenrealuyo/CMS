from datetime import date

from django.test import TestCase

from apps.clusters.models import Cluster, ClusterWeeklyReport
from apps.evangelism.models import EvangelismGroup, EvangelismWeeklyReport
from apps.events.models import EventType
from apps.people.first_attendance import (
    annotate_first_attendance_places,
    resolve_first_attendance_place,
)
from apps.people.models import Branch, Person


class FirstAttendancePlaceTests(TestCase):
    def setUp(self):
        self.branch = Branch.objects.create(
            name="Place Branch",
            code="PLACE",
            is_active=True,
        )
        self.clustering = EventType.objects.get(code="CLUSTERING")
        self.bible_study = EventType.objects.get(code="BIBLE_STUDY")
        self.sunday = EventType.objects.get(code="SUNDAY_SERVICE")
        self.cluster = Cluster.objects.create(
            name="North Cluster",
            code="PLACE-N",
            branch=self.branch,
            is_active=True,
        )
        self.group = EvangelismGroup.objects.create(
            name="North Bible Study",
            cluster=self.cluster,
            branch=self.branch,
            is_active=True,
        )

    def _visitor(self, username, *, activity, attended_on):
        return Person.objects.create_user(
            username=username,
            password="pass12345",
            first_name=username.title(),
            last_name="Visitor",
            role="VISITOR",
            status="ONGOING",
            branch=self.branch,
            date_first_attended=attended_on,
            first_activity_attended=activity,
        )

    def _place(self, person):
        annotated = annotate_first_attendance_places(
            Person.objects.filter(pk=person.pk).select_related(
                "first_activity_attended"
            )
        ).get()
        return resolve_first_attendance_place(annotated)

    def test_clustering_uses_cluster_name(self):
        person = self._visitor(
            "clustered",
            activity=self.clustering,
            attended_on=date(2026, 3, 4),
        )
        report = ClusterWeeklyReport.objects.create(
            cluster=self.cluster,
            year=2026,
            week_number=10,
            meeting_date=date(2026, 3, 4),
            gathering_type="PHYSICAL",
        )
        report.visitors_attended.add(person)

        self.assertEqual(self._place(person), "North Cluster")

    def test_bible_study_uses_evangelism_group_name(self):
        person = self._visitor(
            "studied",
            activity=self.bible_study,
            attended_on=date(2026, 3, 5),
        )
        report = EvangelismWeeklyReport.objects.create(
            evangelism_group=self.group,
            year=2026,
            week_number=10,
            meeting_date=date(2026, 3, 5),
            gathering_type="PHYSICAL",
        )
        report.visitors_attended.add(person)

        self.assertEqual(self._place(person), "North Bible Study")

    def test_other_activity_uses_activity_label(self):
        person = self._visitor(
            "sunday",
            activity=self.sunday,
            attended_on=date(2026, 3, 8),
        )

        self.assertEqual(self._place(person), "Sunday Service")
