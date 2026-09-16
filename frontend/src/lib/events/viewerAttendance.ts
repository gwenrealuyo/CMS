import {
  AttendanceMode,
  Event,
  EventAttendanceRecord,
} from "@/src/types/event";
import { toDateKey } from "@/src/lib/events/recurrenceScope";

export function occurrenceDateKey(value: string): string {
  return toDateKey(value);
}

export function recordsForOccurrence(
  records: EventAttendanceRecord[] | undefined,
  occurrenceDate: string | null | undefined,
): EventAttendanceRecord[] {
  if (!occurrenceDate) {
    return records ?? [];
  }
  const dateKey = occurrenceDateKey(occurrenceDate);
  return (records ?? []).filter((record) => record.occurrence_date === dateKey);
}

export type ViewerAttendance = {
  count: number;
  present: boolean;
  mode: AttendanceMode | null;
};

export function viewerAttendanceForOccurrence(
  event: Pick<Event, "attendance_records"> | null | undefined,
  userId: number | string | null | undefined,
  occurrenceDate: string | null | undefined,
): ViewerAttendance {
  const records = recordsForOccurrence(
    event?.attendance_records,
    occurrenceDate,
  );
  if (userId == null || userId === "") {
    return { count: records.length, present: false, mode: null };
  }
  const viewerId = String(userId);
  const viewerRecord = records.find(
    (record) =>
      String(record.person.id) === viewerId && record.status === "PRESENT",
  );
  return {
    count: records.length,
    present: Boolean(viewerRecord),
    mode: viewerRecord
      ? viewerRecord.attendance_mode || "ONSITE"
      : null,
  };
}
