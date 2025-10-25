import React, { useState, useRef, useEffect, useMemo } from "react";
import {
  ChevronDownIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";

interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface ScalableSelectProps {
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  className?: string;
  disabled?: boolean;
  maxHeight?: number;
  showSearch?: boolean;
  emptyMessage?: string;
  loading?: boolean;
  virtualizeThreshold?: number; // Start virtualizing when options exceed this number
}

export default function ScalableSelect({
  options,
  value,
  onChange,
  placeholder = "Select an option",
  searchPlaceholder = "Search...",
  className = "",
  disabled = false,
  maxHeight = 200,
  showSearch = true,
  emptyMessage = "No options found",
  loading = false,
  virtualizeThreshold = 100,
}: ScalableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const optionsContainerRef = useRef<HTMLDivElement>(null);

  // Filter options based on search query
  const filteredOptions = useMemo(() => {
    if (!searchQuery.trim()) return options;

    const query = searchQuery.toLowerCase();
    return options.filter(
      (option) =>
        option.label.toLowerCase().includes(query) ||
        option.value.toLowerCase().includes(query)
    );
  }, [options, searchQuery]);

  // Determine if we should use virtualization
  const shouldVirtualize = filteredOptions.length > virtualizeThreshold;

  // Get selected option
  const selectedOption = options.find((option) => option.value === value);

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setSearchQuery("");
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && showSearch && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen, showSearch]);

  // Handle option selection
  const handleOptionClick = (optionValue: string) => {
    onChange(optionValue);
    setIsOpen(false);
    setSearchQuery("");
  };

  // Handle clear selection
  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange("");
    setIsOpen(false);
    setSearchQuery("");
  };

  // Handle toggle dropdown
  const handleToggle = () => {
    if (disabled) return;
    setIsOpen(!isOpen);
    if (!isOpen) {
      setSearchQuery("");
    }
  };

  // Render options with virtualization for large lists
  const renderOptions = () => {
    if (loading) {
      return (
        <div className="p-3 text-center text-gray-500">
          <div className="flex items-center justify-center">
            <svg
              className="animate-spin h-4 w-4 mr-2"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              ></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
            Loading...
          </div>
        </div>
      );
    }

    if (filteredOptions.length === 0) {
      return (
        <div className="p-3 text-center text-gray-500 text-sm">
          {emptyMessage}
        </div>
      );
    }

    // For large lists, show a message about virtualization
    if (shouldVirtualize) {
      return (
        <>
          <div className="p-2 text-xs text-gray-500 bg-gray-50 border-b">
            Showing {filteredOptions.length} options. Use search to filter
            results.
          </div>
          <div className="max-h-48 overflow-y-auto">
            {filteredOptions.slice(0, 50).map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => handleOptionClick(option.value)}
                disabled={option.disabled}
                className={`
                  w-full px-3 py-1.5 text-left text-sm transition-colors
                  ${
                    option.disabled
                      ? "text-gray-400 cursor-not-allowed"
                      : "text-gray-900 hover:bg-gray-100"
                  }
                  ${option.value === value ? "bg-blue-50 text-blue-900" : ""}
                `}
              >
                <div className="flex items-center justify-between">
                  <span className="truncate">{option.label}</span>
                  {option.value === value && (
                    <svg
                      className="w-4 h-4 text-blue-600"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                </div>
              </button>
            ))}
            {filteredOptions.length > 50 && (
              <div className="p-2 text-xs text-gray-500 text-center bg-gray-50">
                ... and {filteredOptions.length - 50} more. Use search to find
                specific options.
              </div>
            )}
          </div>
        </>
      );
    }

    // For smaller lists, render all options
    return filteredOptions.map((option) => (
      <button
        key={option.value}
        type="button"
        onClick={() => handleOptionClick(option.value)}
        disabled={option.disabled}
        className={`
          w-full px-3 py-1.5 text-left text-sm transition-colors
          ${
            option.disabled
              ? "text-gray-400 cursor-not-allowed"
              : "text-gray-900 hover:bg-gray-100"
          }
          ${option.value === value ? "bg-blue-50 text-blue-900" : ""}
        `}
      >
        <div className="flex items-center justify-between">
          <span className="truncate">{option.label}</span>
          {option.value === value && (
            <svg
              className="w-4 h-4 text-blue-600"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
          )}
        </div>
      </button>
    ));
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={handleToggle}
        disabled={disabled}
        className={`
          w-full px-3 py-2 text-left bg-white border border-gray-300 rounded-md shadow-sm text-sm
          focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
          ${
            disabled
              ? "bg-gray-50 text-gray-500 cursor-not-allowed"
              : "hover:border-gray-400"
          }
          ${isOpen ? "ring-2 ring-blue-500 border-transparent" : ""}
        `}
      >
        <div className="flex items-center justify-between">
          <span
            className={`block truncate ${
              !selectedOption ? "text-gray-500" : "text-gray-900"
            }`}
          >
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          <div className="flex items-center space-x-1">
            {value && !disabled && (
              <button
                type="button"
                onClick={handleClear}
                className="text-gray-400 hover:text-gray-600 p-0.5 rounded"
              >
                <XMarkIcon className="w-3.5 h-3.5" />
              </button>
            )}
            <ChevronDownIcon
              className={`w-3.5 h-3.5 text-gray-400 transition-transform duration-200 ${
                isOpen ? "rotate-180" : ""
              }`}
            />
          </div>
        </div>
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg">
          {/* Search Input */}
          {showSearch && (
            <div className="p-2 border-b border-gray-200">
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-2.5 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={searchPlaceholder}
                  className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          )}

          {/* Options List */}
          <div
            ref={optionsContainerRef}
            className="overflow-y-auto"
            style={{ maxHeight: `${maxHeight}px` }}
          >
            {renderOptions()}
          </div>
        </div>
      )}
    </div>
  );
}
