"use client";

import KpiCard from "@/src/components/analytics/KpiCard";
import type { PeopleSummaryKpis } from "@/src/types/reports";

interface PeopleStructuralPanelsProps {
  summary: PeopleSummaryKpis | null;
}

export default function PeopleStructuralPanels({
  summary,
}: PeopleStructuralPanelsProps) {
  if (!summary) return null;

  const familyTotal = summary.with_family + summary.without_family;
  const clusterTotal = summary.in_cluster + summary.without_cluster;

  const familyPct =
    familyTotal > 0
      ? `${((summary.with_family / familyTotal) * 100).toFixed(0)}% linked`
      : undefined;
  const clusterPct =
    clusterTotal > 0
      ? `${((summary.in_cluster / clusterTotal) * 100).toFixed(0)}% assigned`
      : undefined;

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-muted-foreground">
        Family & Cluster Coverage
      </h3>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="With Family"
          value={summary.with_family}
          hint={familyPct}
        />
        <KpiCard label="Without Family" value={summary.without_family} />
        <KpiCard
          label="In Cluster"
          value={summary.in_cluster}
          hint={clusterPct}
        />
        <KpiCard label="Without Cluster" value={summary.without_cluster} />
      </div>
    </div>
  );
}
