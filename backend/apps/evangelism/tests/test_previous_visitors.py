from datetime import date

from rest_framework.test import APITestCase

from apps.clusters.models import Cluster, ClusterWeeklyReport
from apps.evangelism.models import EvangelismGroup, EvangelismWeeklyReport
from apps.people.models import Branch, ModuleCoordinator, Person


class EvangelismGroupPreviousVisitorsAPITests(APITestCase):
    def setUp(self):
        self.branch = Branch.objects.create(
            name="Muntinlupa",
            code="MUNTPREVVIS",
            is_active=True,
        )
        self.sharer = Person.objects.create_user(
            username="prevvissharer",
            password="pass12345",
            first_name="Bea",
            last_name="Sharer",
            role="MEMBER",
            status="ACTIVE",
            branch=self.branch,
        )
        self.ev_visitor_old = Person.objects.create_user(
            username="prevvisold",
            password="pass12345",
            first_name="Old",
            last_name="Visitor",
            role="VISITOR",
            status="ONGOING",
            branch=self.branch,
            date_first_attended="2026-08-01",
        )
        self.ev_visitor_recent = Person.objects.create_user(
            username="prevvisrecent",
            password="pass12345",
            first_name="Rec",
            last_name="Visitor",
            role="VISITOR",
            status="ONGOING",
            branch=self.branch,
            date_first_attended="2026-09-01",
        )
        self.unlinked_visitor = Person.objects.create_user(
            username="prevvisunlinked",
            password="pass12345",
            first_name="Una",
            last_name="Linked",
            role="VISITOR",
            status="ONGOING",
            branch=self.branch,
            date_first_attended="2026-01-01",
        )
        self.cluster_visitor = Person.objects.create_user(
            username="prevviscluster",
            password="pass12345",
            first_name="Clu",
            last_name="Visitor",
            role="VISITOR",
            status="ONGOING",
            branch=self.branch,
            date_first_attended="2026-07-01",
        )
        self.cluster = Cluster.objects.create(
            name="Previous Visitors Cluster",
            code="PREV-VIS",
            branch=self.branch,
            is_active=True,
        )
        self.group = EvangelismGroup.objects.create(
            name="Previous Visitors Group",
            cluster=self.cluster,
            coordinator=self.sharer,
            is_active=True,
        )
        self.group.members.add(self.sharer)
        ModuleCoordinator.objects.create(
            person=self.sharer,
            module=ModuleCoordinator.ModuleType.EVANGELISM,
            level=ModuleCoordinator.CoordinatorLevel.BIBLE_SHARER,
            resource_id=self.group.id,
        )
        self.client.force_authenticate(self.sharer)

    def _ev_report(self, week, visitors, year=2026):
        report = EvangelismWeeklyReport.objects.create(
            evangelism_group=self.group,
            year=year,
            week_number=week,
            meeting_date=date.fromisocalendar(year, week, 1),
            gathering_type="PHYSICAL",
            submitted_by=self.sharer,
        )
        report.visitors_attended.set(visitors)
        return report

    def _cluster_report(self, week, visitors, year=2026):
        report = ClusterWeeklyReport.objects.create(
            cluster=self.cluster,
            year=year,
            week_number=week,
            meeting_date=date.fromisocalendar(year, week, 3),
            gathering_type="PHYSICAL",
            submitted_by=self.sharer,
        )
        report.visitors_attended.set(visitors)
        return report

    def _get(self, **params):
        return self.client.get(
            f"/api/evangelism/groups/{self.group.id}/previous_visitors/",
            params,
        )

    def test_prior_evangelism_visitors_only_not_unlinked_people(self):
        self._ev_report(36, [self.ev_visitor_old])
        self._ev_report(37, [self.ev_visitor_recent])
        response = self._get(year=2026, week_number=38)
        self.assertEqual(response.status_code, 200, response.data)
        previously = response.data["previously_attended_visitor_ids"]
        most_recent = response.data["most_recent_visitor_ids"]
        self.assertCountEqual(
            previously, [self.ev_visitor_old.id, self.ev_visitor_recent.id]
        )
        self.assertEqual(most_recent, [self.ev_visitor_recent.id])
        self.assertNotIn(self.unlinked_visitor.id, previously)
        self.assertNotIn(self.cluster_visitor.id, previously)

    def test_bible_sharer_includes_linked_cluster_report_visitors(self):
        self._ev_report(36, [self.ev_visitor_old])
        self._cluster_report(37, [self.cluster_visitor])
        response = self._get(year=2026, week_number=38)
        self.assertEqual(response.status_code, 200, response.data)
        previously = response.data["previously_attended_visitor_ids"]
        most_recent = response.data["most_recent_visitor_ids"]
        self.assertIn(self.ev_visitor_old.id, previously)
        self.assertIn(self.cluster_visitor.id, previously)
        self.assertNotIn(self.unlinked_visitor.id, previously)
        self.assertCountEqual(
            most_recent, [self.ev_visitor_old.id, self.cluster_visitor.id]
        )

    def test_same_or_later_week_is_excluded(self):
        self._ev_report(38, [self.ev_visitor_recent])
        self._ev_report(39, [self.unlinked_visitor])
        response = self._get(year=2026, week_number=38)
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["previously_attended_visitor_ids"], [])
        self.assertEqual(response.data["most_recent_visitor_ids"], [])

    def test_exclude_report_skips_the_report_being_edited(self):
        older = self._ev_report(36, [self.ev_visitor_old])
        current = self._ev_report(37, [self.ev_visitor_recent])
        response = self._get(
            year=2026, week_number=38, exclude_report=current.id
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(
            response.data["previously_attended_visitor_ids"],
            [self.ev_visitor_old.id],
        )
        self.assertEqual(
            response.data["most_recent_visitor_ids"], [self.ev_visitor_old.id]
        )
        self.assertNotIn(self.ev_visitor_recent.id, response.data["most_recent_visitor_ids"])
        self.assertEqual(older.visitors_attended.get().id, self.ev_visitor_old.id)

    def test_requires_year_and_week(self):
        response = self._get()
        self.assertEqual(response.status_code, 400)
