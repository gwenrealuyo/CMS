import Card from "@/src/components/ui/Card";
import LoadingSpinner from "@/src/components/ui/LoadingSpinner";
import { OfferingWeeklySummary } from "@/src/types/finance";

interface OfferingSummaryCardProps {
  summary: OfferingWeeklySummary[];
  loading?: boolean;
}

export default function OfferingSummaryCard({
  summary,
  loading,
}: OfferingSummaryCardProps) {
  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-[#2D3748]">
            Weekly Offerings
          </h3>
          <p className="text-xs text-gray-500">
            Automatic roll-up of recorded offerings per service week.
          </p>
        </div>
      </div>
      {loading ? (
        <div className="flex justify-center py-8">
          <LoadingSpinner />
        </div>
      ) : summary.length === 0 ? (
        <p className="text-sm text-gray-500">
          No offerings recorded yet. Start logging Sunday offerings to see weekly
          totals here.
        </p>
      ) : (
        <div className="space-y-3">
          {summary.map((entry) => (
            <div
              key={entry.weekStart ?? Math.random().toString()}
              className="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-3"
            >
              <div>
                <p className="text-sm font-semibold text-[#2D3748]">
                  Week of{" "}
                  {entry.weekStart
                    ? new Date(entry.weekStart).toLocaleDateString()
                    : "Unknown"}
                </p>
                <p className="text-xs text-gray-500">
                  Derived from all recorded services
                </p>
              </div>
              <span className="text-lg font-bold text-[#2563EB]">
                ₱{entry.totalAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

