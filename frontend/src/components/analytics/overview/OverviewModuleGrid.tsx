"use client";

import { ChevronRightIcon } from "@heroicons/react/24/outline";
import KpiCard from "@/src/components/analytics/KpiCard";
import {
  getModuleAccentClass,
  getModuleIcon,
} from "@/src/components/analytics/analyticsModuleIcons";
import type { OverviewModuleKpi } from "@/src/types/reports";
import type { AnalyticsTab } from "@/src/app/analytics/analyticsTabs";
import { toneForOverviewHeadline } from "@/src/lib/kpiValueTone";

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
      {modules.map((module) => {
        const tab = module.tab as AnalyticsTab;
        return (
          <button
            key={module.tab}
            type="button"
            onClick={() => onModuleClick(tab)}
            className="group flex h-full cursor-pointer flex-col rounded-lg text-left transition-all duration-200 hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-lighthouse-gold/60 focus-visible:ring-offset-2 active:translate-y-0"
          >
            <KpiCard
              label={module.headline.label}
              value={module.headline.value}
              valueTone={toneForOverviewHeadline(
                module.headline.label,
                module.headline.value,
              )}
              icon={getModuleIcon(tab)}
              accentClass={getModuleAccentClass(tab)}
              hint={
                <>
                  <span className="block font-medium text-foreground/80">
                    {module.title}
                  </span>
                  {module.hint && <span className="block">{module.hint}</span>}
                </>
              }
              className="h-full flex-1 transition-all duration-200 group-hover:border-lighthouse-gold/70 group-hover:bg-lighthouse-gold/10 group-hover:shadow-md group-active:shadow-sm"
            />
            <div className="mt-1 flex items-center gap-1.5 rounded-b-lg px-3 py-2 text-sm font-medium text-foreground/70 transition-colors group-hover:bg-lighthouse-gold/15 group-hover:text-lighthouse-navy">
              <span className="underline-offset-2 group-hover:underline">
                View dashboard
              </span>
              <ChevronRightIcon
                className="h-5 w-5 shrink-0 transition-transform duration-200 group-hover:translate-x-1"
                aria-hidden
              />
            </div>
          </button>
        );
      })}
    </div>
  );
}
