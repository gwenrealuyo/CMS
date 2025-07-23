from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import PersonViewSet, FamilyViewSet, ClusterViewSet

app_name = "people"

router = DefaultRouter()
router.register(r'', PersonViewSet, basename='person')
router.register(r'families', FamilyViewSet, basename='family')
router.register(r'clusters', ClusterViewSet, basename='cluster')

urlpatterns = [
    path('', include(router.urls)),
]
