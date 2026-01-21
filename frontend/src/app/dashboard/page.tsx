"use client";

import { useEffect, useMemo, useState } from "react";
import DashboardLayout from "@/src/components/layout/DashboardLayout";
import ProtectedRoute from "@/src/components/auth/ProtectedRoute";
import Card from "@/src/components/ui/Card";
import LoadingSpinner from "@/src/components/ui/LoadingSpinner";
import ErrorMessage from "@/src/components/ui/ErrorMessage";
import Button from "@/src/components/ui/Button";
import { eventsApi, financeApi, lessonsApi } from "@/src/lib/api";
import {
  LessonProgressSummary,
  LessonProgressSummaryByLesson,
} from "@/src/types/lesson";
import { usePeople } from "@/src/hooks/usePeople";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import QuickActions from "@/src/components/dashboard/QuickActions";
import RecentActivity, {
  Activity as RecentActivityItem,
} from "@/src/components/dashboard/RecentActivity";
import { useAuth } from "@/src/contexts/AuthContext";
import { Event } from "@/src/types/event";
import { Donation, Offering } from "@/src/types/finance";

type UpcomingEvent = {
  id: string;
  title: string;
  schedule: string;
  location: string;
  date: Date;
};

type EventActivity = {
  id: string;
  title: string;
  date: Date;
};

const formatCurrency = (value: number) =>
  `₱${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

const formatEventSchedule = (date: Date) =>
  date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

const formatMonthLabel = (date: Date) =>
  date.toLocaleString(undefined, { month: "long", year: "numeric" });

const formatApiDate = (date: Date) => date.toISOString().slice(0, 10);

const formatRelativeTime = (date: Date) => {
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffSeconds = Math.round(diffMs / 1000);
  const diffMinutes = Math.round(diffSeconds / 60);
  const diffHours = Math.round(diffMinutes / 60);
  const diffDays = Math.round(diffHours / 24);

  if (Math.abs(diffSeconds) < 60) {
    return "Just now";
  }
  if (Math.abs(diffMinutes) < 60) {
    return new Intl.RelativeTimeFormat(undefined, {
      numeric: "auto",
    }).format(diffMinutes, "minute");
  }
  if (Math.abs(diffHours) < 24) {
    return new Intl.RelativeTimeFormat(undefined, {
      numeric: "auto",
    }).format(diffHours, "hour");
  }
  return new Intl.RelativeTimeFormat(undefined, {
    numeric: "auto",
  }).format(diffDays, "day");
};

export default function Dashboard() {
  const { user, isModuleCoordinator, isSeniorCoordinator } = useAuth();
  const [lessonSummary, setLessonSummary] =
    useState<LessonProgressSummary | null>(null);
  const [lessonSummaryLoading, setLessonSummaryLoading] = useState(true);
  const [lessonSummaryError, setLessonSummaryError] = useState<string | null>(
    null
  );
  const [upcomingEvents, setUpcomingEvents] = useState<UpcomingEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [eventsError, setEventsError] = useState<string | null>(null);
  const [eventActivity, setEventActivity] = useState<EventActivity[]>([]);
  const [monthlyGiving, setMonthlyGiving] = useState<
    { label: string; amount: string; change: string }[]
  >([]);
  const [financeLoading, setFinanceLoading] = useState(false);
  const [financeError, setFinanceError] = useState<string | null>(null);
  const [recentDonations, setRecentDonations] = useState<Donation[]>([]);
  const [recentOfferings, setRecentOfferings] = useState<Offering[]>([]);

  const isCoordinatorPlus = useMemo(() => {
    if (!user) return false;
    return user.role !== "MEMBER";
  }, [user]);

  const canViewPeople = useMemo(() => {
    if (!user) return false;
    return (
      ["MEMBER", "COORDINATOR", "PASTOR", "ADMIN"].includes(user.role) ||
      isSeniorCoordinator()
    );
  }, [user, isSeniorCoordinator]);

  const canViewLessons = useMemo(() => {
    if (!user) return false;
    return (
      ["MEMBER", "COORDINATOR", "PASTOR", "ADMIN"].includes(user.role) ||
      isModuleCoordinator("LESSONS")
    );
  }, [user, isModuleCoordinator]);

  const canViewEvents = useMemo(() => {
    if (!user) return false;
    return (
      ["MEMBER", "COORDINATOR", "PASTOR", "ADMIN"].includes(user.role) ||
      isModuleCoordinator("EVENTS") ||
      isSeniorCoordinator()
    );
  }, [user, isModuleCoordinator, isSeniorCoordinator]);

  const canViewFinance = useMemo(() => {
    if (!user) return false;
    return (
      user.role === "ADMIN" ||
      user.role === "PASTOR" ||
      isModuleCoordinator("FINANCE")
    );
  }, [user, isModuleCoordinator]);

  const allowPeopleMetrics = isCoordinatorPlus && canViewPeople;
  const allowFinanceWidgets = isCoordinatorPlus && canViewFinance;
  const allowEventsWidgets = canViewEvents;
  const allowLessonWidgets = canViewLessons;

  const { people, loading: peopleLoading, error: peopleError } = usePeople(
    allowPeopleMetrics
  );

  useEffect(() => {
    if (!allowLessonWidgets) {
      setLessonSummary(null);
      setLessonSummaryError(null);
      setLessonSummaryLoading(false);
      return;
    }
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
  }, [allowLessonWidgets]);

  useEffect(() => {
    if (!allowEventsWidgets) {
      setUpcomingEvents([]);
      setEventActivity([]);
      setEventsError(null);
      setEventsLoading(false);
      return;
    }

    const fetchEvents = async () => {
      try {
        setEventsLoading(true);
        const now = new Date();
        const end = new Date(now);
        end.setDate(end.getDate() + 60);
        const response = await eventsApi.getAll({
          start: formatApiDate(now),
          end: formatApiDate(end),
        });
        const events = response.data ?? [];
        const occurrences = events.flatMap((event: Event) => {
          if (event.occurrences && event.occurrences.length > 0) {
            return event.occurrences.map((occurrence) => ({
              id:
                occurrence.occurrence_id ||
                `${event.id}:${occurrence.start_date}`,
              title: event.title,
              location: event.location,
              startDate: new Date(occurrence.start_date),
            }));
          }
          return [
            {
              id: `${event.id}:${event.start_date}`,
              title: event.title,
              location: event.location,
              startDate: new Date(event.start_date),
            },
          ];
        });

        const upcoming = occurrences
          .filter((occurrence) => occurrence.startDate >= now)
          .sort((a, b) => a.startDate.getTime() - b.startDate.getTime())
          .slice(0, 3)
          .map((occurrence) => ({
            id: occurrence.id,
            title: occurrence.title,
            schedule: formatEventSchedule(occurrence.startDate),
            location: occurrence.location,
            date: occurrence.startDate,
          }));

        const recentCutoff = new Date();
        recentCutoff.setDate(recentCutoff.getDate() - 7);
        const recentActivity = occurrences
          .filter(
            (occurrence) =>
              occurrence.startDate >= recentCutoff &&
              occurrence.startDate <= now
          )
          .sort((a, b) => b.startDate.getTime() - a.startDate.getTime())
          .slice(0, 5)
          .map((occurrence) => ({
            id: occurrence.id,
            title: occurrence.title,
            date: occurrence.startDate,
          }));

        setUpcomingEvents(upcoming);
        setEventActivity(recentActivity);
        setEventsError(null);
      } catch (error) {
        setEventsError("Unable to load events.");
        setUpcomingEvents([]);
        setEventActivity([]);
      } finally {
        setEventsLoading(false);
      }
    };

    fetchEvents();
  }, [allowEventsWidgets]);

  useEffect(() => {
    if (!allowFinanceWidgets) {
      setMonthlyGiving([]);
      setFinanceError(null);
      setFinanceLoading(false);
      setRecentDonations([]);
      setRecentOfferings([]);
      return;
    }

    const fetchFinance = async () => {
      try {
        setFinanceLoading(true);
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth() - 2, 1);
        const response = await Promise.all([
          financeApi.listDonations({
            start: formatApiDate(start),
            end: formatApiDate(now),
          }),
          financeApi.listOfferings({
            start: formatApiDate(start),
            end: formatApiDate(now),
          }),
        ]);
        const donations = response[0] ?? [];
        const offerings = response[1] ?? [];
        setRecentDonations(donations);
        setRecentOfferings(offerings);

        const monthKeys: Date[] = [
          new Date(now.getFullYear(), now.getMonth() - 2, 1),
          new Date(now.getFullYear(), now.getMonth() - 1, 1),
          new Date(now.getFullYear(), now.getMonth(), 1),
        ];

        const totalsByMonth = new Map<string, number>();
        monthKeys.forEach((date) => {
          totalsByMonth.set(formatMonthLabel(date), 0);
        });

        const addToMonth = (dateString: string, amount: number) => {
          const date = new Date(dateString);
          if (Number.isNaN(date.getTime())) return;
          const key = formatMonthLabel(
            new Date(date.getFullYear(), date.getMonth(), 1)
          );
          totalsByMonth.set(key, (totalsByMonth.get(key) ?? 0) + amount);
        };

        donations.forEach((donation) => {
          addToMonth(donation.date, donation.amount);
        });

        offerings.forEach((offering) => {
          addToMonth(offering.serviceDate, offering.amount);
        });

        const monthlySnapshot = monthKeys.map((date, index) => {
          const label = formatMonthLabel(date);
          const amountValue = totalsByMonth.get(label) ?? 0;
          const previousDate = monthKeys[index - 1];
          const previousLabel = previousDate ? formatMonthLabel(previousDate) : "";
          const previousValue = previousLabel
            ? totalsByMonth.get(previousLabel) ?? 0
            : 0;
          const change =
            previousValue > 0
              ? `${amountValue >= previousValue ? "+" : ""}${Math.round(
                  ((amountValue - previousValue) / previousValue) * 100
                )}%`
              : "No prior month";
          return {
            label,
            amount: formatCurrency(amountValue),
            change,
          };
        });

        setMonthlyGiving(monthlySnapshot);
        setFinanceError(null);
      } catch (error) {
        setFinanceError("Unable to load finance snapshot.");
        setMonthlyGiving([]);
        setRecentDonations([]);
        setRecentOfferings([]);
      } finally {
        setFinanceLoading(false);
      }
    };

    fetchFinance();
  }, [allowFinanceWidgets]);

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

  const nextSteps = useMemo(() => {
    const steps: string[] = [];
    if (allowLessonWidgets && lessonMetrics.outstanding > 0) {
      steps.push(
        "Review members with outstanding lessons and schedule follow-ups."
      );
    }
    if (allowPeopleMetrics && peopleMetrics.newVisitorsThisMonth > 0) {
      steps.push(
        "Welcome new visitors and connect them with a coordinator this week."
      );
    }
    if (allowEventsWidgets && upcomingEvents.length > 0) {
      steps.push("Confirm attendance teams for upcoming events.");
    }
    if (steps.length === 0) {
      steps.push("Review this week’s ministry goals and plan next actions.");
    }
    return steps.slice(0, 3);
  }, [
    allowEventsWidgets,
    allowLessonWidgets,
    allowPeopleMetrics,
    lessonMetrics.outstanding,
    peopleMetrics.newVisitorsThisMonth,
    upcomingEvents.length,
  ]);

  const recentActivities = useMemo<RecentActivityItem[]>(() => {
    const items: Array<{
      id: string;
      type: "people" | "event" | "finance";
      description: string;
      date: Date;
    }> = [];

    if (allowPeopleMetrics) {
      const recentPeople = people
        .filter((person) => person.date_first_attended)
        .map((person) => ({
          person,
          date: new Date(person.date_first_attended as string),
        }))
        .filter(({ date }) => !Number.isNaN(date.getTime()))
        .sort((a, b) => b.date.getTime() - a.date.getTime())
        .slice(0, 3);

      recentPeople.forEach(({ person, date }) => {
        const name = person.full_name || `${person.first_name} ${person.last_name}`.trim();
        items.push({
          id: `person-${person.id}`,
          type: "people",
          description: `${name} attended for the first time.`,
          date,
        });
      });
    }

    if (allowEventsWidgets) {
      eventActivity.forEach((event) => {
        items.push({
          id: `event-${event.id}`,
          type: "event",
          description: `Event recorded: ${event.title}.`,
          date: event.date,
        });
      });
    }

    if (allowFinanceWidgets) {
      const financeEntries = [
        ...recentDonations.map((donation) => ({
          id: `donation-${donation.id}`,
          date: new Date(donation.createdAt || donation.date),
          description: `Donation received for ${donation.purpose}.`,
        })),
        ...recentOfferings.map((offering) => ({
          id: `offering-${offering.id}`,
          date: new Date(offering.createdAt || offering.serviceDate),
          description: `Offering recorded for ${offering.serviceName}.`,
        })),
      ]
        .filter((entry) => !Number.isNaN(entry.date.getTime()))
        .sort((a, b) => b.date.getTime() - a.date.getTime())
        .slice(0, 3);

      financeEntries.forEach((entry) => {
        items.push({
          id: entry.id,
          type: "finance",
          description: entry.description,
          date: entry.date,
        });
      });
    }

    return items
      .sort((a, b) => b.date.getTime() - a.date.getTime())
      .slice(0, 5)
      .map((item) => ({
        id: item.id,
        type: item.type,
        description: item.description,
        timestamp: formatRelativeTime(item.date),
      }));
  }, [
    allowEventsWidgets,
    allowFinanceWidgets,
    allowPeopleMetrics,
    eventActivity,
    people,
    recentDonations,
    recentOfferings,
  ]);

  const activityEmptyMessage =
    allowPeopleMetrics || allowEventsWidgets || allowFinanceWidgets
      ? "No recent activity for your accessible modules."
      : "Activity isn't available for your access level.";

  const topLessons: LessonProgressSummaryByLesson[] = useMemo(() => {
    if (!lessonSummary || !canViewLessons) {
      return [];
    }
    return [...lessonSummary.lessons].sort((a, b) => {
      if (a.order === b.order) {
        return a.version_label.localeCompare(b.version_label);
      }
      return a.order - b.order;
    });
  }, [lessonSummary, canViewLessons]);

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
          <Button variant="primary" className="w-full md:w-auto">
            Generate Report
          </Button>
        </div>

        {(lessonSummaryError ||
          (allowPeopleMetrics && peopleError) ||
          (allowEventsWidgets && eventsError) ||
          (allowFinanceWidgets && financeError)) && (
          <div className="space-y-2">
            {lessonSummaryError && (
              <ErrorMessage message={lessonSummaryError} />
            )}
            {allowPeopleMetrics && peopleError && (
              <ErrorMessage message={peopleError} />
            )}
            {allowEventsWidgets && eventsError && (
              <ErrorMessage message={eventsError} />
            )}
            {allowFinanceWidgets && financeError && (
              <ErrorMessage message={financeError} />
            )}
          </div>
        )}

        {allowPeopleMetrics || allowLessonWidgets ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {allowPeopleMetrics && (
              <MetricCard
                title="Active Members"
                value={peopleMetrics.members}
                subtitle={`${peopleMetrics.leaders} pastors & coordinators`}
                loading={peopleLoading}
                trend={memberTrend}
              />
            )}
            {allowPeopleMetrics && (
              <MetricCard
                title="Active Visitors"
                value={peopleMetrics.visitors}
                subtitle={`${peopleMetrics.newVisitorsThisMonth} newcomers this month`}
                loading={peopleLoading}
                trend={visitorsTrend}
              />
            )}
            {allowLessonWidgets && (
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
            )}
            {allowLessonWidgets && (
              <MetricCard
                title="Outstanding Lesson Assignments"
                value={lessonMetrics.outstanding}
                subtitle="Assigned or currently in progress"
                loading={lessonSummaryLoading}
                trend={outstandingTrend}
              />
            )}
          </div>
        ) : (
          <Card>
            <p className="text-sm text-gray-500">
              Metrics are unavailable for your current access level.
            </p>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {allowLessonWidgets && (
            <Card>
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-4">
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
                  className="text-xs w-full sm:w-auto"
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
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-semibold text-[#2D3748] break-words">
                            {lesson.lesson_title}
                          </h4>
                          <p className="text-xs text-gray-500">
                            Step {lesson.order} • {lesson.version_label}{" "}
                            {lesson.is_latest ? "(Latest)" : "(Superseded)"}
                          </p>
                        </div>
                        <span className="text-sm font-semibold text-[#2563EB] flex-shrink-0">
                          {lesson.completed}/{lesson.total} completed
                        </span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3 text-xs text-gray-600">
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
          )}

          <QuickActions />
          <RecentActivity
            activities={recentActivities}
            isLoading={
              (allowPeopleMetrics && peopleLoading) ||
              (allowEventsWidgets && eventsLoading) ||
              (allowFinanceWidgets && financeLoading)
            }
            emptyMessage={activityEmptyMessage}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {allowEventsWidgets ? (
            <Card>
              <h3 className="text-lg font-semibold text-[#2D3748] mb-4">
                Upcoming Events
              </h3>
              <p className="text-xs text-gray-500 mb-3">
                Next 60 days of upcoming gatherings.
              </p>
              {eventsLoading ? (
                <LoadingSpinner />
              ) : upcomingEvents.length === 0 ? (
                <p className="text-sm text-gray-500">
                  No upcoming events found.
                </p>
              ) : (
                <div className="space-y-3">
                  {upcomingEvents.map((event) => (
                    <div
                      key={event.id}
                      className="border border-gray-200 rounded-lg p-3 text-sm text-gray-600"
                    >
                      <p className="font-semibold text-[#2D3748]">
                        {event.title}
                      </p>
                      <p>{event.schedule}</p>
                      <p className="text-xs text-gray-500">
                        Location: {event.location}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          ) : (
            <Card>
              <h3 className="text-lg font-semibold text-[#2D3748] mb-4">
                Upcoming Events
              </h3>
              <p className="text-sm text-gray-500">
                Events data is not available for your access level.
              </p>
            </Card>
          )}

          {allowFinanceWidgets ? (
            <Card>
              <h3 className="text-lg font-semibold text-[#2D3748] mb-4">
                Monthly Giving Snapshot
              </h3>
              <p className="text-xs text-gray-500 mb-3">
                Combined donations and offerings by month.
              </p>
              {financeLoading ? (
                <LoadingSpinner />
              ) : monthlyGiving.length === 0 ? (
                <p className="text-sm text-gray-500">
                  No giving data available yet.
                </p>
              ) : (
                <div className="space-y-3">
                  {monthlyGiving.map((entry) => {
                    const changeClass =
                      entry.change === "No prior month"
                        ? "text-gray-500"
                        : entry.change.startsWith("-")
                        ? "text-red-600"
                        : "text-green-600";
                    return (
                      <div
                        key={entry.label}
                        className="border border-gray-200 rounded-lg px-4 py-3 text-sm text-gray-600"
                      >
                        <p className="font-semibold text-[#2D3748]">
                          {entry.label}
                        </p>
                        <p className="text-lg font-bold text-[#2563EB]">
                          {entry.amount}
                        </p>
                        <p className={`text-xs ${changeClass}`}>
                          {entry.change}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          ) : (
            <Card>
              <h3 className="text-lg font-semibold text-[#2D3748] mb-4">
                Monthly Giving Snapshot
              </h3>
              <p className="text-sm text-gray-500">
                Finance data is not available for your access level.
              </p>
            </Card>
          )}

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
