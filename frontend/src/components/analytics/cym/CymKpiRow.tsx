"use client";

import {
  AcademicCapIcon,
  ChartPieIcon,
  UserGroupIcon,
  UsersIcon,
} from "@heroicons/react/24/outline";
import KpiCard from "@/src/components/analytics/KpiCard";
import { kpiIcon } from "@/src/components/analytics/analyticsKpiIcons";
import { toneForPercentRate, toneWhenZeroIsBad } from "@/src/lib/kpiValueTone";
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
      <KpiCard
        label="Active Classes"
        value={summary.active_classes}
        icon={kpiIcon(AcademicCapIcon)}
      />
      <KpiCard
        label="Students"
        value={summary.total_students}
        valueTone={toneWhenZeroIsBad(summary.total_students)}
        icon={kpiIcon(UserGroupIcon)}
      />
      <KpiCard
        label="Teachers"
        value={summary.total_teachers}
        icon={kpiIcon(UsersIcon)}
      />
      <KpiCard
        label="Avg Attendance"
        value={formatRate(summary.average_attendance_rate)}
        valueTone={
          summary.average_attendance_rate != null
            ? toneForPercentRate(summary.average_attendance_rate, {
                successAt: 85,
                dangerBelow: 50,
              })
            : "default"
        }
        icon={kpiIcon(ChartPieIcon)}
      />
    </div>
  );
}
