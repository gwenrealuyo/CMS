"""Cluster transfer request create / approve / reject."""

from __future__ import annotations

from typing import Optional

from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError

from apps.people.models import Person

from .models import Cluster, ClusterTransferRequest
from .primary_membership import apply_cluster_transfer
from . import permissions as cluster_perms


def can_request_cluster_transfer(user, from_cluster: Cluster, to_cluster: Cluster) -> bool:
    if not getattr(user, "is_authenticated", False):
        return False
    if getattr(user, "role", None) in ("ADMIN", "PASTOR"):
        return True
    if cluster_perms.has_cluster_oversight_access(user):
        # Senior or Cluster Committee — branch-scoped unless all-branch picker.
        if cluster_perms.can_pick_cluster_branch(user):
            return True
        return (
            cluster_perms.cluster_oversight_covers(user, from_cluster)
            or cluster_perms.cluster_oversight_covers(user, to_cluster)
        )
    operated = set(cluster_perms.managed_cluster_ids_for_operator(user))
    return from_cluster.id in operated or to_cluster.id in operated


def can_review_cluster_transfer(user, transfer: Optional[ClusterTransferRequest] = None) -> bool:
    if not getattr(user, "is_authenticated", False):
        return False
    if getattr(user, "role", None) in ("ADMIN", "PASTOR"):
        return True
    if not cluster_perms.has_cluster_oversight_access(user):
        return False
    if transfer is None:
        return True
    if cluster_perms.can_pick_cluster_branch(user):
        return True
    return (
        cluster_perms.cluster_oversight_covers(user, transfer.from_cluster)
        or cluster_perms.cluster_oversight_covers(user, transfer.to_cluster)
    )


def submit_cluster_transfer_request(
    *,
    person: Person,
    from_cluster: Cluster,
    to_cluster: Cluster,
    requested_by: Person,
    reason: str = "",
) -> ClusterTransferRequest:
    if from_cluster.id == to_cluster.id:
        raise ValidationError(
            {"to_cluster_id": "Destination must differ from the source cluster."}
        )
    if not person.clusters.filter(id=from_cluster.id).exists():
        raise ValidationError(
            {"from_cluster_id": "Person is not a member of the source cluster."}
        )
    if not from_cluster.is_active or not to_cluster.is_active:
        raise ValidationError(
            {"detail": "Both source and destination clusters must be active."}
        )
    if not can_request_cluster_transfer(requested_by, from_cluster, to_cluster):
        raise PermissionDenied(
            "You do not have permission to request this cluster transfer."
        )
    if ClusterTransferRequest.objects.filter(
        person=person, status=ClusterTransferRequest.Status.PENDING
    ).exists():
        raise ValidationError(
            {
                "detail": (
                    "This person already has a pending cluster transfer request."
                )
            }
        )

    return ClusterTransferRequest.objects.create(
        person=person,
        from_cluster=from_cluster,
        to_cluster=to_cluster,
        requested_by=requested_by,
        reason=(reason or "").strip(),
        status=ClusterTransferRequest.Status.PENDING,
    )


@transaction.atomic
def approve_cluster_transfer_request(
    transfer: ClusterTransferRequest,
    reviewer: Person,
    *,
    note: str = "",
) -> ClusterTransferRequest:
    if transfer.status != ClusterTransferRequest.Status.PENDING:
        raise ValidationError({"detail": "Only pending transfers can be approved."})
    if not can_review_cluster_transfer(reviewer, transfer):
        raise PermissionDenied(
            "You do not have permission to approve cluster transfers."
        )

    apply_cluster_transfer(
        transfer.person,
        transfer.from_cluster,
        transfer.to_cluster,
        actor=reviewer,
    )
    transfer.status = ClusterTransferRequest.Status.APPROVED
    transfer.reviewed_by = reviewer
    transfer.reviewed_at = timezone.now()
    transfer.review_note = (note or "").strip()
    transfer.save(
        update_fields=[
            "status",
            "reviewed_by",
            "reviewed_at",
            "review_note",
            "updated_at",
        ]
    )
    return transfer


@transaction.atomic
def reject_cluster_transfer_request(
    transfer: ClusterTransferRequest,
    reviewer: Person,
    *,
    note: str = "",
) -> ClusterTransferRequest:
    if transfer.status != ClusterTransferRequest.Status.PENDING:
        raise ValidationError({"detail": "Only pending transfers can be rejected."})
    if not can_review_cluster_transfer(reviewer, transfer):
        raise PermissionDenied(
            "You do not have permission to reject cluster transfers."
        )

    transfer.status = ClusterTransferRequest.Status.REJECTED
    transfer.reviewed_by = reviewer
    transfer.reviewed_at = timezone.now()
    transfer.review_note = (note or "").strip()
    transfer.save(
        update_fields=[
            "status",
            "reviewed_by",
            "reviewed_at",
            "review_note",
            "updated_at",
        ]
    )
    return transfer
