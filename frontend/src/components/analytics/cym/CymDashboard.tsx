"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { reportsApi } from "@/src/lib/api";
import type { CymSummary } from "@/src/types/reports";
import Card from "@/src/components/ui/Card";
import AnalyticsExportButton from "@/src/components/analytics/AnalyticsExportButton";
import ErrorMessage from "@/src/components/ui/ErrorMessage";
import LoadingSpinner from "@/src/components/ui/LoadingSpinner";
import CymKpiRow from "./CymKpiRow";
import CymClassAttendanceChart from "./CymClassAttendanceChart";
import CymUnenrolledPanel from "./CymUnenrolledPanel";

interface CymDashboardProps {
  /** "" means all branches; otherwise a branch id string. */
  selectedBranchId: string;
}

const MONTH_LABELS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

export default function CymDashboard({ selectedBranchId }: CymDashboardProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<CymSummary | null>(null);
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [month, setMonth] = useState<number | "">("");

  const branchParam = useMemo(
    () => (selectedBranchId ? Number(selectedBranchId) : undefined),
    [selectedBranchId],
  );

  const yearOptions = useMemo(() => {
    const current = new Date().getFullYear();
    return [current, current - 1, current - 2];
  }, []);

  const fetchSummary = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await reportsApi.getCymSummary({
        branch_id: branchParam,
        year: month !== "" ? year : undefined,
        month: month !== "" ? month : undefined,
      });
      setData(res.data);
    } catch (err) {
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data
          ?.error || "Failed to load CYM data.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [branchParam, month, year]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  const handleExportCSV = async () => {
    try {
      const res = await reportsApi.exportCymCSV({
        branch_id: branchParam,
        year: month !== "" ? year : undefined,
        month: month !== "" ? month : undefined,
      });
      const blob = new Blob([res.data as BlobPart], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "cym_sunday_school.csv";
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

  return (
    <div className="space-y-6">
      <CymKpiRow summary={data} />

      <Card>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <div>
            <label className="mb-1 block text-base font-medium text-foreground">
              Attendance year
            </label>
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="h-[42px] w-full rounded-md border border-gray-300 px-3 py-2"
              disabled={month === ""}
            >
              {yearOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-base font-medium text-foreground">
              Attendance month
            </label>
            <select
              value={month}
              onChange={(e) => {
                const value = e.target.value;
                setMonth(value === "" ? "" : Number(value));
              }}
              className="h-[42px] w-full rounded-md border border-gray-300 px-3 py-2"
            >
              <option value="">All time</option>
              {MONTH_LABELS.map((label, index) => (
                <option key={label} value={index + 1}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex w-full items-end md:col-start-4">
            <AnalyticsExportButton
              onClick={handleExportCSV}
              reportName="children youth ministry"
            />
          </div>
        </div>
      </Card>

      <CymClassAttendanceChart rows={data?.by_class ?? []} loading={loading} />

      <CymUnenrolledPanel
        categories={data?.unenrolled_by_category ?? []}
        loading={loading}
      />
    </div>
  );
}
