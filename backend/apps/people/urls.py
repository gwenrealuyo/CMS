from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    PersonViewSet,
    FamilyViewSet,
    JourneyViewSet,
    ModuleCoordinatorViewSet,
)

app_name = "people"

router = DefaultRouter()
router.register(r"people", PersonViewSet, basename="person")
router.register(r"families", FamilyViewSet, basename="family")
router.register(r"journeys", JourneyViewSet, basename="journey")
router.register(r"module-coordinators", ModuleCoordinatorViewSet, basename="module-coordinator")

urlpatterns = [
    path("", include(router.urls)),
]
