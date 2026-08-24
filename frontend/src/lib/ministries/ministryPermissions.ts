import { User } from "@/src/lib/api";
import { ModuleCoordinator } from "@/src/types/person";
import { ModuleType } from "@/src/types/moduleSettings";

const MINISTRIES_WRITE_LEVELS: ModuleCoordinator["level"][] = [
  "COORDINATOR",
  "SENIOR_COORDINATOR",
  "TEACHER",
  "BIBLE_SHARER",
];

export type CanWriteMinistriesContext = {
  user: User | null;
  moduleEnabled?: Partial<Record<ModuleType, boolean>>;
};

/** Matches backend HasModuleAccess("MINISTRIES", "write") for create/update actions. */
export function canWriteMinistries({
  user,
  moduleEnabled,
}: CanWriteMinistriesContext): boolean {
  if (!user) return false;

  if (user.role === "ADMIN") return true;

  if (moduleEnabled?.MINISTRIES === false) return false;

  if (user.role === "PASTOR") return true;

  const assignments =
    user.module_coordinator_assignments?.filter(
      (assignment) => assignment.module === "MINISTRIES"
    ) ?? [];

  return assignments.some((assignment) =>
    MINISTRIES_WRITE_LEVELS.includes(assignment.level)
  );
}
