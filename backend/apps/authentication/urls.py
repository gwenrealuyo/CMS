from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView

from . import views

app_name = "authentication"

urlpatterns = [
    path("login/", views.login_view, name="login"),
    path("logout/", views.logout_view, name="logout"),
    path("token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("me/", views.current_user_view, name="current_user"),
    path("change-password/", views.change_password_view, name="change_password"),
    path(
        "password-reset-request/",
        views.password_reset_request_view,
        name="password_reset_request",
    ),
    path(
        "admin/password-reset-requests/",
        views.password_reset_requests_list_view,
        name="password_reset_requests_list",
    ),
    path(
        "admin/password-reset-requests/<int:id>/approve/",
        views.approve_password_reset_view,
        name="approve_password_reset",
    ),
    path(
        "admin/password-reset-requests/<int:id>/reject/",
        views.reject_password_reset_view,
        name="reject_password_reset",
    ),
    path(
        "admin/locked-accounts/",
        views.locked_accounts_list_view,
        name="locked_accounts_list",
    ),
    path(
        "admin/unlock-account/<int:user_id>/",
        views.unlock_account_view,
        name="unlock_account",
    ),
    path("admin/audit-logs/", views.audit_logs_view, name="audit_logs"),
    path(
        "admin/dashboard-stats/",
        views.admin_dashboard_stats_view,
        name="admin_dashboard_stats",
    ),
]

