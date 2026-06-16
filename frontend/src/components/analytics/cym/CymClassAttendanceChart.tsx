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
import type { CymClassRow } from "@/src/types/reports";

interface CymClassAttendanceChartProps {
  rows: CymClassRow[];
  loading?: boolean;
}

export default function CymClassAttendanceChart({
  rows,
  loading = false,
}: CymClassAttendanceChartProps) {
  const chartData = rows
    .filter((row) => row.attendance_rate != null)
    .map((row) => ({
      name: row.class_name,
      rate: row.attendance_rate ?? 0,
      students: row.student_count,
    }));

  return (
    <Card title="Class Attendance Rates">
      {loading ? (
        <div className="py-12 text-center text-sm text-muted-foreground">
          Loading class attendance...
        </div>
      ) : chartData.length === 0 ? (
        <div className="py-12 text-center text-sm text-muted-foreground">
          No attendance data for the selected scope.
        </div>
      ) : (
        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              layout="vertical"
              data={chartData}
              margin={{ top: 8, right: 24, bottom: 8, left: 8 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                type="number"
                domain={[0, 100]}
                tick={{ fontSize: 12 }}
                unit="%"
              />
              <YAxis
                type="category"
                dataKey="name"
                width={140}
                tick={{ fontSize: 11 }}
              />
              <Tooltip
                formatter={(value: number) => [`${value.toFixed(1)}%`, "Rate"]}
                labelFormatter={(label) => label}
              />
              <Bar
                dataKey="rate"
                name="Attendance rate"
                fill="#2563eb"
                radius={[0, 4, 4, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}
