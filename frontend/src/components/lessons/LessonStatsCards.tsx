import Card from "@/src/components/ui/Card";
import LoadingSpinner from "@/src/components/ui/LoadingSpinner";
import ErrorMessage from "@/src/components/ui/ErrorMessage";
import { LessonProgressSummary } from "@/src/types/lesson";

interface LessonStatsCardsProps {
  summary: LessonProgressSummary | null;
  visitorsAwaitingCount: number;
  ongoingStudentsCount: number;
  loading: boolean;
  error?: string | null;
}

const formatNumber = (value: number) =>
  new Intl.NumberFormat().format(value ?? 0);

export default function LessonStatsCards({
  summary,
  visitorsAwaitingCount,
  ongoingStudentsCount,
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

  const completedCount = summary?.overall?.COMPLETED ?? 0;
  const totalRecords = summary?.total_participants ?? 0;
  const averageProgress =
    totalRecords > 0 ? Math.round((completedCount / totalRecords) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <SummaryCard
          title="Visitors Awaiting Lessons"
          value={formatNumber(visitorsAwaitingCount)}
          subtitle="Visitors not yet enrolled in any lesson"
          valueClassName="text-red-600"
        />
        <SummaryCard
          title="Ongoing Students"
          value={formatNumber(ongoingStudentsCount)}
          subtitle="Students with ongoing lessons this year"
        />
        <SummaryCard
          title="Completed Lessons"
          value={formatNumber(completedCount)}
          subtitle="Students who completed all lessons"
          valueClassName={
            completedCount > 0 ? "text-green-600" : "text-[#2563EB]"
          }
        />
        <SummaryCard
          title="Average Progress"
          value={`${averageProgress}%`}
          subtitle="Completion rate across yearly students"
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
  valueClassName = "text-[#2563EB]",
}: SummaryCardProps) {
  return (
    <Card>
      <p className="text-sm text-gray-500">{title}</p>
      <p className={`text-3xl font-bold mt-2 ${valueClassName}`}>{value}</p>
      <p className="text-xs text-gray-500 mt-1">{subtitle}</p>
    </Card>
  );
}
