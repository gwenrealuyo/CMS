import Card from "@/src/components/ui/Card";
import LoadingSpinner from "@/src/components/ui/LoadingSpinner";
import ErrorMessage from "@/src/components/ui/ErrorMessage";
import { LessonProgressSummary } from "@/src/types/lesson";
import { getTieredCompletionPercentTextClass } from "@/src/lib/each1Reach1ProgressStyles";

interface LessonStatsCardsProps {
  summary: LessonProgressSummary | null;
  visitorsAwaitingCount: number;
  ongoingStudentsCount: number;
  loading: boolean;
  error?: string | null;
  /** Teachers see completed / ongoing / average for their assigned students only. */
  scopedToAssignedStudents?: boolean;
}

const formatNumber = (value: number) =>
  new Intl.NumberFormat().format(value ?? 0);

export default function LessonStatsCards({
  summary,
  visitorsAwaitingCount,
  ongoingStudentsCount,
  loading,
  error,
  scopedToAssignedStudents = false,
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

  const completedCount = summary?.overall?.COMPLETED ?? 0;
  const totalRecords = summary?.total_participants ?? 0;
  const averageProgress =
    totalRecords > 0 ? Math.round((completedCount / totalRecords) * 100) : 0;
  /** Tiered colors: green only at 100%; red/orange/yellow while in progress. */
  const averageProgressColorClass =
    totalRecords > 0 ?
      getTieredCompletionPercentTextClass(averageProgress)
    : "text-gray-600";

  const ongoingSubtitle = scopedToAssignedStudents
    ? "Your assigned students who have not finished all lessons"
    : "Students who have not finished all lessons";
  const completedSubtitle = scopedToAssignedStudents
    ? "Your assigned students who finished all lessons this year"
    : "Students who finished all lessons this year";
  const averageSubtitle = scopedToAssignedStudents
    ? "Share of your assigned students this year who finished the course"
    : "Share of this year's students who finished the course";
  const visitorsSubtitle = scopedToAssignedStudents
    ? "Visitors in your branch not yet enrolled (not limited to your students)"
    : "Visitors not yet enrolled in any lesson";

  return (
    <div className="space-y-6">
      {scopedToAssignedStudents && (
        <p className="text-sm text-gray-600">
          Ongoing, completed, and average counts include only students assigned
          to you.
        </p>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <SummaryCard
          title="Visitors Awaiting Lessons"
          value={formatNumber(visitorsAwaitingCount)}
          subtitle={visitorsSubtitle}
          valueClassName="text-red-600"
        />
        <SummaryCard
          title="Ongoing Students"
          value={formatNumber(ongoingStudentsCount)}
          subtitle={ongoingSubtitle}
        />
        <SummaryCard
          title="Completed This Year"
          value={formatNumber(completedCount)}
          subtitle={completedSubtitle}
          valueClassName={
            completedCount > 0 ? "text-green-600" : "text-primary"
          }
        />
        <SummaryCard
          title="Average Progress"
          value={`${averageProgress}%`}
          subtitle={averageSubtitle}
          valueClassName={averageProgressColorClass}
        />
      </div>
    </div>
  );
}

interface SummaryCardProps {
  title: string;
  value: string | number;
  subtitle: string;
  valueClassName?: string;
}

function SummaryCard({
  title,
  value,
  subtitle,
  valueClassName = "text-primary",
}: SummaryCardProps) {
  return (
    <Card>
      <p className="text-sm text-gray-500">{title}</p>
      <p className={`text-3xl font-bold mt-2 ${valueClassName}`}>{value}</p>
      <p className="text-xs text-gray-500 mt-1">{subtitle}</p>
    </Card>
  );
}
