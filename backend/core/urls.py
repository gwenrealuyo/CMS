from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/auth/", include("apps.authentication.urls", namespace="authentication")),
    path("api/people/", include("apps.people.urls", namespace="people")),
    path("api/clusters/", include("apps.clusters.urls", namespace="clusters")),
    path("api/events/", include("apps.events.urls")),
    path("api/attendance/", include("apps.attendance.urls", namespace="attendance")),
    path("api/ministries/", include("apps.ministries.urls", namespace="ministries")),
    path("api/lessons/", include("apps.lessons.urls", namespace="lessons")),
    path(
        "api/finance/", include(("apps.finance.urls", "finance"), namespace="finance")
    ),
    path("api/sunday-school/", include("apps.sunday_school.urls", namespace="sunday_school")),
    path("api/evangelism/", include("apps.evangelism.urls", namespace="evangelism")),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
