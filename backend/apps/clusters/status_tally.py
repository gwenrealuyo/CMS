"""Snapshot member-status tallies per cluster as of the end of a month window."""

from __future__ import annotations

import calendar
from collections import defaultdict
from datetime import date, datetime
from typing import Dict, Iterable, List, Optional, Sequence, Set, Tuple

from apps.clusters.models import Cluster
from apps.clusters.permissions import is_cluster_reporter_only
from apps.people.family_counts import FAMILY_MEMBER_ROLES
from apps.people.models import Person, PersonStatusChange
from core.datetime_utils import church_today, get_church_timezone

MEMBER_STATUSES = (
    "ACTIVE",
    "SEMIACTIVE",
    "INACTIVE",
    "DORMANT",
    "FALLAWAY",
    "DECEASED",
)

STATUS_COUNT_FIELDS = {
    "ACTIVE": "active_count",
    "SEMIACTIVE": "semiactive_count",
    "INACTIVE": "inactive_count",
    "DORMANT": "dormant_count",
    "FALLAWAY": "fallaway_count",
    "DECEASED": "deceased_count",
}

ROW_CLUSTER = "cluster"
ROW_UNASSIGNED = "unassigned"
ROW_TOTAL = "total"


def as_of_date_for_months(year: int, months: Sequence[int]) -> date:
    if not months:
        months = list(range(1, 13))
    last_month = max(months)
    last_day = calendar.monthrange(year, last_month)[1]
    return min(date(year, last_month, last_day), church_today())


def as_of_end_datetime(as_of: date) -> datetime:
    tz = get_church_timezone()
    return datetime(
        as_of.year,
        as_of.month,
        as_of.day,
        23,
        59,
        59,
        999999,
        tzinfo=tz,
    )


def empty_status_counts() -> Dict[str, int]:
    counts = {field: 0 for field in STATUS_COUNT_FIELDS.values()}
    counts["members_count"] = 0
    return counts


def _cluster_display_name(cluster: Cluster) -> str:
    return (cluster.name or cluster.code or f"Cluster {cluster.id}").strip()


def snapshot_status_from_changes(
    changes: Sequence[PersonStatusChange],
    current_status: str,
    as_of_dt: datetime,
) -> dict:
    """Reconstruct status at as_of from ordered (ascending) status changes."""
    latest = None
    first = None
    for change in changes:
        if first is None:
            first = change
        if change.created_at <= as_of_dt:
            latest = change
        else:
            break
    if latest is not None:
        return {
            "status": latest.to_status,
            "from_status": latest.from_status or None,
            "to_status": latest.to_status,
            "changed_at": latest.created_at,
            "source": latest.source,
        }
    if first is not None and first.created_at > as_of_dt:
        status = first.from_status or current_status
        return {
            "status": status,
            "from_status": None,
            "to_status": status,
            "changed_at": None,
            "source": None,
        }
    return {
        "status": current_status,
        "from_status": None,
        "to_status": current_status,
        "changed_at": None,
        "source": None,
    }


def snapshot_change_in_window(changed_at, year: int, months: Sequence[int]) -> bool:
    if changed_at is None:
        return False
    local = changed_at
    if getattr(changed_at, "tzinfo", None) is not None:
        local = changed_at.astimezone(get_church_timezone())
    return local.year == year and local.month in months


def _member_qs(branch_id: int):
    return Person.objects.filter(
        branch_id=branch_id,
        role__in=FAMILY_MEMBER_ROLES,
    )


def _person_cluster_map(
    cluster_ids: Sequence[int],
    person_ids: Iterable[int],
) -> Dict[int, Set[int]]:
    mapping: Dict[int, Set[int]] = defaultdict(set)
    person_id_list = list(person_ids)
    if cluster_ids and person_id_list:
        memberships = Cluster.members.through.objects.filter(
            cluster_id__in=cluster_ids,
            person_id__in=person_id_list,
        ).values_list("person_id", "cluster_id")
        for person_id, cluster_id in memberships:
            mapping[person_id].add(cluster_id)
    return mapping


def _load_snapshots(
    person_qs,
    as_of_dt: datetime,
) -> Dict[int, dict]:
    people = list(person_qs.only("id", "status"))
    ids = [person.id for person in people]
    changes_by_person: Dict[int, List[PersonStatusChange]] = defaultdict(list)
    if ids:
        for change in PersonStatusChange.objects.filter(person_id__in=ids).order_by(
            "person_id", "created_at", "id"
        ):
            changes_by_person[change.person_id].append(change)
    snapshots: Dict[int, dict] = {}
    for person in people:
        snapshots[person.id] = snapshot_status_from_changes(
            changes_by_person.get(person.id, []),
            person.status,
            as_of_dt,
        )
    return snapshots


def _counts_from_person_ids(
    person_ids: Iterable[int],
    snapshots: Dict[int, dict],
) -> Dict[str, int]:
    counts = empty_status_counts()
    for person_id in person_ids:
        snapshot = snapshots.get(person_id)
        if not snapshot:
            continue
        status = snapshot["status"]
        field = STATUS_COUNT_FIELDS.get(status)
        if not field:
            continue
        counts[field] += 1
        counts["members_count"] += 1
    return counts


def build_status_tally_rows(
    *,
    year: int,
    months: Sequence[int],
    branch_id: int,
    clusters: Sequence[Cluster],
    include_unassigned: bool,
) -> List[dict]:
    as_of = as_of_date_for_months(year, months)
    as_of_dt = as_of_end_datetime(as_of)
    people_qs = _member_qs(branch_id)
    snapshots = _load_snapshots(people_qs, as_of_dt)
    all_ids = set(snapshots.keys())

    cluster_ids = [cluster.id for cluster in clusters]
    person_cluster_ids = _person_cluster_map(cluster_ids, all_ids)

    rows: List[dict] = []
    total_ids: Set[int] = set()
    for cluster in clusters:
        clustered_ids = {
            person_id
            for person_id in all_ids
            if cluster.id in person_cluster_ids.get(person_id, set())
        }
        total_ids |= clustered_ids
        rows.append(
            {
                "year": year,
                "as_of": as_of.isoformat(),
                "cluster_id": cluster.id,
                "cluster_name": _cluster_display_name(cluster),
                "cluster_code": cluster.code,
                "row_kind": ROW_CLUSTER,
                **_counts_from_person_ids(clustered_ids, snapshots),
            }
        )

    if include_unassigned:
        unassigned_ids = set(
            people_qs.filter(clusters__isnull=True).values_list("id", flat=True)
        )
        if unassigned_ids:
            total_ids |= unassigned_ids
            rows.append(
                {
                    "year": year,
                    "as_of": as_of.isoformat(),
                    "cluster_id": None,
                    "cluster_name": "Unassigned",
                    "cluster_code": None,
                    "row_kind": ROW_UNASSIGNED,
                    **_counts_from_person_ids(unassigned_ids, snapshots),
                }
            )

    rows.append(
        {
            "year": year,
            "as_of": as_of.isoformat(),
            "cluster_id": None,
            "cluster_name": "Total",
            "cluster_code": None,
            "row_kind": ROW_TOTAL,
            **_counts_from_person_ids(total_ids, snapshots),
        }
    )
    return rows


def status_tally_years(branch_id: int) -> List[int]:
    years = {church_today().year}
    for created in PersonStatusChange.objects.filter(
        person__branch_id=branch_id,
        person__role__in=FAMILY_MEMBER_ROLES,
    ).datetimes("created_at", "year"):
        years.add(created.year)
    return sorted(years, reverse=True)


def people_ids_for_status_tally_detail(
    *,
    year: int,
    months: Sequence[int],
    branch_id: int,
    clusters: Sequence[Cluster],
    include_unassigned: bool,
    cluster_id: Optional[int],
    unassigned: bool,
    status: str,
) -> Tuple[List[int], Dict[int, dict], date]:
    as_of = as_of_date_for_months(year, months)
    as_of_dt = as_of_end_datetime(as_of)
    people_qs = _member_qs(branch_id)
    snapshots = _load_snapshots(people_qs, as_of_dt)
    all_ids = set(snapshots.keys())

    cluster_ids = [cluster.id for cluster in clusters]
    person_cluster_ids = _person_cluster_map(cluster_ids, all_ids)

    if unassigned:
        selected_ids = set(
            people_qs.filter(clusters__isnull=True).values_list("id", flat=True)
        )
    elif cluster_id is not None:
        selected_ids = {
            pid for pid in all_ids if cluster_id in person_cluster_ids.get(pid, set())
        }
    else:
        selected_ids = set()
        for cluster in clusters:
            selected_ids |= {
                pid
                for pid in all_ids
                if cluster.id in person_cluster_ids.get(pid, set())
            }
        if include_unassigned:
            selected_ids |= set(
                people_qs.filter(clusters__isnull=True).values_list("id", flat=True)
            )

    wanted = set(MEMBER_STATUSES) if status == "members" else {status}
    filtered = [
        pid
        for pid in selected_ids
        if snapshots.get(pid, {}).get("status") in wanted
    ]
    filtered.sort()
    return filtered, snapshots, as_of


def should_include_unassigned(user) -> bool:
    return not is_cluster_reporter_only(user)
