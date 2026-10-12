from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    LessonAssignmentRequestViewSet,
    LessonSessionReportViewSet,
    LessonStudentEnrollmentViewSet,
    LessonViewSet,
    PersonLessonProgressViewSet,
    lesson_teacher_roster,
    visitors_awaiting_teacher,
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
router.register(
    r"enrollments",
    LessonStudentEnrollmentViewSet,
    basename="lesson-enrollment",
)
router.register(
    r"assignment-requests",
    LessonAssignmentRequestViewSet,
    basename="lesson-assignment-request",
)

urlpatterns = [
    path("teachers/", lesson_teacher_roster, name="lesson-teachers"),
    path(
        "visitors-awaiting-teacher/",
        visitors_awaiting_teacher,
        name="visitors-awaiting-teacher",
    ),
    path("", include(router.urls)),
]
