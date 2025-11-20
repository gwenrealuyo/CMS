from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    EvangelismGroupViewSet,
    EvangelismGroupMemberViewSet,
    EvangelismSessionViewSet,
    EvangelismWeeklyReportViewSet,
    ProspectViewSet,
    FollowUpTaskViewSet,
    DropOffViewSet,
    ConversionViewSet,
    MonthlyConversionTrackingViewSet,
    Each1Reach1GoalViewSet,
)

app_name = "evangelism"

router = DefaultRouter()
router.register(r"groups", EvangelismGroupViewSet, basename="evangelism-group")
router.register(r"members", EvangelismGroupMemberViewSet, basename="evangelism-group-member")
router.register(r"sessions", EvangelismSessionViewSet, basename="evangelism-session")
router.register(r"weekly-reports", EvangelismWeeklyReportViewSet, basename="evangelism-weekly-report")
router.register(r"prospects", ProspectViewSet, basename="prospect")
router.register(r"follow-up-tasks", FollowUpTaskViewSet, basename="follow-up-task")
router.register(r"drop-offs", DropOffViewSet, basename="drop-off")
router.register(r"conversions", ConversionViewSet, basename="conversion")
router.register(r"monthly-tracking", MonthlyConversionTrackingViewSet, basename="monthly-conversion-tracking")
router.register(r"each1reach1-goals", Each1Reach1GoalViewSet, basename="each1reach1-goal")

urlpatterns = [
    path("", include(router.urls)),
]

