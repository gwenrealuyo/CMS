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

/** Levels that pass backend `allows_cluster_report_mutation_attempt` for CLUSTER module. */
const CLUSTER_WEEKLY_REPORT_MUTATION_LEVELS: ModuleCoordinator["level"][] = [
  "COORDINATOR",
  "SENIOR_COORDINATOR",
  "REPORTER",
  "TEACHER",
  "BIBLE_SHARER",
];

/**
 * Reporter resource IDs from module_coordinator_assignments.
 */
export function reporterClusterIdsFromAssignments(
  assignments: ModuleCoordinator[] | undefined,
): number[] {
  if (!assignments?.length) return [];
  return assignments
    .filter(
      (a) =>
        a.module === "CLUSTER" &&
        a.level === "REPORTER" &&
        a.resource_id != null,
    )
    .map((a) => Number(a.resource_id));
}

/**
 * True when user has CLUSTER Reporter and no coordinator/FK/senior cluster leadership.
 */
export function isClusterReporterOnly(
  auth: ManageClusterAuth & { moduleCoordinatorAssignments?: ModuleCoordinator[] },
): boolean {
  const { role, isSeniorCoordinator, isModuleCoordinator, userId } = auth;
  if (!userId) return false;
  if (role === "ADMIN" || role === "PASTOR") return false;
  if (isSeniorCoordinator("CLUSTER")) return false;
  if (isModuleCoordinator("CLUSTER", "COORDINATOR")) return false;
  const assignments = auth.moduleCoordinatorAssignments ?? [];
  const hasReporter = assignments.some(
    (a) => a.module === "CLUSTER" && a.level === "REPORTER",
  );
  if (!hasReporter) return false;
  return !isModuleCoordinator("CLUSTER", "COORDINATOR");
}

/**
 * Mirrors backend `allows_cluster_report_mutation_attempt`.
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

/** Mirrors backend `user_can_submit_cluster_report`. */
export function userCanSubmitClusterReport(
  cluster: Cluster,
  auth: ManageClusterAuth & { moduleCoordinatorAssignments?: ModuleCoordinator[] },
): boolean {
  if (userCanManageCluster(cluster, auth)) return true;
  const clusterId = Number(cluster.id);
  const reporterIds = reporterClusterIdsFromAssignments(
    auth.moduleCoordinatorAssignments,
  );
  return reporterIds.includes(clusterId);
}

/** Clusters the user may submit reports for (coordinator manage + reporter assignments). */
export function clustersForReportSubmission(
  allClusters: Cluster[],
  auth: ManageClusterAuth & { moduleCoordinatorAssignments?: ModuleCoordinator[] },
): Cluster[] {
  const reporterIds = new Set(
    reporterClusterIdsFromAssignments(auth.moduleCoordinatorAssignments),
  );
  return allClusters.filter(
    (c) =>
      userCanManageCluster(c, auth) || reporterIds.has(Number(c.id)),
  );
}

/**
 * Who may view the cluster weekly reports tab and list/read report APIs.
 * Mirrors backend `can_access_cluster_reports`.
 */
export function canAccessClusterReports(
  auth: ManageClusterAuth & { moduleCoordinatorAssignments?: ModuleCoordinator[] },
  allClusters: Cluster[] = [],
): boolean {
  const { userId, role, isSeniorCoordinator, isModuleCoordinator } = auth;
  if (!userId) return false;
  if (role === "ADMIN" || role === "PASTOR") return true;
  if (isSeniorCoordinator("CLUSTER")) return true;
  if (isModuleCoordinator("CLUSTER", "COORDINATOR")) return true;
  const assignments = auth.moduleCoordinatorAssignments ?? [];
  if (
    assignments.some(
      (a) => a.module === "CLUSTER" && a.level === "REPORTER",
    )
  ) {
    return true;
  }
  return allClusters.some((c) => {
    const cid = c.coordinator?.id ?? c.coordinator_id ?? undefined;
    return cid != null && Number(cid) === Number(userId);
  });
}

/**
 * Who may edit vital milestone dates (invited/attended/baptism/lessons).
 * Mirrors backend `user_can_edit_vital_dates`.
 */
export function userCanEditVitalDates(
  personClusterIds: Array<string | number>,
  clusters: Cluster[],
  auth: ManageClusterAuth
): boolean {
  const { userId, role, isSeniorCoordinator } = auth;
  if (!userId) return false;
  if (role === "ADMIN" || role === "PASTOR") return true;
  if (isSeniorCoordinator("CLUSTER")) return true;
  const idSet = new Set(personClusterIds.map((id) => Number(id)));
  return clusters.some(
    (c) => idSet.has(Number(c.id)) && userCanManageCluster(c, auth)
  );
}

/**
 * On create, person has no membership yet — allow ADMIN/PASTOR/CLUSTER senior
 * or any CLUSTER COORDINATOR assignment.
 */
export function userCanEditVitalDatesOnCreate(auth: ManageClusterAuth): boolean {
  const { userId, role, isSeniorCoordinator, isModuleCoordinator } = auth;
  if (!userId) return false;
  if (role === "ADMIN" || role === "PASTOR") return true;
  if (isSeniorCoordinator("CLUSTER")) return true;
  return isModuleCoordinator("CLUSTER", "COORDINATOR");
}
