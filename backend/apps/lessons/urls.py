from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    LessonSessionReportViewSet,
    LessonViewSet,
    PersonLessonProgressViewSet,
)

app_name = "lessons"

router = DefaultRouter()
router.register(r"lessons", LessonViewSet, basename="lesson")
router.register(r"progress", PersonLessonProgressViewSet, basename="lesson-progress")
router.register(
    r"session-reports",
    LessonSessionReportViewSet,
    basename="lesson-session-report",
)

urlpatterns = [
    path("", include(router.urls)),
]
