import { LessonProgressStatus } from "@/src/types/lesson";
import { lessonProgressStatusLabel } from "@/src/lib/lessonsUtils";

export const lessonStatusChipStyles: Record<LessonProgressStatus, string> = {
  ASSIGNED: "bg-gray-100 text-gray-700",
  IN_PROGRESS: "bg-yellow-100 text-yellow-800",
  COMPLETED: "bg-green-100 text-green-700",
  SKIPPED: "bg-yellow-100 text-yellow-700",
};

export function lessonCountChipClass(
  tone: "assigned" | LessonProgressStatus,
): string {
  if (tone === "assigned") {
    return "bg-gray-100 text-gray-700";
  }
  return lessonStatusChipStyles[tone];
}

export function LessonCountChip({
  label,
  count,
  tone,
  countFirst = false,
}: {
  label: string;
  count: number;
  tone: "assigned" | LessonProgressStatus;
  countFirst?: boolean;
}) {
  const text = countFirst ? `${count} ${label}` : `${label} ${count}`;
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${lessonCountChipClass(tone)}`}
    >
      {text}
    </span>
  );
}

export function LessonStatusBadge({ status }: { status: LessonProgressStatus }) {
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${lessonStatusChipStyles[status]}`}
    >
      {lessonProgressStatusLabel(status)}
    </span>
  );
}
