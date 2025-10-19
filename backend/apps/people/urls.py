from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import PersonViewSet, FamilyViewSet, ClusterViewSet, MilestoneViewSet

app_name = "people"

router = DefaultRouter()
router.register(r"people", PersonViewSet, basename="person")
router.register(r"families", FamilyViewSet, basename="family")
router.register(r"clusters", ClusterViewSet, basename="cluster")
router.register(r"milestones", MilestoneViewSet, basename="milestone")

urlpatterns = [
    path("", include(router.urls)),
]
