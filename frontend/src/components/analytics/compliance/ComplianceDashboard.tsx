"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { reportsApi } from "@/src/lib/api";
import {
  AtRiskCluster,
  ClusterCompliance,
  ComplianceData,
  ComplianceHistory,
  ComplianceNote,
  ComplianceStatus,
  OverdueClusters,
} from "@/src/types/cluster";
import Card from "@/src/components/ui/Card";
import ErrorMessage from "@/src/components/ui/ErrorMessage";
import LoadingSpinner from "@/src/components/ui/LoadingSpinner";
import AnalyticsExportButton from "@/src/components/analytics/AnalyticsExportButton";
import KpiCard from "@/src/components/analytics/KpiCard";
import { kpiIcon } from "@/src/components/analytics/analyticsKpiIcons";
import {
  toneForComplianceRate,
  toneWhenPositiveIsBad,
} from "@/src/lib/kpiValueTone";
import {
  ChartPieIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  Squares2X2Icon,
} from "@heroicons/react/24/outline";
import ComplianceHistoryChart from "./ComplianceHistoryChart";
import ComplianceRiskPanels from "./ComplianceRiskPanels";
import ComplianceNotes from "./ComplianceNotes";

interface ComplianceDashboardProps {
  /** "" means all branches; otherwise a branch id string. */
  selectedBranchId: string;
}

function daysAgoISO(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().split("T")[0];
}

function todayISO() {
  return new Date().toISOString().split("T")[0];
}

function statusBadgeColor(status: ComplianceStatus) {
  switch (status) {
    case "COMPLIANT":
      return "bg-green-100 text-green-800";
    case "NON_COMPLIANT":
      return "bg-red-100 text-red-800";
    case "PARTIAL":
      return "bg-yellow-100 text-yellow-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

function trendIcon(trend: string) {
  if (trend === "IMPROVING") return "\u2191";
  if (trend === "DECLINING") return "\u2193";
  return "\u2192";
}

export default function ComplianceDashboard({
  selectedBranchId,
}: ComplianceDashboardProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [data, setData] = useState<ComplianceData | null>(null);
  const [history, setHistory] = useState<ComplianceHistory | null>(null);
  const [atRisk, setAtRisk] = useState<AtRiskCluster[]>([]);
  const [overdue, setOverdue] = useState<OverdueClusters | null>(null);
  const [notes, setNotes] = useState<ComplianceNote[]>([]);

  const [startDate, setStartDate] = useState<string>(() => daysAgoISO(28));
  const [endDate, setEndDate] = useState<string>(() => todayISO());
  const [statusFilter, setStatusFilter] = useState<ComplianceStatus | "ALL">(
    "ALL",
  );

  const branchParam = useMemo(
    () => (selectedBranchId ? Number(selectedBranchId) : undefined),
    [selectedBranchId],
  );

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const commonParams = {
        branch_id: branchParam,
        start_date: startDate,
        end_date: endDate,
        status: statusFilter !== "ALL" ? statusFilter : undefined,
      };
      const [complianceRes, historyRes, atRiskRes, overdueRes, notesRes] =
        await Promise.all([
          reportsApi.getCompliance(commonParams),
          reportsApi.getComplianceHistory({
            branch_id: branchParam,
            group_by: "week",
          }),
          reportsApi.getComplianceAtRisk({ branch_id: branchParam }),
          reportsApi.getComplianceOverdue({ branch_id: branchParam }),
          reportsApi.getComplianceNotes({ branch_id: branchParam }),
        ]);
      setData(complianceRes.data);
      setHistory(historyRes.data);
      setAtRisk(atRiskRes.data);
      setOverdue(overdueRes.data);
      setNotes(notesRes.data);
    } catch (err) {
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data
          ?.error || "Failed to load compliance data.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [branchParam, startDate, endDate, statusFilter]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const handleExportCSV = async () => {
    try {
      const res = await reportsApi.exportComplianceCSV({
        branch_id: branchParam,
        start_date: startDate,
        end_date: endDate,
        status: statusFilter !== "ALL" ? statusFilter : undefined,
      });
      const blob = new Blob([res.data as BlobPart], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `cluster_compliance_${startDate}_${endDate}.csv`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Failed to export CSV", err);
    }
  };

  const clusterOptions = useMemo(
    () =>
      (data?.clusters ?? []).map((item: ClusterCompliance) => ({
        id: item.cluster.id,
        label:
          item.cluster.name ||
          item.cluster.code ||
          `Cluster ${item.cluster.id}`,
      })),
    [data?.clusters],
  );

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

  const summary = data?.summary;

  return (
    <div className="space-y-6">
      {summary && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            label="Total Clusters"
            value={summary.total_clusters}
            icon={kpiIcon(Squares2X2Icon)}
          />
          <KpiCard
            label="Compliant"
            value={summary.compliant_clusters}
            valueTone={
              summary.total_clusters > 0 &&
              summary.compliant_clusters === summary.total_clusters
                ? "success"
                : summary.compliant_clusters === 0
                  ? "danger"
                  : "default"
            }
            icon={kpiIcon(CheckCircleIcon)}
          />
          <KpiCard
            label="Non-Compliant"
            value={summary.non_compliant_clusters}
            valueTone={toneWhenPositiveIsBad(summary.non_compliant_clusters)}
            icon={kpiIcon(ExclamationTriangleIcon)}
          />
          <KpiCard
            label="Overall Rate"
            value={`${summary.compliance_rate.toFixed(1)}%`}
            valueTone={toneForComplianceRate(summary.compliance_rate)}
            icon={kpiIcon(ChartPieIcon)}
          />
        </div>
      )}

      <Card>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <div>
            <label className="mb-1 block text-base font-medium text-foreground">
              Start Date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2"
            />
          </div>
          <div>
            <label className="mb-1 block text-base font-medium text-foreground">
              End Date
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2"
            />
          </div>
          <div>
            <label className="mb-1 block text-base font-medium text-foreground">
              Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(e.target.value as ComplianceStatus | "ALL")
              }
              className="h-[42px] w-full rounded-md border border-gray-300 px-3 py-2"
            >
              <option value="ALL">All</option>
              <option value="COMPLIANT">Compliant</option>
              <option value="PARTIAL">Partial</option>
              <option value="NON_COMPLIANT">Non-Compliant</option>
            </select>
          </div>
          <div className="flex items-end">
            <AnalyticsExportButton
              onClick={handleExportCSV}
              reportName="compliance"
            />
          </div>
        </div>
      </Card>

      <ComplianceHistoryChart history={history} loading={loading} />

      <ComplianceRiskPanels
        atRisk={atRisk}
        overdue={overdue}
        loading={loading}
      />

      <Card>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {[
                  "Cluster",
                  "Coordinator",
                  "Status",
                  "Compliance Rate",
                  "Reports",
                  "Last Report",
                  "Days Since",
                  "Trend",
                ].map((h) => (
                  <th
                    key={h}
                    className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {(data?.clusters ?? []).map((item: ClusterCompliance) => (
                <tr key={item.cluster.id}>
                  <td className="whitespace-nowrap px-6 py-4">
                    <div className="text-sm font-medium text-gray-900">
                      {item.cluster.name ||
                        item.cluster.code ||
                        `Cluster ${item.cluster.id}`}
                    </div>
                    {item.cluster.code && (
                      <div className="text-sm text-gray-500">
                        {item.cluster.code}
                      </div>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
                    {item.cluster.coordinator
                      ? `${item.cluster.coordinator.first_name} ${item.cluster.coordinator.last_name}`
                      : "N/A"}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4">
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-semibold ${statusBadgeColor(
                        item.status,
                      )}`}
                    >
                      {item.status}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4">
                    <div className="flex items-center">
                      <div className="mr-2 h-2 w-16 rounded-full bg-gray-200">
                        <div
                          className={`h-2 rounded-full ${
                            item.compliance_rate >= 100
                              ? "bg-green-500"
                              : item.compliance_rate >= 50
                                ? "bg-yellow-500"
                                : "bg-red-500"
                          }`}
                          style={{
                            width: `${Math.min(item.compliance_rate, 100)}%`,
                          }}
                        />
                      </div>
                      <span className="text-sm text-gray-900">
                        {item.compliance_rate.toFixed(1)}%
                      </span>
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
                    {item.reports_submitted} / {item.reports_expected}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
                    {item.last_report_date
                      ? new Date(item.last_report_date).toLocaleDateString()
                      : "Never"}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
                    {item.days_since_last_report !== null
                      ? `${item.days_since_last_report} days`
                      : "N/A"}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
                    <span className="text-lg">{trendIcon(item.trend)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {(data?.clusters?.length ?? 0) === 0 && (
          <div className="py-8 text-center text-gray-500">
            No compliance data found for the selected period.
          </div>
        )}
      </Card>

      <ComplianceNotes
        notes={notes}
        clusterOptions={clusterOptions}
        defaultPeriodStart={startDate}
        defaultPeriodEnd={endDate}
        loading={loading}
        onNoteAdded={fetchAll}
      />
    </div>
  );
}
