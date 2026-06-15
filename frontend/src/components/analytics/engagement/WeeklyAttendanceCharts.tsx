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

  return (
    <Card title={title}>
      {loading ? (
        <div className="py-12 text-center text-sm text-muted-foreground">
          Loading...
        </div>
      ) : chartData.length === 0 ? (
        <div className="py-12 text-center text-sm text-muted-foreground">
          No attendance data for this period.
        </div>
      ) : (
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 8, right: 16, bottom: 8, left: -8 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="period" tick={{ fontSize: 12 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Legend />
              <Bar
                dataKey="members"
                name="Members"
                fill="#2563eb"
                radius={[4, 4, 0, 0]}
              />
              <Bar
                dataKey="visitors"
                name="Visitors"
                fill="#10b981"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}
