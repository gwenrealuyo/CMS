import { User } from "@/src/lib/api";
import { ModuleCoordinator } from "@/src/types/person";
import { ModuleType } from "@/src/types/moduleSettings";
import { isAdminPerson } from "@/src/lib/peopleSelectors";

const EVANGELISM_MANAGE_LEVELS: ModuleCoordinator["level"][] = [
  "COORDINATOR",
  "SENIOR_COORDINATOR",
];

const EVANGELISM_REPORT_LEVELS: ModuleCoordinator["level"][] = [
  "COORDINATOR",
  "SENIOR_COORDINATOR",
  "BIBLE_SHARER",
  "REPORTER",
];

export type CanWriteEvangelismContext = {
  user: User | null;
  moduleEnabled?: Partial<Record<ModuleType, boolean>>;
};

/** Matches backend HasEvangelismGroupWrite for group create/update. */
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
    EVANGELISM_MANAGE_LEVELS.includes(assignment.level)
  );
}

export function canSubmitEvangelismReport({
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
    EVANGELISM_REPORT_LEVELS.includes(assignment.level)
  );
}

export function canWriteEvangelismRecords({
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
    ["COORDINATOR", "SENIOR_COORDINATOR", "BIBLE_SHARER"].includes(
      assignment.level,
    )
  );
}

export function assignedEvangelismGroupIds(
  user: User | null,
  levels: ModuleCoordinator["level"][] = EVANGELISM_REPORT_LEVELS,
): number[] {
  if (!user) return [];
  return (
    user.module_coordinator_assignments?.filter(
      (assignment) =>
        assignment.module === "EVANGELISM" &&
        levels.includes(assignment.level) &&
        assignment.resource_id != null,
    ) ?? []
  ).map((assignment) => Number(assignment.resource_id));
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
