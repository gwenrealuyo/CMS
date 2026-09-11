from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import EventRoomViewSet

app_name = "event_rooms"

router = DefaultRouter()
router.register(r"", EventRoomViewSet, basename="event-room")

urlpatterns = [
    path("", include(router.urls)),
]
