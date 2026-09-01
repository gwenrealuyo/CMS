"use client";

import { useCallback, useMemo, useState } from "react";
import Table from "@/src/components/ui/Table";
import Modal from "@/src/components/ui/Modal";
import ViewModeToggle from "@/src/components/ui/ViewModeToggle";
import ClusterView from "@/src/components/clusters/ClusterView";
import {
  EvangelismTallyDrilldownMetric,
  EvangelismTallyRow,
} from "@/src/types/evangelism";
import type { Cluster } from "@/src/types/cluster";
import { useEvangelismTally } from "@/src/hooks/useEvangelism";
import { clustersApi, evangelismApi } from "@/src/lib/api";
import { getEvangelismGatheringTypeChipClass } from "@/src/lib/evangelismGatheringTypeStyles";
import { formatLocaleDate } from "@/src/lib/date";
import {
  resolveClusterRosterFamilies,
  resolveClusterRosterPeople,
} from "@/src/lib/clusterRoster";
import TallyDrilldownModal from "@/src/components/evangelism/TallyDrilldownModal";
import { getInitialListViewMode, useIsMdUp } from "@/src/lib/listViewMode";

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
    clusterCode: string;
    metric: Extract<EvangelismTallyDrilldownMetric, "members" | "visitors">;
    label: string;
  } | null>(null);
  const [viewCluster, setViewCluster] = useState<Cluster | null>(null);
  const [loadingClusterId, setLoadingClusterId] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<"table" | "cards">(() =>
    getInitialListViewMode("cards"),
  );
  const isMdUp = useIsMdUp();
  const effectiveViewMode: "table" | "cards" = isMdUp ? "table" : viewMode;

  const openWeeklyDrilldown = (
    row: EvangelismTallyRow,
    metric: Extract<EvangelismTallyDrilldownMetric, "members" | "visitors">,
    label: string,
    value: number,
  ) => {
    if (!value) {
      return;
    }
    setDrilldown({
      year: row.year,
      weekNumber: row.week_number,
      clusterId: row.cluster_id ?? null,
      clusterCode: row.cluster_code || "Unassigned",
      metric,
      label,
    });
  };

  const openClusterView = useCallback(async (row: EvangelismTallyRow) => {
    if (row.cluster_id == null) {
      return;
    }
    if (loadingClusterId != null) {
      return;
    }
    setLoadingClusterId(row.cluster_id);
    try {
      const { data } = await clustersApi.getById(row.cluster_id);
      setViewCluster(data);
    } catch (e) {
      console.error("Failed to load cluster detail", e);
    } finally {
      setLoadingClusterId(null);
    }
  }, [loadingClusterId]);

  const closeClusterView = useCallback(() => {
    setViewCluster(null);
  }, []);

  const renderWeeklyClickableCell = (
    row: EvangelismTallyRow,
    metric: Extract<EvangelismTallyDrilldownMetric, "members" | "visitors">,
    label: string,
  ) => {
    const count = Number(
      metric === "members" ? row.members_count || 0 : row.visitors_count || 0,
    );
    if (count <= 0) {
      return <span className="text-sm text-gray-400">{count}</span>;
    }
    return (
      <button
        type="button"
        className="text-sm font-medium text-primary hover:text-primary hover:underline"
        onClick={() => openWeeklyDrilldown(row, metric, label, count)}
      >
        {count}
      </button>
    );
  };

  const renderClusterCell = (row: EvangelismTallyRow) => {
    const code = row.cluster_code || "N/A";
    const clusterName = row.cluster_name?.trim() || undefined;
    if (row.cluster_id == null) {
      return (
        <span className="text-sm text-gray-700" title={clusterName}>
          {code}
        </span>
      );
    }
    const isLoading = loadingClusterId === row.cluster_id;
    return (
      <button
        type="button"
        className="text-sm font-medium text-primary hover:text-primary hover:underline disabled:opacity-60"
        disabled={isLoading}
        title={clusterName}
        onClick={() => void openClusterView(row)}
      >
        {code}
      </button>
    );
  };

  const drilldownTitle = useMemo(() => {
    if (!drilldown) {
      return "Weekly Tally Records";
    }
    return `${drilldown.label} - ${drilldown.clusterCode} (${drilldown.year} W${drilldown.weekNumber})`;
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
    [drilldown],
  );

  return (
    <>
      {loading ? (
        <div className="text-center py-8 text-gray-500">Loading tally...</div>
      ) : error ? (
        <div className="text-center py-8 text-red-500">Error: {error}</div>
      ) : rows.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          No tally data available
        </div>
      ) : (
        <>
          <div className="mb-3 flex flex-col gap-2 md:hidden">
            <ViewModeToggle
              viewMode={viewMode}
              onViewModeChange={setViewMode}
            />
            {viewMode === "table" && (
              <span className="text-xs text-gray-500">
                Table scrolls horizontally.
              </span>
            )}
          </div>
          <Table
            mobileCardView={effectiveViewMode === "cards"}
            columns={[
              {
                header: "Cluster",
                accessor: "cluster_code" as keyof EvangelismTallyRow,
                render: (_value, row) => renderClusterCell(row),
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
                    {formatLocaleDate(value as string) || "N/A"}
                  </span>
                ),
              },
              {
                header: "Gathering",
                accessor: "gathering_type" as keyof EvangelismTallyRow,
                render: (value) => (
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getEvangelismGatheringTypeChipClass(
                      value as string,
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
                accessor:
                  "evangelism_reports_count" as keyof EvangelismTallyRow,
                render: (_value, row) => (
                  <span className="text-sm text-gray-700">
                    {row.evangelism_reports_count + row.cluster_reports_count}
                  </span>
                ),
              },
            ]}
            data={rows}
          />
        </>
      )}
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
      {viewCluster && (
        <Modal
          isOpen={Boolean(viewCluster)}
          onClose={closeClusterView}
          title=""
          hideHeader
          closeOnOutsideClick
        >
          <ClusterView
            cluster={viewCluster}
            clusterMembers={resolveClusterRosterPeople(viewCluster, [])}
            clusterFamilies={resolveClusterRosterFamilies(viewCluster, [])}
            onEdit={() => {}}
            onDelete={() => {}}
            onClose={closeClusterView}
            onAssignMembers={() => {}}
            onSubmitReport={() => {}}
            showSubmitReportButton={false}
            canManageCluster={false}
          />
        </Modal>
      )}
    </>
  );
}
