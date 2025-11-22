from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    PersonViewSet,
    FamilyViewSet,
    MilestoneViewSet,
    ModuleCoordinatorViewSet,
)

app_name = "people"

router = DefaultRouter()
router.register(r"people", PersonViewSet, basename="person")
router.register(r"families", FamilyViewSet, basename="family")
router.register(r"milestones", MilestoneViewSet, basename="milestone")
router.register(r"module-coordinators", ModuleCoordinatorViewSet, basename="module-coordinator")

urlpatterns = [
    path("", include(router.urls)),
]
