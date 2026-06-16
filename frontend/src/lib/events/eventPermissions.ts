import { User } from "@/src/lib/api";
import { ModuleCoordinator } from "@/src/types/person";
import { ModuleType } from "@/src/types/moduleSettings";

const EVENTS_WRITE_LEVELS: ModuleCoordinator["level"][] = [
  "COORDINATOR",
  "SENIOR_COORDINATOR",
  "TEACHER",
  "BIBLE_SHARER",
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
