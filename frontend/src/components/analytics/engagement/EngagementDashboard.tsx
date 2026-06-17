"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { reportsApi } from "@/src/lib/api";
import type { EngagementSummary } from "@/src/types/reports";
import Card from "@/src/components/ui/Card";
import AnalyticsExportButton from "@/src/components/analytics/AnalyticsExportButton";
import ErrorMessage from "@/src/components/ui/ErrorMessage";
import LoadingSpinner from "@/src/components/ui/LoadingSpinner";
import EngagementKpiRow from "./EngagementKpiRow";
import WeeklyAttendanceCharts from "./WeeklyAttendanceCharts";
import WeeklyComparisonTable from "./WeeklyComparisonTable";
import ServiceAttendanceChart from "./ServiceAttendanceChart";
import EngagementBranchTable from "./EngagementBranchTable";

interface EngagementDashboardProps {
  /** "" means all branches; otherwise a branch id string. */
  selectedBranchId: string;
}

const MONTH_OPTIONS = [6, 12, 24] as const;

export default function EngagementDashboard({
  selectedBranchId,
}: EngagementDashboardProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<EngagementSummary | null>(null);
  const [months, setMonths] = useState<number>(12);

  const branchParam = useMemo(
    () => (selectedBranchId ? Number(selectedBranchId) : undefined),
    [selectedBranchId],
  );

  const fetchSummary = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await reportsApi.getEngagementSummary({
        branch_id: branchParam,
        months,
      });
      setData(res.data);
    } catch (err) {
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data
          ?.error || "Failed to load engagement data.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [branchParam, months]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  const handleExportCSV = async () => {
    try {
      const res = await reportsApi.exportEngagementCSV({
        branch_id: branchParam,
      });
      const blob = new Blob([res.data as BlobPart], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "engagement_attendance.csv";
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Failed to export CSV", err);
    }
  };

  if (loading && !data) {
    return (
      <Card>
        <div className="flex items-center justify-center py-12">
          <LoadingSpinner />
        </div>
      </Card>
    );
  }

  if (error) {
    return <ErrorMessage message={error} />;
  }

  const clusterRows =
    data?.cluster.by_cluster.map((row) => ({
      id: row.cluster_id,
      label: row.cluster_label,
      report_count: row.report_count,
      sum_members_attended: row.sum_members_attended,
    })) ?? [];

  const groupRows =
    data?.evangelism.by_group.map((row) => ({
      id: row.group_id,
      label: row.group_label,
      report_count: row.report_count,
      sum_members_attended: row.sum_members_attended,
    })) ?? [];

  return (
    <div className="space-y-6">
      <EngagementKpiRow summary={data?.summary ?? null} />

      <Card>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <label className="mb-1 block text-base font-medium text-foreground">
              Trend window
            </label>
            <select
              value={months}
              onChange={(e) => setMonths(Number(e.target.value))}
              className="h-[42px] w-full rounded-md border border-gray-300 px-3 py-2"
            >
              {MONTH_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  Last {option} months
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end md:col-start-3">
            <AnalyticsExportButton
              onClick={handleExportCSV}
              reportName="engagement"
            />
          </div>
        </div>
      </Card>

      <ServiceAttendanceChart
        service={data?.service ?? null}
        loading={loading}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <WeeklyAttendanceCharts
          title="Cluster Attendance Trend"
          data={data?.cluster.monthly_trend ?? []}
          loading={loading}
        />
        <WeeklyAttendanceCharts
          title="Evangelism Attendance Trend"
          data={data?.evangelism.monthly_trend ?? []}
          loading={loading}
        />
      </div>

      <WeeklyComparisonTable
        title="Cluster Comparison"
        entityColumnLabel="Cluster"
        rows={clusterRows}
      />

      <WeeklyComparisonTable
        title="Evangelism Group Comparison"
        entityColumnLabel="Group"
        rows={groupRows}
      />

      {data && data.by_branch.length > 0 && (
        <EngagementBranchTable rows={data.by_branch} />
      )}
    </div>
  );
}
