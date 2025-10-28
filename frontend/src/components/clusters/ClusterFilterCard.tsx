import React, { useState, useEffect, useRef } from "react";
import { FilterCondition } from "../people/FilterBar";

// Local definition to align with ClusterFilterDropdown's FilterField
interface FilterField {
  key: string;
  label: string;
  type: "text" | "select" | "date" | "number" | "range";
  options?: { value: string; label: string }[];
}

interface ClusterFilterCardProps {
  field: FilterField;
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
  range: [
    { value: "between", label: "Between" },
    { value: "greater_than", label: "Greater than" },
    { value: "less_than", label: "Less than" },
  ],
};

export default function ClusterFilterCard({
  field,
  isOpen,
  onClose,
  onApplyFilter,
  position,
}: ClusterFilterCardProps) {
  const [operator, setOperator] = useState("contains");
  const [value, setValue] = useState("");
  const [value2, setValue2] = useState("");
  const [selectedOption, setSelectedOption] = useState("");
  const firstInputRef = useRef<HTMLInputElement | HTMLSelectElement | null>(
    null
  );

  useEffect(() => {
    if (isOpen) {
      // Reset form when opening
      setOperator("contains");
      setValue("");
      setValue2("");
      setSelectedOption("");
      // Defer focus to next tick to ensure elements are rendered
      setTimeout(() => {
        firstInputRef.current?.focus();
      }, 0);
    }
  }, [isOpen]);

  const handleApply = () => {
    if (!operator) return;

    let filterValue: string | [string, string];
    let label: string;

    if (field.type === "select") {
      if (!selectedOption) return;
      filterValue = selectedOption;
      const optionLabel =
        field.options?.find((opt) => opt.value === selectedOption)?.label ||
        selectedOption;
      label = `${field.label} ${
        OPERATORS[field.type].find((op) => op.value === operator)?.label
      } ${optionLabel}`;
    } else if (operator === "between") {
      if (!value || !value2) return;
      filterValue = [value, value2];
      label = `${field.label} ${
        OPERATORS[field.type].find((op) => op.value === operator)?.label
      } ${value} and ${value2}`;
    } else {
      if (!value) return;
      filterValue = value;
      label = `${field.label} ${
        OPERATORS[field.type].find((op) => op.value === operator)?.label
      } ${value}`;
    }

    const filter: FilterCondition = {
      id: `${field.key}_${Date.now()}`,
      field: field.key,
      operator,
      value: filterValue,
      label,
    };

    onApplyFilter(filter);
    onClose();
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleApply();
    }
  };

  if (!isOpen) return null;

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
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
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
        {/* Operator Selection */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Operator
          </label>
          <select
            value={operator}
            onChange={(e) => setOperator(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            {OPERATORS[field.type].map((op) => (
              <option key={op.value} value={op.value}>
                {op.label}
              </option>
            ))}
          </select>
        </div>

        {/* Value Input */}
        {field.type === "select" ? (
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Value
            </label>
            <select
              ref={
                firstInputRef as React.MutableRefObject<HTMLSelectElement | null>
              }
              value={selectedOption}
              onChange={(e) => setSelectedOption(e.target.value)}
              onKeyPress={handleKeyPress}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Select {field.label}</option>
              {field.options?.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        ) : field.type === "range" ? (
          <div className="space-y-2">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                {operator === "between" ? "Minimum" : "Value"}
              </label>
              <input
                ref={
                  firstInputRef as React.MutableRefObject<HTMLInputElement | null>
                }
                type="number"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder={
                  operator === "between" ? "Min value" : "Enter value"
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            {operator === "between" && (
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Maximum
                </label>
                <input
                  type="number"
                  value={value2}
                  onChange={(e) => setValue2(e.target.value)}
                  placeholder="Max value"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            )}
          </div>
        ) : field.type === "date" ? (
          <div className="space-y-2">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                {operator === "between" ? "Start Date" : "Date"}
              </label>
              <input
                ref={
                  firstInputRef as React.MutableRefObject<HTMLInputElement | null>
                }
                type="date"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyPress={handleKeyPress}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            {operator === "between" && (
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  End Date
                </label>
                <input
                  type="date"
                  value={value2}
                  onChange={(e) => setValue2(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                {operator === "between" ? "First Value" : "Value"}
              </label>
              <input
                ref={
                  firstInputRef as React.MutableRefObject<HTMLInputElement | null>
                }
                type={field.type === "number" ? "number" : "text"}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder={`Enter ${field.label.toLowerCase()}`}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            {operator === "between" && (
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Second Value
                </label>
                <input
                  type={field.type === "number" ? "number" : "text"}
                  value={value2}
                  onChange={(e) => setValue2(e.target.value)}
                  placeholder={`Enter second ${field.label.toLowerCase()}`}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex justify-end space-x-2 pt-2">
          <button
            onClick={onClose}
            className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Cancel
          </button>
          <button
            onClick={handleApply}
            className="px-3 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Apply Filter
          </button>
        </div>
      </div>
    </div>
  );
}
