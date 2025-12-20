export type ClusterContentTab = "clusters" | "reports" | "compliance";

interface ClusterContentTabsProps {
  activeTab: ClusterContentTab;
  onTabChange: (tab: ClusterContentTab) => void;
}

export default function ClusterContentTabs({
  activeTab,
  onTabChange,
}: ClusterContentTabsProps) {
  const tabs: Array<{
    id: ClusterContentTab;
    label: string;
  }> = [
    { id: "clusters", label: "Clusters" },
    { id: "reports", label: "Reports" },
    { id: "compliance", label: "Compliance" },
  ];

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="inline-flex rounded-full bg-blue-50 p-1 shadow-inner w-full sm:w-auto">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange(tab.id)}
              className={`rounded-full px-4 py-2.5 md:py-2 text-sm font-medium transition-colors min-h-[44px] md:min-h-0 flex-1 sm:flex-none ${
                isActive
                  ? "bg-white text-[#1D4ED8] shadow-sm border border-[#2563EB]"
                  : "text-[#1E40AF] hover:text-[#1D4ED8]"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
