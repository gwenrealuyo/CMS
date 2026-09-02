import { User } from "@/src/lib/api";
import { ModuleCoordinator } from "@/src/types/person";
import { ModuleType } from "@/src/types/moduleSettings";
import { isAdminPerson } from "@/src/lib/peopleSelectors";

const EVANGELISM_WRITE_LEVELS: ModuleCoordinator["level"][] = [
  "COORDINATOR",
  "SENIOR_COORDINATOR",
  "TEACHER",
  "BIBLE_SHARER",
];

export type CanWriteEvangelismContext = {
  user: User | null;
  moduleEnabled?: Partial<Record<ModuleType, boolean>>;
};

/** Matches backend HasModuleAccess("EVANGELISM", "write") for create/update actions. */
export function canWriteEvangelism({
  user,
  moduleEnabled,
}: CanWriteEvangelismContext): boolean {
  if (!user) return false;

  if (user.role === "ADMIN") return true;

  if (moduleEnabled?.EVANGELISM === false) return false;

  if (user.role === "PASTOR") return true;

  const assignments =
    user.module_coordinator_assignments?.filter(
      (assignment) => assignment.module === "EVANGELISM"
    ) ?? [];

  return assignments.some((assignment) =>
    EVANGELISM_WRITE_LEVELS.includes(assignment.level)
  );
}

/** Branch-wide Prospects tab: admins, pastors, and cluster/evangelism senior coordinators. */
export function canBrowseProspects({
  user,
  isSeniorCoordinator,
}: {
  user: User | null;
  isSeniorCoordinator: (module?: ModuleCoordinator["module"]) => boolean;
}): boolean {
  if (!user) return false;
  if (isAdminPerson(user) || user.role === "PASTOR") return true;
  return (
    isSeniorCoordinator("CLUSTER") || isSeniorCoordinator("EVANGELISM")
  );
}
