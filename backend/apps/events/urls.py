from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .onsite_guest_views import (
    OnsiteGuestInvitersView,
    OnsiteGuestSessionView,
    OnsiteGuestVisitorsView,
)
from .registration_views import (
    EventRegistrationTierViewSet,
    EventRegistrationViewSet,
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

registration_tier_list = EventRegistrationTierViewSet.as_view(
    {"get": "list", "post": "create"}
)
registration_tier_detail = EventRegistrationTierViewSet.as_view(
    {
        "get": "retrieve",
        "put": "update",
        "patch": "partial_update",
        "delete": "destroy",
    }
)
registration_list = EventRegistrationViewSet.as_view({"get": "list"})
registration_request = EventRegistrationViewSet.as_view(
    {"post": "request_registration"}
)
registration_detail = EventRegistrationViewSet.as_view(
    {"get": "retrieve", "put": "update", "patch": "partial_update"}
)
registration_cancel = EventRegistrationViewSet.as_view({"post": "cancel"})
registration_refund = EventRegistrationViewSet.as_view({"post": "refund"})
registration_payments = EventRegistrationViewSet.as_view(
    {"get": "payments", "post": "payments"}
)

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
    path(
        "<int:event_pk>/registration-tiers/",
        registration_tier_list,
        name="event-registration-tiers",
    ),
    path(
        "<int:event_pk>/registration-tiers/<int:pk>/",
        registration_tier_detail,
        name="event-registration-tier-detail",
    ),
    path(
        "<int:event_pk>/registrations/request/",
        registration_request,
        name="event-registration-request",
    ),
    path(
        "<int:event_pk>/registrations/",
        registration_list,
        name="event-registrations",
    ),
    path(
        "registrations/<int:pk>/cancel/",
        registration_cancel,
        name="event-registration-cancel",
    ),
    path(
        "registrations/<int:pk>/refund/",
        registration_refund,
        name="event-registration-refund",
    ),
    path(
        "registrations/<int:pk>/payments/",
        registration_payments,
        name="event-registration-payments",
    ),
    path(
        "registrations/<int:pk>/",
        registration_detail,
        name="event-registration-detail",
    ),
    path("", include(router.urls)),
]
