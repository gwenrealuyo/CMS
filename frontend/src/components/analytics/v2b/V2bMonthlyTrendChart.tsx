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
  ANALYTICS_CHART_COLORS,
  ANALYTICS_CHART_GRID_STROKE,
  ANALYTICS_CHART_STROKE_WIDTH,
  ANALYTICS_CHART_TICK_SIZE,
  analyticsChartColor,
} from "@/src/lib/analyticsTheme";
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
    taken_ncc: row.taken_ncc_count,
    baptized: row.baptized_count,
    received_hg: row.received_hg_count,
    converted: row.converted_count,
  }));

  const hasData = chartData.some(
    (row) =>
      row.invited > 0 ||
      row.attended > 0 ||
      row.taken_ncc > 0 ||
      row.baptized > 0 ||
      row.received_hg > 0 ||
      row.converted > 0,
  );

  const tick = { fontSize: ANALYTICS_CHART_TICK_SIZE };
  const dot = { r: 3 };

  return (
    <Card title="Monthly Pipeline Trend">
      {loading ? (
        <div className="py-12 text-center text-base text-muted-foreground">
          Loading monthly trend...
        </div>
      ) : !hasData ? (
        <div className="py-12 text-center text-base text-muted-foreground">
          No monthly tracking data for the selected year.
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
              <YAxis allowDecimals={false} tick={tick} />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="invited"
                name="Invited"
                stroke={analyticsChartColor(3)}
                strokeWidth={ANALYTICS_CHART_STROKE_WIDTH}
                dot={dot}
              />
              <Line
                type="monotone"
                dataKey="attended"
                name="Attended"
                stroke={analyticsChartColor(0)}
                strokeWidth={ANALYTICS_CHART_STROKE_WIDTH}
                dot={dot}
              />
              <Line
                type="monotone"
                dataKey="taken_ncc"
                name="Taken NCC"
                stroke={analyticsChartColor(5)}
                strokeWidth={ANALYTICS_CHART_STROKE_WIDTH}
                dot={dot}
              />
              <Line
                type="monotone"
                dataKey="baptized"
                name="Baptized"
                stroke={ANALYTICS_CHART_COLORS[4]}
                strokeWidth={ANALYTICS_CHART_STROKE_WIDTH}
                dot={dot}
              />
              <Line
                type="monotone"
                dataKey="received_hg"
                name="Received HG"
                stroke={analyticsChartColor(1)}
                strokeWidth={ANALYTICS_CHART_STROKE_WIDTH}
                dot={dot}
              />
              <Line
                type="monotone"
                dataKey="converted"
                name="Converted"
                stroke={analyticsChartColor(2)}
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
