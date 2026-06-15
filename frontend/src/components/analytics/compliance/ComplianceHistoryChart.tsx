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
import type { ComplianceHistory } from "@/src/types/cluster";

interface ComplianceHistoryChartProps {
  history: ComplianceHistory | null;
  loading?: boolean;
}

export default function ComplianceHistoryChart({
  history,
  loading = false,
}: ComplianceHistoryChartProps) {
  const data = history?.data ?? [];

  return (
    <Card title="Compliance Trend">
      {loading ? (
        <div className="py-12 text-center text-sm text-muted-foreground">
          Loading trend...
        </div>
      ) : data.length === 0 ? (
        <div className="py-12 text-center text-sm text-muted-foreground">
          No trend data for this period.
        </div>
      ) : (
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={data}
              margin={{ top: 8, right: 16, bottom: 8, left: -8 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="period" tick={{ fontSize: 12 }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} unit="%" />
              <Tooltip
                formatter={(value: number) => [`${value}%`, "Compliance"]}
              />
              <Line
                type="monotone"
                dataKey="compliance_rate"
                stroke="#2563eb"
                strokeWidth={2}
                dot={{ r: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}
