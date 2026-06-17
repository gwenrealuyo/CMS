"use client";

import { useMemo } from "react";
import {
  CartesianGrid,
  Legend,
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
import type { PeopleBaptismTrend } from "@/src/types/reports";

interface BaptismTrendChartProps {
  trend: PeopleBaptismTrend | null;
  loading?: boolean;
}

export default function BaptismTrendChart({
  trend,
  loading = false,
}: BaptismTrendChartProps) {
  const chartData = useMemo(() => {
    if (!trend) return [];
    const waterByPeriod = new Map(
      trend.water.map((row) => [row.period, row.count]),
    );
    const spiritByPeriod = new Map(
      trend.spirit.map((row) => [row.period, row.count]),
    );
    const periods = trend.water.map((row) => row.period);
    return periods.map((period) => ({
      period,
      water: waterByPeriod.get(period) ?? 0,
      spirit: spiritByPeriod.get(period) ?? 0,
    }));
  }, [trend]);

  const hasData = chartData.some((row) => row.water > 0 || row.spirit > 0);
  const tick = { fontSize: ANALYTICS_CHART_TICK_SIZE };
  const dot = { r: 3 };

  return (
    <Card title="Baptism Trends">
      {loading ? (
        <div className="py-12 text-center text-base text-muted-foreground">
          Loading baptism trends...
        </div>
      ) : !hasData ? (
        <div className="py-12 text-center text-base text-muted-foreground">
          No baptism records in the selected period.
        </div>
      ) : (
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={chartData}
              margin={{ top: 8, right: 16, bottom: 8, left: -8 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke={ANALYTICS_CHART_GRID_STROKE}
              />
              <XAxis dataKey="period" tick={tick} />
              <YAxis allowDecimals={false} tick={tick} />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="water"
                name="Water Baptism"
                stroke={analyticsChartColor(0)}
                strokeWidth={ANALYTICS_CHART_STROKE_WIDTH}
                dot={dot}
              />
              <Line
                type="monotone"
                dataKey="spirit"
                name="Spirit Baptism"
                stroke={analyticsChartColor(2)}
                strokeWidth={ANALYTICS_CHART_STROKE_WIDTH}
                dot={dot}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}
