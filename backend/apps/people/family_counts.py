"""Family roster counts: members vs visitors, independent of permission JOINs.

``member_count`` is MEMBER + PASTOR (converts are stored as MEMBER). Admins are
excluded. ``visitor_count`` is VISITOR only.

These counts must not reuse queryset filters that JOIN ``members`` (branch
scope, "families I'm in", cluster overlap). That JOIN would under-count the
household — e.g. a Member always seeing ``member_count=1``.
"""

from django.db.models import Count, IntegerField, OuterRef, Q, Subquery
from django.db.models.functions import Coalesce

from .models import Family

FAMILY_MEMBER_ROLES = ("MEMBER", "PASTOR")


def _role_count_subquery(role_filter: Q):
    return Coalesce(
        Subquery(
            Family.objects.filter(pk=OuterRef("pk"))
            .order_by()
            .annotate(_c=Count("members", filter=role_filter, distinct=True))
            .values("_c")[:1],
            output_field=IntegerField(),
        ),
        0,
    )


def annotate_family_roster_counts(queryset):
    """Attach household member/visitor counts that ignore outer ``members`` JOINs."""
    return queryset.annotate(
        member_count=_role_count_subquery(Q(members__role__in=FAMILY_MEMBER_ROLES)),
        visitor_count=_role_count_subquery(Q(members__role="VISITOR")),
    )


def count_family_members(family: Family) -> int:
    return family.members.filter(role__in=FAMILY_MEMBER_ROLES).count()


def count_family_visitors(family: Family) -> int:
    return family.members.filter(role="VISITOR").count()
