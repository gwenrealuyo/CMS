export const NOTIFICATIONS_REFETCH_EVENT = "cms-notifications-refetch";

export function requestNotificationsRefetch(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(NOTIFICATIONS_REFETCH_EVENT));
  }
}
