"use client";

import {
  AcademicCapIcon,
  BookOpenIcon,
  CheckCircleIcon,
  ClockIcon,
  UserPlusIcon,
} from "@heroicons/react/24/outline";
import KpiCard from "@/src/components/analytics/KpiCard";
import { kpiIcon } from "@/src/components/analytics/analyticsKpiIcons";
import {
  toneWhenHigherIsBetter,
  toneWhenPositiveIsBad,
} from "@/src/lib/kpiValueTone";
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
      <KpiCard
        label="Participants"
        value={summary.total_participants}
        icon={kpiIcon(AcademicCapIcon)}
      />
      <KpiCard
        label="Completed"
        value={overall.COMPLETED ?? 0}
        valueTone={toneWhenHigherIsBetter(overall.COMPLETED ?? 0)}
        icon={kpiIcon(CheckCircleIcon)}
      />
      <KpiCard
        label="In Progress"
        value={overall.IN_PROGRESS ?? 0}
        icon={kpiIcon(ClockIcon)}
      />
      <KpiCard
        label="Assigned"
        value={overall.ASSIGNED ?? 0}
        icon={kpiIcon(BookOpenIcon)}
      />
      <KpiCard
        label="Unassigned Visitors"
        value={summary.unassigned_visitors ?? 0}
        valueTone={toneWhenPositiveIsBad(summary.unassigned_visitors ?? 0)}
        icon={kpiIcon(UserPlusIcon)}
      />
    </div>
  );
}
