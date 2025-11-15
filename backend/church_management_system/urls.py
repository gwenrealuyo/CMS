from django.contrib import admin
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from members.views import UserViewSet, FamilyViewSet, ClusterViewSet
from events.views import EventViewSet, AttendanceViewSet
from apps.finance.views import DonationViewSet, OfferingViewSet, PledgeViewSet
from apps.ministries.views import MinistryViewSet, MinistryMemberViewSet
from lessons.views import LessonViewSet, LessonCompletionViewSet

router = DefaultRouter()
# Members
# router.register(r'members', UserViewSet)
router.register(r"families", FamilyViewSet)
router.register(r"clusters", ClusterViewSet)
# Events
router.register(r"events", EventViewSet)
router.register(r"attendance", AttendanceViewSet)
# Finance
router.register(r"finance/donations", DonationViewSet)
router.register(r"finance/offerings", OfferingViewSet)
router.register(r"finance/pledges", PledgeViewSet)
# Ministries
router.register(r"ministries", MinistryViewSet)
router.register(r"ministry-members", MinistryMemberViewSet)
# Lessons
router.register(r"lessons", LessonViewSet)
router.register(r"lesson-completions", LessonCompletionViewSet)

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", include(router.urls)),
    path("api-auth/", include("rest_framework.urls")),
]
