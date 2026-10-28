from __future__ import annotations

from django.db.models import Count, Prefetch, Q
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, permissions, viewsets
from rest_framework.exceptions import PermissionDenied, ValidationError

from apps.authentication.permissions import (
    IsMemberOrAbove,
    IsAuthenticatedAndNotVisitor,
    HasModuleAccess,
    IsAdmin,
)
from apps.people.models import ModuleCoordinator
from apps.ministries.models import BIBLE_SHARERS_MINISTRY_CODE, NCC_MINISTRY_CODE

from .access import (
    COORDINATOR_MEMBERSHIP_ROLES,
    apply_ministry_visibility_filter,
    apply_ministry_visibility_for_retrieve,
    user_can_manage_ministry_members,
    user_has_ministries_write,
    user_is_ministry_coordinator,
)
from .bible_sharers import (
    is_bible_sharers_ministry,
    user_can_manage_bible_sharers_ministry,
    user_is_bible_sharers_roster_manager,
)
from .models import Ministry, MinistryMember, MinistryRole
from .ncc import (
    is_ncc_ministry,
    user_can_manage_ncc_ministry,
    user_is_lessons_roster_manager,
)
from .permissions import CanWriteMinistryOrNccRoster
from .serializers import (
    MinistryListSerializer,
    MinistryMemberSerializer,
    MinistrySerializer,
)
from .utils import apply_ministry_branch_visibility

_ROSTER_ACCESS_ASSIGNMENT_PREFETCH = Prefetch(
    "memberships__member__module_coordinator_assignments",
    queryset=ModuleCoordinator.objects.filter(
        Q(
            module=ModuleCoordinator.ModuleType.LESSONS,
            level__in=(
                ModuleCoordinator.CoordinatorLevel.TEACHER,
                ModuleCoordinator.CoordinatorLevel.COORDINATOR,
                ModuleCoordinator.CoordinatorLevel.SENIOR_COORDINATOR,
            ),
        )
        | Q(
            module=ModuleCoordinator.ModuleType.EVANGELISM,
            level=ModuleCoordinator.CoordinatorLevel.BIBLE_SHARER,
            resource_id__isnull=True,
        )
        | Q(
            module=ModuleCoordinator.ModuleType.EVANGELISM,
            level=ModuleCoordinator.CoordinatorLevel.SENIOR_COORDINATOR,
        )
    ),
)


def _system_roster_extra_ministries(user, queryset):
    extra = Ministry.objects.none()
    if user_is_lessons_roster_manager(user):
        ncc_qs = queryset.filter(code=NCC_MINISTRY_CODE, is_system=True)
        extra = extra | apply_ministry_branch_visibility(ncc_qs, user)
    if user_is_bible_sharers_roster_manager(user):
        bs_qs = queryset.filter(
            code=BIBLE_SHARERS_MINISTRY_CODE, is_system=True
        )
        if (
            user.role == "ADMIN"
            or user.can_see_all_branches()
            or user.is_senior_coordinator(ModuleCoordinator.ModuleType.EVANGELISM)
        ):
            extra = extra | bs_qs
        else:
            extra = extra | apply_ministry_branch_visibility(bs_qs, user)
    return extra


_COMMITTEE_LEADERSHIP_FIELDS = (
    "primary_coordinator_id",
    "support_coordinator_ids",
    "primary_coordinator",
    "support_coordinators",
)


class MinistryWritePermission(permissions.BasePermission):
    """Ministries write, ministry coordinators, or Cluster Committee leadership."""

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated or getattr(user, "role", None) == "VISITOR":
            return False
        if user.role in ("ADMIN", "PASTOR"):
            return True
        if HasModuleAccess(
            ModuleCoordinator.ModuleType.MINISTRIES, "write"
        ).has_permission(request, view):
            return True
        from apps.clusters.permissions import _user_branch_is_headquarters
        from apps.ministries.cluster_committee import is_cluster_committee_primary

        if is_cluster_committee_primary(user):
            return True
        if (
            user.is_senior_coordinator(ModuleCoordinator.ModuleType.CLUSTER)
            and _user_branch_is_headquarters(user)
        ):
            return True
        return (
            Ministry.objects.filter(primary_coordinator=user).exists()
            or Ministry.objects.filter(support_coordinators=user).exists()
        )

    def has_object_permission(self, request, view, obj):
        from apps.clusters.permissions import can_manage_cluster_committee_leadership
        from apps.ministries.cluster_committee import is_cluster_committee_ministry
        from .access import user_can_edit_ministry, user_is_hq_cluster_senior

        user = request.user
        ministries_write = user_has_ministries_write(user)
        data = request.data if isinstance(getattr(request, "data", None), dict) else {}
        changing_leadership = any(key in data for key in _COMMITTEE_LEADERSHIP_FIELDS)

        if is_cluster_committee_ministry(obj):
            if changing_leadership:
                return can_manage_cluster_committee_leadership(user, obj)
            if can_manage_cluster_committee_leadership(user, obj):
                return True
            if user_is_ministry_coordinator(user, obj):
                return True
            if user_is_hq_cluster_senior(user):
                return True
            return ministries_write

        if changing_leadership:
            return ministries_write

        if ministries_write:
            return True
        return user_can_edit_ministry(user, obj)


class MinistryViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticatedAndNotVisitor]
    queryset = Ministry.objects.select_related("primary_coordinator", "branch").all()
    serializer_class = MinistrySerializer
    filter_backends = (
        DjangoFilterBackend,
        filters.SearchFilter,
        filters.OrderingFilter,
    )
    filterset_fields = (
        "activity_cadence",
        "category",
        "is_active",
        "scope",
        "branch",
        "code",
        "is_system",
    )
    search_fields = (
        "name",
        "code",
        "description",
        "primary_coordinator__first_name",
        "primary_coordinator__last_name",
    )
    ordering_fields = ("name", "activity_cadence", "created_at")
    ordering = ("name",)

    def get_serializer_class(self):
        if self.action == "list":
            return MinistryListSerializer
        return MinistrySerializer

    def _optimize_queryset(self, queryset):
        queryset = queryset.select_related("primary_coordinator", "branch")
        if getattr(self, "action", None) == "list":
            return queryset.annotate(
                member_count=Count("memberships", distinct=True)
            )
        return queryset.prefetch_related(
            "support_coordinators",
            "memberships__member",
            _ROSTER_ACCESS_ASSIGNMENT_PREFETCH,
        )

    def _branch_scoped_queryset(self):
        user = self.request.user
        queryset = Ministry.objects.all()

        # Admin and HQ pastors: all ministries
        if user.role == "ADMIN" or user.can_see_all_branches():
            return queryset

        # Roster managers: include NCC / Bible Sharers ministries they can see
        roster_extra = _system_roster_extra_ministries(user, queryset)

        # Ministry Coordinator: assigned / primary / support, then branch+national
        coordinator_assignments = user.module_coordinator_assignments.filter(
            module=ModuleCoordinator.ModuleType.MINISTRIES
        )
        if coordinator_assignments.exists():
            ministry_ids = [
                assignment.resource_id
                for assignment in coordinator_assignments
                if assignment.resource_id
            ]
            primary_coordinator_ministries = queryset.filter(primary_coordinator=user)
            support_coordinator_ministries = queryset.filter(support_coordinators=user)
            if ministry_ids:
                assigned_ministries = queryset.filter(id__in=ministry_ids)
                scoped = (
                    primary_coordinator_ministries
                    | support_coordinator_ministries
                    | assigned_ministries
                ).distinct()
            else:
                scoped = (
                    primary_coordinator_ministries | support_coordinator_ministries
                ).distinct()
            scoped = apply_ministry_branch_visibility(scoped, user)
            return (scoped | roster_extra).distinct()

        # Member / branch pastor: own branch + national (+ system rosters)
        # Coordinated ministries are included via branch scope or retrieve
        # visibility (internal rows they coordinate).
        if user.role in ("MEMBER", "PASTOR"):
            scoped = apply_ministry_branch_visibility(queryset, user)
            return (scoped | roster_extra).distinct()

        if roster_extra.exists():
            return roster_extra
        return queryset.none()

    def get_queryset(self):
        user = self.request.user
        queryset = self._branch_scoped_queryset()

        # Object actions must resolve internal rows the user may see; list uses
        # the visibility query param (default directory).
        if getattr(self, "action", None) in (
            "retrieve",
            "update",
            "partial_update",
            "destroy",
        ):
            queryset = apply_ministry_visibility_for_retrieve(queryset, user)
        else:
            mode = self.request.query_params.get("visibility", "directory")
            if mode.lower() in ("directory", "internal", "all", ""):
                queryset = apply_ministry_visibility_filter(
                    queryset, user, mode=mode or "directory"
                )
            else:
                queryset = apply_ministry_visibility_filter(
                    queryset, user, mode="directory"
                )

        return self._optimize_queryset(queryset)

    def get_permissions(self):
        """
        Override to set permissions based on action.
        """
        if self.action in ["list", "retrieve"]:
            return [IsAuthenticatedAndNotVisitor(), IsMemberOrAbove()]
        if self.action == "destroy":
            return [IsAuthenticatedAndNotVisitor(), IsAdmin()]
        if self.action in ("update", "partial_update"):
            return [IsAuthenticatedAndNotVisitor(), MinistryWritePermission()]
        return [
            IsAuthenticatedAndNotVisitor(),
            HasModuleAccess(ModuleCoordinator.ModuleType.MINISTRIES, "write"),
        ]

    def destroy(self, request, *args, **kwargs):
        # Permanent delete is admin-only (see get_permissions). System rosters
        # (NCC, Bible Sharers, Cluster Committee) may be deleted by admins.
        return super().destroy(request, *args, **kwargs)


class MinistryMemberViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticatedAndNotVisitor]
    queryset = (
        MinistryMember.objects.select_related("ministry", "ministry__branch", "member")
        .prefetch_related(
            "member__evangelism_groups",
            "ministry__support_coordinators",
            Prefetch(
                "member__module_coordinator_assignments",
                queryset=ModuleCoordinator.objects.filter(
                    Q(
                        module=ModuleCoordinator.ModuleType.LESSONS,
                        level__in=(
                            ModuleCoordinator.CoordinatorLevel.TEACHER,
                            ModuleCoordinator.CoordinatorLevel.COORDINATOR,
                            ModuleCoordinator.CoordinatorLevel.SENIOR_COORDINATOR,
                        ),
                    )
                    | Q(
                        module=ModuleCoordinator.ModuleType.EVANGELISM,
                        level=ModuleCoordinator.CoordinatorLevel.BIBLE_SHARER,
                        resource_id__isnull=True,
                    )
                    | Q(
                        module=ModuleCoordinator.ModuleType.EVANGELISM,
                        level=ModuleCoordinator.CoordinatorLevel.SENIOR_COORDINATOR,
                    )
                ),
            ),
        )
        .all()
    )
    serializer_class = MinistryMemberSerializer
    filter_backends = (
        DjangoFilterBackend,
        filters.SearchFilter,
        filters.OrderingFilter,
    )
    filterset_fields = ("ministry", "role", "is_active")
    search_fields = ("ministry__name", "member__first_name", "member__last_name")
    ordering_fields = ("join_date", "role")
    ordering = ("ministry__name", "member__first_name")

    def _branch_scoped_ministries(self):
        user = self.request.user
        ministry_qs = Ministry.objects.all()

        if user.role == "ADMIN" or user.can_see_all_branches():
            return ministry_qs

        coordinator_assignments = user.module_coordinator_assignments.filter(
            module=ModuleCoordinator.ModuleType.MINISTRIES
        )
        roster_extra = _system_roster_extra_ministries(user, ministry_qs)

        if coordinator_assignments.exists():
            ministry_ids = [
                assignment.resource_id
                for assignment in coordinator_assignments
                if assignment.resource_id
            ]
            primary = ministry_qs.filter(primary_coordinator=user)
            support = ministry_qs.filter(support_coordinators=user)
            if ministry_ids:
                assigned = ministry_qs.filter(id__in=ministry_ids)
                scoped = (primary | support | assigned).distinct()
            else:
                scoped = (primary | support).distinct()
            scoped = apply_ministry_branch_visibility(scoped, user)
            return (scoped | roster_extra).distinct()

        if user.role in ("MEMBER", "PASTOR"):
            scoped = apply_ministry_branch_visibility(ministry_qs, user)
            return (scoped | roster_extra).distinct()

        if roster_extra.exists():
            return roster_extra
        return ministry_qs.none()

    def get_queryset(self):
        user = self.request.user
        queryset = super().get_queryset()
        scoped = self._branch_scoped_ministries()
        scoped = apply_ministry_visibility_for_retrieve(scoped, user)
        queryset = queryset.filter(ministry_id__in=scoped.values_list("pk", flat=True))

        # Roster privacy: only memberships on ministries the user may view.
        if user.role in ("ADMIN", "PASTOR") or user_has_ministries_write(user):
            return queryset

        roster_q = (
            Q(ministry__primary_coordinator=user)
            | Q(ministry__support_coordinators=user)
            | Q(
                ministry__memberships__member=user,
                ministry__memberships__is_active=True,
            )
        )
        from apps.clusters.permissions import _user_branch_is_headquarters
        from .models import CLUSTER_COMMITTEE_MINISTRY_CODE

        if (
            user.is_senior_coordinator(ModuleCoordinator.ModuleType.CLUSTER)
            and _user_branch_is_headquarters(user)
        ):
            roster_q = roster_q | Q(ministry__code=CLUSTER_COMMITTEE_MINISTRY_CODE)

        if user_is_lessons_roster_manager(user):
            roster_q = roster_q | Q(
                ministry__code=NCC_MINISTRY_CODE, ministry__is_system=True
            )
        if user_is_bible_sharers_roster_manager(user):
            roster_q = roster_q | Q(
                ministry__code=BIBLE_SHARERS_MINISTRY_CODE, ministry__is_system=True
            )

        return queryset.filter(roster_q).distinct()

    def get_permissions(self):
        action = getattr(self, "action", None)
        if action is None and hasattr(self, "request"):
            method = self.request.method
            if method in ["GET", "HEAD", "OPTIONS"]:
                action = "list"
            elif method == "POST":
                action = "create"
            elif method in ["PUT", "PATCH"]:
                action = "update"
            elif method == "DELETE":
                action = "destroy"

        if action in ["list", "retrieve"]:
            return [IsAuthenticatedAndNotVisitor(), IsMemberOrAbove()]
        return [
            IsAuthenticatedAndNotVisitor(),
            CanWriteMinistryOrNccRoster(),
        ]

    def _ministry_from_request(self):
        ministry_id = self.request.data.get("ministry")
        if not ministry_id:
            return None
        try:
            return Ministry.objects.get(pk=ministry_id)
        except Ministry.DoesNotExist:
            return None

    def _assert_can_write_members(self, request, ministry: Ministry) -> None:
        user = request.user
        if not user_can_manage_ministry_members(user, ministry):
            if is_ncc_ministry(ministry):
                raise PermissionDenied(
                    "You do not have permission to manage this NCC teacher roster."
                )
            if is_bible_sharers_ministry(ministry):
                raise PermissionDenied(
                    "You do not have permission to manage this Bible Sharers roster."
                )
            raise PermissionDenied(
                "You do not have permission to manage ministry members."
            )

        # Branch-limit Ministries write for NCC / Bible Sharers (existing behavior)
        ministries_write = user_has_ministries_write(user)
        if is_ncc_ministry(ministry) and ministries_write and not (
            user.role in ("ADMIN", "PASTOR")
            or user_can_manage_ncc_ministry(user, ministry)
        ):
            if not (
                user.can_see_all_branches()
                or (user.branch_id and ministry.branch_id == user.branch_id)
            ):
                raise PermissionDenied(
                    "You do not have permission to manage this NCC teacher roster."
                )

        if is_bible_sharers_ministry(ministry) and ministries_write and not (
            user_can_manage_bible_sharers_ministry(user, ministry)
        ):
            if not (
                user.role == "ADMIN"
                or user.can_see_all_branches()
                or (user.branch_id and ministry.branch_id == user.branch_id)
            ):
                raise PermissionDenied(
                    "You do not have permission to manage this Bible Sharers roster."
                )

    def _assert_not_mutating_leadership_membership(
        self, request, membership: MinistryMember | None = None, *, creating: bool = False
    ) -> None:
        """Coordinators without Ministries write cannot alter leadership memberships."""
        user = request.user
        if user_has_ministries_write(user):
            return
        role = request.data.get("role") if isinstance(request.data, dict) else None
        if role in COORDINATOR_MEMBERSHIP_ROLES or role in (
            MinistryRole.PRIMARY_COORDINATOR,
            MinistryRole.COORDINATOR,
            "primary_coordinator",
            "coordinator",
        ):
            raise PermissionDenied(
                "Coordinator roles are managed via Primary / Support Coordinators."
            )
        if membership is not None and membership.role in COORDINATOR_MEMBERSHIP_ROLES:
            raise PermissionDenied(
                "Coordinator memberships cannot be changed here. "
                "Update Primary / Support Coordinators on the ministry instead."
            )

    def create(self, request, *args, **kwargs):
        ministry = self._ministry_from_request()
        if ministry is None:
            raise ValidationError({"ministry": "This field is required."})
        self._assert_can_write_members(request, ministry)
        self._assert_not_mutating_leadership_membership(request, creating=True)
        return super().create(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        membership = self.get_object()
        self._assert_can_write_members(request, membership.ministry)
        self._assert_not_mutating_leadership_membership(request, membership)
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        kwargs["partial"] = True
        return self.update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        membership = self.get_object()
        self._assert_can_write_members(request, membership.ministry)
        self._assert_not_mutating_leadership_membership(request, membership)
        return super().destroy(request, *args, **kwargs)
