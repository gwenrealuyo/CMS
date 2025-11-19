from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/people/", include("apps.people.urls", namespace="people")),
    path("api/clusters/", include("apps.clusters.urls", namespace="clusters")),
    path("api/events/", include("apps.events.urls")),
    path("api/attendance/", include("apps.attendance.urls", namespace="attendance")),
    path("api/ministries/", include("apps.ministries.urls", namespace="ministries")),
    path("api/lessons/", include("apps.lessons.urls", namespace="lessons")),
    path(
        "api/finance/", include(("apps.finance.urls", "finance"), namespace="finance")
    ),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
