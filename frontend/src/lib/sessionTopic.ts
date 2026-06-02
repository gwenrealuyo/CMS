export type LessonSessionType = "LESSON" | "PRE_LESSON";

export type PreLessonKind = "INTRODUCTION" | "OTHER";

export const PRE_LESSON_TOPIC_PREFIX = "pre:" as const;
export const LESSON_TOPIC_PREFIX = "lesson:" as const;

export const DEFAULT_SESSION_TOPIC = `${PRE_LESSON_TOPIC_PREFIX}INTRODUCTION`;

export const PRE_LESSON_KIND_OPTIONS: {
  value: `${typeof PRE_LESSON_TOPIC_PREFIX}${PreLessonKind}`;
  label: string;
}[] = [
  {
    value: `${PRE_LESSON_TOPIC_PREFIX}INTRODUCTION`,
    label: "Introduction (not counted)",
  },
  {
    value: `${PRE_LESSON_TOPIC_PREFIX}OTHER`,
    label: "Other — before lessons (not counted)",
  },
];

export function formatSessionTopicLabel(
  sessionType?: LessonSessionType | null,
  preLessonKind?: PreLessonKind | null,
  lessonTitle?: string | null
): string {
  if (sessionType === "PRE_LESSON" && preLessonKind) {
    const match = PRE_LESSON_KIND_OPTIONS.find(
      (option) => option.value === `${PRE_LESSON_TOPIC_PREFIX}${preLessonKind}`
    );
    return match?.label ?? "Pre-lesson (not counted)";
  }
  if (lessonTitle) {
    return lessonTitle;
  }
  return "Unassigned";
}

export function sessionTopicFromReport(report: {
  session_type?: LessonSessionType | null;
  pre_lesson_kind?: PreLessonKind | null;
  lesson?: { id: number } | null;
}): string {
  if (report.session_type === "PRE_LESSON" && report.pre_lesson_kind) {
    return `${PRE_LESSON_TOPIC_PREFIX}${report.pre_lesson_kind}`;
  }
  if (report.lesson?.id != null) {
    return `${LESSON_TOPIC_PREFIX}${report.lesson.id}`;
  }
  return DEFAULT_SESSION_TOPIC;
}

export function parseSessionTopicValue(value: string): {
  sessionType: LessonSessionType;
  preLessonKind?: PreLessonKind;
  lessonId?: number;
} {
  if (value.startsWith(PRE_LESSON_TOPIC_PREFIX)) {
    const kind = value.slice(PRE_LESSON_TOPIC_PREFIX.length) as PreLessonKind;
    return { sessionType: "PRE_LESSON", preLessonKind: kind };
  }
  if (value.startsWith(LESSON_TOPIC_PREFIX)) {
    const lessonId = Number(value.slice(LESSON_TOPIC_PREFIX.length));
    return { sessionType: "LESSON", lessonId };
  }
  return { sessionType: "LESSON", lessonId: Number(value) };
}
