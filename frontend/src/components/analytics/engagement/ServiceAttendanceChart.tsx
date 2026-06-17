"use client";

import {
  CartesianGrid,
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
import type { EngagementServiceSection } from "@/src/types/reports";

interface ServiceAttendanceChartProps {
  service: EngagementServiceSection | null;
  loading?: boolean;
}

export default function ServiceAttendanceChart({
  service,
  loading = false,
}: ServiceAttendanceChartProps) {
  const trendData = service?.monthly_trend ?? [];
  const hasTrend = trendData.some((row) => row.headcount > 0);
  const occurrences = service?.occurrences ?? [];

  const tick = { fontSize: ANALYTICS_CHART_TICK_SIZE };

  return (
    <div className="space-y-6">
      <Card title="Sunday Service Attendance Trend">
        {loading ? (
          <div className="py-12 text-center text-base text-muted-foreground">
            Loading Sunday Service trends...
          </div>
        ) : !hasTrend ? (
          <div className="py-12 text-center text-base text-muted-foreground">
            No Sunday Service attendance in the selected period.
          </div>
        ) : (
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={trendData}
                margin={{ top: 8, right: 16, bottom: 8, left: -8 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke={ANALYTICS_CHART_GRID_STROKE}
                />
                <XAxis dataKey="period" tick={tick} />
                <YAxis allowDecimals={false} tick={tick} />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="headcount"
                  name="Attendees"
                  stroke={analyticsChartColor(0)}
                  strokeWidth={ANALYTICS_CHART_STROKE_WIDTH}
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      {occurrences.length > 0 && (
        <Card title="Recent Sunday Service Occurrences">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Service
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Headcount
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {occurrences.map((row) => (
                  <tr key={`${row.event_id}-${row.occurrence_date}`}>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
                      {new Date(row.occurrence_date).toLocaleDateString()}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
                      {row.event_title}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
                      {row.headcount}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
