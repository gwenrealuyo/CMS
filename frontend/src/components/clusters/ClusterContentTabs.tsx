import type { ReactNode } from "react";
import SegmentedControl from "@/src/components/ui/SegmentedControl";
import { TOOLBAR_BRANCH_HEADER_SLOT_CLASS } from "@/src/lib/toolbarStyles";

export type ClusterContentTab =
  | "clusters"
  | "tally"
  | "reports"
  | "compliance"
  | "care"
  | "transfers";

interface ClusterContentTabsProps {
  activeTab: ClusterContentTab;
  onTabChange: (tab: ClusterContentTab) => void;
  showComplianceTab?: boolean;
  showReportsTab?: boolean;
  showCareTab?: boolean;
  showTransfersTab?: boolean;
  branchFilter?: ReactNode;
}

export default function ClusterContentTabs({
  activeTab,
  onTabChange,
  showComplianceTab = true,
  showReportsTab = true,
  showCareTab = false,
  showTransfersTab = true,
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
    ...(showTransfersTab
      ? [{ id: "transfers" as const, label: "Transfers" }]
      : []),
  ];

  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
      <div className="min-w-0 flex-1 overflow-x-auto">
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
