"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { reportsApi } from "@/src/lib/api";
import type { NccSummary } from "@/src/types/reports";
import Card from "@/src/components/ui/Card";
import Button from "@/src/components/ui/Button";
import ErrorMessage from "@/src/components/ui/ErrorMessage";
import LoadingSpinner from "@/src/components/ui/LoadingSpinner";
import NccKpiRow from "./NccKpiRow";
import LessonProgressChart from "./LessonProgressChart";

interface NccDashboardProps {
  /** "" means all branches; otherwise a branch id string. */
  selectedBranchId: string;
}

function currentYear() {
  return new Date().getFullYear();
}

export default function NccDashboard({ selectedBranchId }: NccDashboardProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<NccSummary | null>(null);
  const [year, setYear] = useState<number>(currentYear());

  const branchParam = useMemo(
    () => (selectedBranchId ? Number(selectedBranchId) : undefined),
    [selectedBranchId],
  );

  const yearOptions = useMemo(() => {
    const y = currentYear();
    return [y, y - 1, y - 2];
  }, []);

  const fetchSummary = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await reportsApi.getNccSummary({
        branch_id: branchParam,
        year,
      });
      setData(res.data);
    } catch (err) {
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data
          ?.error || "Failed to load NCC data.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [branchParam, year]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  const handleExportCSV = async () => {
    try {
      const res = await reportsApi.exportNccCSV({
        branch_id: branchParam,
        year,
      });
      const blob = new Blob([res.data as BlobPart], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "ncc_lesson_progress.csv";
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
      <NccKpiRow summary={data} />

      <Card>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Year
            </label>
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="h-[42px] w-full rounded-md border border-gray-300 px-3 py-2"
            >
              {yearOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end md:col-start-3">
            <Button
              onClick={handleExportCSV}
              variant="secondary"
              className="h-[42px]"
            >
              Export CSV
            </Button>
          </div>
        </div>
      </Card>

      <LessonProgressChart lessons={data?.lessons ?? []} loading={loading} />
    </div>
  );
}
