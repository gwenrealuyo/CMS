from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import (
    DonationViewSet,
    OfferingViewSet,
    PledgeViewSet,
    PledgeContributionViewSet,
)

app_name = "finance"

router = DefaultRouter()
router.register(r"donations", DonationViewSet, basename="finance-donation")
router.register(r"offerings", OfferingViewSet, basename="finance-offering")
router.register(r"pledges", PledgeViewSet, basename="finance-pledge")
router.register(
    r"pledge-contributions",
    PledgeContributionViewSet,
    basename="finance-pledge-contribution",
)

urlpatterns = [
    path("", include(router.urls)),
]
