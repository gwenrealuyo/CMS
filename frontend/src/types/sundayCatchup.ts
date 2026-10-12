export type SundayCatchupReason =
  | "REPLAY"
  | "TIMEZONE"
  | "FORGOT_CHECKIN"
  | "OTHER";

export interface SundayCatchupAttendance {
  id: number;
  status: string;
  attendance_mode: "ONSITE" | "ONLINE";
  catchup_reason: string;
  catchup_note: string;
  recorded_at: string;
  recorded_by_name: string | null;
  can_remove: boolean;
}

export interface SundayCatchupRosterRow {
  person_id: number;
  name: string;
  member_id: string;
  status: string;
  attendance: SundayCatchupAttendance | null;
}

export interface SundayCatchupPayload {
  available: boolean;
  window_open: boolean;
  window_closes_on: string | null;
  writes_enabled: boolean;
  read_only_reason: "window_closed" | "onsite_only" | null;
  event: {
    id: number;
    title: string;
    attendance_format: string;
  } | null;
  occurrence_date: string | null;
  roster: SundayCatchupRosterRow[];
}

export const SUNDAY_CATCHUP_REASONS: { value: SundayCatchupReason; label: string }[] =
  [
    { value: "REPLAY", label: "Watched the replay" },
    { value: "TIMEZONE", label: "Another timezone" },
    { value: "FORGOT_CHECKIN", label: "Forgot to check in" },
    { value: "OTHER", label: "Other" },
  ];

export function sundayCatchupReasonLabel(
  reason: string,
  note?: string,
): string {
  if (reason === "OTHER") return (note || "").trim() || "Other";
  return (
    SUNDAY_CATCHUP_REASONS.find((item) => item.value === reason)?.label || reason
  );
}
