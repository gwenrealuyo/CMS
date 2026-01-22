"use client";

import Card from "@/src/components/ui/Card";
import Table from "@/src/components/ui/Table";
import { EvangelismTallyRow } from "@/src/types/evangelism";
import { useEvangelismTally } from "@/src/hooks/useEvangelism";

interface TallyReportProps {
  year?: number;
  clusterId?: number | string;
}

export default function TallyReport({ year, clusterId }: TallyReportProps) {
  const { rows, loading, error } = useEvangelismTally({
    year: year || new Date().getFullYear(),
    cluster: clusterId,
  });

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

  if (loading) {
    return <div className="text-center py-8 text-gray-500">Loading tally...</div>;
  }

  if (error) {
    return <div className="text-center py-8 text-red-500">Error: {error}</div>;
  }

  return (
    <Card>
      <div className="p-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Weekly Tally
        </h3>
        {rows.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No tally data available
          </div>
        ) : (
          <Table
            columns={[
              {
                header: "Cluster",
                accessor: "cluster_name" as keyof EvangelismTallyRow,
                render: (value) => (
                  <span className="text-sm text-gray-700">{value || "N/A"}</span>
                ),
              },
              {
                header: "Week",
                accessor: "week_number" as keyof EvangelismTallyRow,
                render: (value, row) => (
                  <span className="text-sm text-gray-700">
                    {row.year} W{value}
                  </span>
                ),
              },
              {
                header: "Meeting Date",
                accessor: "meeting_date" as keyof EvangelismTallyRow,
                render: (value) => (
                  <span className="text-sm text-gray-700">
                    {value ? new Date(value as string).toLocaleDateString() : "N/A"}
                  </span>
                ),
              },
              {
                header: "Gathering",
                accessor: "gathering_type" as keyof EvangelismTallyRow,
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
                accessor: "members_count" as keyof EvangelismTallyRow,
                render: (value) => (
                  <span className="text-sm text-gray-700">{value || 0}</span>
                ),
              },
              {
                header: "Visitors",
                accessor: "visitors_count" as keyof EvangelismTallyRow,
                render: (value) => (
                  <span className="text-sm text-gray-700">{value || 0}</span>
                ),
              },
              {
                header: "New Visitors",
                accessor: "new_prospects" as keyof EvangelismTallyRow,
                render: (value) => (
                  <span className="text-sm text-gray-700">{value || 0}</span>
                ),
              },
              {
                header: "Conversions",
                accessor: "conversions_this_week" as keyof EvangelismTallyRow,
                render: (value) => (
                  <span className="text-sm text-gray-700">{value || 0}</span>
                ),
              },
              {
                header: "Reports",
                accessor: "evangelism_reports_count" as keyof EvangelismTallyRow,
                render: (_value, row) => (
                  <span className="text-sm text-gray-700">
                    {row.evangelism_reports_count + row.cluster_reports_count}
                  </span>
                ),
              },
            ]}
            data={rows}
          />
        )}
      </div>
    </Card>
  );
}
