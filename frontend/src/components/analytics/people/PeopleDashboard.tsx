"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { reportsApi } from "@/src/lib/api";
import type { PeopleSummary } from "@/src/types/reports";
import Card from "@/src/components/ui/Card";
import ErrorMessage from "@/src/components/ui/ErrorMessage";
import LoadingSpinner from "@/src/components/ui/LoadingSpinner";
import AnalyticsExportButton from "@/src/components/analytics/AnalyticsExportButton";
import KpiCard from "@/src/components/analytics/KpiCard";
import { kpiIcon } from "@/src/components/analytics/analyticsKpiIcons";
import {
  toneWhenPositiveIsBad,
  toneWhenZeroIsBad,
} from "@/src/lib/kpiValueTone";
import {
  CheckCircleIcon,
  HeartIcon,
  UserGroupIcon,
  UsersIcon,
  XCircleIcon,
} from "@heroicons/react/24/outline";
import PeopleCompositionCharts from "./PeopleCompositionCharts";
import PeopleDemographicsCharts from "./PeopleDemographicsCharts";
import BaptismTrendChart from "./BaptismTrendChart";
import PeopleStructuralPanels from "./PeopleStructuralPanels";
import PeopleBranchTable from "./PeopleBranchTable";

interface PeopleDashboardProps {
  /** "" means all branches; otherwise a branch id string. */
  selectedBranchId: string;
}

const MONTH_OPTIONS = [6, 12, 24] as const;

export default function PeopleDashboard({
  selectedBranchId,
}: PeopleDashboardProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<PeopleSummary | null>(null);
  const [months, setMonths] = useState<number>(12);

  const branchParam = useMemo(
    () => (selectedBranchId ? Number(selectedBranchId) : undefined),
    [selectedBranchId],
  );

  const fetchSummary = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await reportsApi.getPeopleSummary({
        branch_id: branchParam,
        months,
      });
      setData(res.data);
    } catch (err) {
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data
          ?.error || "Failed to load people demographics.";
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
      const res = await reportsApi.exportPeopleCSV({
        branch_id: branchParam,
      });
      const blob = new Blob([res.data as BlobPart], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "people_demographics.csv";
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

  const summary = data?.summary;

  return (
    <div className="space-y-6">
      {summary && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
          <KpiCard
            label="Total People"
            value={summary.total_people}
            icon={kpiIcon(UserGroupIcon)}
          />
          <KpiCard
            label="Members"
            value={summary.total_members}
            icon={kpiIcon(UsersIcon)}
          />
          <KpiCard
            label="Visitors"
            value={summary.total_visitors}
            valueTone={toneWhenZeroIsBad(summary.total_visitors)}
            icon={kpiIcon(UserGroupIcon)}
          />
          <KpiCard
            label="Active Members"
            value={summary.active_members}
            valueTone={toneWhenZeroIsBad(summary.active_members)}
            icon={kpiIcon(CheckCircleIcon)}
          />
          <KpiCard
            label="Semi-active"
            value={summary.semiactive_members}
            icon={kpiIcon(UsersIcon)}
          />
          <KpiCard
            label="Inactive"
            value={summary.inactive_members}
            icon={kpiIcon(XCircleIcon)}
          />
          <KpiCard
            label="Deceased"
            value={summary.deceased}
            icon={kpiIcon(HeartIcon)}
          />
        </div>
      )}

      <Card>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <label className="mb-1 block text-base font-medium text-foreground">
              Baptism trend window
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
              reportName="people demographics"
            />
          </div>
        </div>
      </Card>

      <PeopleStructuralPanels summary={summary ?? null} />

      {data && (
        <PeopleCompositionCharts
          byRole={data.by_role}
          byStatus={data.by_status}
          loading={loading}
        />
      )}

      {data && (
        <PeopleDemographicsCharts
          byGender={data.by_gender}
          byAgeBand={data.by_age_band}
          byEntryChannel={data.by_entry_channel}
          loading={loading}
        />
      )}

      <BaptismTrendChart trend={data?.baptism_trend ?? null} loading={loading} />

      {data && data.by_branch.length > 0 && (
        <PeopleBranchTable rows={data.by_branch} />
      )}
    </div>
  );
}
