"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import Card from "@/src/components/ui/Card";
import type { StewardshipMonthlyTrendPoint } from "@/src/types/reports";

const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

interface StewardshipMonthlyTrendChartProps {
  trend: StewardshipMonthlyTrendPoint[];
  includesOfferings: boolean;
  loading?: boolean;
}

export default function StewardshipMonthlyTrendChart({
  trend,
  includesOfferings,
  loading = false,
}: StewardshipMonthlyTrendChartProps) {
  const chartData = trend.map((row) => ({
    period: MONTH_LABELS[row.month - 1] ?? `M${row.month}`,
    donations: row.donation_total,
    offerings: row.offering_total,
    pledge_payments: row.pledge_contribution_total,
  }));

  const hasData = chartData.some(
    (row) =>
      row.donations > 0 || row.offerings > 0 || row.pledge_payments > 0,
  );

  return (
    <Card title="Monthly Giving Trend">
      {loading ? (
        <div className="py-12 text-center text-sm text-muted-foreground">
          Loading monthly trend...
        </div>
      ) : !hasData ? (
        <div className="py-12 text-center text-sm text-muted-foreground">
          No giving data for the selected year.
        </div>
      ) : (
        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={chartData}
              margin={{ top: 8, right: 16, bottom: 8, left: -8 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="period" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip
                formatter={(value: number) =>
                  `₱${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
                }
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="donations"
                name="Donations"
                stroke="#2563eb"
                strokeWidth={2}
                dot={{ r: 2 }}
              />
              {includesOfferings && (
                <Line
                  type="monotone"
                  dataKey="offerings"
                  name="Offerings"
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={{ r: 2 }}
                />
              )}
              <Line
                type="monotone"
                dataKey="pledge_payments"
                name="Pledge Payments"
                stroke="#f59e0b"
                strokeWidth={2}
                dot={{ r: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}
