"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { reportsApi } from "@/src/lib/api";
import type { V2bSummary } from "@/src/types/reports";
import Card from "@/src/components/ui/Card";
import AnalyticsExportButton from "@/src/components/analytics/AnalyticsExportButton";
import ErrorMessage from "@/src/components/ui/ErrorMessage";
import LoadingSpinner from "@/src/components/ui/LoadingSpinner";
import V2bKpiRow from "./V2bKpiRow";
import V2bFunnelChart from "./V2bFunnelChart";
import V2bMonthlyTrendChart from "./V2bMonthlyTrendChart";
import V2bLeakagePanels from "./V2bLeakagePanels";
import V2bClusterTable from "./V2bClusterTable";

interface V2bDashboardProps {
  /** "" means all branches; otherwise a branch id string. */
  selectedBranchId: string;
}

function currentYear() {
  return new Date().getFullYear();
}

export default function V2bDashboard({ selectedBranchId }: V2bDashboardProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<V2bSummary | null>(null);
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
      const res = await reportsApi.getV2bSummary({
        branch_id: branchParam,
        year,
      });
      setData(res.data);
    } catch (err) {
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data
          ?.error || "Failed to load V2B data.";
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
      const res = await reportsApi.exportV2bCSV({
        branch_id: branchParam,
        year,
      });
      const blob = new Blob([res.data as BlobPart], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "visitor_to_brethren.csv";
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
      <V2bKpiRow summary={data?.summary ?? null} />

      <Card>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <label className="mb-1 block text-base font-medium text-foreground">
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
          <div className="flex w-full items-end md:col-start-3">
            <AnalyticsExportButton
              onClick={handleExportCSV}
              reportName="visitor to brethren"
            />
          </div>
        </div>
      </Card>

      <V2bFunnelChart funnel={data?.funnel ?? []} loading={loading} />

      <V2bMonthlyTrendChart trend={data?.monthly_trend ?? []} loading={loading} />

      <V2bLeakagePanels leakage={data?.leakage ?? null} loading={loading} />

      {data && data.by_cluster.length > 0 && (
        <V2bClusterTable rows={data.by_cluster} />
      )}
    </div>
  );
}
