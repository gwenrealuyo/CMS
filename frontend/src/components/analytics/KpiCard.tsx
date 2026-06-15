"use client";

import type { ReactNode } from "react";
import Card from "@/src/components/ui/Card";

interface KpiCardProps {
  label: string;
  value: ReactNode;
  /** Optional supporting text under the value (e.g. trend or context). */
  hint?: ReactNode;
  icon?: ReactNode;
  className?: string;
}

/**
 * Compact metric tile for analytics dashboards. Thin wrapper over the shared
 * Card so later phases get consistent KPI styling for free.
 */
export default function KpiCard({
  label,
  value,
  hint,
  icon,
  className = "",
}: KpiCardProps) {
  return (
    <Card className={className}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-semibold text-foreground">{value}</p>
          {hint && (
            <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
          )}
        </div>
        {icon && <div className="shrink-0 text-gray-400">{icon}</div>}
      </div>
    </Card>
  );
}
