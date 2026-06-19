"use client";

import SegmentedControl from "@/src/components/ui/SegmentedControl";
import ScalableSelect from "@/src/components/ui/ScalableSelect";
import {
  ANALYTICS_TABS,
  type AnalyticsTab,
} from "@/src/app/analytics/analyticsTabs";

interface AnalyticsTabNavProps {
  value: AnalyticsTab;
  onChange: (tab: AnalyticsTab) => void;
}

export default function AnalyticsTabNav({
  value,
  onChange,
}: AnalyticsTabNavProps) {
  const selectOptions = ANALYTICS_TABS.map((tab) => ({
    value: tab.id,
    label: tab.label,
  }));

  return (
    <>
      <div className="md:hidden">
        <label
          htmlFor="analytics-section-select"
          className="mb-1 block text-sm font-medium text-foreground"
        >
          Section
        </label>
        <ScalableSelect
          options={selectOptions}
          value={value}
          onChange={(next) => onChange(next as AnalyticsTab)}
          placeholder="Select section"
          showSearch={false}
          className="w-full"
        />
      </div>

      <div className="hidden md:block">
        <SegmentedControl
          value={value}
          onChange={onChange}
          options={ANALYTICS_TABS}
        />
      </div>
    </>
  );
}
