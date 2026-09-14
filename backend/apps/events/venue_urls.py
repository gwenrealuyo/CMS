from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import AttendanceVenueViewSet

app_name = "attendance_venues"

router = DefaultRouter()
router.register(r"", AttendanceVenueViewSet, basename="attendance-venue")

urlpatterns = [
    path("", include(router.urls)),
]
