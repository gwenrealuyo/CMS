from rest_framework.routers import DefaultRouter

from .views import MinistryMemberViewSet, MinistryViewSet

app_name = "ministries"

router = DefaultRouter()
# Register more specific routes first (members) before the catch-all empty route
router.register(r"members", MinistryMemberViewSet, basename="ministry-member")
router.register(r"", MinistryViewSet, basename="ministry")

urlpatterns = router.urls
