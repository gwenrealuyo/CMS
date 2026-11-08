from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .facilities_views import EquipmentBookingViewSet, EquipmentTypeViewSet

app_name = "equipment"

types_router = DefaultRouter()
types_router.register(r"", EquipmentTypeViewSet, basename="equipment-type")

bookings_router = DefaultRouter()
bookings_router.register(r"", EquipmentBookingViewSet, basename="equipment-booking")

urlpatterns = [
    path("types/", include(types_router.urls)),
    path("bookings/", include(bookings_router.urls)),
]
