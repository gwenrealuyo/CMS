from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/people/", include("apps.people.urls", namespace="people")),
    path("api/events/", include("apps.events.urls")),
    path("api/attendance/", include("apps.attendance.urls", namespace="attendance")),
    # path('api/donations/', include('apps.donations.urls')),
    # path('api/volunteers/', include('apps.volunteers.urls')),
    # path('api/lessons/', include('apps.lessons.urls')),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
