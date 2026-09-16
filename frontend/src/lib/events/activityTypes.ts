import { EventTypeOption } from "@/src/types/event";

/** Ministry activities a person can have as first activity attended. */
export function isActivityEventType(
  type?: Pick<EventTypeOption, "counts_as_activity"> | null
): boolean {
  return type?.counts_as_activity !== false;
}

export function activityEventTypes<
  T extends Pick<EventTypeOption, "counts_as_activity">,
>(types: T[]): T[] {
  return types.filter(isActivityEventType);
}
