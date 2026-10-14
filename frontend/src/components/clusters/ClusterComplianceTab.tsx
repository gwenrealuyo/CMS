"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { branchesApi, clusterReportsApi } from "@/src/lib/api";
import {
  ComplianceData,
  ClusterCompliance,
  ComplianceStatus,
} from "@/src/types/cluster";
import Card from "@/src/components/ui/Card";
import Button from "@/src/components/ui/Button";
import LoadingSpinner from "@/src/components/ui/LoadingSpinner";
import ErrorMessage from "@/src/components/ui/ErrorMessage";
import ScalableSelect from "@/src/components/ui/ScalableSelect";
import { LockedControlTooltip } from "@/src/components/ui/LockedControlTooltip";
import { useAuth } from "@/src/contexts/AuthContext";
import { formatLocaleDate } from "@/src/lib/date";
import { formatPersonName } from "@/src/lib/name";
import {
  getIsoWeekDateRange,
  getIsoWeekParts,
  isoWeeksInYear,
} from "@/src/lib/isoWeek";

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

export default function ClusterComplianceTab() {
  const { user, isSeniorCoordinator } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ComplianceData | null>(null);
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
  const [selectedBranchId, setSelectedBranchId] = useState<string>("");
  const [branchPickerOptions, setBranchPickerOptions] = useState<
    { value: string; label: string }[]
  >([]);
  const [branchesLoading, setBranchesLoading] = useState(false);
  const prevUserIdRef = useRef<number | undefined>(undefined);

  const canChangeBranchFilter = useMemo(() => {
    if (!user) return false;
    if (user.role === "ADMIN" || user.role === "PASTOR") return true;
    return isSeniorCoordinator("CLUSTER");
  }, [user, isSeniorCoordinator]);

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

  useEffect(() => {
    if (!user) {
      setSelectedBranchId("");
      prevUserIdRef.current = undefined;
      return;
    }
    if (prevUserIdRef.current !== user.id) {
      prevUserIdRef.current = user.id;
      setSelectedBranchId(
        user.branch != null && user.branch !== undefined
          ? String(user.branch)
          : "",
      );
    }
  }, [user]);

  useEffect(() => {
    if (!canChangeBranchFilter) {
      setBranchPickerOptions([]);
      return;
    }
    let cancelled = false;
    setBranchesLoading(true);
    branchesApi
      .getAll({ is_active: true })
      .then((res) => {
        if (cancelled) return;
        const rows = Array.isArray(res.data) ? res.data : [];
        setBranchPickerOptions(
          rows.map((branch) => ({
            value: String(branch.id),
            label: branch.name,
          })),
        );
      })
      .catch(() => {
        if (!cancelled) setBranchPickerOptions([]);
      })
      .finally(() => {
        if (!cancelled) setBranchesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [canChangeBranchFilter]);

  const branchFilterLabel = useMemo(() => {
    if (!selectedBranchId) return "No branch";
    if (
      user?.branch_name &&
      user.branch != null &&
      String(user.branch) === selectedBranchId
    ) {
      return user.branch_name;
    }
    const option = branchPickerOptions.find(
      (item) => item.value === selectedBranchId,
    );
    return option?.label ?? `Branch #${selectedBranchId}`;
  }, [selectedBranchId, user?.branch, user?.branch_name, branchPickerOptions]);

  const branchSelectOptions = useMemo(() => {
    if (canChangeBranchFilter) {
      return [{ value: "", label: "All branches" }, ...branchPickerOptions];
    }
    if (selectedBranchId) {
      return [{ value: selectedBranchId, label: branchFilterLabel }];
    }
    return [{ value: "", label: "No branch assigned" }];
  }, [
    canChangeBranchFilter,
    branchPickerOptions,
    selectedBranchId,
    branchFilterLabel,
  ]);

  const branchSelectInteractive = canChangeBranchFilter && !branchesLoading;

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

  const fetchCompliance = async () => {
    if (!weekParam) {
      setData(null);
      setError(null);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const response = await clusterReportsApi.compliance({
        year: selectedYear,
        week_number: weekParam,
        branch_id: selectedBranchId || undefined,
        status: statusFilter !== "ALL" ? statusFilter : undefined,
      });
      setData(response.data);
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to load compliance data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCompliance();
  }, [selectedYear, weekParam, statusFilter, selectedBranchId]);

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

  const handleExportCSV = async () => {
    if (!weekParam) return;
    try {
      const response = await clusterReportsApi.exportComplianceCSV({
        year: selectedYear,
        week_number: weekParam,
        branch_id: selectedBranchId || undefined,
        status: statusFilter !== "ALL" ? statusFilter : undefined,
      });
      const blob = new Blob([response.data], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = selectedWeeks.includes(ALL_WEEKS)
        ? `cluster_compliance_${selectedYear}_all-weeks.csv`
        : `cluster_compliance_${selectedYear}_w${weekParam.replace(/,/g, "-")}.csv`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Failed to export CSV:", err);
    }
  };

  const getStatusBadgeColor = (status: ComplianceStatus) => {
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
  };

  const getTrendIcon = (trend: string | null) => {
    switch (trend) {
      case "IMPROVING":
        return "↑";
      case "DECLINING":
        return "↓";
      case "STABLE":
        return "→";
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <Card className="!p-3">
          <div className="text-xs text-gray-600">Total Clusters</div>
          <div className="text-lg font-semibold leading-tight mt-0.5">
            {data?.summary.total_clusters ?? "—"}
          </div>
        </Card>
        <Card className="!p-3">
          <div className="text-xs text-gray-600">Compliant</div>
          <div className="text-lg font-semibold leading-tight mt-0.5 text-green-600">
            {data?.summary.compliant_clusters ?? "—"}
          </div>
        </Card>
        <Card className="!p-3">
          <div className="text-xs text-gray-600">Non-Compliant</div>
          <div className="text-lg font-semibold leading-tight mt-0.5 text-red-600">
            {data?.summary.non_compliant_clusters ?? "—"}
          </div>
        </Card>
        <Card className="!p-3">
          <div className="text-xs text-gray-600">Overall Compliance Rate</div>
          <div className="text-lg font-semibold leading-tight mt-0.5">
            {data ? `${data.summary.compliance_rate.toFixed(1)}%` : "—"}
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-12 gap-4 items-end">
            <div className="xl:col-span-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Branch
              </label>
              {branchSelectInteractive ? (
                <ScalableSelect
                  options={branchSelectOptions}
                  value={selectedBranchId}
                  onChange={setSelectedBranchId}
                  placeholder="Branch"
                  searchPlaceholder="Search branches..."
                  className="w-full"
                  showSearch
                  maxHeight={220}
                  emptyMessage="No branches found"
                  loading={branchesLoading}
                />
              ) : (
                <LockedControlTooltip
                  label={
                    branchesLoading && canChangeBranchFilter
                      ? "Loading branches…"
                      : "Branch is limited to your assignment."
                  }
                  wrapperClassName="block w-full cursor-default"
                >
                  <ScalableSelect
                    options={branchSelectOptions}
                    value={selectedBranchId}
                    onChange={setSelectedBranchId}
                    placeholder="Branch"
                    className="w-full"
                    interactionBlocked
                    showSearch={false}
                    maxHeight={220}
                    emptyMessage="No branches found"
                  />
                </LockedControlTooltip>
              )}
            </div>
            <div className="xl:col-span-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">
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
            <div className="xl:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Year
              </label>
              <select
                value={selectedYear}
                onChange={(e) => handleYearChange(parseInt(e.target.value, 10))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md h-11"
              >
                {availableYears.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col xl:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status Filter
              </label>
              <select
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter(e.target.value as ComplianceStatus | "ALL")
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md h-11"
              >
                <option value="ALL">All</option>
                <option value="COMPLIANT">Compliant</option>
                <option value="PARTIAL">Partial</option>
                <option value="NON_COMPLIANT">Non-Compliant</option>
              </select>
            </div>
            <div className="flex items-end sm:col-span-2 xl:col-span-2">
              <Button
                onClick={handleExportCSV}
                variant="secondary"
                className="h-11 w-full"
                disabled={!weekParam || loading || !data}
              >
                Export CSV
              </Button>
            </div>
          </div>
          {!weekParam && (
            <p className="text-sm text-gray-500">Select at least one week.</p>
          )}
        </div>
      </Card>

      {loading ? (
        <Card>
          <div className="flex justify-center items-center py-12">
            <LoadingSpinner />
          </div>
        </Card>
      ) : error ? (
        <Card>
          <ErrorMessage message={error} />
        </Card>
      ) : !data ? null : (
        <>
          {/* Compliance Table */}
          <Card className="!p-0">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Cluster
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Coordinator
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Compliance Rate
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Reports
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Cancelled
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Last Report
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Days Since
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Trend
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {data.clusters.map((item: ClusterCompliance) => (
                    <tr key={item.cluster.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
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
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {item.cluster.coordinator
                          ? formatPersonName(item.cluster.coordinator)
                          : "N/A"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadgeColor(
                            item.status,
                          )}`}
                        >
                          {item.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="w-16 bg-gray-200 rounded-full h-2 mr-2">
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
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
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
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {item.last_report_date
                          ? formatLocaleDate(item.last_report_date)
                          : "Never"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {item.days_since_last_report !== null
                          ? `${item.days_since_last_report} days`
                          : "N/A"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {item.trend ? (
                          <span className="text-lg">
                            {getTrendIcon(item.trend)}
                          </span>
                        ) : (
                          "N/A"
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {data.clusters.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                No compliance data found for the selected period.
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
