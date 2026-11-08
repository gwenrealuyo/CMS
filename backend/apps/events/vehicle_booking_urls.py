from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .facilities_views import VehicleBookingViewSet

app_name = "vehicle_bookings"

router = DefaultRouter()
router.register(r"", VehicleBookingViewSet, basename="vehicle-booking")

urlpatterns = [
    path("", include(router.urls)),
]
