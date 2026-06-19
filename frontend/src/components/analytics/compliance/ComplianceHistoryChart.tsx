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
  ANALYTICS_CHART_HEIGHT_COMPACT_CLASS,
  ANALYTICS_CHART_STROKE_WIDTH,
  ANALYTICS_CHART_TICK_SIZE,
  analyticsChartColor,
} from "@/src/lib/analyticsTheme";
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
  const tick = { fontSize: ANALYTICS_CHART_TICK_SIZE };

  return (
    <Card title="Compliance Trend">
      {loading ? (
        <div className="py-12 text-center text-base text-muted-foreground">
          Loading trend...
        </div>
      ) : data.length === 0 ? (
        <div className="py-12 text-center text-base text-muted-foreground">
          No trend data for this period.
        </div>
      ) : (
        <div className={`${ANALYTICS_CHART_HEIGHT_COMPACT_CLASS} w-full`}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={data}
              margin={{ top: 8, right: 16, bottom: 8, left: -8 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke={ANALYTICS_CHART_GRID_STROKE}
              />
              <XAxis dataKey="period" tick={tick} />
              <YAxis domain={[0, 100]} tick={tick} unit="%" />
              <Tooltip
                formatter={(value: number) => [`${value}%`, "Compliance"]}
              />
              <Line
                type="monotone"
                dataKey="compliance_rate"
                stroke={analyticsChartColor(0)}
                strokeWidth={ANALYTICS_CHART_STROKE_WIDTH}
                dot={{ r: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}
