"use client";

import Card from "@/src/components/ui/Card";
import LoadingSpinner from "@/src/components/ui/LoadingSpinner";
import ErrorMessage from "@/src/components/ui/ErrorMessage";
import { EvangelismSummary as SummaryType } from "@/src/types/evangelism";

interface EvangelismSummaryProps {
  summary: SummaryType | null;
  loading?: boolean;
  error?: string | null;
}

const formatNumber = (value: number) =>
  new Intl.NumberFormat().format(value ?? 0);

export default function EvangelismSummary({ 
  summary, 
  loading = false,
  error = null 
}: EvangelismSummaryProps) {
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <LoadingSpinner />
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <Card>
          <ErrorMessage message={error} />
        </Card>
      </div>
    );
  }

  if (!summary) {
    return null;
  }

  const inactiveGroups = summary.total_groups - summary.active_groups;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <SummaryCard
          title="Total Groups"
          value={formatNumber(summary.total_groups)}
          subtitle={`${summary.active_groups} active, ${inactiveGroups} inactive`}
        />
        <SummaryCard
          title="Active Groups"
          value={formatNumber(summary.active_groups)}
          subtitle="Currently active Bible Study groups"
        />
        <SummaryCard
          title="Total Prospects"
          value={formatNumber(summary.total_prospects)}
          subtitle="People being evangelized"
        />
        <SummaryCard
          title="Total Conversions"
          value={formatNumber(summary.total_conversions)}
          subtitle="Completed conversions"
        />
      </div>
    </div>
  );
}

interface SummaryCardProps {
  title: string;
  value: string | number;
  subtitle: string;
}

function SummaryCard({ title, value, subtitle }: SummaryCardProps) {
  return (
    <Card>
      <p className="text-sm text-gray-500">{title}</p>
      <p className="text-3xl font-bold text-[#2563EB] mt-2">{value}</p>
      <p className="text-xs text-gray-500 mt-1">{subtitle}</p>
    </Card>
  );
}

