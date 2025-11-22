import React, { useState, useRef, useEffect } from "react";

interface SortOption {
  key: string;
  label: string;
}

interface ClusterSortDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectSort: (sortBy: string, sortOrder: "asc" | "desc") => void;
  position: { top: number; left: number };
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
  position,
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
        // Check if click is on the sort button or its children
        const clickedButton = target.closest('button');
        if (clickedButton) {
          const buttonText = clickedButton.textContent?.trim() || '';
          // Don't close if clicking the sort button itself
          // Check by text content (should start with "Sort") and SVG icon
          if (buttonText.startsWith('Sort')) {
            // Verify it has the sort icon by checking for the specific path pattern
            const hasSortIcon = clickedButton.querySelector('svg path[d*="M3 4h13"]');
            if (hasSortIcon) {
              return; // This is the sort button, don't close
            }
          }
        }
        onClose();
      }
    };

    if (isOpen) {
      // Use a small delay to avoid closing immediately when opening
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

  // Adjust position for mobile
  const adjustedPosition = {
    top: position.top,
    left: Math.max(16, Math.min(position.left, window.innerWidth - 272)), // 256 + 16 padding
  };

  return (
    <div
      ref={dropdownRef}
      className="fixed z-50 w-64 max-w-[calc(100vw-2rem)] bg-white rounded-lg shadow-lg border border-gray-200 py-2"
      style={{
        top: adjustedPosition.top,
        left: adjustedPosition.left,
      }}
    >
      <div className="px-3 py-2 border-b border-gray-100">
        <h3 className="text-sm font-medium text-gray-900">Sort by</h3>
      </div>

      <div className="max-h-64 overflow-y-auto">
        {SORT_OPTIONS.map((option) => (
          <div key={option.key} className="px-3 py-2.5 md:py-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-700">{option.label}</span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => onSelectSort(option.key, "asc")}
                  className={`px-2.5 py-1.5 md:px-2 md:py-1 text-xs rounded min-h-[36px] md:min-h-0 ${
                    currentSortBy === option.key && currentSortOrder === "asc"
                      ? "bg-blue-100 text-blue-800"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                  aria-label={`Sort ${option.label} ascending`}
                >
                  ↑
                </button>
                <button
                  onClick={() => onSelectSort(option.key, "desc")}
                  className={`px-2.5 py-1.5 md:px-2 md:py-1 text-xs rounded min-h-[36px] md:min-h-0 ${
                    currentSortBy === option.key && currentSortOrder === "desc"
                      ? "bg-blue-100 text-blue-800"
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
