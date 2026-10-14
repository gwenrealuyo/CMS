"use client";

import { useEffect, useRef, type ReactNode } from "react";

export type LessonContentTab =
  | "lesson"
  | "progress"
  | "teachers"
  | "awaiting-teacher"
  | "timeline"
  | "sessions"
  | "commitment";

interface LessonContentTabsProps {
  activeTab: LessonContentTab;
  onTabChange: (tab: LessonContentTab) => void;
  hideProgress?: boolean;
  hideTeachers?: boolean;
  hideTimeline?: boolean;
  hideAwaitingTeacher?: boolean;
  awaitingTeacherCount?: number | null;
  hideSessions?: boolean;
  disableCommitment?: boolean;
  branchFilter?: ReactNode;
}

const TAB_BUTTON_BASE_CLASS =
  "shrink-0 snap-start py-4 px-1 border-b-2 font-medium text-sm transition-colors whitespace-nowrap";

export default function LessonContentTabs({
  activeTab,
  onTabChange,
  hideProgress,
  hideTeachers,
  hideTimeline,
  hideAwaitingTeacher,
  awaitingTeacherCount,
  hideSessions,
  disableCommitment,
  branchFilter,
}: LessonContentTabsProps) {
  const activeTabButtonRef = useRef<HTMLButtonElement>(null);

  const tabs: Array<{
    id: LessonContentTab;
    label: string;
    mobileLabel: string;
    disabled: boolean;
  }> = [
    {
      id: "lesson",
      label: "Content",
      mobileLabel: "Content",
      disabled: false,
    },
    ...(!hideProgress
      ? [
          {
            id: "progress" as const,
            label: "Progress",
            mobileLabel: "Progress",
            disabled: false,
          },
        ]
      : []),
    ...(!hideTeachers
      ? [
          {
            id: "teachers" as const,
            label: "Teachers",
            mobileLabel: "Teachers",
            disabled: false,
          },
        ]
      : []),
    ...(!hideAwaitingTeacher
      ? [
          {
            id: "awaiting-teacher" as const,
            label: "Awaiting Teacher",
            mobileLabel: "Awaiting",
            disabled: false,
          },
        ]
      : []),
    ...(!hideTimeline
      ? [
          {
            id: "timeline" as const,
            label: "Timeline",
            mobileLabel: "Timeline",
            disabled: false,
          },
        ]
      : []),
    ...(!hideSessions
      ? [
          {
            id: "sessions" as const,
            label: "Reports",
            mobileLabel: "Reports",
            disabled: false,
          },
        ]
      : []),
    {
      id: "commitment",
      label: "Files",
      mobileLabel: "Files",
      disabled: Boolean(disableCommitment),
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
          className="-mb-px flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth"
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
                className={`${TAB_BUTTON_BASE_CLASS} ${
                  isActive
                    ? "border-primary text-primary"
                    : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
                } ${tab.disabled ? "cursor-not-allowed opacity-50" : ""}`}
              >
                <span className="md:hidden">{tab.mobileLabel}</span>
                <span className="hidden md:inline">{tab.label}</span>
                {tab.id === "awaiting-teacher" &&
                typeof awaitingTeacherCount === "number" ? (
                  <span className="ml-1.5 inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-red-100 px-1.5 text-xs font-semibold text-red-700">
                    {awaitingTeacherCount}
                  </span>
                ) : null}
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
