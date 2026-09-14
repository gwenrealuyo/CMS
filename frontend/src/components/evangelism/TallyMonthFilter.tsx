"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDownIcon } from "@heroicons/react/24/outline";
import {
  MONTH_SHORT,
  canUseYtd,
  detectMonthPreset,
  formatMonthsLabel,
  allYearMonths,
  quarterMonths,
  ytdMonths,
} from "@/src/lib/tallyMonthWindow";

interface TallyMonthFilterProps {
  year: number;
  months: number[];
  onChange: (months: number[]) => void;
}

export default function TallyMonthFilter({
  year,
  months,
  onChange,
}: TallyMonthFilterProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const preset = detectMonthPreset(months, year);
  const ytdAvailable = canUseYtd(year);
  const selected = new Set(months);

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (rootRef.current && !rootRef.current.contains(target)) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener("mousedown", handleClick);
    }
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const presetClass = (active: boolean) =>
    `rounded-md px-2 py-1.5 text-xs font-medium min-h-[36px] ${
      active
        ? "bg-primary text-white"
        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
    }`;

  const toggleMonth = (month: number) => {
    const next = selected.has(month)
      ? months.filter((value) => value !== month)
      : [...months, month].sort((a, b) => a - b);
    if (next.length === 0) {
      return;
    }
    onChange(next);
  };

  return (
    <div ref={rootRef} className="relative min-w-0">
      <label className="sr-only">Filter by months</label>
      <button
        type="button"
        aria-label="Filter by months"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex h-11 min-h-[44px] w-full items-center justify-between gap-2 rounded-md border border-gray-200 bg-white px-3 py-0 text-left text-sm text-gray-900"
      >
        <span className="truncate">{formatMonthsLabel(months, year)}</span>
        <ChevronDownIcon className="h-4 w-4 shrink-0 text-gray-500" />
      </button>
      {open && (
        <div className="absolute z-30 mt-1 w-full min-w-[18rem] rounded-md border border-gray-200 bg-white p-3 shadow-lg">
          <div className="mb-3 flex flex-wrap gap-1.5">
            <button
              type="button"
              className={presetClass(preset === "all")}
              onClick={() => onChange(allYearMonths())}
            >
              All year
            </button>
            {ytdAvailable && (
              <button
                type="button"
                className={presetClass(preset === "ytd")}
                onClick={() => onChange(ytdMonths(year))}
              >
                YTD
              </button>
            )}
            {([1, 2, 3, 4] as const).map((quarter) => (
              <button
                key={quarter}
                type="button"
                className={presetClass(preset === `q${quarter}`)}
                onClick={() => onChange(quarterMonths(quarter))}
              >
                Q{quarter}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4">
            {MONTH_SHORT.map((label, index) => {
              const month = index + 1;
              const checked = selected.has(month);
              return (
                <label
                  key={month}
                  className={`flex min-h-[36px] cursor-pointer items-center gap-2 rounded-md px-2 text-sm ${
                    checked ? "bg-primary/10 text-gray-900" : "text-gray-700"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleMonth(month)}
                    className="rounded border-gray-300"
                  />
                  {label}
                </label>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
