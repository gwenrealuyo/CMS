import django_filters
from django.db.models import Q

from .models import Person, Family


class NumberInFilter(django_filters.BaseInFilter, django_filters.NumberFilter):
    pass


class CharInFilter(django_filters.BaseInFilter, django_filters.CharFilter):
    pass


class PersonFilter(django_filters.FilterSet):
    """
    Server-side filters for the people directory.

    Text fields support exact / icontains / istartswith / iendswith plus *_ne.
    Dates support exact / before / after / between / is_not via dedicated params.
    """

    role = django_filters.CharFilter(field_name="role", lookup_expr="exact")
    role__in = CharInFilter(field_name="role", lookup_expr="in")
    role_ne = django_filters.CharFilter(field_name="role", lookup_expr="exact", exclude=True)

    status = django_filters.CharFilter(field_name="status", lookup_expr="exact")
    status__in = CharInFilter(field_name="status", lookup_expr="in")
    status_ne = django_filters.CharFilter(
        field_name="status", lookup_expr="exact", exclude=True
    )

    branch = django_filters.NumberFilter(field_name="branch_id")
    branch__in = NumberInFilter(field_name="branch_id", lookup_expr="in")
    branch_ne = django_filters.NumberFilter(field_name="branch_id", exclude=True)
    branch_ne__in = NumberInFilter(
        field_name="branch_id", lookup_expr="in", exclude=True
    )

    cluster = django_filters.NumberFilter(field_name="clusters__id")

    first_name = django_filters.CharFilter(field_name="first_name", lookup_expr="iexact")
    first_name__icontains = django_filters.CharFilter(
        field_name="first_name", lookup_expr="icontains"
    )
    first_name__istartswith = django_filters.CharFilter(
        field_name="first_name", lookup_expr="istartswith"
    )
    first_name__iendswith = django_filters.CharFilter(
        field_name="first_name", lookup_expr="iendswith"
    )
    first_name_ne = django_filters.CharFilter(
        field_name="first_name", lookup_expr="iexact", exclude=True
    )

    last_name = django_filters.CharFilter(field_name="last_name", lookup_expr="iexact")
    last_name__icontains = django_filters.CharFilter(
        field_name="last_name", lookup_expr="icontains"
    )
    last_name__istartswith = django_filters.CharFilter(
        field_name="last_name", lookup_expr="istartswith"
    )
    last_name__iendswith = django_filters.CharFilter(
        field_name="last_name", lookup_expr="iendswith"
    )
    last_name_ne = django_filters.CharFilter(
        field_name="last_name", lookup_expr="iexact", exclude=True
    )

    email = django_filters.CharFilter(field_name="email", lookup_expr="iexact")
    email__icontains = django_filters.CharFilter(
        field_name="email", lookup_expr="icontains"
    )
    email__istartswith = django_filters.CharFilter(
        field_name="email", lookup_expr="istartswith"
    )
    email__iendswith = django_filters.CharFilter(
        field_name="email", lookup_expr="iendswith"
    )
    email_ne = django_filters.CharFilter(
        field_name="email", lookup_expr="iexact", exclude=True
    )

    phone = django_filters.CharFilter(field_name="phone", lookup_expr="iexact")
    phone__icontains = django_filters.CharFilter(
        field_name="phone", lookup_expr="icontains"
    )
    phone__istartswith = django_filters.CharFilter(
        field_name="phone", lookup_expr="istartswith"
    )
    phone__iendswith = django_filters.CharFilter(
        field_name="phone", lookup_expr="iendswith"
    )
    phone_ne = django_filters.CharFilter(
        field_name="phone", lookup_expr="iexact", exclude=True
    )

    date_first_attended = django_filters.DateFilter(
        field_name="date_first_attended", lookup_expr="exact"
    )
    date_first_attended_before = django_filters.DateFilter(
        field_name="date_first_attended", lookup_expr="lt"
    )
    date_first_attended_after = django_filters.DateFilter(
        field_name="date_first_attended", lookup_expr="gt"
    )
    date_first_attended_ne = django_filters.DateFilter(
        field_name="date_first_attended", lookup_expr="exact", exclude=True
    )
    date_first_attended_after_or_equal = django_filters.DateFilter(
        field_name="date_first_attended", lookup_expr="gte"
    )
    date_first_attended_before_or_equal = django_filters.DateFilter(
        field_name="date_first_attended", lookup_expr="lte"
    )

    date_of_birth = django_filters.DateFilter(
        field_name="date_of_birth", lookup_expr="exact"
    )
    date_of_birth_before = django_filters.DateFilter(
        field_name="date_of_birth", lookup_expr="lt"
    )
    date_of_birth_after = django_filters.DateFilter(
        field_name="date_of_birth", lookup_expr="gt"
    )
    date_of_birth_ne = django_filters.DateFilter(
        field_name="date_of_birth", lookup_expr="exact", exclude=True
    )
    date_of_birth_after_or_equal = django_filters.DateFilter(
        field_name="date_of_birth", lookup_expr="gte"
    )
    date_of_birth_before_or_equal = django_filters.DateFilter(
        field_name="date_of_birth", lookup_expr="lte"
    )

    # Convenience aliases used by the directory FilterBar for "between"
    date_first_attended_min = django_filters.DateFilter(
        field_name="date_first_attended", lookup_expr="gte"
    )
    date_first_attended_max = django_filters.DateFilter(
        field_name="date_first_attended", lookup_expr="lte"
    )
    date_of_birth_min = django_filters.DateFilter(
        field_name="date_of_birth", lookup_expr="gte"
    )
    date_of_birth_max = django_filters.DateFilter(
        field_name="date_of_birth", lookup_expr="lte"
    )

    has_name = django_filters.BooleanFilter(method="filter_has_name")
    exclude_username = django_filters.CharFilter(method="filter_exclude_username")

    class Meta:
        model = Person
        fields = []

    def filter_has_name(self, queryset, name, value):
        if value is True:
            return queryset.exclude(Q(first_name="") | Q(last_name="")).exclude(
                first_name__isnull=True
            ).exclude(last_name__isnull=True)
        if value is False:
            return queryset.filter(
                Q(first_name="")
                | Q(last_name="")
                | Q(first_name__isnull=True)
                | Q(last_name__isnull=True)
            )
        return queryset

    def filter_exclude_username(self, queryset, name, value):
        if not value:
            return queryset
        usernames = [u.strip() for u in value.split(",") if u.strip()]
        if not usernames:
            return queryset
        return queryset.exclude(username__in=usernames)


class FamilyFilter(django_filters.FilterSet):
    """Server-side filters for the families directory."""

    branch = django_filters.NumberFilter(field_name="branch_id")
    member_count_min = django_filters.NumberFilter(
        field_name="member_count", lookup_expr="gte"
    )
    member_count_max = django_filters.NumberFilter(
        field_name="member_count", lookup_expr="lte"
    )
    member_count = django_filters.NumberFilter(
        field_name="member_count", lookup_expr="exact"
    )
    visitor_count_min = django_filters.NumberFilter(
        field_name="visitor_count", lookup_expr="gte"
    )
    visitor_count_max = django_filters.NumberFilter(
        field_name="visitor_count", lookup_expr="lte"
    )
    visitor_count = django_filters.NumberFilter(
        field_name="visitor_count", lookup_expr="exact"
    )
    name = django_filters.CharFilter(field_name="name", lookup_expr="iexact")
    name__icontains = django_filters.CharFilter(
        field_name="name", lookup_expr="icontains"
    )
    name__istartswith = django_filters.CharFilter(
        field_name="name", lookup_expr="istartswith"
    )
    name__iendswith = django_filters.CharFilter(
        field_name="name", lookup_expr="iendswith"
    )
    name_ne = django_filters.CharFilter(
        field_name="name", lookup_expr="iexact", exclude=True
    )

    class Meta:
        model = Family
        fields = []
