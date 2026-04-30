import type { Cluster } from "@/src/types/cluster";
import type { ModuleCoordinator } from "@/src/types/person";

type ManageClusterAuth = {
  userId: number | string | undefined;
  role: string | undefined;
  isSeniorCoordinator: (module?: ModuleCoordinator["module"]) => boolean;
  isModuleCoordinator: (
    module: ModuleCoordinator["module"],
    level?: ModuleCoordinator["level"],
    resourceId?: number,
  ) => boolean;
};

/** Levels that pass backend `allows_cluster_mutation_attempt` for CLUSTER module. */
const CLUSTER_WEEKLY_REPORT_MUTATION_LEVELS: ModuleCoordinator["level"][] = [
  "COORDINATOR",
  "SENIOR_COORDINATOR",
  "TEACHER",
  "BIBLE_SHARER",
];

/**
 * Mirrors backend `allows_cluster_mutation_attempt` (cluster + weekly report mutations).
 */
export function userCanAttemptClusterWeeklyReportMutation(
  clusters: Cluster[],
  auth: ManageClusterAuth,
): boolean {
  const { userId, role, isSeniorCoordinator, isModuleCoordinator } = auth;
  if (!userId) return false;
  if (role === "ADMIN" || role === "PASTOR") return true;
  if (isSeniorCoordinator("CLUSTER")) return true;
  for (const level of CLUSTER_WEEKLY_REPORT_MUTATION_LEVELS) {
    if (isModuleCoordinator("CLUSTER", level)) return true;
  }
  return clusters.some((c) => {
    const cid = c.coordinator?.id ?? c.coordinator_id ?? undefined;
    return cid != null && Number(cid) === Number(userId);
  });
}

/** Mirrors backend `user_manages_cluster` plus ADMIN/PASTOR/senior CLUSTER bypass. */
export function userCanManageCluster(
  cluster: Cluster,
  auth: ManageClusterAuth,
): boolean {
  const { userId, role, isSeniorCoordinator, isModuleCoordinator } = auth;
  if (!userId) return false;
  if (role === "ADMIN" || role === "PASTOR") return true;
  if (isSeniorCoordinator("CLUSTER")) return true;
  const cid =
    cluster.coordinator?.id ?? cluster.coordinator_id ?? undefined;
  if (cid != null && Number(cid) === Number(userId)) return true;
  return isModuleCoordinator("CLUSTER", "COORDINATOR", cluster.id);
}
