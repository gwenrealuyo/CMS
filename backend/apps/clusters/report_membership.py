"""Sync weekly-report visitors into cluster membership."""

from __future__ import annotations

import logging
from typing import Iterable

from django.db import transaction
from django.utils import timezone

from apps.people.models import Journey, Person

from .branch_membership import sync_member_branches_to_cluster
from .models import Cluster, ClusterWeeklyReport

logger = logging.getLogger(__name__)


def _cluster_display_name(cluster: Cluster) -> str:
    if cluster.code:
        return cluster.code
    if cluster.name:
        return cluster.name
    return f"Cluster {cluster.id}"


def _remove_added_members_from_inactive_clusters(
    active_cluster: Cluster, added_member_ids: Iterable[int]
) -> None:
    ids = list(added_member_ids)
    if not active_cluster.is_active or not ids:
        return
    inactive_clusters = Cluster.objects.filter(
        is_active=False, members__id__in=ids
    ).distinct()
    for inactive in inactive_clusters:
        inactive.members.remove(*ids)


def sync_report_visitors_to_cluster_members(
    report: ClusterWeeklyReport,
    visitor_ids: Iterable[int],
    *,
    verified_by: Person | None = None,
) -> None:
    """
    When visitors attend a cluster meeting, add them to that cluster's members.
    """
    ids = {int(pk) for pk in visitor_ids}
    if not ids:
        return

    cluster = report.cluster
    existing_member_ids = set(cluster.members.values_list("id", flat=True))
    to_add_ids = ids - existing_member_ids
    if not to_add_ids:
        return

    visitors = Person.objects.filter(pk__in=to_add_ids, role="VISITOR").exclude(
        role="ADMIN"
    )
    new_visitor_ids = list(visitors.values_list("id", flat=True))
    if not new_visitor_ids:
        return

    if cluster.is_active:
        _remove_added_members_from_inactive_clusters(cluster, new_visitor_ids)

    sync_member_branches_to_cluster(cluster, new_visitor_ids)
    cluster.members.add(*new_visitor_ids)

    if not cluster.is_active:
        return

    cluster_display = _cluster_display_name(cluster)
    today = timezone.now().date()
    journeys = [
        Journey(
            user=person,
            title=f"Added to cluster: {cluster_display}",
            date=today,
            type="CLUSTER",
            description="Added to this cluster.",
            verified_by=verified_by,
        )
        for person in visitors
    ]
    if journeys:
        with transaction.atomic():
            Journey.objects.bulk_create(journeys)
        logger.info(
            "Added %s visitor(s) to cluster %s from report %s",
            len(journeys),
            cluster.id,
            report.id,
        )
