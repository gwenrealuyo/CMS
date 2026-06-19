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
import { useIsMdUp } from "@/src/lib/listViewMode";
import {
  ANALYTICS_CHART_GRID_STROKE,
  ANALYTICS_CHART_HEIGHT_CLASS,
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
  const isMdUp = useIsMdUp();
  const chartData = funnel.filter((row) => row.count > 0 || funnel.length <= 6);
  const tickSize = isMdUp ? ANALYTICS_CHART_TICK_SIZE : 11;
  const tick = { fontSize: tickSize };
  const yAxisWidth = isMdUp ? 150 : 96;

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
              <XAxis type="number" allowDecimals={false} tick={tick} />
              <YAxis
                type="category"
                dataKey="label"
                width={yAxisWidth}
                tick={{ fontSize: tickSize }}
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
