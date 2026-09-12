"use client";

import { RecurrencePattern } from "@/src/types/event";
import { recurrenceChipLabel } from "@/src/lib/events/recurrenceLabel";

type EventRecurringChipProps = {
  pattern?: RecurrencePattern | null;
  size?: "sm" | "md";
};

export default function EventRecurringChip({
  pattern,
  size = "md",
}: EventRecurringChipProps) {
  const label = recurrenceChipLabel(pattern);
  const chipClass = size === "sm" ? "chip-primary-sm gap-1" : "chip-primary gap-1.5";
  const iconClass = size === "sm" ? "w-2.5 h-2.5" : "w-3.5 h-3.5";

  return (
    <span className={chipClass} title={`Repeats ${label}`}>
      <svg
        className={iconClass}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99"
        />
      </svg>
      {label}
    </span>
  );
}
