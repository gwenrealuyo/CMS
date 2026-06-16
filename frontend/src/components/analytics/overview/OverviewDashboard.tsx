"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { reportsApi } from "@/src/lib/api";
import type { OverviewSummary } from "@/src/types/reports";
import type { AnalyticsTab } from "@/src/app/analytics/analyticsTabs";
import Card from "@/src/components/ui/Card";
import ErrorMessage from "@/src/components/ui/ErrorMessage";
import LoadingSpinner from "@/src/components/ui/LoadingSpinner";
import OverviewModuleGrid from "./OverviewModuleGrid";

interface OverviewDashboardProps {
  /** "" means all branches; otherwise a branch id string. */
  selectedBranchId: string;
  onTabChange: (tab: AnalyticsTab) => void;
}

const MONTH_OPTIONS = [6, 12, 24] as const;

function currentYear() {
  return new Date().getFullYear();
}

export default function OverviewDashboard({
  selectedBranchId,
  onTabChange,
}: OverviewDashboardProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<OverviewSummary | null>(null);
  const [year, setYear] = useState<number>(currentYear());
  const [months, setMonths] = useState<number>(12);

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
      const res = await reportsApi.getOverviewSummary({
        branch_id: branchParam,
        year,
        months,
      });
      setData(res.data);
    } catch (err) {
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data
          ?.error || "Failed to load executive overview.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [branchParam, year, months]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

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
      <Card>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label
                htmlFor="overview-year"
                className="mb-1 block text-sm font-medium text-muted-foreground"
              >
                Year
              </label>
              <select
                id="overview-year"
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                {yearOptions.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor="overview-months"
                className="mb-1 block text-sm font-medium text-muted-foreground"
              >
                Trend window (months)
              </label>
              <select
                id="overview-months"
                value={months}
                onChange={(e) => setMonths(Number(e.target.value))}
                className="rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                {MONTH_OPTIONS.map((m) => (
                  <option key={m} value={m}>
                    Last {m} months
                  </option>
                ))}
              </select>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            Click a card to open the full dashboard.
          </p>
        </div>
      </Card>

      <OverviewModuleGrid
        modules={data?.modules ?? []}
        onModuleClick={onTabChange}
      />
    </div>
  );
}
