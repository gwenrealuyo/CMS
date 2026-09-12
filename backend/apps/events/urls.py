from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .self_checkin_views import (
    SelfCheckInInvitersView,
    SelfCheckInSessionView,
    SelfCheckInUndoView,
    SelfCheckInView,
    SelfCheckInVisitorsView,
)
from .views import EventViewSet

app_name = "events"

router = DefaultRouter()
router.register(r"", EventViewSet, basename="event")

urlpatterns = [
    path(
        "self-check-in/session/",
        SelfCheckInSessionView.as_view(),
        name="self-check-in-session",
    ),
    path(
        "self-check-in/visitors/",
        SelfCheckInVisitorsView.as_view(),
        name="self-check-in-visitors",
    ),
    path(
        "self-check-in/inviters/",
        SelfCheckInInvitersView.as_view(),
        name="self-check-in-inviters",
    ),
    path(
        "self-check-in/undo/",
        SelfCheckInUndoView.as_view(),
        name="self-check-in-undo",
    ),
    path("self-check-in/", SelfCheckInView.as_view(), name="self-check-in"),
    path("", include(router.urls)),
]
