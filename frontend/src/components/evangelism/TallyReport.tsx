"use client";

import { useCallback, useMemo, useState } from "react";
import Card from "@/src/components/ui/Card";
import Table from "@/src/components/ui/Table";
import { EvangelismTallyDrilldownMetric, EvangelismTallyRow } from "@/src/types/evangelism";
import { useEvangelismTally } from "@/src/hooks/useEvangelism";
import { evangelismApi } from "@/src/lib/api";
import TallyDrilldownModal from "@/src/components/evangelism/TallyDrilldownModal";

interface TallyReportProps {
  year?: number;
  clusterId?: number | string;
}

export default function TallyReport({ year, clusterId }: TallyReportProps) {
  const selectedYear = year || new Date().getFullYear();
  const { rows, loading, error } = useEvangelismTally({
    year: selectedYear,
    cluster: clusterId,
  });
  const [drilldown, setDrilldown] = useState<{
    year: number;
    weekNumber: number;
    clusterId: number | string | null;
    clusterName: string;
    metric: Extract<EvangelismTallyDrilldownMetric, "members" | "visitors">;
    label: string;
  } | null>(null);

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

  const openWeeklyDrilldown = (
    row: EvangelismTallyRow,
    metric: Extract<EvangelismTallyDrilldownMetric, "members" | "visitors">,
    label: string,
    value: number
  ) => {
    if (!value) {
      return;
    }
    setDrilldown({
      year: row.year,
      weekNumber: row.week_number,
      clusterId: row.cluster_id ?? null,
      clusterName: row.cluster_name || "Unassigned",
      metric,
      label,
    });
  };

  const renderWeeklyClickableCell = (
    row: EvangelismTallyRow,
    metric: Extract<EvangelismTallyDrilldownMetric, "members" | "visitors">,
    label: string
  ) => {
    const count = Number(
      metric === "members" ? row.members_count || 0 : row.visitors_count || 0
    );
    if (count <= 0) {
      return <span className="text-sm text-gray-400">{count}</span>;
    }
    return (
      <button
        type="button"
        className="text-sm font-medium text-blue-600 hover:text-blue-700 hover:underline"
        onClick={() => openWeeklyDrilldown(row, metric, label, count)}
      >
        {count}
      </button>
    );
  };

  const drilldownTitle = useMemo(() => {
    if (!drilldown) {
      return "Weekly Tally Records";
    }
    return `${drilldown.label} - ${drilldown.clusterName} (${drilldown.year} W${drilldown.weekNumber})`;
  }, [drilldown]);

  const fetchDrilldownPage = useCallback(
    async (page: number) => {
      if (!drilldown) {
        return { count: 0, next: null, previous: null, results: [] };
      }
      const response = await evangelismApi.getWeeklyTallyPeopleDetail({
        year: drilldown.year,
        week_number: drilldown.weekNumber,
        cluster_id: drilldown.clusterId ?? "unassigned",
        metric: drilldown.metric,
        page,
        page_size: 20,
      });
      return response.data;
    },
    [drilldown]
  );

  return (
    <Card>
      <div className="p-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Weekly Tally
        </h3>
        {loading ? (
          <div className="text-center py-8 text-gray-500">Loading tally...</div>
        ) : error ? (
          <div className="text-center py-8 text-red-500">Error: {error}</div>
        ) : rows.length === 0 ? (
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
                render: (_value, row) =>
                  renderWeeklyClickableCell(row, "members", "Members"),
              },
              {
                header: "Visitors",
                accessor: "visitors_count" as keyof EvangelismTallyRow,
                render: (_value, row) =>
                  renderWeeklyClickableCell(row, "visitors", "Visitors"),
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
      <TallyDrilldownModal
        isOpen={Boolean(drilldown)}
        title={drilldownTitle}
        requestKey={
          drilldown
            ? `${drilldown.year}-${drilldown.weekNumber}-${drilldown.clusterId}-${drilldown.metric}`
            : null
        }
        onClose={() => setDrilldown(null)}
        fetchPage={fetchDrilldownPage}
      />
    </Card>
  );
}
