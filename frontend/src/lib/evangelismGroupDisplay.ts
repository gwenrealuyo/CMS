import { Branch } from "@/src/types/branch";
import { Cluster } from "@/src/types/cluster";
import { EvangelismGroup } from "@/src/types/evangelism";

export function resolveEvangelismGroupClusterMeta(
  group: EvangelismGroup,
  clusters: Cluster[],
  branches: Branch[]
): { clusterBranch: Branch | null; clusterDisplayCode: string | null } {
  if (!group.cluster?.id) {
    return { clusterBranch: null, clusterDisplayCode: null };
  }
  const fullCluster = clusters.find(
    (c) => String(c.id) === String(group.cluster!.id)
  );
  const clusterDisplayCode =
    fullCluster?.code?.trim() ||
    group.cluster.code?.trim() ||
    group.cluster.name ||
    "—";

  if (fullCluster?.branch == null) {
    return { clusterBranch: null, clusterDisplayCode };
  }
  const branchId = Number(fullCluster.branch);
  const clusterBranch = branches.find((b) => b.id === branchId) || null;
  return { clusterBranch, clusterDisplayCode };
}

export function getEvangelismGroupMemberCount(group: EvangelismGroup): number {
  const base = group.members_count ?? 0;
  const coordinator = group.coordinator;
  if (!coordinator) return base;
  const coordinatorInMembers = group.members?.some(
    (member) => String(member.id) === String(coordinator.id)
  );
  if (coordinatorInMembers) return base;
  if (coordinator.role === "ADMIN" || coordinator.role === "VISITOR") {
    return base;
  }
  return base + 1;
}

export function getEvangelismGroupCoordinatorName(group: EvangelismGroup): string {
  return group.coordinator?.full_name?.trim() || "Unknown Coordinator";
}

export function formatEvangelismGroupSchedule(group: EvangelismGroup): string {
  const parts = [group.meeting_day, group.meeting_time].filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : "No schedule";
}
