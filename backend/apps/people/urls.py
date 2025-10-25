from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    PersonViewSet,
    FamilyViewSet,
    ClusterViewSet,
    MilestoneViewSet,
    ClusterWeeklyReportViewSet,
)

app_name = "people"

router = DefaultRouter()
router.register(r"people", PersonViewSet, basename="person")
router.register(r"families", FamilyViewSet, basename="family")
router.register(r"clusters", ClusterViewSet, basename="cluster")
router.register(r"milestones", MilestoneViewSet, basename="milestone")
router.register(
    r"cluster-weekly-reports",
    ClusterWeeklyReportViewSet,
    basename="cluster-weekly-report",
)

urlpatterns = [
    path("", include(router.urls)),
]
