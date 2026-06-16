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
import type { V2bLeakageSection } from "@/src/types/reports";

interface V2bLeakagePanelsProps {
  leakage: V2bLeakageSection | null;
  loading?: boolean;
}

function LeakageBarChart({
  title,
  data,
}: {
  title: string;
  data: { name: string; count: number }[];
}) {
  if (data.length === 0) {
    return (
      <Card title={title}>
        <div className="py-8 text-center text-sm text-muted-foreground">
          No data available.
        </div>
      </Card>
    );
  }

  return (
    <Card title={title}>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 8, right: 16, bottom: 8, left: -8 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 11 }}
              interval={0}
              angle={-15}
              textAnchor="end"
              height={60}
            />
            <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
            <Tooltip />
            <Bar dataKey="count" name="Count" fill="#ef4444" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

export default function V2bLeakagePanels({
  leakage,
  loading = false,
}: V2bLeakagePanelsProps) {
  if (loading) {
    return (
      <div className="space-y-3">
        <LeakageBetaNote />
        <Card title="Drop-off Leakage">
          <div className="py-8 text-center text-sm text-muted-foreground">
            Loading leakage data...
          </div>
        </Card>
      </div>
    );
  }

  if (!leakage || leakage.total_drop_offs === 0) {
    return null;
  }

  const byStage = leakage.by_stage.map((row) => ({
    name: row.label,
    count: row.count,
  }));
  const byReason = leakage.by_reason.map((row) => ({
    name: row.label,
    count: row.count,
  }));

  return (
    <div className="space-y-3">
      <LeakageBetaNote />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <LeakageBarChart title="Drop-offs by Stage" data={byStage} />
        <LeakageBarChart title="Drop-offs by Reason" data={byReason} />
      </div>
    </div>
  );
}

function LeakageBetaNote() {
  return (
    <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
      <span className="font-medium">Beta.</span> Drop-off leakage charts and
      recovery metrics are early — stage and reason breakdowns may shift as
      tracking improves.
    </p>
  );
}
