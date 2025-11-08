from rest_framework.routers import DefaultRouter

from .views import MinistryMemberViewSet, MinistryViewSet

app_name = "ministries"

router = DefaultRouter()
router.register(r"", MinistryViewSet, basename="ministry")
router.register(r"members", MinistryMemberViewSet, basename="ministry-member")

urlpatterns = router.urls
