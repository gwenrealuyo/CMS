import SegmentedControl from "@/src/components/ui/SegmentedControl";

export type ClusterContentTab = "clusters" | "reports" | "compliance";

interface ClusterContentTabsProps {
  activeTab: ClusterContentTab;
  onTabChange: (tab: ClusterContentTab) => void;
  showComplianceTab?: boolean;
  showReportsTab?: boolean;
}

export default function ClusterContentTabs({
  activeTab,
  onTabChange,
  showComplianceTab = true,
  showReportsTab = true,
}: ClusterContentTabsProps) {
  const tabs: Array<{
    id: ClusterContentTab;
    label: string;
  }> = [
    { id: "clusters", label: "Clusters" },
    ...(showReportsTab ? [{ id: "reports" as const, label: "Reports" }] : []),
    ...(showComplianceTab ? [{ id: "compliance" as const, label: "Compliance" }] : []),
  ];

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <SegmentedControl
        value={activeTab}
        onChange={onTabChange}
        options={tabs}
        fullWidthOnMobile
      />
    </div>
  );
}
