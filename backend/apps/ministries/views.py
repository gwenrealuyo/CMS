from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, status, viewsets
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response

from apps.authentication.permissions import (
    IsMemberOrAbove,
    IsAuthenticatedAndNotVisitor,
    HasModuleAccess,
    IsAdmin,
)
from apps.people.models import ModuleCoordinator
from apps.ministries.models import NCC_MINISTRY_CODE

from .models import Ministry, MinistryMember
from .ncc import (
    is_ncc_ministry,
    user_can_manage_ncc_ministry,
    user_is_lessons_roster_manager,
)
from .permissions import CanWriteMinistryOrNccRoster
from .serializers import MinistryMemberSerializer, MinistrySerializer
from .utils import apply_ministry_branch_visibility


class MinistryViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticatedAndNotVisitor]
    queryset = (
        Ministry.objects.select_related("primary_coordinator", "branch")
        .prefetch_related("support_coordinators", "memberships__member")
        .all()
    )
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

    def get_queryset(self):
        user = self.request.user
        queryset = super().get_queryset()

        # Admin and HQ pastors: all ministries
        if user.role == "ADMIN" or user.can_see_all_branches():
            return queryset

        # Lessons roster managers: include NCC ministries in visible branches
        ncc_extra = Ministry.objects.none()
        if user_is_lessons_roster_manager(user):
            ncc_qs = queryset.filter(code=NCC_MINISTRY_CODE, is_system=True)
            ncc_extra = apply_ministry_branch_visibility(ncc_qs, user)

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
            return (scoped | ncc_extra).distinct()

        # Member / branch pastor: own branch + national (+ NCC for lessons managers)
        if user.role in ("MEMBER", "PASTOR"):
            scoped = apply_ministry_branch_visibility(queryset, user)
            return (scoped | ncc_extra).distinct()

        if ncc_extra.exists():
            return ncc_extra
        return queryset.none()

    def get_permissions(self):
        """
        Override to set permissions based on action.
        """
        if self.action in ["list", "retrieve"]:
            return [IsAuthenticatedAndNotVisitor(), IsMemberOrAbove()]
        if self.action == "destroy":
            return [IsAuthenticatedAndNotVisitor(), IsAdmin()]
        return [
            IsAuthenticatedAndNotVisitor(),
            HasModuleAccess(ModuleCoordinator.ModuleType.MINISTRIES, "write"),
        ]

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.is_system:
            raise ValidationError(
                {"detail": "System ministries (NCC roster) cannot be deleted."}
            )
        return super().destroy(request, *args, **kwargs)


class MinistryMemberViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticatedAndNotVisitor]
    queryset = (
        MinistryMember.objects.select_related("ministry", "ministry__branch", "member")
        .prefetch_related("ministry__support_coordinators")
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

    def get_queryset(self):
        user = self.request.user
        queryset = super().get_queryset()

        if user.role == "ADMIN" or user.can_see_all_branches():
            return queryset

        ministry_qs = Ministry.objects.all()
        coordinator_assignments = user.module_coordinator_assignments.filter(
            module=ModuleCoordinator.ModuleType.MINISTRIES
        )
        ncc_extra = Ministry.objects.none()
        if user_is_lessons_roster_manager(user):
            ncc_extra = apply_ministry_branch_visibility(
                ministry_qs.filter(code=NCC_MINISTRY_CODE, is_system=True),
                user,
            )

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
            scoped = (scoped | ncc_extra).distinct()
        elif user.role in ("MEMBER", "PASTOR"):
            scoped = apply_ministry_branch_visibility(ministry_qs, user)
            scoped = (scoped | ncc_extra).distinct()
        elif ncc_extra.exists():
            scoped = ncc_extra
        else:
            return queryset.none()

        return queryset.filter(ministry_id__in=scoped.values_list("pk", flat=True))

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
        if action == "destroy":
            return [IsAuthenticatedAndNotVisitor(), IsAdmin()]
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
        ministries_write = HasModuleAccess(
            ModuleCoordinator.ModuleType.MINISTRIES, "write"
        ).has_permission(request, self)

        if is_ncc_ministry(ministry):
            if user.role in ("ADMIN", "PASTOR") or user_can_manage_ncc_ministry(
                user, ministry
            ):
                return
            if ministries_write and (
                user.role == "ADMIN"
                or user.can_see_all_branches()
                or (user.branch_id and ministry.branch_id == user.branch_id)
            ):
                return
            raise PermissionDenied(
                "You do not have permission to manage this NCC teacher roster."
            )

        if user.role in ("ADMIN", "PASTOR") or ministries_write:
            return
        raise PermissionDenied(
            "You do not have permission to manage ministry members."
        )

    def create(self, request, *args, **kwargs):
        ministry = self._ministry_from_request()
        if ministry is None:
            raise ValidationError({"ministry": "This field is required."})
        self._assert_can_write_members(request, ministry)
        return super().create(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        membership = self.get_object()
        self._assert_can_write_members(request, membership.ministry)
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        kwargs["partial"] = True
        return self.update(request, *args, **kwargs)
