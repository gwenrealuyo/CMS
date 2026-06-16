"use client";

import Card from "@/src/components/ui/Card";
import type { StewardshipPledgeRow } from "@/src/types/reports";

interface PledgeFulfillmentTableProps {
  pledges: StewardshipPledgeRow[];
}

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "bg-blue-100 text-blue-800",
  FULFILLED: "bg-green-100 text-green-700",
  CANCELLED: "bg-gray-200 text-gray-600",
};

const formatAmount = (amount: number) =>
  `₱${amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

export default function PledgeFulfillmentTable({
  pledges,
}: PledgeFulfillmentTableProps) {
  return (
    <Card title="Pledge Fulfillment">
      {pledges.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No active or fulfilled pledges for the selected scope.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-2">Pledge</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2 text-right">Committed</th>
                <th className="px-3 py-2 text-right">Received</th>
                <th className="px-3 py-2 text-right">Balance</th>
                <th className="px-3 py-2 text-right">Progress</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {pledges.map((pledge) => (
                <tr key={pledge.id}>
                  <td className="px-3 py-3 font-medium text-foreground">
                    {pledge.pledge_title}
                  </td>
                  <td className="px-3 py-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        STATUS_COLORS[pledge.status] ?? "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {pledge.status}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-right">
                    {formatAmount(pledge.pledge_amount)}
                  </td>
                  <td className="px-3 py-3 text-right">
                    {formatAmount(pledge.amount_received)}
                  </td>
                  <td className="px-3 py-3 text-right">
                    {formatAmount(pledge.balance)}
                  </td>
                  <td className="px-3 py-3 text-right">
                    {Math.round(pledge.progress_percent)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
