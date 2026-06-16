"use client";

import KpiCard from "@/src/components/analytics/KpiCard";
import type { NccSummary } from "@/src/types/reports";

interface NccKpiRowProps {
  summary: NccSummary | null;
}

export default function NccKpiRow({ summary }: NccKpiRowProps) {
  if (!summary) {
    return null;
  }

  const overall = summary.overall;

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
      <KpiCard label="Participants" value={summary.total_participants} />
      <KpiCard label="Completed" value={overall.COMPLETED ?? 0} />
      <KpiCard label="In Progress" value={overall.IN_PROGRESS ?? 0} />
      <KpiCard label="Assigned" value={overall.ASSIGNED ?? 0} />
      <KpiCard
        label="Unassigned Visitors"
        value={summary.unassigned_visitors ?? 0}
      />
    </div>
  );
}
