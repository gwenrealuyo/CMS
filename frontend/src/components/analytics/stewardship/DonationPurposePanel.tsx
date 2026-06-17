"use client";

import Card from "@/src/components/ui/Card";
import type { StewardshipDonationStats } from "@/src/types/reports";

interface DonationPurposePanelProps {
  donations: StewardshipDonationStats | null;
}

const formatAmount = (amount: number) =>
  `₱${amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

export default function DonationPurposePanel({
  donations,
}: DonationPurposePanelProps) {
  const breakdownEntries = Object.entries(
    donations?.purpose_breakdown ?? {},
  );
  const sortedBreakdown = [...breakdownEntries].sort(
    (first, second) => second[1] - first[1],
  );
  const totalAmount = breakdownEntries.reduce(
    (sum, [, amount]) => sum + amount,
    0,
  );

  return (
    <Card title="Donation Purpose Mix">
      {sortedBreakdown.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No donations recorded for the selected period.
        </p>
      ) : (
        <div className="space-y-3">
          {sortedBreakdown.map(([purpose, amount]) => {
            const percentage =
              totalAmount > 0
                ? Math.round((amount / totalAmount) * 100)
                : 0;
            return (
              <div key={purpose} className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-foreground">{purpose}</span>
                  <span className="text-muted-foreground">
                    {formatAmount(amount)}
                  </span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-gray-100">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
