"use client";

import { useEffect, useMemo, useState } from "react";
import DashboardLayout from "@/src/components/layout/DashboardLayout";
import ProtectedRoute from "@/src/components/auth/ProtectedRoute";
import Card from "@/src/components/ui/Card";
import LoadingSpinner from "@/src/components/ui/LoadingSpinner";
import ErrorMessage from "@/src/components/ui/ErrorMessage";
import Button from "@/src/components/ui/Button";
import { lessonsApi } from "@/src/lib/api";
import {
  LessonProgressSummary,
  LessonProgressSummaryByLesson,
} from "@/src/types/lesson";
import { usePeople } from "@/src/hooks/usePeople";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import QuickActions from "@/src/components/dashboard/QuickActions";
import RecentActivity from "@/src/components/dashboard/RecentActivity";

export default function Dashboard() {
  const [lessonSummary, setLessonSummary] =
    useState<LessonProgressSummary | null>(null);
  const [lessonSummaryLoading, setLessonSummaryLoading] = useState(true);
  const [lessonSummaryError, setLessonSummaryError] = useState<string | null>(
    null
  );
  const { people, loading: peopleLoading, error: peopleError } = usePeople();

  useEffect(() => {
    const fetchLessonSummary = async () => {
      try {
        setLessonSummaryLoading(true);
        const response = await lessonsApi.summary();
        setLessonSummary(response.data);
        setLessonSummaryError(null);
      } catch (error) {
        setLessonSummaryError("Unable to load lesson analytics.");
      } finally {
        setLessonSummaryLoading(false);
      }
    };

    fetchLessonSummary();
  }, []);

  const lessonMetrics = useMemo(() => {
    const overall = lessonSummary?.overall;
    const total = lessonSummary?.total_participants ?? 0;
    const completed = overall?.COMPLETED ?? 0;
    const inProgress = overall?.IN_PROGRESS ?? 0;
    const assigned = overall?.ASSIGNED ?? 0;
    const skipped = overall?.SKIPPED ?? 0;
    const outstanding = inProgress + assigned;
    const completionRate =
      total > 0 ? Math.round((completed / total) * 100) : 0;

    return {
      total,
      completed,
      inProgress,
      assigned,
      skipped,
      outstanding,
      completionRate,
    };
  }, [lessonSummary]);

  const peopleMetrics = useMemo(() => {
    const metrics = {
      total: people.length,
      members: 0,
      visitors: 0,
      leaders: 0,
      newVisitorsThisMonth: 0,
    };

    if (people.length === 0) {
      return metrics;
    }

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    people.forEach((person) => {
      if (person.role === "VISITOR") {
        metrics.visitors += 1;
        if (person.date_first_attended) {
          const attendedDate = new Date(person.date_first_attended);
          if (
            !Number.isNaN(attendedDate.getTime()) &&
            attendedDate.getMonth() === currentMonth &&
            attendedDate.getFullYear() === currentYear
          ) {
            metrics.newVisitorsThisMonth += 1;
          }
        }
      } else {
        metrics.members += 1;
        if (person.role === "PASTOR" || person.role === "COORDINATOR") {
          metrics.leaders += 1;
        }
      }
    });

    return metrics;
  }, [people]);

  const memberTrend = useMemo(() => {
    if (peopleMetrics.total === 0) {
      return { direction: "flat" as const, label: "No people records yet" };
    }
    const difference = peopleMetrics.members - peopleMetrics.visitors;
    if (difference > 0) {
      return {
        direction: "up" as const,
        label: `${difference} more members than visitors`,
      };
    }
    if (difference < 0) {
      return {
        direction: "down" as const,
        label: `${Math.abs(difference)} fewer members than visitors`,
      };
    }
    return { direction: "flat" as const, label: "Members equal visitors" };
  }, [peopleMetrics.members, peopleMetrics.visitors, peopleMetrics.total]);

  const visitorsTrend = useMemo(() => {
    if (peopleMetrics.total === 0) {
      return { direction: "flat" as const, label: "No people records yet" };
    }
    if (peopleMetrics.newVisitorsThisMonth > 0) {
      return {
        direction: "up" as const,
        label: `+${peopleMetrics.newVisitorsThisMonth} this month`,
      };
    }
    return {
      direction: "down" as const,
      label: "No new visitors recorded this month",
    };
  }, [peopleMetrics.total, peopleMetrics.newVisitorsThisMonth]);

  const lessonCompletionTrend = useMemo(() => {
    if (lessonMetrics.total === 0) {
      return {
        direction: "flat" as const,
        label: "No lesson assignments yet",
      };
    }
    if (lessonMetrics.completionRate >= 50) {
      return {
        direction: "up" as const,
        label: "On track for conversions",
      };
    }
    return {
      direction: "down" as const,
      label: "Encourage more completions",
    };
  }, [lessonMetrics.total, lessonMetrics.completionRate]);

  const outstandingTrend = useMemo(() => {
    if (lessonMetrics.total === 0) {
      return { direction: "flat" as const, label: "No lesson assignments yet" };
    }
    if (lessonMetrics.outstanding === 0) {
      return { direction: "flat" as const, label: "All assignments completed" };
    }
    return {
      direction: "down" as const,
      label: `${lessonMetrics.outstanding} pending follow-ups`,
    };
  }, [lessonMetrics.total, lessonMetrics.outstanding]);

  const upcomingEvents = [
    {
      title: "Midweek Service",
      schedule: "Nov 13, 2025 • 7:00 PM",
      location: "Main Sanctuary",
    },
    {
      title: "Cluster Leaders Huddle",
      schedule: "Nov 16, 2025 • 2:00 PM",
      location: "Multipurpose Hall",
    },
    {
      title: "New Converts Graduation",
      schedule: "Nov 20, 2025 • 3:00 PM",
      location: "Conference Room B",
    },
  ];

  const monthlyGiving = [
    { label: "September 2025", amount: "₱120,500", change: "+8%" },
    { label: "October 2025", amount: "₱128,300", change: "+6%" },
    { label: "November 2025", amount: "₱54,900", change: "Month-to-date" },
  ];

  const nextSteps = [
    "Review members with outstanding lessons and schedule follow-up conversations.",
    "Celebrate recent conversions and update their journey stories.",
    "Publish the next series of lessons for upcoming cohorts.",
  ];

  const topLessons: LessonProgressSummaryByLesson[] = useMemo(() => {
    if (!lessonSummary) {
      return [];
    }
    return [...lessonSummary.lessons].sort((a, b) => {
      if (a.order === b.order) {
        return a.version_label.localeCompare(b.version_label);
      }
      return a.order - b.order;
    });
  }, [lessonSummary]);

  return (
    <ProtectedRoute>
      <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-[#2D3748]">
              Dashboard Overview
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              Monitor key ministry metrics, lesson progress, and quick actions
              for the week.
            </p>
          </div>
          <Button variant="primary">Generate Report</Button>
        </div>

        {(lessonSummaryError || peopleError) && (
          <div className="space-y-2">
            {lessonSummaryError && (
              <ErrorMessage message={lessonSummaryError} />
            )}
            {peopleError && <ErrorMessage message={peopleError} />}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <MetricCard
            title="Active Members"
            value={peopleMetrics.members}
            subtitle={`${peopleMetrics.leaders} pastors & coordinators`}
            loading={peopleLoading}
            trend={memberTrend}
          />
          <MetricCard
            title="Active Visitors"
            value={peopleMetrics.visitors}
            subtitle={`${peopleMetrics.newVisitorsThisMonth} newcomers this month`}
            loading={peopleLoading}
            trend={visitorsTrend}
          />
          <MetricCard
            title="Lesson Completion Rate"
            value={`${lessonMetrics.completionRate}%`}
            subtitle={
              lessonSummaryLoading
                ? ""
                : lessonMetrics.total > 0
                ? `${lessonMetrics.completed}/${lessonMetrics.total} completed`
                : "No lesson assignments yet"
            }
            loading={lessonSummaryLoading}
            trend={lessonCompletionTrend}
          />
          <MetricCard
            title="Outstanding Lesson Assignments"
            value={lessonMetrics.outstanding}
            subtitle="Assigned or currently in progress"
            loading={lessonSummaryLoading}
            trend={outstandingTrend}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card>
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-[#2D3748]">
                  Lesson Completion Pipeline
                </h3>
                <p className="text-sm text-gray-500">
                  Track lesson status across current and superseded versions.
                </p>
              </div>
              <Button
                variant="tertiary"
                className="text-xs"
                onClick={() => {
                  window.location.href = "/lessons";
                }}
              >
                Manage Lessons
              </Button>
            </div>
            {lessonSummaryLoading ? (
              <LoadingSpinner />
            ) : topLessons.length === 0 ? (
              <p className="text-sm text-gray-500">
                No lesson assignments recorded yet.
              </p>
            ) : (
              <div className="space-y-3">
                {topLessons.map((lesson) => (
                  <div
                    key={`${lesson.lesson_id}-${lesson.version_label}`}
                    className="border rounded-lg px-4 py-3"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-sm font-semibold text-[#2D3748]">
                          {lesson.lesson_title}
                        </h4>
                        <p className="text-xs text-gray-500">
                          Step {lesson.order} • {lesson.version_label}{" "}
                          {lesson.is_latest ? "(Latest)" : "(Superseded)"}
                        </p>
                      </div>
                      <span className="text-sm font-semibold text-[#2563EB]">
                        {lesson.completed}/{lesson.total} completed
                      </span>
                    </div>
                    <div className="grid grid-cols-4 gap-2 mt-3 text-xs text-gray-600">
                      <div>
                        <span className="block font-semibold text-gray-700">
                          Assigned
                        </span>
                        {lesson.assigned}
                      </div>
                      <div>
                        <span className="block font-semibold text-gray-700">
                          In Progress
                        </span>
                        {lesson.in_progress}
                      </div>
                      <div>
                        <span className="block font-semibold text-gray-700">
                          Completed
                        </span>
                        {lesson.completed}
                      </div>
                      <div>
                        <span className="block font-semibold text-gray-700">
                          Skipped
                        </span>
                        {lesson.skipped}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <QuickActions />
          <RecentActivity />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <h3 className="text-lg font-semibold text-[#2D3748] mb-4">
              Upcoming Events
            </h3>
            <p className="text-xs text-gray-500 mb-3">
              Placeholder summary from the events module.
            </p>
            <div className="space-y-3">
              {upcomingEvents.map((event) => (
                <div
                  key={`${event.title}-${event.schedule}`}
                  className="border border-gray-200 rounded-lg p-3 text-sm text-gray-600"
                >
                  <p className="font-semibold text-[#2D3748]">{event.title}</p>
                  <p>{event.schedule}</p>
                  <p className="text-xs text-gray-500">
                    Location: {event.location}
                  </p>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <h3 className="text-lg font-semibold text-[#2D3748] mb-4">
              Monthly Giving Snapshot
            </h3>
            <p className="text-xs text-gray-500 mb-3">
              Placeholder giving snapshot for quick reference.
            </p>
            <div className="space-y-3">
              {monthlyGiving.map((entry) => (
                <div
                  key={entry.label}
                  className="border border-gray-200 rounded-lg px-4 py-3 text-sm text-gray-600"
                >
                  <p className="font-semibold text-[#2D3748]">{entry.label}</p>
                  <p className="text-lg font-bold text-[#2563EB]">
                    {entry.amount}
                  </p>
                  <p className="text-xs text-green-600">{entry.change}</p>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <h3 className="text-lg font-semibold text-[#2D3748] mb-4">
              Next Steps
            </h3>
            <div className="space-y-3 text-sm text-gray-600">
              {nextSteps.map((step) => (
                <p key={step}>• {step}</p>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </DashboardLayout>
    </ProtectedRoute>
  );
}

type TrendDirection = "up" | "down" | "flat";

interface MetricCardProps {
  title: string;
  value: number | string;
  subtitle?: string;
  loading?: boolean;
  trend?: {
    direction: TrendDirection;
    label: string;
  };
}

function MetricCard({
  title,
  value,
  subtitle,
  loading,
  trend,
}: MetricCardProps) {
  const renderTrend = () => {
    if (!trend) return null;
    const commonClasses = "flex items-center gap-1 text-xs font-medium mt-3";
    if (trend.direction === "up") {
      return (
        <p className={`${commonClasses} text-green-600`}>
          <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
          {trend.label}
        </p>
      );
    }
    if (trend.direction === "down") {
      return (
        <p className={`${commonClasses} text-red-600`}>
          <ArrowDownRight className="h-4 w-4" aria-hidden="true" />
          {trend.label}
        </p>
      );
    }
    return (
      <p className={`${commonClasses} text-gray-500`}>
        <Minus className="h-4 w-4" aria-hidden="true" />
        {trend.label}
      </p>
    );
  };

  return (
    <Card>
      <div className="flex flex-col">
        <p className="text-sm text-gray-600">{title}</p>
        {loading ? (
          <div className="mt-4">
            <LoadingSpinner />
          </div>
        ) : (
          <>
            <p className="text-3xl font-bold text-[#2563EB] mt-1">{value}</p>
            {subtitle && (
              <p className="text-xs text-gray-500 mt-2 leading-snug">
                {subtitle}
              </p>
            )}
            {renderTrend()}
          </>
        )}
      </div>
    </Card>
  );
}
