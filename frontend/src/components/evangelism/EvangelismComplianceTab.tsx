"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { branchesApi, evangelismApi } from "@/src/lib/api";
import { formatLocaleDate } from "@/src/lib/date";
import { canChangeEvangelismBranchFilter } from "@/src/lib/evangelismBranchFilter";
import {
  getIsoWeekDateRange,
  getIsoWeekParts,
  isoWeeksInYear,
} from "@/src/lib/isoWeek";
import { useAuth } from "@/src/contexts/AuthContext";
import {
  EvangelismComplianceData,
  EvangelismComplianceStatus,
} from "@/src/types/evangelism";
import Button from "@/src/components/ui/Button";
import Card from "@/src/components/ui/Card";
import ErrorMessage from "@/src/components/ui/ErrorMessage";
import LoadingSpinner from "@/src/components/ui/LoadingSpinner";
import ScalableSelect from "@/src/components/ui/ScalableSelect";
import { LockedControlTooltip } from "@/src/components/ui/LockedControlTooltip";

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

const STATUS_LABEL: Record<EvangelismComplianceStatus, string> = {
  COMPLIANT: "Compliant",
  PARTIAL: "Partial",
  NON_COMPLIANT: "Non-compliant",
  NO_GROUP: "No group",
};

function statusBadgeClass(status: EvangelismComplianceStatus) {
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

export default function EvangelismComplianceTab() {
  const { user, isSeniorCoordinator } = useAuth();
  const canChangeBranch = useMemo(
    () => canChangeEvangelismBranchFilter(user, isSeniorCoordinator),
    [user, isSeniorCoordinator],
  );
  const [selectedYear, setSelectedYear] = useState<number>(todayIso.year);
  const [availableYears, setAvailableYears] = useState<number[]>([
    todayIso.year,
  ]);
  const [selectedWeeks, setSelectedWeeks] = useState<string[]>([
    String(todayIso.week),
  ]);
  const [statusFilter, setStatusFilter] = useState<
    EvangelismComplianceStatus | "ALL"
  >("ALL");
  const [selectedBranchId, setSelectedBranchId] = useState<string>("");
  const [branchPickerOptions, setBranchPickerOptions] = useState<
    { value: string; label: string }[]
  >([]);
  const [branchesLoading, setBranchesLoading] = useState(false);
  const [data, setData] = useState<EvangelismComplianceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const prevUserIdRef = useRef<number | undefined>(undefined);

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
    if (!canChangeBranch) {
      setBranchPickerOptions([]);
      return;
    }
    let cancelled = false;
    setBranchesLoading(true);
    branchesApi
      .getAll({ is_active: true })
      .then((response) => {
        if (cancelled) return;
        const rows = Array.isArray(response.data) ? response.data : [];
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
  }, [canChangeBranch]);

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
    if (canChangeBranch) {
      return [{ value: "", label: "All branches" }, ...branchPickerOptions];
    }
    if (selectedBranchId) {
      return [{ value: selectedBranchId, label: branchFilterLabel }];
    }
    return [{ value: "", label: "No branch assigned" }];
  }, [
    canChangeBranch,
    branchPickerOptions,
    selectedBranchId,
    branchFilterLabel,
  ]);

  const branchSelectInteractive = canChangeBranch && !branchesLoading;

  useEffect(() => {
    let cancelled = false;
    evangelismApi
      .weeklyReportsDistinctYears(
        selectedBranchId ? { branch: selectedBranchId } : undefined,
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
    if (!user) return;
    if (!weekParam) {
      setData(null);
      setError(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await evangelismApi.compliance({
          year: selectedYear,
          week_number: weekParam,
          branch_id: selectedBranchId || undefined,
          status: statusFilter !== "ALL" ? statusFilter : undefined,
        });
        if (!cancelled) setData(response.data);
      } catch (err: unknown) {
        if (!cancelled) {
          const message =
            (err as { response?: { data?: { error?: string } } })?.response
              ?.data?.error || "Failed to load compliance data";
          setError(message);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [user, selectedYear, weekParam, selectedBranchId, statusFilter]);

  const handleExportCSV = async () => {
    if (!weekParam) return;
    try {
      const response = await evangelismApi.exportComplianceCSV({
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
        ? `evangelism_compliance_${selectedYear}_all-weeks.csv`
        : `evangelism_compliance_${selectedYear}_w${weekParam.replace(/,/g, "-")}.csv`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Failed to export CSV", err);
    }
  };

  const summary = data?.summary;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
        <Card className="!p-3">
          <div className="text-xs text-gray-600">Cluster BS coverage</div>
          <div className="mt-0.5 text-lg font-semibold leading-tight">
            {summary ? `${summary.setup_coverage_rate.toFixed(1)}%` : "—"}
          </div>
        </Card>
        <Card className="!p-3">
          <div className="text-xs text-gray-600">Without a group</div>
          <div className="mt-0.5 text-lg font-semibold leading-tight text-red-600">
            {summary?.clusters_without_group ?? "—"}
          </div>
        </Card>
        <Card className="!p-3">
          <div className="text-xs text-gray-600">Report compliance</div>
          <div className="mt-0.5 text-lg font-semibold leading-tight">
            {summary ? `${summary.report_compliance_rate.toFixed(1)}%` : "—"}
          </div>
        </Card>
        <Card className="!p-3">
          <div className="text-xs text-gray-600">Compliant</div>
          <div className="mt-0.5 text-lg font-semibold leading-tight text-green-600">
            {summary?.compliant_clusters ?? "—"}
          </div>
        </Card>
        <Card className="!p-3">
          <div className="text-xs text-gray-600">Partial</div>
          <div className="mt-0.5 text-lg font-semibold leading-tight text-yellow-700">
            {summary?.partial_clusters ?? "—"}
          </div>
        </Card>
        <Card className="!p-3">
          <div className="text-xs text-gray-600">Non-compliant</div>
          <div className="mt-0.5 text-lg font-semibold leading-tight text-red-600">
            {summary?.non_compliant_clusters ?? "—"}
          </div>
        </Card>
      </div>

      <Card>
        <div className="space-y-4">
          <div className="grid grid-cols-1 items-end gap-4 sm:grid-cols-2 xl:grid-cols-12">
            <div className="xl:col-span-3">
              <label className="mb-1 block text-sm font-medium text-gray-700">
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
                    branchesLoading && canChangeBranch
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
              <label className="mb-1 block text-sm font-medium text-gray-700">
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
              <label className="mb-1 block text-sm font-medium text-gray-700">
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
            <div className="flex flex-col xl:col-span-2">
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Status Filter
              </label>
              <select
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(
                    event.target.value as EvangelismComplianceStatus | "ALL",
                  )
                }
                className="h-11 w-full rounded-md border border-gray-300 px-3 py-2"
              >
                <option value="ALL">All</option>
                <option value="NO_GROUP">No group</option>
                <option value="COMPLIANT">Compliant</option>
                <option value="PARTIAL">Partial</option>
                <option value="NON_COMPLIANT">Non-compliant</option>
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
          <div className="flex items-center justify-center py-12">
            <LoadingSpinner />
          </div>
        </Card>
      ) : error ? (
        <Card>
          <ErrorMessage message={error} />
        </Card>
      ) : !data ? null : (
        <Card>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {[
                    "Cluster",
                    "Groups",
                    "Status",
                    "Compliance Rate",
                    "Reports",
                    "Missing Weeks",
                    "Cancelled",
                    "Last Report",
                  ].map((header) => (
                    <th
                      key={header}
                      className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {data.clusters.map((item) => {
                  const rate = item.compliance_rate;
                  return (
                    <tr
                      key={
                        item.cluster.id ??
                        `group-${item.groups[0]?.id ?? item.cluster.name}`
                      }
                    >
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
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {item.groups.length > 0
                          ? item.groups.map((group) => group.name).join(", ")
                          : "No group"}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4">
                        <span
                          className={`rounded-full px-2 py-1 text-xs font-semibold ${statusBadgeClass(item.status)}`}
                        >
                          {STATUS_LABEL[item.status]}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4">
                        {rate == null ? (
                          <span className="text-sm text-gray-500">—</span>
                        ) : (
                          <div className="flex items-center">
                            <div className="mr-2 h-2 w-16 rounded-full bg-gray-200">
                              <div
                                className={`h-2 rounded-full ${
                                  rate >= 100
                                    ? "bg-green-500"
                                    : rate >= 50
                                      ? "bg-yellow-500"
                                      : "bg-red-500"
                                }`}
                                style={{ width: `${Math.min(rate, 100)}%` }}
                              />
                            </div>
                            <span className="text-sm text-gray-900">
                              {rate.toFixed(1)}%
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
                        {item.status === "NO_GROUP"
                          ? "—"
                          : `${item.reports_submitted} / ${item.reports_expected}`}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {item.missing_weeks.length > 0
                          ? item.missing_weeks.join(", ")
                          : "—"}
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
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {data.clusters.length === 0 && (
            <div className="py-8 text-center text-gray-500">
              No compliance data found for the selected period.
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
