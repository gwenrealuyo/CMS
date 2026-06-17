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
import {
  ANALYTICS_CHART_GRID_STROKE,
  ANALYTICS_CHART_STROKE_WIDTH,
  ANALYTICS_CHART_TICK_SIZE,
  analyticsChartColor,
} from "@/src/lib/analyticsTheme";
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

  const tick = { fontSize: ANALYTICS_CHART_TICK_SIZE };
  const dot = { r: 3 };

  return (
    <Card title="Monthly Giving Trend">
      {loading ? (
        <div className="py-12 text-center text-base text-muted-foreground">
          Loading monthly trend...
        </div>
      ) : !hasData ? (
        <div className="py-12 text-center text-base text-muted-foreground">
          No giving data for the selected year.
        </div>
      ) : (
        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={chartData}
              margin={{ top: 8, right: 16, bottom: 8, left: -8 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke={ANALYTICS_CHART_GRID_STROKE}
              />
              <XAxis dataKey="period" tick={tick} />
              <YAxis tick={tick} />
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
                stroke={analyticsChartColor(0)}
                strokeWidth={ANALYTICS_CHART_STROKE_WIDTH}
                dot={dot}
              />
              {includesOfferings && (
                <Line
                  type="monotone"
                  dataKey="offerings"
                  name="Offerings"
                  stroke={analyticsChartColor(2)}
                  strokeWidth={ANALYTICS_CHART_STROKE_WIDTH}
                  dot={dot}
                />
              )}
              <Line
                type="monotone"
                dataKey="pledge_payments"
                name="Pledge Payments"
                stroke={analyticsChartColor(1)}
                strokeWidth={ANALYTICS_CHART_STROKE_WIDTH}
                dot={dot}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}
