import { User } from "@/src/lib/api";
import { ModuleCoordinator } from "@/src/types/person";
import { ModuleType } from "@/src/types/moduleSettings";

const EVENTS_WRITE_LEVELS: ModuleCoordinator["level"][] = [
  "COORDINATOR",
  "SENIOR_COORDINATOR",
];

const EVENTS_ROOM_MANAGE_LEVELS: ModuleCoordinator["level"][] = [
  "COORDINATOR",
  "SENIOR_COORDINATOR",
];

const REQUEST_BOOKING_LEVELS: ModuleCoordinator["level"][] = [
  "COORDINATOR",
  "SENIOR_COORDINATOR",
];

const NON_EVENTS_MODULES: ModuleCoordinator["module"][] = [
  "CLUSTER",
  "FINANCE",
  "EVANGELISM",
  "SUNDAY_SCHOOL",
  "LESSONS",
  "MINISTRIES",
];

export type CanWriteEventsContext = {
  user: User | null;
  moduleEnabled?: Partial<Record<ModuleType, boolean>>;
};

/** Matches backend HasModuleAccess("EVENTS", "write") for create/update actions. */
export function canWriteEvents({
  user,
  moduleEnabled,
}: CanWriteEventsContext): boolean {
  if (!user) return false;

  if (user.role === "ADMIN") return true;

  if (moduleEnabled?.EVENTS === false) return false;

  if (user.role === "PASTOR") return true;

  const assignments =
    user.module_coordinator_assignments?.filter(
      (assignment) => assignment.module === "EVENTS"
    ) ?? [];

  return assignments.some((assignment) =>
    EVENTS_WRITE_LEVELS.includes(assignment.level)
  );
}

/** ADMIN, PASTOR, and Events COORDINATOR / SENIOR_COORDINATOR. */
export function canManageEventRooms({
  user,
  moduleEnabled,
}: CanWriteEventsContext): boolean {
  if (!user) return false;

  if (user.role === "ADMIN") return true;

  if (moduleEnabled?.EVENTS === false) return false;

  if (user.role === "PASTOR") return true;

  const assignments =
    user.module_coordinator_assignments?.filter(
      (assignment) => assignment.module === "EVENTS"
    ) ?? [];

  return assignments.some((assignment) =>
    EVENTS_ROOM_MANAGE_LEVELS.includes(assignment.level)
  );
}

/** ADMIN, PASTOR, and Events COORDINATOR / SENIOR_COORDINATOR. */
export function canApproveEventBooking(ctx: CanWriteEventsContext): boolean {
  return canManageEventRooms(ctx);
}

/** Coordinator / Senior Coordinator of a non-Events module. */
export function canRequestEventBooking({
  user,
  moduleEnabled,
}: CanWriteEventsContext): boolean {
  if (!user) return false;
  if (canManageEventRooms({ user, moduleEnabled })) return false;
  if (moduleEnabled?.EVENTS === false) return false;

  const assignments = user.module_coordinator_assignments ?? [];
  return assignments.some(
    (assignment) =>
      NON_EVENTS_MODULES.includes(assignment.module) &&
      REQUEST_BOOKING_LEVELS.includes(assignment.level)
  );
}

export function canCreateEvent(ctx: CanWriteEventsContext): boolean {
  return canWriteEvents(ctx) || canRequestEventBooking(ctx);
}
