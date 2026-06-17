"use client";

import {
  CalendarDaysIcon,
  ClipboardDocumentListIcon,
  UsersIcon,
} from "@heroicons/react/24/outline";
import KpiCard from "@/src/components/analytics/KpiCard";
import { kpiIcon } from "@/src/components/analytics/analyticsKpiIcons";
import { toneWhenZeroIsBad } from "@/src/lib/kpiValueTone";
import type { EngagementSummaryKpis } from "@/src/types/reports";

interface EngagementKpiRowProps {
  summary: EngagementSummaryKpis | null;
}

export default function EngagementKpiRow({ summary }: EngagementKpiRowProps) {
  if (!summary) return null;

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <KpiCard
        label="Cluster Reports"
        value={summary.cluster_reports}
        hint={`Avg ${summary.cluster_avg_members.toFixed(1)} members / report`}
        icon={kpiIcon(ClipboardDocumentListIcon)}
      />
      <KpiCard
        label="Evangelism Reports"
        value={summary.evangelism_reports}
        hint={`Avg ${summary.evangelism_avg_members.toFixed(1)} members / report`}
        icon={kpiIcon(ClipboardDocumentListIcon)}
      />
      <KpiCard
        label="Sunday Service Occurrences"
        value={summary.service_occurrences}
        valueTone={toneWhenZeroIsBad(summary.service_occurrences)}
        hint={`Avg ${summary.service_avg_headcount.toFixed(1)} attendees`}
        icon={kpiIcon(CalendarDaysIcon)}
      />
      <KpiCard
        label="Cluster Avg Visitors"
        value={summary.cluster_avg_visitors.toFixed(1)}
        valueTone={toneWhenZeroIsBad(summary.cluster_avg_visitors)}
        hint={`Evangelism avg: ${summary.evangelism_avg_visitors.toFixed(1)}`}
        icon={kpiIcon(UsersIcon)}
      />
    </div>
  );
}
