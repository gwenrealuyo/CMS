import React, { useRef, useEffect } from "react";

interface SortOption {
  key: string;
  label: string;
}

interface ClusterSortDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectSort: (sortBy: string, sortOrder: "asc" | "desc") => void;
  /** Viewport-fixed placement; ignored when `anchored` is true. */
  position?: { top: number; left: number };
  /** Anchor under parent with absolute positioning (scrolls with page). */
  anchored?: boolean;
  currentSortBy: string;
  currentSortOrder: "asc" | "desc";
}

const SORT_OPTIONS: SortOption[] = [
  { key: "name", label: "Cluster Name" },
  { key: "member_count", label: "Member Count" },
  { key: "visitor_count", label: "Visitor Count" },
  { key: "family_count", label: "Family Count" },
  { key: "created_at", label: "Created Date" },
];

export default function ClusterSortDropdown({
  isOpen,
  onClose,
  onSelectSort,
  position = { top: 0, left: 0 },
  anchored = false,
  currentSortBy,
  currentSortOrder,
}: ClusterSortDropdownProps) {
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(target as Node)
      ) {
        const clickedButton = target.closest("button");
        if (clickedButton) {
          const buttonText = clickedButton.textContent?.trim() || "";
          if (buttonText.startsWith("Sort")) {
            const hasSortIcon = clickedButton.querySelector(
              'svg path[d*="M3 4h13"]',
            );
            if (hasSortIcon) {
              return;
            }
          }
        }
        onClose();
      }
    };

    if (isOpen) {
      const timeoutId = setTimeout(() => {
        document.addEventListener("mousedown", handleClickOutside);
      }, 100);

      return () => {
        clearTimeout(timeoutId);
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const adjustedPosition = {
    top: position.top,
    left: Math.max(16, Math.min(position.left, window.innerWidth - 272)),
  };

  return (
    <div
      ref={dropdownRef}
      className={
        anchored
          ? "absolute inset-x-0 top-full mt-1.5 z-50 w-full tablet:right-0 tablet:left-auto tablet:w-64 max-w-[calc(100vw-2rem)] bg-white rounded-lg shadow-lg border border-gray-200 py-2"
          : "fixed z-50 w-64 max-w-[calc(100vw-2rem)] bg-white rounded-lg shadow-lg border border-gray-200 py-2"
      }
      style={
        anchored
          ? undefined
          : {
              top: adjustedPosition.top,
              left: adjustedPosition.left,
            }
      }
    >
      <div className="px-3 py-2 border-b border-gray-100">
        <h3 className="text-sm font-medium text-gray-900">Sort by</h3>
      </div>

      <div className="tablet:max-h-64 tablet:overflow-y-auto">
        {SORT_OPTIONS.map((option) => (
          <div key={option.key} className="px-3 py-2.5 md:py-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-700">{option.label}</span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => onSelectSort(option.key, "asc")}
                  className={`px-2.5 py-1.5 md:px-2 md:py-1 text-xs rounded min-h-[36px] md:min-h-0 ${
                    currentSortBy === option.key && currentSortOrder === "asc"
                      ? "chip-primary"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                  aria-label={`Sort ${option.label} ascending`}
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => onSelectSort(option.key, "desc")}
                  className={`px-2.5 py-1.5 md:px-2 md:py-1 text-xs rounded min-h-[36px] md:min-h-0 ${
                    currentSortBy === option.key && currentSortOrder === "desc"
                      ? "chip-primary"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                  aria-label={`Sort ${option.label} descending`}
                >
                  ↓
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
