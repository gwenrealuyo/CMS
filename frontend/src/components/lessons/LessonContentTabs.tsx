"use client";

import { useEffect, useRef, type ReactNode } from "react";

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

const TAB_BUTTON_BASE_CLASS =
  "shrink-0 snap-start py-4 px-1 border-b-2 font-medium text-sm transition-colors whitespace-nowrap";

export default function LessonContentTabs({
  activeTab,
  onTabChange,
  disableProgress,
  disableSessions,
  disableCommitment,
  branchFilter,
}: LessonContentTabsProps) {
  const activeTabButtonRef = useRef<HTMLButtonElement>(null);

  const tabs: Array<{
    id: LessonContentTab;
    label: string;
    mobileLabel: string;
    disabled: boolean;
    minWidthClass: string;
  }> = [
    {
      id: "lesson",
      label: "Lesson Content",
      mobileLabel: "Content",
      disabled: false,
      minWidthClass: "min-w-[68px] md:min-w-[100px]",
    },
    {
      id: "progress",
      label: "Student Progress",
      mobileLabel: "Progress",
      disabled: Boolean(disableProgress),
      minWidthClass: "min-w-[72px] md:min-w-[120px]",
    },
    {
      id: "sessions",
      label: "Session Reports",
      mobileLabel: "Reports",
      disabled: Boolean(disableSessions),
      minWidthClass: "min-w-[72px] md:min-w-[110px]",
    },
    {
      id: "commitment",
      label: "Commitment Forms",
      mobileLabel: "Commitment",
      disabled: Boolean(disableCommitment),
      minWidthClass: "min-w-[80px] md:min-w-[130px]",
    },
  ];

  useEffect(() => {
    activeTabButtonRef.current?.scrollIntoView({
      inline: "nearest",
      block: "nearest",
      behavior: "smooth",
    });
  }, [activeTab]);

  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0 flex-1 border-b border-gray-200">
        <nav
          className="-mb-px flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth sm:gap-8"
          role="tablist"
        >
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                ref={isActive ? activeTabButtonRef : undefined}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-label={tab.label}
                disabled={tab.disabled}
                onClick={() => {
                  if (!tab.disabled) {
                    onTabChange(tab.id);
                  }
                }}
                className={`${TAB_BUTTON_BASE_CLASS} ${tab.minWidthClass} ${
                  isActive
                    ? "border-primary text-primary"
                    : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
                } ${tab.disabled ? "cursor-not-allowed opacity-50" : ""}`}
              >
                <span className="md:hidden">{tab.mobileLabel}</span>
                <span className="hidden md:inline">{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
      {branchFilter ? (
        <div className="flex w-full shrink-0 items-center md:w-auto md:pb-1">
          {branchFilter}
        </div>
      ) : null}
    </div>
  );
}
