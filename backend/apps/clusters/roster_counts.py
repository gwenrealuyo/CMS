"""Cluster roster counts: members vs visitors, independent of outer JOINs.

``member_count`` is MEMBER + PASTOR (converts are stored as MEMBER). Admins are
excluded. ``visitor_count`` is VISITOR only.
"""

from django.db.models import Count, IntegerField, OuterRef, Q, Subquery
from django.db.models.functions import Coalesce

from apps.people.family_counts import FAMILY_MEMBER_ROLES

from .models import Cluster


def _role_count_subquery(role_filter: Q):
    return Coalesce(
        Subquery(
            Cluster.objects.filter(pk=OuterRef("pk"))
            .order_by()
            .annotate(_c=Count("members", filter=role_filter, distinct=True))
            .values("_c")[:1],
            output_field=IntegerField(),
        ),
        0,
    )


def annotate_cluster_roster_counts(queryset):
    """Attach member/visitor counts that ignore outer ``members`` JOINs."""
    return queryset.annotate(
        member_count=_role_count_subquery(Q(members__role__in=FAMILY_MEMBER_ROLES)),
        visitor_count=_role_count_subquery(Q(members__role="VISITOR")),
    )
