"use client";

import Card from "@/src/components/ui/Card";
import type { StewardshipOfferingWeeklyRow } from "@/src/types/reports";

interface OfferingWeeklyPanelProps {
  offerings: StewardshipOfferingWeeklyRow[];
  loading?: boolean;
}

export default function OfferingWeeklyPanel({
  offerings,
  loading = false,
}: OfferingWeeklyPanelProps) {
  return (
    <Card title="Weekly Offerings">
      {loading ? (
        <div className="py-8 text-center text-sm text-muted-foreground">
          Loading offerings...
        </div>
      ) : offerings.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No offerings recorded for the selected year.
        </p>
      ) : (
        <div className="space-y-3">
          {offerings.map((entry, index) => (
            <div
              key={entry.week_start ?? `week-${index}`}
              className="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-3"
            >
              <div>
                <p className="text-sm font-semibold text-foreground">
                  Week of{" "}
                  {entry.week_start
                    ? new Date(entry.week_start).toLocaleDateString()
                    : "Unknown"}
                </p>
                <p className="text-xs text-muted-foreground">
                  Church-wide offering total
                </p>
              </div>
              <span className="text-lg font-bold text-primary">
                ₱
                {entry.total_amount.toLocaleString(undefined, {
                  maximumFractionDigits: 2,
                })}
              </span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
