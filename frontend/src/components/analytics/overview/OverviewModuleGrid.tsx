"use client";

import KpiCard from "@/src/components/analytics/KpiCard";
import type { OverviewModuleKpi } from "@/src/types/reports";
import type { AnalyticsTab } from "@/src/app/analytics/analyticsTabs";

interface OverviewModuleGridProps {
  modules: OverviewModuleKpi[];
  onModuleClick: (tab: AnalyticsTab) => void;
}

export default function OverviewModuleGrid({
  modules,
  onModuleClick,
}: OverviewModuleGridProps) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {modules.map((module) => (
        <button
          key={module.tab}
          type="button"
          onClick={() => onModuleClick(module.tab as AnalyticsTab)}
          className="text-left transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-lg"
        >
          <KpiCard
            label={module.headline.label}
            value={module.headline.value}
            hint={
              <>
                <span className="block font-medium text-foreground/80">
                  {module.title}
                </span>
                {module.hint && <span className="block">{module.hint}</span>}
              </>
            }
            className="h-full cursor-pointer"
          />
        </button>
      ))}
    </div>
  );
}
