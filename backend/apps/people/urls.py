from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import UserViewSet, FamilyViewSet, ClusterViewSet

app_name = "members"

router = DefaultRouter()
router.register(r'members', UserViewSet, basename='member')
router.register(r'families', FamilyViewSet, basename='family')
router.register(r'clusters', ClusterViewSet, basename='cluster')

urlpatterns = [
    path('', include(router.urls)),
]
