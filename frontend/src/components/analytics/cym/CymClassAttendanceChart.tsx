"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import Card from "@/src/components/ui/Card";
import { useIsMdUp } from "@/src/lib/listViewMode";
import {
  ANALYTICS_CHART_GRID_STROKE,
  ANALYTICS_CHART_HEIGHT_CLASS,
  ANALYTICS_CHART_TICK_SIZE,
  analyticsChartColor,
} from "@/src/lib/analyticsTheme";
import type { CymClassRow } from "@/src/types/reports";

interface CymClassAttendanceChartProps {
  rows: CymClassRow[];
  loading?: boolean;
}

export default function CymClassAttendanceChart({
  rows,
  loading = false,
}: CymClassAttendanceChartProps) {
  const isMdUp = useIsMdUp();
  const chartData = rows
    .filter((row) => row.attendance_rate != null)
    .map((row) => ({
      name: row.class_name,
      rate: row.attendance_rate ?? 0,
      students: row.student_count,
    }));

  const tick = { fontSize: isMdUp ? ANALYTICS_CHART_TICK_SIZE : 11 };
  const yAxisWidth = isMdUp ? 140 : 96;

  return (
    <Card title="Class Attendance Rates">
      {loading ? (
        <div className="py-12 text-center text-base text-muted-foreground">
          Loading class attendance...
        </div>
      ) : chartData.length === 0 ? (
        <div className="py-12 text-center text-base text-muted-foreground">
          No attendance data for the selected scope.
        </div>
      ) : (
        <div className={`${ANALYTICS_CHART_HEIGHT_CLASS} w-full`}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              layout="vertical"
              data={chartData}
              margin={{
                top: 8,
                right: 16,
                bottom: 8,
                left: isMdUp ? 8 : 4,
              }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke={ANALYTICS_CHART_GRID_STROKE}
              />
              <XAxis
                type="number"
                domain={[0, 100]}
                tick={tick}
                unit="%"
              />
              <YAxis
                type="category"
                dataKey="name"
                width={yAxisWidth}
                tick={tick}
              />
              <Tooltip
                formatter={(value: number) => [`${value.toFixed(1)}%`, "Rate"]}
                labelFormatter={(label) => label}
              />
              <Bar
                dataKey="rate"
                name="Attendance rate"
                fill={analyticsChartColor(0)}
                radius={[0, 4, 4, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}
