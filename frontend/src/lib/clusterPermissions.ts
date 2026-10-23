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
  clusterCommitteeRole?: "PRIMARY" | "SUPPORT" | null;
};

function hasClusterOversight(auth: ManageClusterAuth): boolean {
  if (auth.isSeniorCoordinator("CLUSTER")) return true;
  return (
    auth.clusterCommitteeRole === "PRIMARY" ||
    auth.clusterCommitteeRole === "SUPPORT"
  );
}

/** HQ all-branch Cluster picker: Admin, Pastor, HQ Senior, or HQ Committee Primary. */
export function userCanPickClusterBranch(user: {
  role?: string;
  branch_is_headquarters?: boolean;
  cluster_committee_primary_at_headquarters?: boolean;
} | null | undefined, isSeniorCoordinator: (module?: ModuleCoordinator["module"]) => boolean): boolean {
  if (!user) return false;
  if (user.role === "ADMIN" || user.role === "PASTOR") return true;
  if (isSeniorCoordinator("CLUSTER") && user.branch_is_headquarters) return true;
  return Boolean(user.cluster_committee_primary_at_headquarters);
}

/** Levels that pass backend `allows_cluster_report_mutation_attempt` for CLUSTER module. */
const CLUSTER_WEEKLY_REPORT_MUTATION_LEVELS: ModuleCoordinator["level"][] = [
  "COORDINATOR",
  "ASSISTANT_COORDINATOR",
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
 * Assistant resource IDs from module_coordinator_assignments.
 */
export function assistantClusterIdsFromAssignments(
  assignments: ModuleCoordinator[] | undefined,
): number[] {
  if (!assignments?.length) return [];
  return assignments
    .filter(
      (a) =>
        a.module === "CLUSTER" &&
        a.level === "ASSISTANT_COORDINATOR" &&
        a.resource_id != null,
    )
    .map((a) => Number(a.resource_id));
}

function isNamedOrAssignedCoordinator(
  cluster: Cluster,
  auth: ManageClusterAuth,
): boolean {
  const { userId, isModuleCoordinator } = auth;
  if (!userId) return false;
  const cid = cluster.coordinator?.id ?? cluster.coordinator_id ?? undefined;
  if (cid != null && Number(cid) === Number(userId)) return true;
  return isModuleCoordinator("CLUSTER", "COORDINATOR", Number(cluster.id));
}

/**
 * True when user has CLUSTER Reporter and no coordinator/assistant/FK/senior leadership.
 */
export function isClusterReporterOnly(
  auth: ManageClusterAuth & { moduleCoordinatorAssignments?: ModuleCoordinator[] },
): boolean {
  const { role, isModuleCoordinator, userId } = auth;
  if (!userId) return false;
  if (role === "ADMIN" || role === "PASTOR") return false;
  if (hasClusterOversight(auth)) return false;
  if (isModuleCoordinator("CLUSTER", "COORDINATOR")) return false;
  if (isModuleCoordinator("CLUSTER", "ASSISTANT_COORDINATOR")) return false;
  const assignments = auth.moduleCoordinatorAssignments ?? [];
  const hasReporter = assignments.some(
    (a) => a.module === "CLUSTER" && a.level === "REPORTER",
  );
  if (!hasReporter) return false;
  return true;
}

/**
 * Mirrors backend `allows_cluster_report_mutation_attempt`.
 */
export function userCanAttemptClusterWeeklyReportMutation(
  clusters: Cluster[],
  auth: ManageClusterAuth,
): boolean {
  const { userId, role, isModuleCoordinator } = auth;
  if (!userId) return false;
  if (role === "ADMIN" || role === "PASTOR") return true;
  if (hasClusterOversight(auth)) return true;
  for (const level of CLUSTER_WEEKLY_REPORT_MUTATION_LEVELS) {
    if (isModuleCoordinator("CLUSTER", level)) return true;
  }
  return clusters.some((c) => {
    const cid = c.coordinator?.id ?? c.coordinator_id ?? undefined;
    return cid != null && Number(cid) === Number(userId);
  });
}

/**
 * Named coordinator (or admin/pastor/senior) — leadership fields + deactivate/delete.
 * Mirrors backend `user_can_edit_cluster_leadership` with privileged bypass.
 */
export function userCanManageCluster(
  cluster: Cluster,
  auth: ManageClusterAuth,
): boolean {
  const { userId, role } = auth;
  if (!userId) return false;
  if (role === "ADMIN" || role === "PASTOR") return true;
  if (hasClusterOversight(auth)) return true;
  return isNamedOrAssignedCoordinator(cluster, auth);
}

/** Alias: leadership assignment (coordinator / assistants / reporters). */
export function userCanManageClusterLeadership(
  cluster: Cluster,
  auth: ManageClusterAuth,
): boolean {
  return userCanManageCluster(cluster, auth);
}

/**
 * Day-to-day ops: named coordinator or assistant (plus privileged bypass).
 * Mirrors backend `user_can_operate_cluster` with privileged bypass.
 */
export function userCanOperateCluster(
  cluster: Cluster,
  auth: ManageClusterAuth & { moduleCoordinatorAssignments?: ModuleCoordinator[] },
): boolean {
  if (userCanManageCluster(cluster, auth)) return true;
  const assistantIds = assistantClusterIdsFromAssignments(
    auth.moduleCoordinatorAssignments,
  );
  return assistantIds.includes(Number(cluster.id));
}

/**
 * Sunday catch-up for one cluster. Mirrors backend `user_can_sunday_catchup`:
 * admin, pastor, cluster senior, or that cluster's coordinator, assistant, or reporter.
 */
export function userCanSundayCatchup(
  cluster: Cluster,
  auth: ManageClusterAuth & { moduleCoordinatorAssignments?: ModuleCoordinator[] },
): boolean {
  if (userCanOperateCluster(cluster, auth)) return true;
  return reporterClusterIdsFromAssignments(
    auth.moduleCoordinatorAssignments,
  ).includes(Number(cluster.id));
}

/** Mirrors backend `user_can_submit_cluster_report`. */
export function userCanSubmitClusterReport(
  cluster: Cluster,
  auth: ManageClusterAuth & { moduleCoordinatorAssignments?: ModuleCoordinator[] },
): boolean {
  if (userCanOperateCluster(cluster, auth)) return true;
  const clusterId = Number(cluster.id);
  const reporterIds = reporterClusterIdsFromAssignments(
    auth.moduleCoordinatorAssignments,
  );
  return reporterIds.includes(clusterId);
}

/** Clusters the user may submit reports for (operator + reporter assignments). */
export function clustersForReportSubmission(
  allClusters: Cluster[],
  auth: ManageClusterAuth & { moduleCoordinatorAssignments?: ModuleCoordinator[] },
): Cluster[] {
  const reporterIds = new Set(
    reporterClusterIdsFromAssignments(auth.moduleCoordinatorAssignments),
  );
  return allClusters.filter(
    (c) =>
      userCanOperateCluster(c, auth) || reporterIds.has(Number(c.id)),
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
  const { userId, role, isModuleCoordinator } = auth;
  if (!userId) return false;
  if (role === "ADMIN" || role === "PASTOR") return true;
  if (hasClusterOversight(auth)) return true;
  if (isModuleCoordinator("CLUSTER", "COORDINATOR")) return true;
  if (isModuleCoordinator("CLUSTER", "ASSISTANT_COORDINATOR")) return true;
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
  auth: ManageClusterAuth & { moduleCoordinatorAssignments?: ModuleCoordinator[] },
): boolean {
  const { userId, role } = auth;
  if (!userId) return false;
  if (role === "ADMIN" || role === "PASTOR") return true;
  if (hasClusterOversight(auth)) return true;
  const idSet = new Set(personClusterIds.map((id) => Number(id)));
  return clusters.some(
    (c) => idSet.has(Number(c.id)) && userCanOperateCluster(c, auth),
  );
}

/**
 * On create, person has no membership yet — allow ADMIN/PASTOR/CLUSTER senior
 * or any CLUSTER COORDINATOR / ASSISTANT assignment.
 */
export function userCanEditVitalDatesOnCreate(auth: ManageClusterAuth): boolean {
  const { userId, role, isModuleCoordinator } = auth;
  if (!userId) return false;
  if (role === "ADMIN" || role === "PASTOR") return true;
  if (hasClusterOversight(auth)) return true;
  return (
    isModuleCoordinator("CLUSTER", "COORDINATOR") ||
    isModuleCoordinator("CLUSTER", "ASSISTANT_COORDINATOR")
  );
}

/**
 * Who may export cluster directory rows or weekly reports.
 * Admin, Pastor, and Cluster Senior Coordinator.
 */
export function userCanExportClusterData(auth: {
  role: string | undefined;
  isSeniorCoordinator: (module?: ModuleCoordinator["module"]) => boolean;
  clusterCommitteeRole?: "PRIMARY" | "SUPPORT" | null;
}): boolean {
  const { role, isSeniorCoordinator, clusterCommitteeRole } = auth;
  if (role === "ADMIN" || role === "PASTOR") return true;
  if (isSeniorCoordinator("CLUSTER")) return true;
  return clusterCommitteeRole === "PRIMARY" || clusterCommitteeRole === "SUPPORT";
}

/**
 * Who may open the people behind a status tally cell.
 * Mirrors backend `can_view_status_tally_people`.
 */
export function userCanViewStatusTallyPeople(
  auth: ManageClusterAuth & { moduleCoordinatorAssignments?: ModuleCoordinator[] },
  clusters: Cluster[] = [],
): boolean {
  const { userId, role } = auth;
  if (!userId) return false;
  if (role === "ADMIN" || role === "PASTOR") return true;
  if (role !== "MEMBER") return false;
  const assignments = auth.moduleCoordinatorAssignments ?? [];
  if (assignments.some((assignment) => assignment.level !== "REPORTER")) {
    return true;
  }
  return clusters.some((cluster) => {
    const coordinatorId =
      cluster.coordinator?.id ?? cluster.coordinator_id ?? undefined;
    return coordinatorId != null && Number(coordinatorId) === Number(userId);
  });
}

/**
 * Who may view and edit the member care caseload (pastoral notes).
 * Mirrors backend `can_access_member_care`. Not reporters or plain members.
 */
export function userCanAccessMemberCare(
  auth: ManageClusterAuth & { moduleCoordinatorAssignments?: ModuleCoordinator[] },
  clusters: Cluster[] = [],
): boolean {
  const { userId, role, isModuleCoordinator } = auth;
  if (!userId) return false;
  if (role === "ADMIN" || role === "PASTOR") return true;
  if (hasClusterOversight(auth)) return true;
  if (isModuleCoordinator("CLUSTER", "COORDINATOR")) return true;
  if (isModuleCoordinator("CLUSTER", "ASSISTANT_COORDINATOR")) return true;
  return clusters.some((c) => {
    const cid = c.coordinator?.id ?? c.coordinator_id ?? undefined;
    return cid != null && Number(cid) === Number(userId);
  });
}
