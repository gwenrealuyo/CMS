from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .facilities_views import VehicleViewSet

app_name = "vehicles"

router = DefaultRouter()
router.register(r"", VehicleViewSet, basename="vehicle")

urlpatterns = [
    path("", include(router.urls)),
]
