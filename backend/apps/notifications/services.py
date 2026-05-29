"""Build in-app notification feed items for the authenticated user."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, time, timedelta
from typing import Any, Dict, List, Optional, Set

from django.db.models import Q
from django.utils import timezone

from apps.authentication.models import AccountLockout, PasswordResetRequest
from apps.authentication.permissions import is_module_enabled
from apps.clusters.models import Cluster, ClusterWeeklyReport
from apps.clusters.permissions import managed_cluster_ids_for_coordinator
from apps.evangelism.models import EvangelismGroup, EvangelismWeeklyReport, FollowUpTask
from apps.notifications.scoping import (
    clusters_oversight_queryset_for_user,
    managed_evangelism_group_ids_for_coordinator,
)
from apps.people.models import ModuleCoordinator

ACTIVITY_WINDOW_DAYS = 7
FEED_CAP = 50


@dataclass
class NotificationItem:
    key: str
    category: str  # alert | activity
    type: str
    severity: str  # info | warning | success
    title: str
    body: str
    href: str
    occurred_at: timezone.datetime

    def to_dict(self) -> Dict[str, Any]:
        return {
            "key": self.key,
            "category": self.category,
            "type": self.type,
            "severity": self.severity,
            "title": self.title,
            "body": self.body,
            "href": self.href,
            "occurred_at": self.occurred_at.isoformat(),
        }


def current_iso_week() -> tuple[int, int]:
    today = timezone.now().date()
    iso = today.isocalendar()
    return iso[0], iso[1]


def submission_severity() -> str:
    """info Mon–Wed, warning Thu–Sun."""
    weekday = timezone.now().date().weekday()
    return "warning" if weekday >= 3 else "info"


def build_notification_feed(user) -> List[NotificationItem]:
    items: List[NotificationItem] = []
    items.extend(_build_admin_alerts(user))
    items.extend(_build_cluster_report_due(user))
    items.extend(_build_evangelism_report_due(user))
    items.extend(_build_cluster_report_overdue_oversight(user))
    items.extend(_build_follow_up_alerts(user))
    items.extend(_build_activity_items(user))

    items.sort(key=lambda i: i.occurred_at, reverse=True)
    return items[:FEED_CAP]


def filter_dismissed(
    user, items: List[NotificationItem], dismissed_keys: Set[str]
) -> List[NotificationItem]:
    return [i for i in items if i.key not in dismissed_keys]


def count_unread_alerts(items: List[NotificationItem]) -> int:
    return sum(1 for i in items if i.category == "alert")


def _build_admin_alerts(user) -> List[NotificationItem]:
    if getattr(user, "role", None) != "ADMIN":
        return []

    now = timezone.now()
    items: List[NotificationItem] = []

    for reset in PasswordResetRequest.objects.filter(status="PENDING").order_by(
        "-requested_at"
    )[:10]:
        username = reset.user.username if reset.user else "Unknown"
        items.append(
            NotificationItem(
                key=f"password_reset_pending:{reset.id}",
                category="alert",
                type="password_reset_pending",
                severity="warning",
                title="Password reset pending",
                body=f"Approve or reject reset request for {username}",
                href="/admin-settings",
                occurred_at=reset.requested_at,
            )
        )

    locked = AccountLockout.objects.filter(
        Q(locked_until__isnull=False, locked_until__gt=now)
        | Q(
            lockout_count__gte=2,
            failed_attempts__gte=5,
            locked_until__isnull=True,
        )
    ).select_related("user")[:10]

    for lockout in locked:
        username = lockout.user.username if lockout.user else "Unknown"
        items.append(
            NotificationItem(
                key=f"account_locked:{lockout.user_id}",
                category="alert",
                type="account_locked",
                severity="warning",
                title="Account locked",
                body=f"{username} is locked and may need unlock",
                href="/admin-settings",
                occurred_at=lockout.last_attempt,
            )
        )

    return items


def _build_cluster_report_due(user) -> List[NotificationItem]:
    if not is_module_enabled(ModuleCoordinator.ModuleType.CLUSTER):
        return []

    managed_ids = managed_cluster_ids_for_coordinator(user)
    if not managed_ids:
        return []

    year, week = current_iso_week()
    submitted_ids = set(
        ClusterWeeklyReport.objects.filter(
            year=year, week_number=week, cluster_id__in=managed_ids
        ).values_list("cluster_id", flat=True)
    )

    severity = submission_severity()
    items: List[NotificationItem] = []
    for cluster in Cluster.objects.filter(id__in=managed_ids):
        if cluster.id in submitted_ids:
            continue
        name = cluster.name or cluster.code or f"Cluster {cluster.id}"
        items.append(
            NotificationItem(
                key=f"cluster_report_due:{cluster.id}:{year}:{week}",
                category="alert",
                type="cluster_report_due",
                severity=severity,
                title=f"Submit cluster report — Week {week}",
                body=f"{name} has no report for this week yet",
                href=f"/clusters?tab=reports&cluster={cluster.id}&week={week}",
                occurred_at=timezone.now(),
            )
        )
    return items


def _build_evangelism_report_due(user) -> List[NotificationItem]:
    if not is_module_enabled(ModuleCoordinator.ModuleType.EVANGELISM):
        return []

    managed = managed_evangelism_group_ids_for_coordinator(user)
    if not managed:
        return []

    groups = EvangelismGroup.objects.filter(id__in=managed, is_active=True)
    group_ids = list(groups.values_list("id", flat=True))
    if not group_ids:
        return []

    year, week = current_iso_week()
    submitted_ids = set(
        EvangelismWeeklyReport.objects.filter(
            year=year, week_number=week, evangelism_group_id__in=group_ids
        ).values_list("evangelism_group_id", flat=True)
    )

    severity = submission_severity()
    items: List[NotificationItem] = []
    for group in groups:
        if group.id in submitted_ids:
            continue
        items.append(
            NotificationItem(
                key=f"evangelism_report_due:{group.id}:{year}:{week}",
                category="alert",
                type="evangelism_report_due",
                severity=severity,
                title=f"Submit evangelism report — Week {week}",
                body=f"{group.name} has no report for this week yet",
                href=f"/evangelism?tab=reports&group={group.id}&week={week}",
                occurred_at=timezone.now(),
            )
        )
    return items


def _build_cluster_report_overdue_oversight(user) -> List[NotificationItem]:
    if not is_module_enabled(ModuleCoordinator.ModuleType.CLUSTER):
        return []

    role = getattr(user, "role", None)
    is_oversight = role in ("ADMIN", "PASTOR") or user.is_senior_coordinator(
        ModuleCoordinator.ModuleType.CLUSTER
    )
    if not is_oversight:
        return []

    own_managed = set(managed_cluster_ids_for_coordinator(user))
    year, week = current_iso_week()
    oversight_qs = clusters_oversight_queryset_for_user(user)
    submitted_ids = set(
        ClusterWeeklyReport.objects.filter(year=year, week_number=week).values_list(
            "cluster_id", flat=True
        )
    )

    items: List[NotificationItem] = []
    for cluster in oversight_qs:
        if cluster.id in submitted_ids:
            continue
        if cluster.id in own_managed:
            continue
        name = cluster.name or cluster.code or f"Cluster {cluster.id}"
        items.append(
            NotificationItem(
                key=f"cluster_report_overdue:{cluster.id}:{year}:{week}",
                category="alert",
                type="cluster_report_overdue",
                severity="warning",
                title=f"Cluster report missing — Week {week}",
                body=f"{name} has not submitted this week's report",
                href=f"/clusters?tab=reports&cluster={cluster.id}&week={week}",
                occurred_at=timezone.now(),
            )
        )
    return items[:20]


def _build_follow_up_alerts(user) -> List[NotificationItem]:
    if not is_module_enabled(ModuleCoordinator.ModuleType.EVANGELISM):
        return []

    today = timezone.now().date()
    items: List[NotificationItem] = []

    overdue = FollowUpTask.objects.filter(
        assigned_to=user,
        due_date__lt=today,
        status__in=[FollowUpTask.Status.PENDING, FollowUpTask.Status.IN_PROGRESS],
    ).select_related("prospect")[:15]

    for task in overdue:
        prospect = task.prospect
        name = f"{prospect.first_name} {prospect.last_name}".strip() or "Prospect"
        items.append(
            NotificationItem(
                key=f"follow_up_overdue:{task.id}",
                category="alert",
                type="follow_up_overdue",
                severity="warning",
                title="Overdue follow-up",
                body=f"{name} — due {task.due_date.isoformat()}",
                href="/evangelism?tab=groups",
                occurred_at=_date_to_aware_datetime(task.due_date),
            )
        )

    due_soon_end = today + timedelta(days=3)
    due_soon = FollowUpTask.objects.filter(
        assigned_to=user,
        due_date__gte=today,
        due_date__lte=due_soon_end,
        status__in=[FollowUpTask.Status.PENDING, FollowUpTask.Status.IN_PROGRESS],
    ).select_related("prospect")[:10]

    for task in due_soon:
        prospect = task.prospect
        name = f"{prospect.first_name} {prospect.last_name}".strip() or "Prospect"
        items.append(
            NotificationItem(
                key=f"follow_up_due_soon:{task.id}",
                category="alert",
                type="follow_up_due_soon",
                severity="info",
                title="Follow-up due soon",
                body=f"{name} — due {task.due_date.isoformat()}",
                href="/evangelism?tab=groups",
                occurred_at=_date_to_aware_datetime(task.due_date),
            )
        )

    return items


def _date_to_aware_datetime(d):
    return timezone.make_aware(datetime.combine(d, time.min))


def _aware_dt(dt):
    if timezone.is_aware(dt):
        return dt
    return timezone.make_aware(dt, timezone.get_current_timezone())


def _build_activity_items(user) -> List[NotificationItem]:
    since = timezone.now() - timedelta(days=ACTIVITY_WINDOW_DAYS)
    items: List[NotificationItem] = []

    if is_module_enabled(ModuleCoordinator.ModuleType.CLUSTER):
        cluster_reports = (
            ClusterWeeklyReport.objects.filter(
                submitted_by=user, submitted_at__gte=since
            )
            .select_related("cluster")
            .order_by("-submitted_at")[:10]
        )
        for report in cluster_reports:
            cluster = report.cluster
            name = cluster.name or cluster.code or f"Cluster {cluster.id}"
            items.append(
                NotificationItem(
                    key=f"activity:cluster_report_submitted:{report.id}",
                    category="activity",
                    type="cluster_report_submitted",
                    severity="success",
                    title="Cluster report submitted",
                    body=f"{name} — Week {report.week_number} saved successfully",
                    href=f"/clusters?tab=reports&report={report.id}",
                    occurred_at=_aware_dt(report.submitted_at),
                )
            )

    if is_module_enabled(ModuleCoordinator.ModuleType.EVANGELISM):
        evan_reports = (
            EvangelismWeeklyReport.objects.filter(
                submitted_by=user, submitted_at__gte=since
            )
            .select_related("evangelism_group")
            .order_by("-submitted_at")[:10]
        )
        for report in evan_reports:
            group = report.evangelism_group
            items.append(
                NotificationItem(
                    key=f"activity:evangelism_report_submitted:{report.id}",
                    category="activity",
                    type="evangelism_report_submitted",
                    severity="success",
                    title="Evangelism report submitted",
                    body=f"{group.name} — Week {report.week_number} saved successfully",
                    href=f"/evangelism?tab=reports&report={report.id}",
                    occurred_at=_aware_dt(report.submitted_at),
                )
            )

    return items
