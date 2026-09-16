"""Helpers for evangelism group approval (pending / approved / rejected)."""

from __future__ import annotations

from django.utils import timezone

from apps.evangelism.models import EvangelismGroup
from apps.evangelism.permissions import is_evangelism_senior_or_privileged


def initial_group_approval_status(user) -> str:
    if is_evangelism_senior_or_privileged(user):
        return EvangelismGroup.ApprovalStatus.APPROVED
    return EvangelismGroup.ApprovalStatus.PENDING


def mark_group_approved(group: EvangelismGroup, user, *, note: str = "") -> EvangelismGroup:
    group.approval_status = EvangelismGroup.ApprovalStatus.APPROVED
    group.reviewed_by = user
    group.reviewed_at = timezone.now()
    group.review_note = note or ""
    group.save(
        update_fields=[
            "approval_status",
            "reviewed_by",
            "reviewed_at",
            "review_note",
            "updated_at",
        ]
    )
    return group


def mark_group_rejected(group: EvangelismGroup, user, *, note: str = "") -> EvangelismGroup:
    group.approval_status = EvangelismGroup.ApprovalStatus.REJECTED
    group.reviewed_by = user
    group.reviewed_at = timezone.now()
    group.review_note = note or ""
    group.save(
        update_fields=[
            "approval_status",
            "reviewed_by",
            "reviewed_at",
            "review_note",
            "updated_at",
        ]
    )
    return group
