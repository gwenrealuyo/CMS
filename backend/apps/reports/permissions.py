from apps.authentication.permissions import IsAuthenticatedAndNotVisitor


class IsReportsViewer(IsAuthenticatedAndNotVisitor):
    """Allows access to the analytics/reports hub.

    Phase 0: ADMIN and PASTOR only. Senior coordinators may be granted
    module-scoped access in a later phase.
    """

    def has_permission(self, request, view):
        if not super().has_permission(request, view):
            return False
        return request.user.role in ("ADMIN", "PASTOR")
