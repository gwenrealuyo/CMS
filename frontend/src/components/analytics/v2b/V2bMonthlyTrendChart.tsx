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
import type { V2bMonthlyTrendPoint } from "@/src/types/reports";

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

interface V2bMonthlyTrendChartProps {
  trend: V2bMonthlyTrendPoint[];
  loading?: boolean;
}

export default function V2bMonthlyTrendChart({
  trend,
  loading = false,
}: V2bMonthlyTrendChartProps) {
  const chartData = trend.map((row) => ({
    period: MONTH_LABELS[row.month - 1] ?? `M${row.month}`,
    invited: row.invited_count,
    attended: row.attended_count,
    baptized: row.baptized_count,
    received_hg: row.received_hg_count,
    converted: row.converted_count,
  }));

  const hasData = chartData.some(
    (row) =>
      row.invited > 0 ||
      row.attended > 0 ||
      row.baptized > 0 ||
      row.received_hg > 0 ||
      row.converted > 0,
  );

  return (
    <Card title="Monthly Pipeline Trend">
      {loading ? (
        <div className="py-12 text-center text-sm text-muted-foreground">
          Loading monthly trend...
        </div>
      ) : !hasData ? (
        <div className="py-12 text-center text-sm text-muted-foreground">
          No monthly tracking data for the selected year.
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
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="invited"
                name="Invited"
                stroke="#64748b"
                strokeWidth={2}
                dot={{ r: 2 }}
              />
              <Line
                type="monotone"
                dataKey="attended"
                name="Attended"
                stroke="#2563eb"
                strokeWidth={2}
                dot={{ r: 2 }}
              />
              <Line
                type="monotone"
                dataKey="baptized"
                name="Baptized"
                stroke="#8b5cf6"
                strokeWidth={2}
                dot={{ r: 2 }}
              />
              <Line
                type="monotone"
                dataKey="received_hg"
                name="Received HG"
                stroke="#f59e0b"
                strokeWidth={2}
                dot={{ r: 2 }}
              />
              <Line
                type="monotone"
                dataKey="converted"
                name="Converted"
                stroke="#10b981"
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
