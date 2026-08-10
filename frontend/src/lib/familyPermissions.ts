import type { User } from "@/src/lib/api";
import type { ModuleCoordinator } from "@/src/types/person";

type FamilyManageAuth = {
  isModuleCoordinator: (
    module: ModuleCoordinator["module"],
    level?: ModuleCoordinator["level"],
    resourceId?: number,
  ) => boolean;
  isSeniorCoordinator: (module?: ModuleCoordinator["module"]) => boolean;
};

/**
 * Who may create/update families (mirrors FamilyViewSet + HasModuleAccess CLUSTER).
 * Admin, Pastor, Cluster senior coordinator, or Cluster non-senior coordinator.
 * Excludes plain Members, Cluster Reporters, and other-module coordinators.
 */
export function canManageFamilies(
  user: User | null | undefined,
  auth: FamilyManageAuth,
): boolean {
  if (!user) return false;
  if (user.role === "ADMIN" || user.role === "PASTOR") return true;
  if (auth.isSeniorCoordinator("CLUSTER")) return true;
  if (auth.isModuleCoordinator("CLUSTER", "COORDINATOR")) return true;
  return false;
}
