from django.urls import path

from .views import (
    ComplianceAtRiskView,
    ComplianceExportCsvView,
    ComplianceHistoryView,
    ComplianceNotesView,
    ComplianceOverdueView,
    ComplianceView,
    CymExportCsvView,
    CymSummaryView,
    EngagementExportCsvView,
    EngagementSummaryView,
    NccExportCsvView,
    NccSummaryView,
    OverviewSummaryView,
    PeopleExportCsvView,
    PeopleSummaryView,
    ReportsMetaView,
    StewardshipExportCsvView,
    StewardshipSummaryView,
    V2bExportCsvView,
    V2bSummaryView,
)

app_name = "reports"

urlpatterns = [
    path("meta/", ReportsMetaView.as_view(), name="reports-meta"),
    path("overview/", OverviewSummaryView.as_view(), name="overview-summary"),
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
    path("ncc/summary/", NccSummaryView.as_view(), name="ncc-summary"),
    path("ncc/export/csv/", NccExportCsvView.as_view(), name="ncc-export-csv"),
    path("cym/summary/", CymSummaryView.as_view(), name="cym-summary"),
    path("cym/export/csv/", CymExportCsvView.as_view(), name="cym-export-csv"),
    path("v2b/summary/", V2bSummaryView.as_view(), name="v2b-summary"),
    path("v2b/export/csv/", V2bExportCsvView.as_view(), name="v2b-export-csv"),
    path(
        "stewardship/summary/",
        StewardshipSummaryView.as_view(),
        name="stewardship-summary",
    ),
    path(
        "stewardship/export/csv/",
        StewardshipExportCsvView.as_view(),
        name="stewardship-export-csv",
    ),
]
