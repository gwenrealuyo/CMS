import { Event, EventTypeOption } from "@/src/types/event";

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

/** Room booking / meeting-only mode (door attendance allowed; no self-check-in). */
export function isRoomHoldEvent(
  event?: Pick<Event, "is_room_hold" | "type"> | null
): boolean {
  if (!event) return false;
  if (event.is_room_hold === true) return true;
  // Legacy fallback before API clients always send is_room_hold.
  return event.type === "MEETING";
}
