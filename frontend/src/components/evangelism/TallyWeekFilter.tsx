"use client";

import { useMemo } from "react";
import ScalableSelect from "@/src/components/ui/ScalableSelect";
import {
  getIsoWeekDateRange,
  getIsoWeekParts,
  isoWeeksOverlappingMonth,
} from "@/src/lib/isoWeek";

export const TALLY_ALL_WEEKS = "all";

function formatWeekDateRange(year: number, weekNumber: number): string {
  const { start, end } = getIsoWeekDateRange(year, weekNumber);
  const startMonth = start.toLocaleDateString("en-US", { month: "short" });
  const startDay = start.getDate();
  const endMonth = end.toLocaleDateString("en-US", { month: "short" });
  const endDay = end.getDate();

  if (startMonth === endMonth) {
    return `${startMonth} ${startDay}-${endDay}`;
  }
  return `${startMonth} ${startDay}-${endMonth} ${endDay}`;
}

export function weeksOverlappingMonths(
  year: number,
  months: number[],
): number[] {
  const weeks = new Set<number>();
  for (const month of months) {
    for (const week of isoWeeksOverlappingMonth(year, month)) {
      weeks.add(week);
    }
  }
  return Array.from(weeks).sort((a, b) => a - b);
}

/** Drop week selections that no longer overlap the month window. */
export function pruneSelectedWeeks(
  selectedWeeks: string[],
  year: number,
  months: number[],
): string[] {
  if (selectedWeeks.includes(TALLY_ALL_WEEKS)) {
    return [TALLY_ALL_WEEKS];
  }
  const valid = new Set(
    weeksOverlappingMonths(year, months).map((week) => String(week)),
  );
  const next = selectedWeeks.filter((value) => valid.has(value));
  return next.length > 0 ? next : [TALLY_ALL_WEEKS];
}

/** Comma-separated week numbers, or undefined when “All Weeks” is selected. */
export function weeksQueryParam(selectedWeeks: string[]): string | undefined {
  if (selectedWeeks.includes(TALLY_ALL_WEEKS)) {
    return undefined;
  }
  const numbers = selectedWeeks
    .map((week) => Number(week))
    .filter((week) => Number.isInteger(week));
  if (numbers.length === 0) {
    return undefined;
  }
  return [...numbers].sort((a, b) => a - b).join(",");
}

interface TallyWeekFilterProps {
  year: number;
  months: number[];
  weeks: string[];
  onChange: (weeks: string[]) => void;
}

export default function TallyWeekFilter({
  year,
  months,
  weeks,
  onChange,
}: TallyWeekFilterProps) {
  const todayIso = useMemo(() => getIsoWeekParts(new Date()), []);

  const weekOptions = useMemo(
    () =>
      weeksOverlappingMonths(year, months).map((weekNum) => {
        const range = formatWeekDateRange(year, weekNum);
        const isCurrentWeek =
          year === todayIso.year && weekNum === todayIso.week;
        return {
          value: String(weekNum),
          label: isCurrentWeek
            ? `W${weekNum} (${range}) · current`
            : `W${weekNum} (${range})`,
        };
      }),
    [months, todayIso.week, todayIso.year, year],
  );

  const handleWeeksChange = (values: string[]) => {
    const hadAll = weeks.includes(TALLY_ALL_WEEKS);
    const hasAll = values.includes(TALLY_ALL_WEEKS);
    if (hasAll && !hadAll) {
      onChange([TALLY_ALL_WEEKS]);
      return;
    }
    if (hadAll && hasAll) {
      onChange(values.filter((value) => value !== TALLY_ALL_WEEKS));
      return;
    }
    onChange(values.length > 0 ? values : [TALLY_ALL_WEEKS]);
  };

  return (
    <ScalableSelect
      multiple
      options={weekOptions}
      values={weeks}
      onValuesChange={handleWeeksChange}
      pinnedOption={{ value: TALLY_ALL_WEEKS, label: "All Weeks" }}
      scrollToValue={
        weekOptions.some((option) => option.value === String(todayIso.week))
          ? String(todayIso.week)
          : weeks[weeks.length - 1]
      }
      placeholder="Weeks"
      searchPlaceholder="Search weeks..."
      className="w-full"
      showSearch
      maxHeight={280}
      emptyMessage="No weeks found"
    />
  );
}
