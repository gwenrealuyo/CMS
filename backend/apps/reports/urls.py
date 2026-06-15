from django.urls import path

from .views import (
    ComplianceAtRiskView,
    ComplianceExportCsvView,
    ComplianceHistoryView,
    ComplianceNotesView,
    ComplianceOverdueView,
    ComplianceView,
    EngagementExportCsvView,
    EngagementSummaryView,
    PeopleExportCsvView,
    PeopleSummaryView,
    ReportsMetaView,
)

app_name = "reports"

urlpatterns = [
    path("meta/", ReportsMetaView.as_view(), name="reports-meta"),
    path("compliance/", ComplianceView.as_view(), name="compliance"),
    path(
        "compliance/overdue/",
        ComplianceOverdueView.as_view(),
        name="compliance-overdue",
    ),
    path(
        "compliance/at-risk/",
        ComplianceAtRiskView.as_view(),
        name="compliance-at-risk",
    ),
    path(
        "compliance/history/",
        ComplianceHistoryView.as_view(),
        name="compliance-history",
    ),
    path(
        "compliance/notes/",
        ComplianceNotesView.as_view(),
        name="compliance-notes",
    ),
    path(
        "compliance/export/csv/",
        ComplianceExportCsvView.as_view(),
        name="compliance-export-csv",
    ),
    path("people/summary/", PeopleSummaryView.as_view(), name="people-summary"),
    path(
        "people/export/csv/",
        PeopleExportCsvView.as_view(),
        name="people-export-csv",
    ),
    path(
        "engagement/summary/",
        EngagementSummaryView.as_view(),
        name="engagement-summary",
    ),
    path(
        "engagement/export/csv/",
        EngagementExportCsvView.as_view(),
        name="engagement-export-csv",
    ),
]
