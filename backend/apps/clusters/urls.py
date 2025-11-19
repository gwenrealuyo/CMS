from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    ClusterViewSet,
    ClusterWeeklyReportViewSet,
)

app_name = "clusters"

router = DefaultRouter()
router.register(r"clusters", ClusterViewSet, basename="cluster")
router.register(
    r"cluster-weekly-reports",
    ClusterWeeklyReportViewSet,
    basename="cluster-weekly-report",
)

urlpatterns = [
    path("", include(router.urls)),
]
