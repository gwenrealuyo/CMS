/** Client-side mirror of room-hold 24h / 15m lead-time rules. */

export const ROOM_HOLD_ADVANCE_MS = 24 * 60 * 60 * 1000;
export const ROOM_HOLD_LAST_MINUTE_BUFFER_MS = 15 * 60 * 1000;

export function isWithinRoomHoldAdvanceWindow(start: Date, now = new Date()): boolean {
  return start.getTime() < now.getTime() + ROOM_HOLD_ADVANCE_MS;
}

export function isBeforeLastMinuteBuffer(start: Date, now = new Date()): boolean {
  return start.getTime() < now.getTime() + ROOM_HOLD_LAST_MINUTE_BUFFER_MS;
}

export const LAST_MINUTE_ADMIN_NOTE =
  "Room holds should be booked at least 24 hours ahead. Within 24 hours you may only use the last-minute room (and must start at least 15 minutes from now). Contact church building administrators if you still need a different room.";
