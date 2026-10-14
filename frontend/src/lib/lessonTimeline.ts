import {
  LessonTimelineCatalogLesson,
  LessonTimelineStudent,
} from "@/src/types/lesson";

export function formatLessonGapLabel(
  row: Pick<LessonTimelineStudent, "days_since_last_session" | "days_anchor">,
): string {
  const days = row.days_since_last_session;
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

export function lessonGapTone(
  row: Pick<LessonTimelineStudent, "days_since_last_session" | "days_anchor">,
): string {
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
      date: string;
    }
  | {
      kind: "spirit";
      key: string;
      date: string;
    }
  | {
      kind: "cluster";
      key: string;
      code: string;
    };

export function buildTimelineMarks(
  catalog: LessonTimelineCatalogLesson[],
  student: LessonTimelineStudent,
): LessonTimelineVisualMark[] {
  const progressByLesson = new Map(
    student.lessons.map((lesson) => [lesson.lesson_id, lesson]),
  );
  const markers: Array<{ kind: "baptism" | "spirit"; date: string; key: string }> = [];
  if (student.water_baptism_date) {
    markers.push({
      kind: "baptism",
      date: student.water_baptism_date,
      key: `baptism-${student.water_baptism_date}`,
    });
  }
  if (student.spirit_baptism_date) {
    markers.push({
      kind: "spirit",
      date: student.spirit_baptism_date,
      key: `spirit-${student.spirit_baptism_date}`,
    });
  }
  markers.sort((first, second) => first.date.localeCompare(second.date));

  const lessonMarks: LessonTimelineVisualMark[] = catalog.map((lesson) => ({
    kind: "lesson",
    key: `lesson-${lesson.id}`,
    title: lesson.title,
    completedOn: progressByLesson.get(lesson.id)?.completed_on ?? null,
    status: progressByLesson.get(lesson.id)?.status ?? null,
  }));

  const clusterMarks: LessonTimelineVisualMark[] = student.cluster_codes.map(
    (code) => ({
      kind: "cluster",
      key: `cluster-${code}`,
      code,
    }),
  );
  const anyCompleted = lessonMarks.some(
    (mark) => mark.kind === "lesson" && mark.completedOn,
  );
  if (!anyCompleted) {
    return [...markers, ...lessonMarks, ...clusterMarks];
  }

  const marks: LessonTimelineVisualMark[] = [];
  let markerIndex = 0;
  const flushUntil = (date: string) => {
    while (markerIndex < markers.length && markers[markerIndex].date <= date) {
      marks.push(markers[markerIndex]);
      markerIndex += 1;
    }
  };

  for (const lesson of lessonMarks) {
    if (lesson.kind === "lesson" && lesson.completedOn) {
      flushUntil(lesson.completedOn);
    }
    marks.push(lesson);
  }
  while (markerIndex < markers.length) {
    marks.push(markers[markerIndex]);
    markerIndex += 1;
  }
  return [...marks, ...clusterMarks];
}
