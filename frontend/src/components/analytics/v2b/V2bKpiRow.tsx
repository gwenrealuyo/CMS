"use client";

import KpiCard from "@/src/components/analytics/KpiCard";
import type { V2bSummaryKpis } from "@/src/types/reports";

interface V2bKpiRowProps {
  summary: V2bSummaryKpis | null;
}

function formatRate(rate: number | null | undefined) {
  if (rate == null) {
    return "—";
  }
  return `${rate.toFixed(1)}%`;
}

export default function V2bKpiRow({ summary }: V2bKpiRowProps) {
  if (!summary) {
    return null;
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
      <KpiCard label="Active Prospects" value={summary.active_prospects} />
      <KpiCard
        label="Completed Conversions"
        value={summary.completed_conversions}
      />
      <KpiCard label="Total Reached" value={summary.total_reached} />
      <KpiCard
        label="Drop-offs"
        value={summary.drop_offs}
        hint="Beta — drop-off tracking is still being refined."
      />
      <KpiCard
        label="Recovery Rate"
        value={formatRate(summary.recovery_rate)}
        hint="Beta — recovery metrics are still being refined."
      />
    </div>
  );
}
