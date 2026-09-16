"""Bible Sharers people directory + cluster coverage payload."""

from collections import defaultdict
from typing import Optional

from rest_framework.exceptions import ValidationError

from apps.clusters.models import Cluster
from apps.ministries.bible_sharers import (
    get_bible_sharers_ministry,
    headquarters_branch,
    user_can_manage_bible_sharers_ministry,
)
from apps.ministries.models import MinistryMember
from apps.people.models import Branch, ModuleCoordinator, Person

from .models import EvangelismGroup
from .serializers import ClusterSummarySerializer

NO_CLUSTER_KEY = "unclustered"


def parse_coverage_branch_id(raw) -> Optional[int]:
    if raw in (None, ""):
        return None
    try:
        branch_id = int(raw)
    except (TypeError, ValueError) as exc:
        raise ValidationError({"branch": "Branch must be a valid integer."}) from exc
    if not Branch.objects.filter(id=branch_id).exists():
        raise ValidationError({"branch": "Branch not found."})
    return branch_id


def _person_name(person: Person) -> str:
    return person.get_full_name() or person.username


def _include_hq_roster(branch_id: Optional[int]) -> bool:
    if branch_id is None:
        return True
    hq = headquarters_branch()
    return hq is not None and hq.id == branch_id


def _assignment_in_scope(group: EvangelismGroup, person: Person, branch_id: Optional[int]) -> bool:
    if branch_id is None:
        return True
    if group.branch_id:
        return group.branch_id == branch_id
    if group.cluster_id:
        return group.cluster.branch_id == branch_id
    return person.branch_id == branch_id


def _serialize_group_cluster(group: EvangelismGroup):
    if not group.cluster_id:
        return None
    return ClusterSummarySerializer(group.cluster).data


def build_bible_sharers_coverage(*, user, branch_id: Optional[int]) -> dict:
    assignments = ModuleCoordinator.objects.filter(
        module=ModuleCoordinator.ModuleType.EVANGELISM,
        level=ModuleCoordinator.CoordinatorLevel.BIBLE_SHARER,
        resource_id__isnull=False,
    ).select_related("person")

    group_ids = {a.resource_id for a in assignments if a.resource_id}
    groups_by_id = {
        g.id: g
        for g in EvangelismGroup.objects.filter(
            id__in=group_ids, is_active=True
        ).select_related("cluster", "cluster__branch", "branch", "coordinator")
    }

    people_by_cluster = defaultdict(dict)
    groups_by_cluster = defaultdict(dict)
    directory_groups = defaultdict(dict)

    for assignment in assignments:
        group = groups_by_id.get(assignment.resource_id)
        if not group:
            continue
        person = assignment.person
        if not _assignment_in_scope(group, person, branch_id):
            continue

        directory_groups[person.id][group.id] = group
        cluster_key = group.cluster_id if group.cluster_id else NO_CLUSTER_KEY
        person_entry = people_by_cluster[cluster_key].setdefault(
            person.id,
            {
                "id": person.id,
                "name": _person_name(person),
                "group_ids": [],
            },
        )
        if group.id not in person_entry["group_ids"]:
            person_entry["group_ids"].append(group.id)
        groups_by_cluster[cluster_key].setdefault(
            group.id,
            {
                "id": group.id,
                "name": group.name,
                "coordinator": (
                    group.coordinator.get_full_name() if group.coordinator else None
                ),
                "bible_sharers_count": 0,
            },
        )

    for cluster_key, people in people_by_cluster.items():
        for person_entry in people.values():
            for gid in person_entry["group_ids"]:
                groups_by_cluster[cluster_key][gid]["bible_sharers_count"] += 1

    grant_person_ids = set(
        ModuleCoordinator.objects.filter(
            module=ModuleCoordinator.ModuleType.EVANGELISM,
            level=ModuleCoordinator.CoordinatorLevel.BIBLE_SHARER,
            resource_id__isnull=True,
        ).values_list("person_id", flat=True)
    )

    ministry = get_bible_sharers_ministry()
    roster_active_by_person = {}
    if ministry is not None:
        roster_active_by_person = dict(
            MinistryMember.objects.filter(ministry=ministry).values_list(
                "member_id", "is_active"
            )
        )

    include_roster = _include_hq_roster(branch_id)
    directory_ids = set(directory_groups.keys())
    if include_roster:
        directory_ids.update(roster_active_by_person.keys())
        directory_ids.update(grant_person_ids)

    people_by_id = {
        p.id: p
        for p in Person.objects.filter(id__in=directory_ids).order_by(
            "last_name", "first_name", "id"
        )
    }

    people_rows = []
    assigned_count = 0
    for person in people_by_id.values():
        groups = [
            {
                "id": group.id,
                "name": group.name,
                "cluster": _serialize_group_cluster(group),
            }
            for group in sorted(
                directory_groups.get(person.id, {}).values(),
                key=lambda g: (g.name.lower(), g.id),
            )
        ]
        assigned = len(groups) > 0
        if assigned:
            assigned_count += 1
        on_roster = person.id in roster_active_by_person
        people_rows.append(
            {
                "id": person.id,
                "name": _person_name(person),
                "on_hq_roster": on_roster,
                "roster_active": (
                    roster_active_by_person[person.id] if on_roster else None
                ),
                "has_module_wide_grant": person.id in grant_person_ids,
                "assigned": assigned,
                "groups": groups,
                "group_count": len(groups),
            }
        )

    clusters_qs = Cluster.objects.all().order_by("name")
    if branch_id is not None:
        clusters_qs = clusters_qs.filter(branch_id=branch_id)
    clusters = list(clusters_qs)

    coverage = []
    clusters_without = []
    total_sharer_groups = set()

    def _coverage_people(cluster_key):
        people = list(people_by_cluster.get(cluster_key, {}).values())
        groups_data = list(groups_by_cluster.get(cluster_key, {}).values())
        return people, groups_data

    for cluster in clusters:
        people, groups_data = _coverage_people(cluster.id)
        has_sharers = len(people) > 0
        if has_sharers:
            for group in groups_data:
                total_sharer_groups.add(group["id"])
        else:
            clusters_without.append(cluster.name)
        coverage.append(
            {
                "cluster": ClusterSummarySerializer(cluster).data,
                "has_bible_sharers": has_sharers,
                "bible_sharers": [
                    {
                        "id": person["id"],
                        "name": person["name"],
                        "groups": [
                            groups_by_cluster[cluster.id][gid]["name"]
                            for gid in person["group_ids"]
                            if gid in groups_by_cluster[cluster.id]
                        ],
                    }
                    for person in people
                ],
                "bible_sharers_groups": groups_data,
                "bible_sharers_count": len(people),
            }
        )

    unclustered_people, unclustered_groups = _coverage_people(NO_CLUSTER_KEY)
    if unclustered_people:
        for group in unclustered_groups:
            total_sharer_groups.add(group["id"])
        coverage.append(
            {
                "cluster": {
                    "id": None,
                    "name": "No cluster",
                    "code": None,
                    "branch": None,
                },
                "has_bible_sharers": True,
                "bible_sharers": [
                    {
                        "id": person["id"],
                        "name": person["name"],
                        "groups": [
                            groups_by_cluster[NO_CLUSTER_KEY][gid]["name"]
                            for gid in person["group_ids"]
                            if gid in groups_by_cluster[NO_CLUSTER_KEY]
                        ],
                    }
                    for person in unclustered_people
                ],
                "bible_sharers_groups": unclustered_groups,
                "bible_sharers_count": len(unclustered_people),
            }
        )

    can_manage = False
    ministry_id = None
    if ministry is not None:
        ministry_id = ministry.id
        can_manage = user_can_manage_bible_sharers_ministry(user, ministry)

    clustered_coverage = [item for item in coverage if item["cluster"]["id"] is not None]

    return {
        "people": people_rows,
        "coverage": coverage,
        "summary": {
            "total_bible_sharers": len(people_rows),
            "assigned_count": assigned_count,
            "unassigned_count": len(people_rows) - assigned_count,
            "total_clusters": len(clusters),
            "clusters_with_bible_sharers": sum(
                1 for item in clustered_coverage if item["has_bible_sharers"]
            ),
            "clusters_without_bible_sharers": len(clusters_without),
            "clusters_without_names": clusters_without,
            "total_bible_sharers_groups": len(total_sharer_groups),
            "bible_sharers_ministry_id": ministry_id,
            "can_manage_roster": can_manage,
        },
    }
