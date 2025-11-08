import Card from "@/src/components/ui/Card";
import LoadingSpinner from "@/src/components/ui/LoadingSpinner";
import ErrorMessage from "@/src/components/ui/ErrorMessage";
import { LessonProgressSummary } from "@/src/types/lesson";

interface LessonStatsCardsProps {
  summary: LessonProgressSummary | null;
  visitorsAwaitingCount: number;
  loading: boolean;
  error?: string | null;
}

const formatNumber = (value: number) =>
  new Intl.NumberFormat().format(value ?? 0);

export default function LessonStatsCards({
  summary,
  visitorsAwaitingCount,
  loading,
  error,
}: LessonStatsCardsProps) {
  if (loading) {
    return (
      <Card>
        <LoadingSpinner />
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <ErrorMessage message={error} />
      </Card>
    );
  }

  const assignedCount = summary?.overall?.ASSIGNED ?? 0;
  const inProgressCount = summary?.overall?.IN_PROGRESS ?? 0;
  const completedCount = summary?.overall?.COMPLETED ?? 0;
  const totalRecords = summary?.total_participants ?? 0;
  const averageProgress =
    totalRecords > 0 ? Math.round((completedCount / totalRecords) * 100) : 0;
  const activeAssignments = assignedCount + inProgressCount;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <SummaryCard
          title="Visitors Awaiting Lessons"
          value={formatNumber(visitorsAwaitingCount)}
          subtitle="Visitors not yet enrolled in any lesson"
        />
        <SummaryCard
          title="Active Assignments"
          value={formatNumber(activeAssignments)}
          subtitle="Currently assigned or in progress"
        />
        <SummaryCard
          title="Completed Lessons"
          value={formatNumber(completedCount)}
          subtitle="Total completions"
        />
        <SummaryCard
          title="Average Progress"
          value={`${averageProgress}%`}
          subtitle="Across all assignments"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatusCard
          label="Assigned"
          value={formatNumber(assignedCount)}
          description="Lessons waiting to be started"
          colorClass="bg-gray-100 text-gray-700"
        />

        <StatusCard
          label="In Progress"
          value={formatNumber(inProgressCount)}
          description="Lessons currently being studied"
          colorClass="bg-blue-100 text-blue-700"
        />
        <StatusCard
          label="Completed"
          value={formatNumber(completedCount)}
          description="Lessons completed successfully"
          colorClass="bg-green-100 text-green-700"
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

interface StatusCardProps {
  label: string;
  value: string | number;
  description: string;
  colorClass: string;
}

function StatusCard({
  label,
  value,
  description,
  colorClass,
}: StatusCardProps) {
  return (
    <Card>
      <span
        className={`inline-flex items-center px-3 py-1 text-xs font-semibold rounded-full ${colorClass}`}
      >
        {label}
      </span>
      <p className="text-4xl font-bold text-[#1F2937] mt-3">{value}</p>
      <p className="text-xs text-gray-500 mt-2">{description}</p>
    </Card>
  );
}
