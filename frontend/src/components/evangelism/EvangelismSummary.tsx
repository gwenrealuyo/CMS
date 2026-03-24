"use client";

import Card from "@/src/components/ui/Card";
import LoadingSpinner from "@/src/components/ui/LoadingSpinner";
import ErrorMessage from "@/src/components/ui/ErrorMessage";
import { EvangelismSummary as SummaryType } from "@/src/types/evangelism";

interface EvangelismSummaryProps {
  summary: SummaryType | null;
  loading?: boolean;
  error?: string | null;
  each1Reach1Progress?: {
    year: number;
    achieved: number;
    target: number;
    percentage: number;
    loading?: boolean;
    error?: string | null;
  };
}

const formatNumber = (value: number) =>
  new Intl.NumberFormat().format(value ?? 0);

export default function EvangelismSummary({
  summary,
  loading = false,
  error = null,
  each1Reach1Progress,
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
  const progressValue = each1Reach1Progress?.loading
    ? "..."
    : each1Reach1Progress?.error
    ? "N/A"
    : `${(each1Reach1Progress?.percentage ?? 0).toFixed(1)}%`;
  const progressSubtitle = each1Reach1Progress?.loading
    ? "Loading goal progress..."
    : each1Reach1Progress?.error
    ? "Unable to load goal progress"
    : each1Reach1Progress && each1Reach1Progress.target > 0
    ? `${formatNumber(each1Reach1Progress.achieved)} / ${formatNumber(
        each1Reach1Progress.target
      )} conversions in ${each1Reach1Progress.year}`
    : each1Reach1Progress
    ? `No goals set for ${each1Reach1Progress.year}`
    : "No goals set";

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <SummaryCard
          title="Total Groups"
          value={formatNumber(summary.total_groups)}
          subtitle={`${summary.active_groups} active, ${inactiveGroups} inactive`}
        />
        <SummaryCard
          title="Total Visitors"
          value={formatNumber(summary.total_prospects)}
          subtitle="People being evangelized"
        />
        <SummaryCard
          title="Total Conversions"
          value={formatNumber(summary.total_conversions)}
          subtitle="Completed conversions"
        />
        <SummaryCard
          title="Each 1 Reach 1 Goal"
          value={progressValue}
          subtitle={progressSubtitle}
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
