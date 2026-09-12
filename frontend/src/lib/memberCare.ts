import type {
  MemberCareCaseStatus,
  MemberCareRecommendedAction,
} from "@/src/types/person";

export const MEMBER_CARE_ACTION_OPTIONS: Array<{
  value: MemberCareRecommendedAction;
  label: string;
}> = [
  { value: "", label: "Not set" },
  {
    value: "FOLLOW_UP_MONITOR",
    label: "Follow up and monitor progress",
  },
  { value: "VISITATION", label: "Visitation and follow up" },
  { value: "NO_ACTION", label: "No action for now" },
  { value: "OTHER", label: "Other" },
];

export const MEMBER_CARE_STATUS_OPTIONS: Array<{
  value: MemberCareCaseStatus;
  label: string;
}> = [
  { value: "OPEN", label: "Open" },
  { value: "IN_PROGRESS", label: "In progress" },
  { value: "NO_ACTION", label: "No action" },
  { value: "COMPLETED", label: "Completed" },
  { value: "RECOVERED", label: "Recovered" },
];

export function memberCareActionLabel(
  action: MemberCareRecommendedAction | string | null | undefined,
  other?: string | null,
): string {
  if (action === "OTHER") {
    const custom = (other || "").trim();
    return custom || "Other";
  }
  const match = MEMBER_CARE_ACTION_OPTIONS.find((o) => o.value === action);
  return match?.label && match.value ? match.label : "—";
}
