import type { ReactNode } from "react";
import SegmentedControl from "@/src/components/ui/SegmentedControl";

export type LessonContentTab =
  | "lesson"
  | "progress"
  | "sessions"
  | "commitment";

interface LessonContentTabsProps {
  activeTab: LessonContentTab;
  onTabChange: (tab: LessonContentTab) => void;
  disableProgress?: boolean;
  disableSessions?: boolean;
  disableCommitment?: boolean;
  branchFilter?: ReactNode;
}

export default function LessonContentTabs({
  activeTab,
  onTabChange,
  disableProgress,
  disableSessions,
  disableCommitment,
  branchFilter,
}: LessonContentTabsProps) {
  const tabs = [
    { id: "lesson" as const, label: "Lesson Content", disabled: false },
    {
      id: "progress" as const,
      label: "Student Progress",
      disabled: Boolean(disableProgress),
    },
    {
      id: "sessions" as const,
      label: "Session Reports",
      disabled: Boolean(disableSessions),
    },
    {
      id: "commitment" as const,
      label: "Commitment Forms",
      disabled: Boolean(disableCommitment),
    },
  ];

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <SegmentedControl
        value={activeTab}
        onChange={onTabChange}
        options={tabs}
      />
      {branchFilter ? (
        <div className="flex shrink-0 items-center">{branchFilter}</div>
      ) : null}
    </div>
  );
}
