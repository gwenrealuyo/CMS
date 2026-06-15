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

  return (
    <div className="space-y-6">
      <Card title="Sunday Service Attendance Trend">
        {loading ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            Loading Sunday Service trends...
          </div>
        ) : !hasTrend ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            No Sunday Service attendance in the selected period.
          </div>
        ) : (
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={trendData}
                margin={{ top: 8, right: 16, bottom: 8, left: -8 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="period" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="headcount"
                  name="Attendees"
                  stroke="#2563eb"
                  strokeWidth={2}
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
