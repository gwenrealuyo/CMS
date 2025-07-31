import type { DonationStats } from "@/src/types/donation";
import Card from "@/src/components/ui/Card";

interface DonationStatsProps {
  stats: DonationStats;
}

export default function DonationStats({ stats }: DonationStatsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <Card>
        <div className="text-center">
          <h3 className="text-lg font-medium text-gray-900">Total Donations</h3>
          <p className="mt-2 text-3xl font-bold text-[#2563EB]">
            ${stats.totalAmount.toLocaleString()}
          </p>
        </div>
      </Card>

      <Card>
        <div className="text-center">
          <h3 className="text-lg font-medium text-gray-900">
            Number of Donations
          </h3>
          <p className="mt-2 text-3xl font-bold text-[#2563EB]">
            {stats.donationCount}
          </p>
        </div>
      </Card>

      <Card>
        <div className="text-center">
          <h3 className="text-lg font-medium text-gray-900">
            Average Donation
          </h3>
          <p className="mt-2 text-3xl font-bold text-[#2563EB]">
            ${stats.averageDonation.toLocaleString()}
          </p>
        </div>
      </Card>

      <Card>
        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            Purpose Breakdown
          </h3>
          {Object.entries(stats.purposeBreakdown).map(([purpose, amount]) => (
            <div
              key={purpose}
              className="flex justify-between items-center mb-2"
            >
              <span className="text-gray-600">{purpose}</span>
              <span className="font-medium">${amount.toLocaleString()}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
