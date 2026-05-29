from django.urls import path

from . import views

app_name = "notifications"

urlpatterns = [
    path("", views.notification_list_view, name="list"),
    path("dismiss-all/", views.notification_dismiss_all_view, name="dismiss_all"),
    path(
        "<path:notification_key>/dismiss/",
        views.notification_dismiss_view,
        name="dismiss",
    ),
]
