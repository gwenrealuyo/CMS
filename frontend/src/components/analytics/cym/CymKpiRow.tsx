"use client";

import KpiCard from "@/src/components/analytics/KpiCard";
import type { CymSummary } from "@/src/types/reports";

interface CymKpiRowProps {
  summary: CymSummary | null;
}

function formatRate(rate: number | null | undefined) {
  if (rate == null) {
    return "—";
  }
  return `${rate.toFixed(1)}%`;
}

export default function CymKpiRow({ summary }: CymKpiRowProps) {
  if (!summary) {
    return null;
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <KpiCard label="Active Classes" value={summary.active_classes} />
      <KpiCard label="Students" value={summary.total_students} />
      <KpiCard label="Teachers" value={summary.total_teachers} />
      <KpiCard
        label="Avg Attendance"
        value={formatRate(summary.average_attendance_rate)}
      />
    </div>
  );
}
