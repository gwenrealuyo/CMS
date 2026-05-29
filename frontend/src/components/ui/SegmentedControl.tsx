"use client";

import React, { ReactNode } from "react";

export interface SegmentedControlOption<T extends string> {
  id: T;
  label: string;
  disabled?: boolean;
  icon?: ReactNode;
}

interface SegmentedControlProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: SegmentedControlOption<T>[];
  /** Stretch tabs evenly on small screens (e.g. Clusters page). */
  fullWidthOnMobile?: boolean;
  className?: string;
}

export default function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  fullWidthOnMobile = false,
  className = "",
}: SegmentedControlProps<T>) {
  return (
    <div
      className={`inline-flex rounded-lg bg-gray-100 p-1 gap-0.5 ${
        fullWidthOnMobile ? "w-full sm:w-auto" : ""
      } ${className}`.trim()}
      role="tablist"
    >
      {options.map((option) => {
        const isActive = value === option.id;
        return (
          <button
            key={option.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            disabled={option.disabled}
            onClick={() => {
              if (!option.disabled) {
                onChange(option.id);
              }
            }}
            className={`inline-flex items-center justify-center gap-1.5 rounded-md px-4 py-2.5 md:py-2 text-sm font-medium transition-all min-h-[44px] md:min-h-0 ${
              fullWidthOnMobile ? "flex-1 sm:flex-none" : ""
            } ${
              isActive
                ? "bg-white text-gray-900 shadow-sm"
                : "bg-transparent text-gray-500 hover:text-gray-700"
            } ${option.disabled ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            {option.icon}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
