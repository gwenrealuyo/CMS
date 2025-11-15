import Card from "@/src/components/ui/Card";
import type { DonationStats } from "@/src/types/finance";

interface DonationStatsProps {
  stats: DonationStats;
  currencySymbol?: string;
}

const formatAmount = (amount: number, currencySymbol: string = "₱") =>
  `${currencySymbol}${amount.toLocaleString(undefined, {
    maximumFractionDigits: 2,
  })}`;

export default function DonationStats({
  stats,
  currencySymbol = "₱",
}: DonationStatsProps) {
  const breakdownEntries = Object.entries(stats.purposeBreakdown ?? {});
  const sortedBreakdown = [...breakdownEntries].sort(
    (first, second) => second[1] - first[1]
  );
  const totalAmount = breakdownEntries.reduce(
    (sum, [, amount]) => sum + amount,
    0
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <SnapshotTile
          label="Total Giving"
          value={formatAmount(stats.totalAmount, currencySymbol)}
          description="Across all logged contributions"
          badgeClass="bg-blue-100 text-blue-700"
        />
        <SnapshotTile
          label="Average Per Entry"
          value={formatAmount(stats.averageDonation, currencySymbol)}
          description="Typical donation amount"
          badgeClass="bg-sky-100 text-sky-700"
        />
        <SnapshotTile
          label="Entries Recorded"
          value={new Intl.NumberFormat().format(stats.donationCount ?? 0)}
          description="Individual donation logs"
          badgeClass="bg-indigo-100 text-indigo-700"
        />
      </div>

      <Card>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-[#2D3748]">Purpose Mix</p>
            <span className="text-xs uppercase tracking-wide text-gray-500">
              {sortedBreakdown.length === 0
                ? "No data"
                : `${sortedBreakdown.length} categories`}
            </span>
          </div>

          {sortedBreakdown.length === 0 ? (
            <p className="text-sm text-gray-500">
              No giving logged yet. Record a donation to see purpose trends.
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
                      <span className="font-medium text-[#2D3748]">
                        {purpose}
                      </span>
                      <span className="text-gray-500">
                        {formatAmount(amount, currencySymbol)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="h-2 flex-1 rounded-full bg-blue-50">
                        <div
                          className="h-2 rounded-full bg-[#2563EB]"
                          style={{ width: `${Math.max(6, percentage)}%` }}
                        />
                      </div>
                      <span className="w-10 text-right text-xs font-semibold text-[#2563EB]">
                        {percentage}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

interface SnapshotTileProps {
  label: string;
  value: string | number;
  description: string;
  badgeClass: string;
}

function SnapshotTile({
  label,
  value,
  description,
  badgeClass,
}: SnapshotTileProps) {
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-4">
      <span
        className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${badgeClass}`}
      >
        {label}
      </span>
      <p className="mt-3 text-2xl font-bold text-[#1F2937]">{value}</p>
      <p className="mt-2 text-xs text-gray-500">{description}</p>
    </div>
  );
}
