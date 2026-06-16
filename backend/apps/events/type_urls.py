from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import EventTypeViewSet

app_name = "event_types"

router = DefaultRouter()
router.register(r"", EventTypeViewSet, basename="event-type")

urlpatterns = [
    path("", include(router.urls)),
]
