from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .onsite_guest_views import (
    OnsiteGuestInvitersView,
    OnsiteGuestSessionView,
    OnsiteGuestVisitorsView,
)
from .self_checkin_views import (
    EventSettingView,
    PublicSelfCheckInIdentifyView,
    PublicSelfCheckInSessionView,
    PublicSelfCheckInView,
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
        "settings/",
        EventSettingView.as_view(),
        name="event-settings",
    ),
    path(
        "onsite-guest/session/",
        OnsiteGuestSessionView.as_view(),
        name="onsite-guest-session",
    ),
    path(
        "onsite-guest/visitors/",
        OnsiteGuestVisitorsView.as_view(),
        name="onsite-guest-visitors",
    ),
    path(
        "onsite-guest/inviters/",
        OnsiteGuestInvitersView.as_view(),
        name="onsite-guest-inviters",
    ),
    path(
        "self-check-in/public/session/",
        PublicSelfCheckInSessionView.as_view(),
        name="self-check-in-public-session",
    ),
    path(
        "self-check-in/public/identify/",
        PublicSelfCheckInIdentifyView.as_view(),
        name="self-check-in-public-identify",
    ),
    path(
        "self-check-in/public/",
        PublicSelfCheckInView.as_view(),
        name="self-check-in-public",
    ),
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
