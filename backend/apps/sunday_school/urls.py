from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    SundaySchoolCategoryViewSet,
    SundaySchoolClassMemberViewSet,
    SundaySchoolClassViewSet,
    SundaySchoolSessionViewSet,
)

app_name = "sunday_school"

router = DefaultRouter()
router.register(r"categories", SundaySchoolCategoryViewSet, basename="sunday-school-category")
router.register(r"classes", SundaySchoolClassViewSet, basename="sunday-school-class")
router.register(
    r"members", SundaySchoolClassMemberViewSet, basename="sunday-school-class-member"
)
router.register(r"sessions", SundaySchoolSessionViewSet, basename="sunday-school-session")

urlpatterns = [
    path("", include(router.urls)),
]

