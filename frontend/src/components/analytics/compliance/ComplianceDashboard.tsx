"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { clusterReportsApi, reportsApi, evangelismApi } from "@/src/lib/api";
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
import { formatLocaleDate } from "@/src/lib/date";
import { formatPersonName } from "@/src/lib/name";
import {
  getIsoWeekDateRange,
  getIsoWeekParts,
  isoWeeksInYear,
} from "@/src/lib/isoWeek";
import ScalableSelect from "@/src/components/ui/ScalableSelect";
import type { EvangelismComplianceData } from "@/src/types/evangelism";

const todayIso = getIsoWeekParts(new Date());
const ALL_WEEKS = "all";

function formatWeekDateRange(year: number, weekNumber: number): string {
  const { start, end } = getIsoWeekDateRange(year, weekNumber);
  const startMonth = start.toLocaleDateString("en-US", { month: "short" });
  const startDay = start.getDate();
  const endMonth = end.toLocaleDateString("en-US", { month: "short" });
  const endDay = end.getDate();

  if (startMonth === endMonth) {
    return `${startMonth} ${startDay}-${endDay}`;
  }
  return `${startMonth} ${startDay}-${endMonth} ${endDay}`;
}

interface ComplianceDashboardProps {
  /** "" means all branches; otherwise a branch id string. */
  selectedBranchId: string;
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

function trendIcon(trend: string | null) {
  if (trend === "IMPROVING") return "\u2191";
  if (trend === "DECLINING") return "\u2193";
  if (trend === "STABLE") return "\u2192";
  return null;
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
  const [evangelism, setEvangelism] = useState<EvangelismComplianceData | null>(
    null,
  );

  const [selectedYear, setSelectedYear] = useState<number>(todayIso.year);
  const [availableYears, setAvailableYears] = useState<number[]>([
    todayIso.year,
  ]);
  const [selectedWeeks, setSelectedWeeks] = useState<string[]>([
    String(todayIso.week),
  ]);
  const [statusFilter, setStatusFilter] = useState<ComplianceStatus | "ALL">(
    "ALL",
  );

  const weekOptions = useMemo(
    () =>
      isoWeeksInYear(selectedYear).map((weekNum) => ({
        value: String(weekNum),
        label: `W${weekNum} (${formatWeekDateRange(selectedYear, weekNum)})`,
      })),
    [selectedYear],
  );

  const weekParam = useMemo(() => {
    const numbers = selectedWeeks.includes(ALL_WEEKS)
      ? isoWeeksInYear(selectedYear)
      : selectedWeeks
          .map((week) => Number(week))
          .filter((week) => Number.isInteger(week));
    return [...numbers].sort((a, b) => a - b).join(",");
  }, [selectedWeeks, selectedYear]);

  const handleWeeksChange = (values: string[]) => {
    const hadAll = selectedWeeks.includes(ALL_WEEKS);
    const hasAll = values.includes(ALL_WEEKS);
    if (hasAll && !hadAll) {
      setSelectedWeeks([ALL_WEEKS]);
      return;
    }
    if (hadAll && hasAll) {
      setSelectedWeeks(values.filter((value) => value !== ALL_WEEKS));
      return;
    }
    setSelectedWeeks(values);
  };

  const handleYearChange = (year: number) => {
    setSelectedYear(year);
    setSelectedWeeks((current) => {
      if (current.includes(ALL_WEEKS)) return [ALL_WEEKS];
      const valid = new Set(isoWeeksInYear(year).map(String));
      const next = current.filter((week) => valid.has(week));
      if (next.length > 0) return next;
      if (year === todayIso.year && valid.has(String(todayIso.week))) {
        return [String(todayIso.week)];
      }
      const weeks = isoWeeksInYear(year);
      return weeks.length > 0 ? [String(weeks[weeks.length - 1])] : [];
    });
  };

  const branchParam = useMemo(
    () => (selectedBranchId ? Number(selectedBranchId) : undefined),
    [selectedBranchId],
  );

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const periodParams = {
        branch_id: branchParam,
        year: selectedYear,
        week_number: weekParam,
        status: statusFilter !== "ALL" ? statusFilter : undefined,
      };
      const [complianceRes, historyRes, atRiskRes, overdueRes, notesRes, evangelismRes] =
        await Promise.all([
          weekParam
            ? reportsApi.getCompliance(periodParams)
            : Promise.resolve(null),
          reportsApi.getComplianceHistory({
            branch_id: branchParam,
            group_by: "week",
          }),
          reportsApi.getComplianceAtRisk({ branch_id: branchParam }),
          reportsApi.getComplianceOverdue({ branch_id: branchParam }),
          reportsApi.getComplianceNotes({ branch_id: branchParam }),
          weekParam
            ? evangelismApi
                .compliance({
                  branch_id: branchParam,
                  year: selectedYear,
                  week_number: weekParam,
                })
                .catch(() => null)
            : Promise.resolve(null),
        ]);
      setData(complianceRes?.data ?? null);
      setHistory(historyRes.data);
      setAtRisk(atRiskRes.data);
      setOverdue(overdueRes.data);
      setNotes(notesRes.data);
      setEvangelism(evangelismRes?.data ?? null);
    } catch (err) {
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data
          ?.error || "Failed to load compliance data.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [branchParam, selectedYear, weekParam, statusFilter]);

  useEffect(() => {
    let cancelled = false;
    clusterReportsApi
      .distinctYears(
        selectedBranchId ? { branch_id: selectedBranchId } : undefined,
      )
      .then((response) => {
        if (cancelled) return;
        const years = response.data.years ?? [];
        const merged = Array.from(new Set([todayIso.year, ...years])).sort(
          (a, b) => b - a,
        );
        setAvailableYears(merged.length > 0 ? merged : [todayIso.year]);
      })
      .catch(() => {
        if (!cancelled) setAvailableYears([todayIso.year]);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedBranchId]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const handleExportCSV = async () => {
    if (!weekParam) return;
    try {
      const res = await reportsApi.exportComplianceCSV({
        branch_id: branchParam,
        year: selectedYear,
        week_number: weekParam,
        status: statusFilter !== "ALL" ? statusFilter : undefined,
      });
      const blob = new Blob([res.data as BlobPart], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `cluster_compliance_${selectedYear}_w${weekParam}.csv`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Failed to export CSV", err);
    }
  };

  const notePeriod = useMemo(() => {
    const numbers = weekParam
      ? weekParam
          .split(",")
          .map((week) => Number(week))
          .filter((week) => Number.isInteger(week))
      : [];
    const weeks = numbers.length > 0 ? numbers : [todayIso.week];
    const year = numbers.length > 0 ? selectedYear : todayIso.year;
    const ranges = weeks.map((week) => getIsoWeekDateRange(year, week));
    const start = ranges.reduce(
      (earliest, range) => (range.start < earliest ? range.start : earliest),
      ranges[0].start,
    );
    const end = ranges.reduce(
      (latest, range) => (range.end > latest ? range.end : latest),
      ranges[0].end,
    );
    const toInput = (date: Date) => {
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      return `${date.getFullYear()}-${month}-${day}`;
    };
    return { start: toInput(start), end: toInput(end) };
  }, [selectedYear, weekParam]);

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

      {evangelism && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Link
            href="/evangelism?tab=compliance"
            className="block rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <KpiCard
              label="Cluster BS coverage"
              value={`${evangelism.summary.setup_coverage_rate.toFixed(1)}%`}
              hint={`${evangelism.summary.clusters_without_group} without a group`}
              valueTone={toneForComplianceRate(
                evangelism.summary.setup_coverage_rate,
              )}
              icon={kpiIcon(Squares2X2Icon)}
            />
          </Link>
          <Link
            href="/evangelism?tab=compliance"
            className="block rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <KpiCard
              label="Evangelism report rate"
              value={`${evangelism.summary.report_compliance_rate.toFixed(1)}%`}
              hint="Weekly reports for clusters with a Cluster BS group"
              valueTone={toneForComplianceRate(
                evangelism.summary.report_compliance_rate,
              )}
              icon={kpiIcon(ChartPieIcon)}
            />
          </Link>
        </div>
      )}

      <Card>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
          <div className="xl:col-span-2">
            <label className="mb-1 block text-base font-medium text-foreground">
              Week
            </label>
            <ScalableSelect
              multiple
              options={weekOptions}
              values={selectedWeeks}
              onValuesChange={handleWeeksChange}
              pinnedOption={{ value: ALL_WEEKS, label: "All Weeks" }}
              scrollToValue={
                weekOptions.some(
                  (option) => option.value === String(todayIso.week),
                )
                  ? String(todayIso.week)
                  : selectedWeeks[selectedWeeks.length - 1]
              }
              placeholder="Select weeks"
              searchPlaceholder="Search weeks..."
              className="w-full"
              showSearch
              maxHeight={280}
              emptyMessage="No weeks found"
            />
          </div>
          <div>
            <label className="mb-1 block text-base font-medium text-foreground">
              Year
            </label>
            <select
              value={selectedYear}
              onChange={(event) =>
                handleYearChange(parseInt(event.target.value, 10))
              }
              className="h-11 w-full rounded-md border border-gray-300 px-3 py-2"
            >
              {availableYears.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
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
              className="h-11 w-full rounded-md border border-gray-300 px-3 py-2"
            >
              <option value="ALL">All</option>
              <option value="COMPLIANT">Compliant</option>
              <option value="PARTIAL">Partial</option>
              <option value="NON_COMPLIANT">Non-Compliant</option>
            </select>
          </div>
          <div className="flex w-full items-end xl:col-span-2">
            <AnalyticsExportButton
              onClick={handleExportCSV}
              reportName="compliance"
            />
          </div>
        </div>
        {!weekParam && (
          <p className="mt-3 text-sm text-foreground/60">
            Select at least one week.
          </p>
        )}
      </Card>

      <ComplianceHistoryChart history={history} loading={loading} />

      <ComplianceRiskPanels
        atRisk={atRisk}
        overdue={overdue}
        loading={loading}
      />

      <Card>
        <p className="mb-2 text-sm text-foreground/60 md:hidden">
          Swipe sideways to see all columns.
        </p>
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
                  "Cancelled",
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
                      ? formatPersonName(item.cluster.coordinator)
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
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {item.cancelled_weeks?.length ? (
                      <div className="space-y-1">
                        {item.cancelled_weeks.map((entry, index) => (
                          <div key={`${entry.week}-${entry.group ?? ""}-${index}`}>
                            Week {entry.week}
                            {entry.group ? ` — ${entry.group}` : ""}
                            {entry.reason ? `: ${entry.reason}` : ""}
                          </div>
                        ))}
                      </div>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
                    {item.last_report_date
                      ? formatLocaleDate(item.last_report_date)
                      : "Never"}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
                    {item.days_since_last_report !== null
                      ? `${item.days_since_last_report} days`
                      : "N/A"}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
                    {item.trend ? (
                      <span className="text-lg">{trendIcon(item.trend)}</span>
                    ) : (
                      "N/A"
                    )}
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
        defaultPeriodStart={notePeriod.start}
        defaultPeriodEnd={notePeriod.end}
        loading={loading}
        onNoteAdded={fetchAll}
      />
    </div>
  );
}
