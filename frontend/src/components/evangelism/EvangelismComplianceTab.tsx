"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { branchesApi, evangelismApi } from "@/src/lib/api";
import { formatLocaleDate } from "@/src/lib/date";
import {
  canChangeEvangelismBranchFilter,
} from "@/src/lib/evangelismBranchFilter";
import { useAuth } from "@/src/contexts/AuthContext";
import {
  EvangelismComplianceData,
  EvangelismComplianceStatus,
} from "@/src/types/evangelism";
import { Branch } from "@/src/types/branch";
import Button from "@/src/components/ui/Button";
import Card from "@/src/components/ui/Card";
import ErrorMessage from "@/src/components/ui/ErrorMessage";
import LoadingSpinner from "@/src/components/ui/LoadingSpinner";

function localISODate(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function daysAgoISO(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return localISODate(date);
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
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchId, setBranchId] = useState<number | "">("");
  const [startDate, setStartDate] = useState(() => daysAgoISO(28));
  const [endDate, setEndDate] = useState(() => localISODate(new Date()));
  const [statusFilter, setStatusFilter] = useState<
    EvangelismComplianceStatus | "ALL"
  >("ALL");
  const [data, setData] = useState<EvangelismComplianceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const branchUserIdRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (!user) {
      branchUserIdRef.current = undefined;
      return;
    }
    if (branchUserIdRef.current !== user.id) {
      branchUserIdRef.current = user.id;
      setBranchId(user.branch != null ? user.branch : "");
    }
  }, [user]);

  useEffect(() => {
    if (!canChangeBranch) return;
    let cancelled = false;
    branchesApi
      .getAll()
      .then((response) => {
        if (!cancelled) setBranches(response.data);
      })
      .catch(() => {
        if (!cancelled) setBranches([]);
      });
    return () => {
      cancelled = true;
    };
  }, [canChangeBranch]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const effectiveBranch = canChangeBranch
          ? branchId
          : user.branch != null
            ? user.branch
            : "";
        const response = await evangelismApi.compliance({
          start_date: startDate,
          end_date: endDate,
          branch_id: effectiveBranch === "" ? undefined : effectiveBranch,
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
  }, [user, canChangeBranch, branchId, startDate, endDate, statusFilter]);

  const handleExportCSV = async () => {
    try {
      const effectiveBranch = canChangeBranch
        ? branchId
        : user?.branch != null
          ? user.branch
          : "";
      const response = await evangelismApi.exportComplianceCSV({
        start_date: startDate,
        end_date: endDate,
        branch_id: effectiveBranch === "" ? undefined : effectiveBranch,
        status: statusFilter !== "ALL" ? statusFilter : undefined,
      });
      const blob = new Blob([response.data], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `evangelism_compliance_${startDate}_${endDate}.csv`;
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
    return (
      <Card>
        <ErrorMessage message={error} />
      </Card>
    );
  }

  if (!data) return null;

  const summary = data.summary;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
        <Card className="!p-3">
          <div className="text-xs text-gray-600">Cluster BS coverage</div>
          <div className="mt-0.5 text-lg font-semibold leading-tight">
            {summary.setup_coverage_rate.toFixed(1)}%
          </div>
        </Card>
        <Card className="!p-3">
          <div className="text-xs text-gray-600">Without a group</div>
          <div className="mt-0.5 text-lg font-semibold leading-tight text-red-600">
            {summary.clusters_without_group}
          </div>
        </Card>
        <Card className="!p-3">
          <div className="text-xs text-gray-600">Report compliance</div>
          <div className="mt-0.5 text-lg font-semibold leading-tight">
            {summary.report_compliance_rate.toFixed(1)}%
          </div>
        </Card>
        <Card className="!p-3">
          <div className="text-xs text-gray-600">Compliant</div>
          <div className="mt-0.5 text-lg font-semibold leading-tight text-green-600">
            {summary.compliant_clusters}
          </div>
        </Card>
        <Card className="!p-3">
          <div className="text-xs text-gray-600">Partial</div>
          <div className="mt-0.5 text-lg font-semibold leading-tight text-yellow-700">
            {summary.partial_clusters}
          </div>
        </Card>
        <Card className="!p-3">
          <div className="text-xs text-gray-600">Non-compliant</div>
          <div className="mt-0.5 text-lg font-semibold leading-tight text-red-600">
            {summary.non_compliant_clusters}
          </div>
        </Card>
      </div>

      <Card>
        <div className="space-y-4 p-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
            {canChangeBranch && (
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Branch
                </label>
                <select
                  value={branchId === "" ? "all" : String(branchId)}
                  onChange={(event) => {
                    const value = event.target.value;
                    setBranchId(value === "all" ? "" : Number(value));
                  }}
                  className="h-[42px] w-full rounded-md border border-gray-300 px-3 py-2"
                >
                  <option value="all">All branches</option>
                  {branches.map((branch) => (
                    <option key={branch.id} value={String(branch.id)}>
                      {branch.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                End Date
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2"
              />
            </div>
            <div className="flex flex-col">
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
                className="h-[42px] w-full rounded-md border border-gray-300 px-3 py-2"
              >
                <option value="ALL">All</option>
                <option value="NO_GROUP">No group</option>
                <option value="COMPLIANT">Compliant</option>
                <option value="PARTIAL">Partial</option>
                <option value="NON_COMPLIANT">Non-compliant</option>
              </select>
            </div>
            <div className="flex items-end">
              <Button
                onClick={handleExportCSV}
                variant="secondary"
                className="h-[42px]"
              >
                Export CSV
              </Button>
            </div>
          </div>
        </div>
      </Card>

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
    </div>
  );
}
