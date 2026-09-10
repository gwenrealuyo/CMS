import {
  Lesson,
  LessonPersonSummary,
  LessonSessionReport,
  LessonStudentEnrollment,
  PersonLessonProgress,
  PersonProgressSummary,
} from "@/src/types/lesson";
import { isSelectablePerson } from "@/src/lib/peopleSelectors";

export type LessonPersonLike = {
  id?: string | number;
  first_name?: string;
  middle_name?: string;
  last_name?: string;
  suffix?: string;
  username: string;
  role?: string | null;
  branch?: number | string | null;
  branch_id?: number | string | null;
};

export const NCC_TEACHER_ROSTER_EMPTY_MESSAGE =
  "No other teachers on this branch's NCC / Lessons roster. Add them under Ministries.";

export function personBranchId(
  person: { branch?: number | string | null; branch_id?: number | string | null } | null | undefined,
): string | null {
  if (person == null) {
    return null;
  }
  const value = person.branch ?? person.branch_id;
  if (value == null || value === "") {
    return null;
  }
  return String(value);
}

/** Matches lesson session / enrollment teacher pickers (excludes VISITOR and ADMIN). */
export function isLessonTeacherCandidate(
  person: Pick<LessonPersonLike, "role" | "username">,
): boolean {
  const role = (person.role || "").toUpperCase();
  return role !== "VISITOR" && isSelectablePerson(person);
}

export type SessionFilterValues = {
  teacherId: string;
  studentId: string;
  lessonId: string;
  month: string;
  year: string;
};

export function getDefaultSessionMonthYear(): { month: string; year: string } {
  const now = new Date();
  return {
    month: String(now.getMonth() + 1),
    year: String(now.getFullYear()),
  };
}

export const createDefaultSessionFilters = (): SessionFilterValues => {
  const { month, year } = getDefaultSessionMonthYear();
  return {
    teacherId: "",
    studentId: "",
    lessonId: "",
    month,
    year,
  };
};

/** @deprecated Use createDefaultSessionFilters */
export const createEmptySessionFilters = createDefaultSessionFilters;

export function hasNonDefaultSessionDateFilters(
  filters: SessionFilterValues
): boolean {
  const { month: defaultMonth, year: defaultYear } = getDefaultSessionMonthYear();
  if (!filters.month || !filters.year) {
    return true;
  }
  return filters.month !== defaultMonth || filters.year !== defaultYear;
}

export function sanitizeNumericValue(value: unknown): number | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }
  const num = Number(value);
  return Number.isNaN(num) ? undefined : num;
}

export function escapeCsvValue(
  value: string | number | null | undefined
): string {
  if (value === null || value === undefined) {
    return "";
  }
  const stringValue = String(value);
  const needsEscaping = /[",\n]/.test(stringValue);
  const sanitized = stringValue.replace(/"/g, '""');
  return needsEscaping ? `"${sanitized}"` : stringValue;
}

export function extractErrorMessage(
  error: unknown,
  defaultMessage: string
): string {
  if (error && typeof error === "object") {
    if ("response" in error && error.response) {
      const response = error.response as {
        data?: {
          detail?: string;
          message?: string;
          details?: Record<string, unknown>;
        };
      };
      if (response.data?.detail) {
        return response.data.detail;
      }
      if (response.data?.message && response.data.message !== "Invalid request") {
        return response.data.message;
      }
      const details = response.data?.details;
      if (details && typeof details === "object") {
        for (const value of Object.values(details)) {
          if (typeof value === "string" && value.trim()) {
            return value;
          }
          if (Array.isArray(value) && typeof value[0] === "string" && value[0].trim()) {
            return value[0];
          }
        }
      }
      if (response.data?.message) {
        return response.data.message;
      }
    }
    if ("message" in error && typeof error.message === "string") {
      return error.message;
    }
  }
  return defaultMessage;
}

export function groupProgressByPerson(
  progress: PersonLessonProgress[],
  allLessons: Lesson[]
): PersonProgressSummary[] {
  // Group progress by person
  const progressByPerson = new Map<number, PersonLessonProgress[]>();

  for (const record of progress) {
    if (!record.person) continue;
    const personId = record.person.id;
    if (!progressByPerson.has(personId)) {
      progressByPerson.set(personId, []);
    }
    progressByPerson.get(personId)!.push(record);
  }

  // Calculate summary for each person
  const summaries: PersonProgressSummary[] = [];

  progressByPerson.forEach((personProgress) => {
    const person = personProgress[0].person!;
    const summary = calculatePersonProgress(person, personProgress, allLessons);
    summaries.push(summary);
  });

  return summaries;
}

export function calculatePersonProgress(
  person: LessonPersonSummary,
  personProgress: PersonLessonProgress[],
  allLessons: Lesson[]
): PersonProgressSummary {
  // Get active latest lessons only
  const activeLatestLessons = allLessons
    .filter((lesson) => lesson.is_latest && lesson.is_active)
    .sort((a, b) => a.order - b.order);

  const totalLessons = activeLatestLessons.length;

  // Find previous lesson (highest order COMPLETED)
  const completedLessonsByOrder = personProgress
    .filter((p) => p.status === "COMPLETED")
    .map((p) => p.lesson)
    .sort((a, b) => b.order - a.order);
  const previousLesson =
    completedLessonsByOrder.length > 0 ? completedLessonsByOrder[0] : null;

  // Count completed lessons
  const completedCount = personProgress.filter(
    (p) => p.status === "COMPLETED"
  ).length;

  // Find next lesson (first lesson in order that's not completed)
  const completedLessonIds = new Set(
    personProgress
      .filter((p) => p.status === "COMPLETED")
      .map((p) => p.lesson.id)
  );

  const nextLesson =
    activeLatestLessons.find((lesson) => !completedLessonIds.has(lesson.id)) ||
    null;

  // Calculate progress percentage
  const progressPercentage =
    totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0;

  return {
    person,
    previousLesson,
    completedCount,
    totalLessons,
    nextLesson,
    progressPercentage,
    allProgress: personProgress,
  };
}

export function buildStudentTeacherMapFromEnrollments(
  enrollments: LessonStudentEnrollment[],
): Map<number, LessonPersonSummary> {
  const map = new Map<number, LessonPersonSummary>();
  for (const enrollment of enrollments) {
    if (enrollment.is_active && enrollment.student?.id && enrollment.teacher) {
      map.set(enrollment.student.id, enrollment.teacher);
    }
  }
  return map;
}

/** Label for enrollment teacher, including former/unknown historical names. */
export function enrollmentTeacherLabel(
  enrollment:
    | Pick<
        LessonStudentEnrollment,
        | "teacher"
        | "teacher_display_name"
        | "historical_teacher_first_name"
        | "historical_teacher_last_name"
      >
    | null
    | undefined,
  formatName: (person: LessonPersonSummary) => string = (p) =>
    [p.first_name, p.last_name].filter(Boolean).join(" ").trim() ||
    p.username ||
    "Teacher",
): string {
  if (!enrollment) return "No teacher";
  if (enrollment.teacher) {
    return formatName(enrollment.teacher);
  }
  if (enrollment.teacher_display_name?.trim()) {
    return enrollment.teacher_display_name.trim();
  }
  const historical = [
    enrollment.historical_teacher_first_name,
    enrollment.historical_teacher_last_name,
  ]
    .filter(Boolean)
    .join(" ")
    .trim();
  return historical || "Former / unknown teacher";
}

export function enrollmentByStudentId(
  enrollments: LessonStudentEnrollment[],
): Map<number, LessonStudentEnrollment> {
  const map = new Map<number, LessonStudentEnrollment>();
  for (const enrollment of enrollments) {
    if (enrollment.student?.id) {
      map.set(enrollment.student.id, enrollment);
    }
  }
  return map;
}

export function parseTimestampMs(value?: string | null): number {
  if (!value) {
    return 0;
  }
  const ms = new Date(value).getTime();
  return Number.isNaN(ms) ? 0 : ms;
}

export function buildLatestSessionAtByStudent(
  reports: LessonSessionReport[],
): Map<number, string> {
  const map = new Map<number, string>();
  for (const report of reports) {
    const studentId = report.student?.id;
    if (studentId == null) {
      continue;
    }
    const iso = report.session_start || report.session_date;
    const ms = parseTimestampMs(iso);
    if (!ms) {
      continue;
    }
    if (ms > parseTimestampMs(map.get(studentId))) {
      map.set(studentId, iso);
    }
  }
  return map;
}

export function getPersonLastActivityIso(
  summary: PersonProgressSummary,
  enrollment: LessonStudentEnrollment | undefined,
  latestSessionIso: string | undefined,
): string | null {
  const candidates: Array<string | null | undefined> = [
    enrollment?.assigned_at,
    latestSessionIso,
    ...summary.allProgress.map((record) => record.assigned_at),
  ];

  let bestIso: string | null = null;
  let bestMs = 0;
  for (const candidate of candidates) {
    const ms = parseTimestampMs(candidate);
    if (ms > bestMs) {
      bestMs = ms;
      bestIso = candidate ?? null;
    }
  }
  return bestIso;
}

/**
 * Build a browser-reachable media URL for the commitment PDF.
 * Prefers the API origin from NEXT_PUBLIC_API_URL so view/download still work
 * when Django's build_absolute_uri() returns an internal or wrong host.
 */
export function resolveCommitmentFormUrl(
  url: string | null | undefined,
): string {
  if (!url) return "";
  const apiBase =
    process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";
  try {
    const apiOrigin = new URL(apiBase).origin;
    const parsed = new URL(url, apiOrigin);
    const mediaIndex = parsed.pathname.indexOf("/media/");
    if (mediaIndex >= 0) {
      return `${apiOrigin}${parsed.pathname.slice(mediaIndex)}${parsed.search}`;
    }
    if (parsed.pathname.startsWith("media/")) {
      return `${apiOrigin}/${parsed.pathname}${parsed.search}`;
    }
    return parsed.href;
  } catch {
    return url;
  }
}
