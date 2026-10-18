import {
  LessonTimelineCatalogLesson,
  LessonTimelineStudent,
} from "@/src/types/lesson";

export function hasCompletedTimelineLessons(
  row: Pick<LessonTimelineStudent, "has_finished_lessons" | "lessons">,
): boolean {
  if (row.has_finished_lessons) {
    return true;
  }
  return (
    row.lessons.length > 0 &&
    row.lessons.every(
      (lesson) =>
        lesson.status === "COMPLETED" || Boolean(lesson.completed_on),
    )
  );
}

export function formatLessonGapLabel(
  row: Pick<
    LessonTimelineStudent,
    "days_since_last_session" | "days_anchor" | "has_finished_lessons" | "lessons"
  >,
): string {
  const days = row.days_since_last_session;
  if (hasCompletedTimelineLessons(row) && row.days_anchor !== "session") {
    return "Completed";
  }
  if (days == null) {
    return "No session yet";
  }
  const ago =
    days === 0 ? "Today" : days === 1 ? "1 day ago" : `${days} days ago`;
  if (row.days_anchor === "session") {
    return ago;
  }
  return `No session yet · ${ago}`;
}

export function isTimelineStudentFinished(
  row: Pick<
    LessonTimelineStudent,
    | "has_finished_lessons"
    | "lessons"
    | "water_baptism_date"
    | "spirit_baptism_date"
    | "cluster_codes"
  >,
): boolean {
  return (
    hasCompletedTimelineLessons(row) &&
    Boolean(row.water_baptism_date) &&
    Boolean(row.spirit_baptism_date) &&
    row.cluster_codes.length > 0
  );
}

export function lessonGapTone(
  row: Pick<
    LessonTimelineStudent,
    | "days_since_last_session"
    | "days_anchor"
    | "has_finished_lessons"
    | "lessons"
    | "water_baptism_date"
    | "spirit_baptism_date"
    | "cluster_codes"
  >,
): string {
  if (isTimelineStudentFinished(row)) {
    return "bg-emerald-100 text-emerald-800";
  }
  if (hasCompletedTimelineLessons(row)) {
    return "bg-gray-100 text-gray-700";
  }
  const days = row.days_since_last_session;
  if (row.days_anchor !== "session" || days == null || days < 8) {
    return "bg-gray-100 text-gray-700";
  }
  if (days >= 21) {
    return "bg-red-100 text-red-800";
  }
  return "bg-amber-100 text-amber-900";
}

export type LessonTimelineVisualMark =
  | {
      kind: "lesson";
      key: string;
      title: string;
      completedOn: string | null;
      status: string | null;
    }
  | {
      kind: "baptism";
      key: string;
      date: string | null;
    }
  | {
      kind: "spirit";
      key: string;
      date: string | null;
    }
  | {
      kind: "cluster";
      key: string;
      code: string | null;
    };

export function buildTimelineMarks(
  catalog: LessonTimelineCatalogLesson[],
  student: LessonTimelineStudent,
): LessonTimelineVisualMark[] {
  const progressByLesson = new Map(
    student.lessons.map((lesson) => [lesson.lesson_id, lesson]),
  );
  const datedMarkers: Array<{
    kind: "baptism" | "spirit";
    date: string;
    key: string;
  }> = [];
  const pendingMilestones: LessonTimelineVisualMark[] = [];

  if (student.water_baptism_date) {
    datedMarkers.push({
      kind: "baptism",
      date: student.water_baptism_date,
      key: `baptism-${student.water_baptism_date}`,
    });
  } else {
    pendingMilestones.push({
      kind: "baptism",
      date: null,
      key: "baptism-pending",
    });
  }

  if (student.spirit_baptism_date) {
    datedMarkers.push({
      kind: "spirit",
      date: student.spirit_baptism_date,
      key: `spirit-${student.spirit_baptism_date}`,
    });
  } else {
    pendingMilestones.push({
      kind: "spirit",
      date: null,
      key: "spirit-pending",
    });
  }

  datedMarkers.sort((first, second) => first.date.localeCompare(second.date));

  const lessonMarks: LessonTimelineVisualMark[] = catalog.map((lesson) => ({
    kind: "lesson",
    key: `lesson-${lesson.id}`,
    title: lesson.title,
    completedOn: progressByLesson.get(lesson.id)?.completed_on ?? null,
    status: progressByLesson.get(lesson.id)?.status ?? null,
  }));

  const activeClusterMarks: LessonTimelineVisualMark[] =
    student.cluster_codes.map((code) => ({
      kind: "cluster",
      key: `cluster-${code}`,
      code,
    }));

  if (student.cluster_codes.length === 0) {
    pendingMilestones.push({
      kind: "cluster",
      key: "cluster-pending",
      code: null,
    });
  }

  const anyCompleted = lessonMarks.some(
    (mark) => mark.kind === "lesson" && mark.completedOn,
  );
  if (!anyCompleted) {
    return [
      ...datedMarkers,
      ...lessonMarks,
      ...activeClusterMarks,
      ...pendingMilestones,
    ];
  }

  const marks: LessonTimelineVisualMark[] = [];
  let markerIndex = 0;
  const flushUntil = (date: string) => {
    while (
      markerIndex < datedMarkers.length &&
      datedMarkers[markerIndex].date <= date
    ) {
      marks.push(datedMarkers[markerIndex]);
      markerIndex += 1;
    }
  };

  for (const lesson of lessonMarks) {
    if (lesson.kind === "lesson" && lesson.completedOn) {
      flushUntil(lesson.completedOn);
    }
    marks.push(lesson);
  }
  while (markerIndex < datedMarkers.length) {
    marks.push(datedMarkers[markerIndex]);
    markerIndex += 1;
  }
  return [...marks, ...activeClusterMarks, ...pendingMilestones];
}
