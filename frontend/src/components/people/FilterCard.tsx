import React, { useState, useEffect, useRef } from "react";
import { FilterCondition, FilterConditionValue } from "./FilterBar";

export interface FilterCardField {
  key: string;
  label: string;
  type: "text" | "select" | "date" | "number" | "branch";
  options?: { value: string; label: string }[];
}

interface FilterCardProps {
  field: FilterCardField;
  isOpen: boolean;
  onClose: () => void;
  onApplyFilter: (filter: FilterCondition) => void;
  position: { top: number; left: number };
}

const OPERATORS = {
  text: [
    { value: "contains", label: "Contains" },
    { value: "is", label: "Is" },
    { value: "is_not", label: "Is not" },
    { value: "starts_with", label: "Starts with" },
    { value: "ends_with", label: "Ends with" },
  ],
  select: [
    { value: "is", label: "Is" },
    { value: "is_not", label: "Is not" },
  ],
  date: [
    { value: "is", label: "Is" },
    { value: "is_not", label: "Is not" },
    { value: "before", label: "Before" },
    { value: "after", label: "After" },
    { value: "between", label: "Between" },
  ],
  number: [
    { value: "is", label: "Is" },
    { value: "is_not", label: "Is not" },
    { value: "greater_than", label: "Greater than" },
    { value: "less_than", label: "Less than" },
    { value: "between", label: "Between" },
  ],
  branch: [
    { value: "is", label: "Is" },
    { value: "is_not", label: "Is not" },
  ],
};

function defaultOperatorForField(field: FilterCardField): string {
  if (field.key === "branch" || field.type === "branch") return "is";
  if (field.type === "select") return "is";
  if (field.type === "date" || field.type === "number") return "is";
  return "contains";
}

function operatorsForField(field: FilterCardField) {
  if (field.key === "branch" || field.type === "branch") {
    return OPERATORS.branch;
  }
  return OPERATORS[field.type];
}

export default function FilterCard({
  field,
  isOpen,
  onClose,
  onApplyFilter,
  position,
}: FilterCardProps) {
  const [operator, setOperator] = useState("contains");
  const [value, setValue] = useState("");
  const [value2, setValue2] = useState("");
  const [selectedBranchIds, setSelectedBranchIds] = useState<string[]>([]);
  const [isBetween, setIsBetween] = useState(false);
  const firstInputRef = useRef<HTMLInputElement | HTMLSelectElement | null>(
    null,
  );

  const isBranchField = field.key === "branch" || field.type === "branch";
  const branchMultiMode =
    isBranchField && (operator === "is" || operator === "is_not");

  useEffect(() => {
    if (operator === "between") {
      setIsBetween(true);
    } else {
      setIsBetween(false);
    }
  }, [operator]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        firstInputRef.current?.focus();
      }, 0);
      setOperator(defaultOperatorForField(field));
      setValue("");
      setValue2("");
      setSelectedBranchIds([]);
    }
  }, [isOpen, field]);

  useEffect(() => {
    if (!isOpen || !isBranchField) return;
    setValue("");
    setValue2("");
    setSelectedBranchIds([]);
  }, [operator, isBranchField, isOpen]);

  const toggleBranchId = (id: string) => {
    setSelectedBranchIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const handleApply = () => {
    let filterValue: FilterConditionValue;

    if (branchMultiMode) {
      if (selectedBranchIds.length === 0) return;
      filterValue = [...selectedBranchIds].sort(
        (a, b) => Number(a) - Number(b),
      );
    } else {
      if (!value.trim()) return;
      filterValue = isBetween
        ? ([value, value2] as [string, string])
        : value;
    }

    const filter: FilterCondition = {
      id: `${field.key}_${Date.now()}`,
      field: field.key,
      operator,
      value: filterValue,
      label: field.label,
    };

    onApplyFilter(filter);
    onClose();
    setValue("");
    setValue2("");
    setSelectedBranchIds([]);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleApply();
    }
  };

  const renderInput = () => {
    if (branchMultiMode && field.options) {
      return (
        <div
          className="max-h-48 overflow-y-auto border border-gray-300 rounded-lg p-2 space-y-1.5"
          role="group"
          aria-label={`Select ${field.label}`}
        >
          {field.options.map((option) => (
            <label
              key={option.value}
              className="flex items-center gap-2 text-sm text-gray-800 cursor-pointer py-1 px-1 rounded hover:bg-gray-50"
            >
              <input
                type="checkbox"
                checked={selectedBranchIds.includes(option.value)}
                onChange={() => toggleBranchId(option.value)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
      );
    }

    if (field.type === "select" && field.options) {
      return (
        <select
          ref={
            firstInputRef as React.MutableRefObject<HTMLSelectElement | null>
          }
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyPress={handleKeyPress}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="">Select {field.label}</option>
          {field.options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      );
    }

    if (field.type === "date") {
      return (
        <input
          ref={firstInputRef as React.MutableRefObject<HTMLInputElement | null>}
          type="date"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyPress={handleKeyPress}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      );
    }

    if (field.type === "number") {
      return (
        <input
          ref={firstInputRef as React.MutableRefObject<HTMLInputElement | null>}
          type="number"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyPress={handleKeyPress}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      );
    }

    return (
      <input
        ref={firstInputRef as React.MutableRefObject<HTMLInputElement | null>}
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyPress={handleKeyPress}
        placeholder={`Enter ${field.label.toLowerCase()}`}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      />
    );
  };

  if (!isOpen) return null;

  const opList = operatorsForField(field);

  return (
    <div
      className="fixed z-50 w-80 bg-white rounded-lg shadow-lg border border-gray-200 p-4"
      style={{
        top: position.top,
        left: position.left,
      }}
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-gray-900">
          Filter by {field.label}
        </h3>
        <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Condition
          </label>
          <select
            value={operator}
            onChange={(e) => setOperator(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            {opList.map((op) => (
              <option key={op.value} value={op.value}>
                {op.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Value
          </label>
          {renderInput()}
        </div>

        {isBetween && (
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              To
            </label>
            {field.type === "date" ? (
              <input
                type="date"
                value={value2}
                onChange={(e) => setValue2(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            ) : field.type === "number" ? (
              <input
                type="number"
                value={value2}
                onChange={(e) => setValue2(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            ) : (
              <input
                type="text"
                value={value2}
                onChange={(e) => setValue2(e.target.value)}
                placeholder={`Enter ${field.label.toLowerCase()}`}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            )}
          </div>
        )}
      </div>

      <div className="flex justify-end space-x-2 mt-4 pt-4 border-t border-gray-200">
        <button
          type="button"
          onClick={onClose}
          className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleApply}
          disabled={
            branchMultiMode
              ? selectedBranchIds.length === 0
              : !value.trim() || (isBetween && !value2.trim())
          }
          className="px-3 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Apply Filter
        </button>
      </div>
    </div>
  );
}
