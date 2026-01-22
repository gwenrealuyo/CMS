"use client";

import { useState } from "react";
import Button from "@/src/components/ui/Button";
import Table from "@/src/components/ui/Table";
import { EvangelismWeeklyReport } from "@/src/types/evangelism";

interface GroupReportsSectionProps {
  reports: EvangelismWeeklyReport[];
  onAddReport: () => void;
  onEditReport: (report: EvangelismWeeklyReport) => void;
  loading?: boolean;
}

export default function GroupReportsSection({
  reports,
  onAddReport,
  onEditReport,
  loading = false,
}: GroupReportsSectionProps) {
  const [showAll, setShowAll] = useState(false);
  const DEFAULT_LIMIT = 5;

  const displayedReports = showAll
    ? reports
    : reports.slice(0, DEFAULT_LIMIT);
  const hasMoreReports = reports.length > DEFAULT_LIMIT;

  const getGatheringTypeColor = (type?: string) => {
    switch (type) {
      case "PHYSICAL":
        return "bg-green-100 text-green-800";
      case "ONLINE":
        return "bg-blue-100 text-blue-800";
      case "HYBRID":
        return "bg-purple-100 text-purple-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <h3 className="text-lg font-semibold text-gray-900">Reports</h3>
        <Button
          onClick={onAddReport}
          className="bg-blue-600 hover:bg-blue-700 w-full sm:w-auto min-h-[44px]"
        >
          Submit Report
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-8 text-gray-500">Loading...</div>
      ) : reports.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          No reports submitted
        </div>
      ) : (
        <>
          <Table
            columns={[
              {
                header: "Week",
                accessor: "week_number" as keyof EvangelismWeeklyReport,
                render: (value, row) => (
                  <span className="text-sm text-gray-700">
                    {row.year} W{value}
                  </span>
                ),
              },
              {
                header: "Meeting Date",
                accessor: "meeting_date" as keyof EvangelismWeeklyReport,
                render: (value) => (
                  <span className="text-sm text-gray-700">
                    {value
                      ? new Date(value as string).toLocaleDateString()
                      : "N/A"}
                  </span>
                ),
              },
              {
                header: "Gathering",
                accessor: "gathering_type" as keyof EvangelismWeeklyReport,
                render: (value) => (
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getGatheringTypeColor(
                      value as string
                    )}`}
                  >
                    {(value as string) || "N/A"}
                  </span>
                ),
              },
              {
                header: "Members",
                accessor: "members_attended" as keyof EvangelismWeeklyReport,
                render: (_value, row) => (
                  <span className="text-sm text-gray-700">
                    {row.members_attended?.length || 0}
                  </span>
                ),
              },
              {
                header: "Visitors",
                accessor: "visitors_attended" as keyof EvangelismWeeklyReport,
                render: (_value, row) => (
                  <span className="text-sm text-gray-700">
                    {row.visitors_attended?.length || 0}
                  </span>
                ),
              },
              {
                header: "Actions",
                accessor: "id" as keyof EvangelismWeeklyReport,
                render: (_value, row) => (
                  <div className="flex gap-1.5">
                    <Button
                      variant="secondary"
                      onClick={() => onEditReport(row)}
                      className="!text-blue-600 bg-white border border-blue-200 hover:bg-blue-50 hover:border-blue-300 text-xs py-1 px-2"
                    >
                      Edit
                    </Button>
                  </div>
                ),
              },
            ]}
            data={displayedReports}
          />
          {hasMoreReports && (
            <div className="flex justify-center pt-2">
              <Button
                variant="tertiary"
                onClick={() => setShowAll(!showAll)}
                className="text-sm"
              >
                {showAll
                  ? "Show Less"
                  : `Show More (${reports.length - DEFAULT_LIMIT} more)`}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
