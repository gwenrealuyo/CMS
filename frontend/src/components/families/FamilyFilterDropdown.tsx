import React, { useRef, useEffect } from "react";

interface FilterField {
  key: string;
  label: string;
  type: "text" | "select" | "date" | "number" | "range";
  options?: { value: string; label: string }[];
}

interface FamilyFilterDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectField: (field: FilterField) => void;
}

const FAMILY_FILTER_FIELDS: FilterField[] = [
  {
    key: "name",
    label: "Family Name",
    type: "text",
  },
  {
    key: "member_count",
    label: "Member Count",
    type: "range",
  },
  {
    key: "visitor_count",
    label: "Visitor Count",
    type: "range",
  },
];

export default function FamilyFilterDropdown({
  isOpen,
  onClose,
  onSelectField,
}: FamilyFilterDropdownProps) {
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        const target = event.target as HTMLElement;
        const clickedButton = target.closest("button");
        if (clickedButton) {
          const buttonText = clickedButton.textContent?.trim() || "";
          if (buttonText === "Filter" || buttonText.startsWith("Filter")) {
            return;
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

  return (
    <div
      ref={dropdownRef}
      className="absolute inset-x-0 top-full mt-1.5 z-50 w-full tablet:right-0 tablet:left-auto tablet:w-64 max-w-[calc(100vw-2rem)] bg-white rounded-lg shadow-lg border border-gray-200 py-2"
    >
      <div className="px-3 py-2 border-b border-gray-100">
        <h3 className="text-sm font-medium text-gray-900">Filter by Field</h3>
      </div>

      <div className="tablet:max-h-64 tablet:overflow-y-auto">
        {FAMILY_FILTER_FIELDS.map((field) => (
          <button
            key={field.key}
            type="button"
            onClick={() => {
              onSelectField(field);
              onClose();
            }}
            className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center justify-between"
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
