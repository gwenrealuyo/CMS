"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { XMarkIcon } from "@heroicons/react/24/outline";
import {
  MONTH_NAMES,
  daysInMonth,
  formatLocalYmd,
  getLocalTodayDateString,
  getYearBounds,
  isValidLocalYmd,
  parseLocalYmd,
} from "@/src/lib/date";

export const ESTIMATE_HELP =
  "If you don’t remember the exact date, provide estimated year and month. Check Day unknown if not sure about the day.";

const inputClassName =
  "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed";

function isMdUpViewport(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(min-width: 768px)").matches
  );
}

type PersonDateFieldProps = {
  value?: string | null;
  onChange: (next: string) => void;
  disabled?: boolean;
  id?: string;
  className?: string;
};

type Draft = {
  year: string;
  month: string; // "" | "1"…"12"
  day: string; // "" | "1"…"31" (may be "0" while typing on md+)
  dayUnknown: boolean;
};

function draftFromValue(value?: string | null): Draft {
  const parts = parseLocalYmd(value);
  if (!parts) {
    return { year: "", month: "", day: "", dayUnknown: false };
  }
  return {
    year: String(parts.year),
    month: String(parts.month),
    day: String(parts.day),
    dayUnknown: false,
  };
}

function clampDayDigits(digits: string, maxDay: number): string {
  if (!digits) return "";
  const n = Number(digits);
  if (!Number.isInteger(n) || n < 1) return "";
  return String(Math.min(n, maxDay));
}

export default function PersonDateField({
  value,
  onChange,
  disabled = false,
  id,
  className = "",
}: PersonDateFieldProps) {
  const todayYmd = getLocalTodayDateString();
  const { minYear, maxYear } = getYearBounds();

  const [draft, setDraft] = useState<Draft>(() => draftFromValue(value));
  const [error, setError] = useState<string | null>(null);

  const monthSelectRef = useRef<HTMLSelectElement>(null);
  const dayInputRef = useRef<HTMLInputElement>(null);
  /** Latest year digits for blur validation (avoids stale draft on auto-advance). */
  const yearDigitsRef = useRef(draft.year);

  // Sync from parent when value changes externally (e.g. load person / clear elsewhere).
  useEffect(() => {
    setDraft((prev) => {
      const committed = tryCommit(prev);
      const external = value || "";

      // Our own commit round-trip — keep dayUnknown / partial UI state.
      if (committed === external && external !== "") {
        return prev;
      }

      if (!external) {
        // Keep in-progress partial edits while parent is still empty.
        if (prev.year || prev.month || prev.day || prev.dayUnknown) {
          if (tryCommit(prev) === "") return prev;
        }
        yearDigitsRef.current = "";
        return draftFromValue(null);
      }

      // External load/update: do not infer dayUnknown from …-01 (Jan 1 can be real).
      const next = draftFromValue(external);
      yearDigitsRef.current = next.year;
      return next;
    });
  }, [value]);

  const yearNum = draft.year ? Number(draft.year) : NaN;
  const monthNum = draft.month ? Number(draft.month) : NaN;

  const maxDay =
    Number.isInteger(yearNum) &&
    Number.isInteger(monthNum) &&
    monthNum >= 1 &&
    monthNum <= 12
      ? daysInMonth(yearNum, monthNum)
      : 31;

  const dayOptions = useMemo(() => {
    const limit = Math.min(maxDay, 31);
    return Array.from({ length: limit }, (_, i) => i + 1);
  }, [maxDay]);

  const hasAnySelection = Boolean(
    draft.year || draft.month || draft.day || draft.dayUnknown || value,
  );

  const applyDraft = useCallback(
    (next: Draft) => {
      let normalized = { ...next };
      if (normalized.dayUnknown) {
        normalized.day = "1";
      } else if (normalized.year && normalized.month && normalized.day) {
        const y = Number(normalized.year);
        const m = Number(normalized.month);
        const d = Number(normalized.day);
        if (
          Number.isInteger(y) &&
          Number.isInteger(m) &&
          m >= 1 &&
          m <= 12 &&
          Number.isInteger(d) &&
          d >= 1
        ) {
          const max = daysInMonth(y, m);
          if (d > max) normalized = { ...normalized, day: String(max) };
        }
      }

      setDraft(normalized);

      const yearDigits = normalized.year;
      const yearComplete = yearDigits.length === 4;
      const yearOk =
        !yearDigits ||
        !yearComplete ||
        (Number.isInteger(Number(yearDigits)) &&
          Number(yearDigits) >= minYear &&
          Number(yearDigits) <= maxYear);

      if (!yearOk) {
        setError(`Year must be between ${minYear} and ${maxYear}.`);
        if (value) onChange("");
        return;
      }

      // Still typing the year — keep parent value until year is complete.
      if (yearDigits && !yearComplete) {
        setError(null);
        return;
      }

      const committed = tryCommit(normalized);

      if (
        yearComplete &&
        normalized.month &&
        (normalized.dayUnknown || normalized.day) &&
        committed
      ) {
        if (committed > todayYmd) {
          setError("Date cannot be in the future.");
          return;
        }
        setError(null);
        if (committed !== (value || "")) onChange(committed);
        return;
      }

      setError(null);
      if (value) onChange("");
    },
    [maxYear, minYear, onChange, todayYmd, value],
  );

  const handleYearChange = (raw: string) => {
    const digits = raw.replace(/\D/g, "").slice(0, 4);
    yearDigitsRef.current = digits;
    applyDraft({ ...draft, year: digits });
    if (digits.length === 4 && isMdUpViewport()) {
      requestAnimationFrame(() => monthSelectRef.current?.focus());
    }
  };

  const handleYearBlur = () => {
    const yearDigits = yearDigitsRef.current;
    // Incomplete year (e.g. auto-advance blur while draft still shows 3 digits).
    if (!yearDigits || yearDigits.length < 4) return;
    const y = Number(yearDigits);
    if (!Number.isInteger(y) || y < minYear || y > maxYear) {
      setError(`Year must be between ${minYear} and ${maxYear}.`);
    }
  };

  const handleMonthChange = (month: string) => {
    applyDraft({ ...draft, month });
    if (month && isMdUpViewport() && !draft.dayUnknown) {
      requestAnimationFrame(() => dayInputRef.current?.focus());
    }
  };

  const handleDayInputChange = (raw: string) => {
    const digits = raw.replace(/\D/g, "").slice(0, 2);
    if (digits === "") {
      applyDraft({ ...draft, day: "" });
      return;
    }
    if (digits.length === 1) {
      applyDraft({ ...draft, day: digits });
      return;
    }
    const clamped = clampDayDigits(digits, maxDay);
    applyDraft({ ...draft, day: clamped });
  };

  const handleDayInputBlur = () => {
    if (!draft.day || draft.dayUnknown) return;
    const clamped = clampDayDigits(draft.day, maxDay);
    if (clamped !== draft.day) {
      applyDraft({ ...draft, day: clamped });
    }
  };

  const handleClear = () => {
    yearDigitsRef.current = "";
    setDraft({ year: "", month: "", day: "", dayUnknown: false });
    setError(null);
    if (value) onChange("");
  };

  const yearId = id ? `${id}-year` : undefined;
  const monthSelectId = id ? `${id}-month` : undefined;
  const daySelectId = id ? `${id}-day` : undefined;
  const dayInputId = id ? `${id}-day-md` : undefined;

  return (
    <div className={className}>
      <div className="grid grid-cols-3 gap-2">
        <div>
          <label htmlFor={yearId} className="sr-only">
            Year
          </label>
          <input
            id={yearId}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            placeholder="Year"
            value={draft.year}
            onChange={(e) => handleYearChange(e.target.value)}
            onBlur={handleYearBlur}
            disabled={disabled}
            maxLength={4}
            className={inputClassName}
            aria-invalid={Boolean(error)}
          />
        </div>

        <div>
          <label htmlFor={monthSelectId} className="sr-only">
            Month
          </label>
          <select
            ref={monthSelectRef}
            id={monthSelectId}
            value={draft.month}
            onChange={(e) => handleMonthChange(e.target.value)}
            disabled={disabled}
            className={inputClassName}
          >
            <option value="" disabled hidden>Month</option>
            {MONTH_NAMES.map((name, index) => (
              <option key={name} value={String(index + 1)}>
                {name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor={daySelectId} className="sr-only">
            Day
          </label>
          <select
            id={daySelectId}
            value={draft.dayUnknown ? "1" : draft.day === "0" ? "" : draft.day}
            onChange={(e) => applyDraft({ ...draft, day: e.target.value })}
            disabled={disabled || draft.dayUnknown}
            className={`${inputClassName} md:hidden`}
          >
            <option value="" disabled hidden>Day</option>
            {dayOptions.map((d) => (
              <option key={d} value={String(d)}>
                {d}
              </option>
            ))}
          </select>
          <label htmlFor={dayInputId} className="sr-only">
            Day
          </label>
          <input
            ref={dayInputRef}
            id={dayInputId}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            placeholder="DD"
            value={draft.dayUnknown ? "1" : draft.day}
            onChange={(e) => handleDayInputChange(e.target.value)}
            onBlur={handleDayInputBlur}
            disabled={disabled || draft.dayUnknown}
            maxLength={2}
            className={`${inputClassName} hidden md:block`}
          />
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
        {!disabled && hasAnySelection && (
          <button
            type="button"
            onClick={handleClear}
            className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
          >
            <XMarkIcon className="h-4 w-4" aria-hidden />
            Clear
          </button>
        )}

        <label
          className={`inline-flex items-center gap-2 text-sm text-gray-700 ${
            disabled ? "opacity-60 cursor-not-allowed" : "cursor-pointer"
          }`}
        >
          <input
            type="checkbox"
            checked={draft.dayUnknown}
            onChange={(e) =>
              applyDraft({
                ...draft,
                dayUnknown: e.target.checked,
                day: e.target.checked ? "1" : draft.day || "1",
              })
            }
            disabled={disabled}
            className="rounded border-gray-300 text-primary focus:ring-ring"
          />
          Day unknown
        </label>
      </div>

      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

function tryCommit(draft: Draft): string {
  if (!draft.year || !draft.month) return "";
  const year = Number(draft.year);
  const month = Number(draft.month);
  if (!Number.isInteger(month) || month < 1 || month > 12) return "";
  const day = draft.dayUnknown ? 1 : Number(draft.day);
  if (!draft.dayUnknown && !draft.day) return "";
  if (!draft.dayUnknown && (!Number.isInteger(day) || day < 1)) return "";
  if (!isValidLocalYmd(year, month, day)) return "";
  return formatLocalYmd(year, month, day);
}
