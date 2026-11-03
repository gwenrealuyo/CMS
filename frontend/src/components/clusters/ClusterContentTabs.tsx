import type { ReactNode } from "react";
import SegmentedControl from "@/src/components/ui/SegmentedControl";
import { TOOLBAR_BRANCH_HEADER_SLOT_CLASS } from "@/src/lib/toolbarStyles";

export type ClusterContentTab =
  | "clusters"
  | "tally"
  | "reports"
  | "compliance"
  | "care";

interface ClusterContentTabsProps {
  activeTab: ClusterContentTab;
  onTabChange: (tab: ClusterContentTab) => void;
  showComplianceTab?: boolean;
  showReportsTab?: boolean;
  showCareTab?: boolean;
  branchFilter?: ReactNode;
}

export default function ClusterContentTabs({
  activeTab,
  onTabChange,
  showComplianceTab = true,
  showReportsTab = true,
  showCareTab = false,
  branchFilter,
}: ClusterContentTabsProps) {
  const tabs: Array<{
    id: ClusterContentTab;
    label: string;
  }> = [
    { id: "clusters", label: "Clusters" },
    { id: "tally", label: "Tally" },
    ...(showCareTab ? [{ id: "care" as const, label: "Care" }] : []),
    ...(showReportsTab ? [{ id: "reports" as const, label: "Reports" }] : []),
    ...(showComplianceTab
      ? [{ id: "compliance" as const, label: "Compliance" }]
      : []),
  ];

  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0 flex-1">
        <SegmentedControl
          value={activeTab}
          onChange={onTabChange}
          options={tabs}
          fullWidthOnMobile
        />
      </div>
      {branchFilter ? (
        <div className={TOOLBAR_BRANCH_HEADER_SLOT_CLASS}>{branchFilter}</div>
      ) : null}
    </div>
  );
}
