from datetime import date

from django.test import TestCase

from apps.clusters.models import Cluster, ClusterWeeklyReport
from apps.evangelism.models import EvangelismGroup, EvangelismWeeklyReport
from apps.evangelism.views import EvangelismWeeklyReportViewSet
from apps.people.models import Branch, Person


def _old_build_weekly_tally_rows(evangelism_qs, cluster_qs):
    """Pre-optimization tally semantics for differential checks."""
    tallies = {}

    def get_entry(cluster_obj, year_val, week_val):
        key = (cluster_obj.id if cluster_obj else None, int(year_val), int(week_val))
        if key not in tallies:
            tallies[key] = {
                "cluster_id": cluster_obj.id if cluster_obj else None,
                "cluster_name": cluster_obj.name if cluster_obj else "Unassigned",
                "cluster_code": cluster_obj.code if cluster_obj else "Unassigned",
                "year": int(year_val),
                "week_number": int(week_val),
                "meeting_dates": [],
                "gathering_types": set(),
                "members_set": set(),
                "visitors_set": set(),
                "evangelism_reports_count": 0,
                "cluster_reports_count": 0,
                "new_prospects": 0,
                "conversions_this_week": 0,
            }
        return tallies[key]

    evangelism_qs = evangelism_qs.select_related(
        "evangelism_group", "evangelism_group__cluster"
    ).prefetch_related("members_attended", "visitors_attended")
    cluster_qs = cluster_qs.select_related("cluster").prefetch_related(
        "members_attended", "visitors_attended"
    )

    for report in evangelism_qs:
        entry = get_entry(
            report.evangelism_group.cluster, report.year, report.week_number
        )
        entry["meeting_dates"].append(report.meeting_date)
        entry["gathering_types"].add(report.gathering_type)
        entry["members_set"].update(p.id for p in report.members_attended.all())
        entry["visitors_set"].update(p.id for p in report.visitors_attended.all())
        entry["evangelism_reports_count"] += 1
        entry["new_prospects"] += report.new_prospects or 0
        entry["conversions_this_week"] += report.conversions_this_week or 0

    for report in cluster_qs:
        entry = get_entry(report.cluster, report.year, report.week_number)
        entry["meeting_dates"].append(report.meeting_date)
        entry["gathering_types"].add(report.gathering_type)
        entry["members_set"].update(p.id for p in report.members_attended.all())
        entry["visitors_set"].update(p.id for p in report.visitors_attended.all())
        entry["cluster_reports_count"] += 1

    rows = []
    for entry in tallies.values():
        gathering_types = entry["gathering_types"]
        if not gathering_types:
            gathering_type = "UNKNOWN"
        elif len(gathering_types) == 1:
            gathering_type = next(iter(gathering_types))
        else:
            gathering_type = "MIXED"
        meeting_date = min(entry["meeting_dates"]) if entry["meeting_dates"] else None
        rows.append(
            {
                "cluster_id": entry["cluster_id"],
                "cluster_name": entry["cluster_name"],
                "cluster_code": entry["cluster_code"],
                "year": entry["year"],
                "week_number": entry["week_number"],
                "meeting_date": meeting_date,
                "gathering_type": gathering_type,
                "members_count": len(entry["members_set"]),
                "visitors_count": len(entry["visitors_set"]),
                "evangelism_reports_count": entry["evangelism_reports_count"],
                "cluster_reports_count": entry["cluster_reports_count"],
                "new_prospects": entry["new_prospects"],
                "conversions_this_week": entry["conversions_this_week"],
            }
        )
    rows.sort(key=lambda r: (r["year"], r["week_number"]), reverse=True)
    return rows


class WeeklyTallyDifferentialTests(TestCase):
    def test_new_builder_matches_old_semantics(self):
        branch = Branch.objects.create(name="Diff Branch", code="DB")
        coord = Person.objects.create_user(
            username="diff_coord",
            password="password123",
            role="MEMBER",
            status="ACTIVE",
            branch=branch,
        )
        cluster = Cluster.objects.create(
            code="DIFF-1",
            name="Diff Cluster",
            branch=branch,
            coordinator=coord,
        )
        empty_name_cluster = Cluster.objects.create(
            code="DIFF-2",
            name="",
            branch=branch,
            coordinator=coord,
        )
        m1 = Person.objects.create_user(
            username="diff_m1",
            password="password123",
            role="MEMBER",
            status="ACTIVE",
            branch=branch,
        )
        m2 = Person.objects.create_user(
            username="diff_m2",
            password="password123",
            role="MEMBER",
            status="ACTIVE",
            branch=branch,
        )
        v1 = Person.objects.create_user(
            username="diff_v1",
            password="password123",
            role="VISITOR",
            status="ONGOING",
            branch=branch,
        )
        eg1 = EvangelismGroup.objects.create(
            name="diff eg1", cluster=cluster, coordinator=coord
        )
        eg2 = EvangelismGroup.objects.create(
            name="diff eg2", cluster=cluster, coordinator=coord
        )
        eg_u = EvangelismGroup.objects.create(
            name="diff egu", cluster=None, coordinator=coord
        )
        eg_empty = EvangelismGroup.objects.create(
            name="diff ege", cluster=empty_name_cluster, coordinator=coord
        )

        r1 = EvangelismWeeklyReport.objects.create(
            evangelism_group=eg1,
            year=2026,
            week_number=5,
            meeting_date=date(2026, 2, 1),
            gathering_type="PHYSICAL",
            new_prospects=2,
            conversions_this_week=1,
            submitted_by=coord,
        )
        r1.members_attended.add(m1)
        r1.visitors_attended.add(v1)

        r2 = EvangelismWeeklyReport.objects.create(
            evangelism_group=eg2,
            year=2026,
            week_number=5,
            meeting_date=date(2026, 2, 2),
            gathering_type="ONLINE",
            new_prospects=3,
            conversions_this_week=0,
            submitted_by=coord,
        )
        r2.members_attended.add(m1, m2)

        cr = ClusterWeeklyReport.objects.create(
            cluster=cluster,
            year=2026,
            week_number=5,
            meeting_date=date(2026, 2, 3),
            gathering_type="HYBRID",
            submitted_by=coord,
        )
        cr.members_attended.add(m2)

        ur = EvangelismWeeklyReport.objects.create(
            evangelism_group=eg_u,
            year=2026,
            week_number=5,
            meeting_date=date(2026, 2, 4),
            gathering_type="PHYSICAL",
            submitted_by=coord,
        )
        ur.members_attended.add(m1)

        er = EvangelismWeeklyReport.objects.create(
            evangelism_group=eg_empty,
            year=2026,
            week_number=6,
            meeting_date=date(2026, 2, 10),
            gathering_type="PHYSICAL",
            submitted_by=coord,
        )
        er.members_attended.add(m1)

        # Cluster-only week for empty-name cluster
        ClusterWeeklyReport.objects.create(
            cluster=empty_name_cluster,
            year=2026,
            week_number=8,
            meeting_date=date(2026, 2, 24),
            gathering_type="ONLINE",
            submitted_by=coord,
        ).members_attended.add(m2)

        EvangelismWeeklyReport.objects.create(
            evangelism_group=eg1,
            year=2026,
            week_number=7,
            meeting_date=date(2026, 2, 17),
            gathering_type="PHYSICAL",
            new_prospects=5,
            conversions_this_week=2,
            submitted_by=coord,
        )

        ev = EvangelismWeeklyReport.objects.filter(year=2026)
        cl = ClusterWeeklyReport.objects.filter(year=2026)
        old_rows = _old_build_weekly_tally_rows(ev, cl)
        new_rows = EvangelismWeeklyReportViewSet._build_weekly_tally_rows(ev, cl)

        def row_key(row):
            return (row["cluster_id"], row["year"], row["week_number"])

        old_map = {row_key(r): r for r in old_rows}
        new_map = {row_key(r): r for r in new_rows}
        self.assertEqual(set(old_map), set(new_map))
        for key, old in old_map.items():
            self.assertEqual(old, new_map[key], msg=f"Mismatch for {key}")
