import django_filters
from django.db.models import Q

from .models import Prospect
from .services import _prospect_branch_q


class ProspectFilter(django_filters.FilterSet):
    """List filters for invited visitors / prospects."""

    invited_by = django_filters.NumberFilter(field_name="invited_by_id")
    inviter_cluster = django_filters.NumberFilter(field_name="inviter_cluster_id")
    evangelism_group = django_filters.NumberFilter(field_name="evangelism_group_id")
    endorsed_cluster = django_filters.NumberFilter(field_name="endorsed_cluster_id")
    pipeline_stage = django_filters.CharFilter(field_name="pipeline_stage")
    is_dropped_off = django_filters.BooleanFilter(field_name="is_dropped_off")
    branch = django_filters.NumberFilter(method="filter_branch")
    cluster = django_filters.NumberFilter(method="filter_cluster")
    source = django_filters.CharFilter(method="filter_source")

    class Meta:
        model = Prospect
        fields = []

    def filter_branch(self, queryset, name, value):
        return queryset.filter(_prospect_branch_q(value)).distinct()

    def filter_cluster(self, queryset, name, value):
        return queryset.filter(
            Q(inviter_cluster_id=value) | Q(endorsed_cluster_id=value)
        ).distinct()

    def filter_source(self, queryset, name, value):
        """Cluster source is explicit attribution, not the inviter's own cluster."""
        has_cluster = Q(inviter_cluster_id__isnull=False) | Q(
            endorsed_cluster_id__isnull=False
        )
        if value == "evangelism":
            return queryset.filter(evangelism_group_id__isnull=False)
        if value == "cluster":
            return queryset.filter(evangelism_group_id__isnull=True).filter(has_cluster)
        if value == "both":
            return queryset.filter(evangelism_group_id__isnull=False).filter(has_cluster)
        return queryset
