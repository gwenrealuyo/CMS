"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import Card from "@/src/components/ui/Card";
import {
  ANALYTICS_CHART_GRID_STROKE,
  ANALYTICS_CHART_TICK_SIZE,
  analyticsChartColor,
} from "@/src/lib/analyticsTheme";
import type { EngagementMonthlyTrendPoint } from "@/src/types/reports";

interface WeeklyAttendanceChartsProps {
  title: string;
  data: EngagementMonthlyTrendPoint[];
  loading?: boolean;
}

export default function WeeklyAttendanceCharts({
  title,
  data,
  loading = false,
}: WeeklyAttendanceChartsProps) {
  const chartData = data.filter(
    (row) => row.members > 0 || row.visitors > 0,
  );
  const tick = { fontSize: ANALYTICS_CHART_TICK_SIZE };

  return (
    <Card title={title}>
      {loading ? (
        <div className="py-12 text-center text-base text-muted-foreground">
          Loading...
        </div>
      ) : chartData.length === 0 ? (
        <div className="py-12 text-center text-base text-muted-foreground">
          No attendance data for this period.
        </div>
      ) : (
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
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
              <Bar
                dataKey="members"
                name="Members"
                fill={analyticsChartColor(0)}
                radius={[4, 4, 0, 0]}
              />
              <Bar
                dataKey="visitors"
                name="Visitors"
                fill={analyticsChartColor(2)}
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}
