import Card from "@/src/components/ui/Card";

type DateRangePeriod =
  | "thisWeek"
  | "thisMonth"
  | "thisYear"
  | "last7Days"
  | "last30Days"
  | "lastQuarter"
  | "last6Months"
  | "previousMonth"
  | "previousYear"
  | "customRange";

interface FinanceOverviewStatsProps {
  donationStats: {
    totalAmount: number;
    donationCount: number;
    averageDonation: number;
  };
  offeringStats: {
    totalAmount: number;
    offeringCount: number;
    averageOffering: number;
  };
  pledgeStats: {
    totalPledged: number;
    totalReceived: number;
    outstandingBalance: number;
  };
  currencySymbol?: string;
  dateRangePeriod: DateRangePeriod;
  onDateRangeChange: (period: DateRangePeriod) => void;
  customStartDate?: string;
  customEndDate?: string;
  onCustomStartDateChange?: (date: string) => void;
  onCustomEndDateChange?: (date: string) => void;
}

const formatAmount = (amount: number, currencySymbol: string = "₱") =>
  `${currencySymbol}${amount.toLocaleString(undefined, {
    maximumFractionDigits: 2,
  })}`;

export default function FinanceOverviewStats({
  donationStats,
  offeringStats,
  pledgeStats,
  currencySymbol = "₱",
  dateRangePeriod,
  onDateRangeChange,
  customStartDate = "",
  customEndDate = "",
  onCustomStartDateChange,
  onCustomEndDateChange,
}: FinanceOverviewStatsProps) {
  // Calculate unified metrics
  const totalCollected =
    donationStats.totalAmount +
    offeringStats.totalAmount +
    pledgeStats.totalReceived;

  const totalActivity =
    donationStats.donationCount +
    offeringStats.offeringCount +
    (pledgeStats.totalPledged > 0 ? 1 : 0); // Count pledges as 1 if any exist

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <select
          value={dateRangePeriod}
          onChange={(e) => {
            const newPeriod = e.target.value as DateRangePeriod;
            onDateRangeChange(newPeriod);
            // Reset custom dates when switching away from custom range
            if (
              newPeriod !== "customRange" &&
              onCustomStartDateChange &&
              onCustomEndDateChange
            ) {
              onCustomStartDateChange("");
              onCustomEndDateChange("");
            }
          }}
          className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 md:py-2 text-sm font-medium text-gray-700 shadow-sm focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:ring-offset-1 w-full sm:w-auto min-w-[180px] min-h-[44px] md:min-h-0"
        >
          <option value="thisWeek">This Week</option>
          <option value="thisMonth">This Month</option>
          <option value="thisYear">This Year</option>
          <option value="last7Days">Last 7 Days</option>
          <option value="last30Days">Last 30 Days</option>
          <option value="lastQuarter">Last Quarter</option>
          <option value="last6Months">Last 6 Months</option>
          <option value="previousMonth">Previous Month</option>
          <option value="previousYear">Previous Year</option>
          <option value="customRange">Custom Range</option>
        </select>

        {dateRangePeriod === "customRange" && (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-gray-600 whitespace-nowrap">
                From:
              </label>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => onCustomStartDateChange?.(e.target.value)}
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:ring-offset-1 min-h-[44px] md:min-h-0"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-gray-600 whitespace-nowrap">
                To:
              </label>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => onCustomEndDateChange?.(e.target.value)}
                min={customStartDate}
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:ring-offset-1 min-h-[44px] md:min-h-0"
              />
            </div>
          </div>
        )}
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SnapshotTile
          label="Total Collected"
          value={formatAmount(totalCollected, currencySymbol)}
          description="All funds received (donations, offerings, pledge contributions)"
          badgeClass="bg-green-100 text-green-700"
        />
        <SnapshotTile
          label="Total Committed"
          value={formatAmount(pledgeStats.totalPledged, currencySymbol)}
          description="Total amount pledged across all campaigns"
          badgeClass="bg-blue-100 text-blue-700"
        />
        <SnapshotTile
          label="Outstanding Balance"
          value={formatAmount(pledgeStats.outstandingBalance, currencySymbol)}
          description="Remaining balance to fulfill pledges"
          badgeClass="bg-amber-100 text-amber-700"
        />
        <SnapshotTile
          label="Total Activity"
          value={new Intl.NumberFormat().format(totalActivity)}
          description="Total transactions recorded"
          badgeClass="bg-indigo-100 text-indigo-700"
        />
      </div>
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
    <Card>
      <span
        className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${badgeClass}`}
      >
        {label}
      </span>
      <p className="mt-3 text-2xl font-bold text-[#1F2937]">{value}</p>
      <p className="mt-2 text-xs text-gray-500">{description}</p>
    </Card>
  );
}
