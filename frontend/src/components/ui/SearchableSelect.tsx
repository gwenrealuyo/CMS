"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { formatPersonName } from "@/src/lib/name";

export type SearchableOption = {
  id?: string | number;
  first_name?: string;
  middle_name?: string;
  last_name?: string;
  suffix?: string;
  username: string;
  [key: string]: unknown;
};

interface SearchableSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SearchableOption[];
  placeholder?: string;
  label?: string;
  emptyMessage?: string;
  showEmptyOption?: boolean;
  emptyOptionLabel?: string;
  disabled?: boolean;
}

export default function SearchableSelect({
  value,
  onChange,
  options,
  placeholder = "Search...",
  label,
  emptyMessage = "No results found",
  showEmptyOption = true,
  emptyOptionLabel = "All",
  disabled = false,
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedOption = useMemo(() => {
    if (!value) return null;
    return options.find((opt) => opt.id !== undefined && String(opt.id) === value);
  }, [options, value]);

  const filteredOptions = useMemo(() => {
    // Filter out options without IDs
    const validOptions = options.filter((opt) => opt.id !== undefined);
    
    if (!searchQuery.trim()) {
      return validOptions;
    }
    const query = searchQuery.toLowerCase();
    return validOptions.filter((option) => {
      const name = formatPersonName(option).toLowerCase();
      const username = (option.username || "").toLowerCase();
      return name.includes(query) || username.includes(query);
    });
  }, [options, searchQuery]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setSearchQuery("");
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      // Focus the input when dropdown opens
      setTimeout(() => {
        inputRef.current?.focus();
      }, 0);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const handleSelect = (optionId: string | number | undefined) => {
    if (disabled || optionId === undefined) return;
    onChange(String(optionId));
    setIsOpen(false);
    setSearchQuery("");
  };

  const handleClear = () => {
    if (disabled) return;
    onChange("");
    setIsOpen(false);
    setSearchQuery("");
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled) return;
    setSearchQuery(e.target.value);
    if (!isOpen) {
      setIsOpen(true);
    }
  };

  const handleInputFocus = () => {
    if (!disabled) {
      setIsOpen(true);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return;
    if (e.key === "Escape") {
      setIsOpen(false);
      setSearchQuery("");
    } else if (e.key === "Enter" && filteredOptions.length === 1) {
      handleSelect(filteredOptions[0].id);
    }
  };

  // Close dropdown if disabled while open
  useEffect(() => {
    if (disabled && isOpen) {
      setIsOpen(false);
      setSearchQuery("");
    }
  }, [disabled, isOpen]);

  return (
    <div className="space-y-1" ref={containerRef}>
      {label && (
        <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600">
          {label}
        </label>
      )}
      <div className="relative">
        <div
          className={`w-full rounded-md border border-gray-300 px-3 py-2 text-sm bg-white ${
            disabled
              ? "bg-gray-50 cursor-not-allowed opacity-60"
              : "focus-within:border-blue-500 focus-within:outline-none focus-within:ring-1 focus-within:ring-blue-500 cursor-pointer"
          }`}
          onClick={() => {
            if (!disabled && !isOpen) {
              setIsOpen(true);
              inputRef.current?.focus();
            }
          }}
        >
          {!isOpen && selectedOption ? (
            <div className="flex items-center justify-between">
              <span className={disabled ? "text-gray-500" : "text-gray-900"}>
                {formatPersonName(selectedOption)}
              </span>
              {!disabled && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleClear();
                  }}
                  className="text-gray-400 hover:text-gray-600 ml-2"
                  aria-label="Clear selection"
                >
                  ×
                </button>
              )}
            </div>
          ) : !isOpen && !selectedOption ? (
            <span className="text-gray-500">{placeholder}</span>
          ) : (
            <input
              ref={inputRef}
              type="text"
              value={searchQuery}
              onChange={handleInputChange}
              onFocus={handleInputFocus}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              disabled={disabled}
              className="w-full outline-none bg-transparent text-gray-900 disabled:cursor-not-allowed disabled:text-gray-500"
            />
          )}
        </div>

        {isOpen && !disabled && (
          <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
            {showEmptyOption && (
              <button
                type="button"
                onClick={handleClear}
                className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 ${
                  !value ? "bg-blue-50 text-blue-700" : "text-gray-900"
                }`}
              >
                {emptyOptionLabel}
              </button>
            )}
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-2 text-gray-500 text-sm">
                {emptyMessage}
              </div>
            ) : (
              filteredOptions.map((option) => {
                const optionId = option.id;
                if (optionId === undefined) return null;
                const isSelected = String(optionId) === value;
                return (
                  <button
                    key={optionId}
                    type="button"
                    onClick={() => handleSelect(optionId)}
                    className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 ${
                      isSelected
                        ? "bg-blue-50 text-blue-700 font-medium"
                        : "text-gray-900"
                    }`}
                  >
                    {formatPersonName(option)}
                  </button>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}

