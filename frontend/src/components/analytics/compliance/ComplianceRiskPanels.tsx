"use client";

import Card from "@/src/components/ui/Card";
import type { AtRiskCluster, Cluster, OverdueClusters } from "@/src/types/cluster";

interface ComplianceRiskPanelsProps {
  atRisk: AtRiskCluster[];
  overdue: OverdueClusters | null;
  loading?: boolean;
}

function clusterLabel(cluster: Cluster) {
  return cluster.name || cluster.code || `Cluster ${cluster.id}`;
}

export default function ComplianceRiskPanels({
  atRisk,
  overdue,
  loading = false,
}: ComplianceRiskPanelsProps) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card title="At-Risk Clusters">
        {loading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            Loading...
          </div>
        ) : atRisk.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            No clusters are currently at risk.
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {atRisk.map((item) => (
              <li
                key={item.cluster.id}
                className="flex items-start justify-between gap-3 py-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">
                    {clusterLabel(item.cluster)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {item.risk_reason}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-800">
                  {item.compliance.compliance_rate.toFixed(0)}%
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card
        title="Overdue This Week"
        headerAction={
          overdue ? (
            <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-semibold text-yellow-800">
              {overdue.overdue_count} overdue
            </span>
          ) : undefined
        }
      >
        {loading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            Loading...
          </div>
        ) : !overdue || overdue.overdue_clusters.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            All clusters have reported this week.
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {overdue.overdue_clusters.map((cluster) => (
              <li key={cluster.id} className="py-3">
                <p className="text-sm font-medium text-foreground">
                  {clusterLabel(cluster)}
                </p>
                {cluster.coordinator && (
                  <p className="text-xs text-muted-foreground">
                    {cluster.coordinator.first_name}{" "}
                    {cluster.coordinator.last_name}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
