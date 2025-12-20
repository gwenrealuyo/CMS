import React, { useState, useRef, useEffect } from "react";
import { Branch } from "@/src/types/branch";

interface FilterField {
  key: string;
  label: string;
  type: "text" | "select" | "date" | "number";
  options?: { value: string; label: string }[];
}

interface FilterDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectField: (field: FilterField) => void;
  position: { top: number; left: number };
  branches?: Branch[];
}

const FILTER_FIELDS: FilterField[] = [
  {
    key: "first_name",
    label: "First Name",
    type: "text",
  },
  {
    key: "last_name",
    label: "Last Name",
    type: "text",
  },
  {
    key: "email",
    label: "Email",
    type: "text",
  },
  {
    key: "phone",
    label: "Phone",
    type: "text",
  },
  {
    key: "role",
    label: "Role",
    type: "select",
    options: [
      { value: "PASTOR", label: "Pastor" },
      { value: "COORDINATOR", label: "Coordinator" },
      { value: "MEMBER", label: "Member" },
      { value: "VISITOR", label: "Visitor" },
    ],
  },
  {
    key: "status",
    label: "Status",
    type: "select",
    options: [
      { value: "ACTIVE", label: "Active" },
      { value: "SEMIACTIVE", label: "Semi-active" },
      { value: "INACTIVE", label: "Inactive" },
      { value: "DECEASED", label: "Deceased" },
    ],
  },
  {
    key: "branch",
    label: "Branch",
    type: "select",
    options: [], // Will be populated dynamically
  },
  {
    key: "date_first_attended",
    label: "Join Date",
    type: "date",
  },
  {
    key: "birth_date",
    label: "Birth Date",
    type: "date",
  },
];

export default function FilterDropdown({
  isOpen,
  onClose,
  onSelectField,
  position,
  branches = [],
}: FilterDropdownProps) {
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Update branch filter options dynamically
  const filterFieldsWithBranches = FILTER_FIELDS.map((field) => {
    if (field.key === "branch") {
      return {
        ...field,
        options: branches
          .filter((b) => b.is_active)
          .map((b) => ({
            value: b.id.toString(),
            label: b.name + (b.is_headquarters ? " (HQ)" : ""),
          })),
      };
    }
    return field;
  });

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
        <h3 className="text-sm font-medium text-gray-900">Filter by Field</h3>
      </div>

      <div className="max-h-64 overflow-y-auto">
        {filterFieldsWithBranches.map((field) => (
          <button
            key={field.key}
            onClick={() => {
              onSelectField(field);
              onClose();
            }}
            className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center justify-between"
            disabled={
              field.key === "branch" && (!branches || branches.length === 0)
            }
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
