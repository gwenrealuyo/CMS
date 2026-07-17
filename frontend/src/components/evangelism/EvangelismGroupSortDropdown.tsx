import { useEffect, useRef } from "react";

interface SortOption {
  key: string;
  label: string;
}

interface EvangelismGroupSortDropdownProps {
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
  { key: "name", label: "Group Name" },
  { key: "member_count", label: "Member Count" },
  { key: "visitor_count", label: "Visitor Count" },
  { key: "cluster_code", label: "Cluster Code" },
  { key: "created_at", label: "Created Date" },
];

export default function EvangelismGroupSortDropdown({
  isOpen,
  onClose,
  onSelectSort,
  position = { top: 0, left: 0 },
  anchored = false,
  currentSortBy,
  currentSortOrder,
}: EvangelismGroupSortDropdownProps) {
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
            if (hasSortIcon) return;
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
          ? "absolute inset-x-0 top-full z-50 mt-1.5 w-full max-w-[calc(100vw-2rem)] rounded-lg border border-gray-200 bg-white py-2 shadow-lg tablet:left-auto tablet:right-0 tablet:w-64"
          : "fixed z-50 w-64 max-w-[calc(100vw-2rem)] rounded-lg border border-gray-200 bg-white py-2 shadow-lg"
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
      <div className="border-b border-gray-100 px-3 py-2">
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
                  className={`min-h-[36px] rounded px-2.5 py-1.5 text-xs md:min-h-0 md:px-2 md:py-1 ${
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
                  className={`min-h-[36px] rounded px-2.5 py-1.5 text-xs md:min-h-0 md:px-2 md:py-1 ${
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
