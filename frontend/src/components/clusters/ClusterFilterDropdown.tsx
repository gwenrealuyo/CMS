import React, { useState, useRef, useEffect } from "react";

interface FilterField {
  key: string;
  label: string;
  type: "text" | "select" | "date" | "number" | "range";
  options?: { value: string; label: string }[];
}

interface ClusterFilterDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectField: (field: FilterField) => void;
  position: { top: number; left: number };
}

const CLUSTER_FILTER_FIELDS: FilterField[] = [
  {
    key: "name",
    label: "Cluster Name",
    type: "text",
  },
  {
    key: "code",
    label: "Cluster Code",
    type: "text",
  },
  {
    key: "coordinator",
    label: "Coordinator",
    type: "text",
  },
  {
    key: "location",
    label: "Location",
    type: "text",
  },
  {
    key: "meeting_schedule",
    label: "Meeting Schedule",
    type: "text",
  },
  {
    key: "member_count",
    label: "Member Count",
    type: "range",
  },
  {
    key: "family_count",
    label: "Family Count",
    type: "range",
  },
];

export default function ClusterFilterDropdown({
  isOpen,
  onClose,
  onSelectField,
  position,
}: ClusterFilterDropdownProps) {
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(target as Node)
      ) {
        // Check if click is on the filter button or its children
        const clickedButton = target.closest('button');
        if (clickedButton) {
          const buttonText = clickedButton.textContent?.trim() || '';
          // Don't close if clicking the filter button itself
          // Check by text content (should contain "Filter") and SVG icon
          if (buttonText === 'Filter' || buttonText.startsWith('Filter')) {
            // Verify it has the filter icon by checking for the specific path
            const svgPath = clickedButton.querySelector('path[d*="M12 6v6"]');
            if (svgPath) {
              return; // This is the filter button, don't close
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
        <h3 className="text-sm font-medium text-gray-900">Filter by Field</h3>
      </div>

      <div className="max-h-64 overflow-y-auto">
        {CLUSTER_FILTER_FIELDS.map((field) => (
          <button
            key={field.key}
            onClick={() => {
              onSelectField(field);
              onClose();
            }}
            className="w-full px-3 py-2.5 md:py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center justify-between min-h-[44px] md:min-h-0"
          >
            <span>{field.label}</span>
            <span className="text-xs text-gray-400 capitalize">
              {field.type}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
