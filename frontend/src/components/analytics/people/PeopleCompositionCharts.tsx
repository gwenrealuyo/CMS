"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import Card from "@/src/components/ui/Card";
import type { PeopleBreakdownItem } from "@/src/types/reports";

const CHART_COLORS = [
  "#2563eb",
  "#10b981",
  "#f59e0b",
  "#8b5cf6",
  "#ec4899",
  "#06b6d4",
  "#64748b",
];

interface PeopleCompositionChartsProps {
  byRole: PeopleBreakdownItem[];
  byStatus: PeopleBreakdownItem[];
  loading?: boolean;
}

function toChartData(items: PeopleBreakdownItem[]) {
  return items
    .filter((item) => item.count > 0)
    .map((item) => ({
      name: item.label,
      value: item.count,
    }));
}

export default function PeopleCompositionCharts({
  byRole,
  byStatus,
  loading = false,
}: PeopleCompositionChartsProps) {
  const roleData = toChartData(byRole);
  const statusData = toChartData(byStatus);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <Card title="By Role">
        {loading ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            Loading...
          </div>
        ) : roleData.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            No role data available.
          </div>
        ) : (
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={roleData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) =>
                    `${name}: ${(percent * 100).toFixed(0)}%`
                  }
                  outerRadius={90}
                  dataKey="value"
                >
                  {roleData.map((_, index) => (
                    <Cell
                      key={`role-${index}`}
                      fill={CHART_COLORS[index % CHART_COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      <Card title="By Status">
        {loading ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            Loading...
          </div>
        ) : statusData.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            No status data available.
          </div>
        ) : (
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={statusData}
                margin={{ top: 8, right: 16, bottom: 8, left: -8 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11 }}
                  interval={0}
                  angle={-20}
                  textAnchor="end"
                  height={60}
                />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="value" name="Count" fill="#2563eb" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>
    </div>
  );
}
