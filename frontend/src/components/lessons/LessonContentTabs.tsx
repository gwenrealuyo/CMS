export type LessonContentTab = "lesson" | "progress" | "sessions" | "commitment";

interface LessonContentTabsProps {
  activeTab: LessonContentTab;
  onTabChange: (tab: LessonContentTab) => void;
  disableProgress?: boolean;
  disableSessions?: boolean;
  disableCommitment?: boolean;
}

export default function LessonContentTabs({
  activeTab,
  onTabChange,
  disableProgress,
  disableSessions,
  disableCommitment,
}: LessonContentTabsProps) {
  const tabs: Array<{
    id: LessonContentTab;
    label: string;
    disabled: boolean;
  }> = [
    { id: "lesson", label: "Lesson Content", disabled: false },
    {
      id: "progress",
      label: "Member Progress",
      disabled: Boolean(disableProgress),
    },
    {
      id: "sessions",
      label: "Session Reports",
      disabled: Boolean(disableSessions),
    },
    {
      id: "commitment",
      label: "Commitment Forms",
      disabled: Boolean(disableCommitment),
    },
  ];

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="inline-flex rounded-full bg-blue-50 p-1 shadow-inner">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                if (!tab.disabled) {
                  onTabChange(tab.id);
                }
              }}
              disabled={tab.disabled}
              className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-white text-[#1D4ED8] shadow-sm border border-[#2563EB]"
                  : "text-[#1E40AF] hover:text-[#1D4ED8]"
              } ${tab.disabled ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}


