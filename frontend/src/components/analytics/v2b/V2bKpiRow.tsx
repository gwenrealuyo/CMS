"use client";

import {
  ArrowTrendingUpIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  UserGroupIcon,
} from "@heroicons/react/24/outline";
import KpiCard from "@/src/components/analytics/KpiCard";
import { kpiIcon } from "@/src/components/analytics/analyticsKpiIcons";
import {
  toneForPercentRate,
  toneWhenPositiveIsBad,
  toneWhenZeroIsBad,
  toneWhenHigherIsBetter,
} from "@/src/lib/kpiValueTone";
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
      <KpiCard
        label="Active Prospects"
        value={summary.active_prospects}
        valueTone={toneWhenZeroIsBad(summary.active_prospects)}
        icon={kpiIcon(UserGroupIcon)}
      />
      <KpiCard
        label="Completed Conversions"
        value={summary.completed_conversions}
        valueTone={toneWhenHigherIsBetter(summary.completed_conversions)}
        icon={kpiIcon(CheckCircleIcon)}
      />
      <KpiCard
        label="Total Reached"
        value={summary.total_reached}
        icon={kpiIcon(UserGroupIcon)}
      />
      <KpiCard
        label="Drop-offs"
        value={summary.drop_offs}
        valueTone={toneWhenPositiveIsBad(summary.drop_offs)}
        hint="Beta — drop-off tracking is still being refined."
        icon={kpiIcon(ExclamationTriangleIcon)}
      />
      <KpiCard
        label="Recovery Rate"
        value={formatRate(summary.recovery_rate)}
        valueTone={
          summary.recovery_rate != null
            ? toneForPercentRate(summary.recovery_rate, {
                successAt: 75,
                dangerBelow: 25,
              })
            : "default"
        }
        hint="Beta — recovery metrics are still being refined."
        icon={kpiIcon(ArrowTrendingUpIcon)}
      />
    </div>
  );
}
