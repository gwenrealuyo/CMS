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
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      ref={dropdownRef}
      className="fixed z-50 w-64 bg-white rounded-lg shadow-lg border border-gray-200 py-2"
      style={{
        top: position.top,
        left: position.left,
      }}
    >
      <div className="px-3 py-2 border-b border-gray-100">
        <h3 className="text-sm font-medium text-gray-900">Sort by</h3>
      </div>

      <div className="max-h-64 overflow-y-auto">
        {SORT_OPTIONS.map((option) => (
          <div key={option.key} className="px-3 py-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-700">{option.label}</span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => onSelectSort(option.key, "asc")}
                  className={`px-2 py-1 text-xs rounded ${
                    currentSortBy === option.key && currentSortOrder === "asc"
                      ? "bg-blue-100 text-blue-800"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  ↑
                </button>
                <button
                  onClick={() => onSelectSort(option.key, "desc")}
                  className={`px-2 py-1 text-xs rounded ${
                    currentSortBy === option.key && currentSortOrder === "desc"
                      ? "bg-blue-100 text-blue-800"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
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
