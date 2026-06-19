"use client";

import type { ReactNode } from "react";
import Card from "@/src/components/ui/Card";
import {
  kpiValueToneClass,
  type KpiValueTone,
} from "@/src/lib/kpiValueTone";

interface KpiCardProps {
  label: string;
  value: ReactNode;
  /** Optional supporting text under the value (e.g. trend or context). */
  hint?: ReactNode;
  icon?: ReactNode;
  /** Left border accent, e.g. border-l-primary */
  accentClass?: string;
  /** Semantic color for the headline value (success / danger). */
  valueTone?: KpiValueTone;
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
  accentClass = "",
  valueTone = "default",
  className = "",
}: KpiCardProps) {
  return (
    <Card
      className={`${accentClass ? `border-l-4 pl-3 ${accentClass}` : ""} ${className}`.trim()}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground/80">{label}</p>
          <p
            className={`mt-1 break-words text-2xl font-bold sm:text-3xl ${kpiValueToneClass(valueTone)}`}
          >
            {value}
          </p>
          {hint && (
            <p className="mt-1 text-sm text-foreground/65">{hint}</p>
          )}
        </div>
        {icon && <div className="shrink-0">{icon}</div>}
      </div>
    </Card>
  );
}
