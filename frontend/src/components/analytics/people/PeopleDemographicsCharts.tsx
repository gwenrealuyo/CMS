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
import {
  ANALYTICS_CHART_GRID_STROKE,
  ANALYTICS_CHART_TICK_SIZE,
  analyticsChartColor,
} from "@/src/lib/analyticsTheme";
import type { PeopleBreakdownItem } from "@/src/types/reports";

interface PeopleDemographicsChartsProps {
  byGender: PeopleBreakdownItem[];
  byAgeBand: PeopleBreakdownItem[];
  byEntryChannel: PeopleBreakdownItem[];
  loading?: boolean;
}

function toBarData(items: PeopleBreakdownItem[]) {
  return items
    .filter((item) => item.count > 0)
    .map((item) => ({
      name: item.label,
      count: item.count,
    }));
}

function DemographicsBarChart({
  data,
  emptyMessage,
}: {
  data: { name: string; count: number }[];
  emptyMessage: string;
}) {
  const tick = { fontSize: ANALYTICS_CHART_TICK_SIZE };

  if (data.length === 0) {
    return (
      <div className="py-12 text-center text-base text-muted-foreground">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 8, right: 16, bottom: 8, left: -8 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke={ANALYTICS_CHART_GRID_STROKE}
          />
          <XAxis
            dataKey="name"
            tick={tick}
            interval={0}
            angle={data.length > 4 ? -25 : 0}
            textAnchor={data.length > 4 ? "end" : "middle"}
            height={data.length > 4 ? 70 : 40}
          />
          <YAxis allowDecimals={false} tick={tick} />
          <Tooltip />
          <Bar
            dataKey="count"
            name="Count"
            fill={analyticsChartColor(2)}
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function PeopleDemographicsCharts({
  byGender,
  byAgeBand,
  byEntryChannel,
  loading = false,
}: PeopleDemographicsChartsProps) {
  const genderData = toBarData(byGender);
  const ageData = toBarData(byAgeBand);
  const channelData = toBarData(byEntryChannel);

  if (loading) {
    return (
      <Card title="Demographics">
        <div className="py-12 text-center text-base text-muted-foreground">
          Loading demographics...
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card title="By Gender">
          <DemographicsBarChart
            data={genderData}
            emptyMessage="No gender data available."
          />
        </Card>
        <Card title="By Age Band">
          <DemographicsBarChart
            data={ageData}
            emptyMessage="No age band data available."
          />
        </Card>
      </div>
      <Card title="By Entry Channel">
        <DemographicsBarChart
          data={channelData}
          emptyMessage="No entry channel data available."
        />
      </Card>
    </div>
  );
}
