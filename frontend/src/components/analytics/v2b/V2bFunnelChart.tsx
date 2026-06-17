"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
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
import type { V2bFunnelStage } from "@/src/types/reports";

interface V2bFunnelChartProps {
  funnel: V2bFunnelStage[];
  loading?: boolean;
}

export default function V2bFunnelChart({
  funnel,
  loading = false,
}: V2bFunnelChartProps) {
  const chartData = funnel.filter((row) => row.count > 0 || funnel.length <= 6);
  const tick = { fontSize: ANALYTICS_CHART_TICK_SIZE };

  return (
    <Card title="Conversion Funnel">
      {loading ? (
        <div className="py-12 text-center text-base text-muted-foreground">
          Loading funnel...
        </div>
      ) : chartData.length === 0 ? (
        <div className="py-12 text-center text-base text-muted-foreground">
          No active prospects in the selected scope.
        </div>
      ) : (
        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              layout="vertical"
              data={chartData}
              margin={{ top: 8, right: 24, bottom: 8, left: 8 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke={ANALYTICS_CHART_GRID_STROKE}
              />
              <XAxis type="number" allowDecimals={false} tick={tick} />
              <YAxis
                type="category"
                dataKey="label"
                width={150}
                tick={{ fontSize: ANALYTICS_CHART_TICK_SIZE }}
              />
              <Tooltip
                formatter={(value: number, _name, props) => {
                  const rate = props.payload?.rate_from_previous;
                  const rateLabel =
                    rate != null ? ` (${rate.toFixed(1)}% from previous)` : "";
                  return [`${value}${rateLabel}`, "Count"];
                }}
              />
              <Bar dataKey="count" name="Prospects" radius={[0, 4, 4, 0]}>
                {chartData.map((_, index) => (
                  <Cell
                    key={`funnel-${index}`}
                    fill={analyticsChartColor(index)}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}
