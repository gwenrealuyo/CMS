import { Branch } from "@/src/types/branch";
import { Cluster } from "@/src/types/cluster";
import { EvangelismGroup } from "@/src/types/evangelism";

export function resolveEvangelismGroupClusterMeta(
  group: EvangelismGroup,
  clusters: Cluster[],
  branches: Branch[]
): { clusterBranch: Branch | null; clusterDisplayCode: string | null } {
  const groupBranchIdRaw = group.branch ?? group.branch_id ?? null;
  if (!group.cluster?.id) {
    if (groupBranchIdRaw == null) {
      return { clusterBranch: null, clusterDisplayCode: null };
    }
    const clusterBranch =
      branches.find((b) => Number(b.id) === Number(groupBranchIdRaw)) || null;
    return { clusterBranch, clusterDisplayCode: null };
  }
  const fullCluster = clusters.find(
    (c) => String(c.id) === String(group.cluster!.id)
  );
  const clusterDisplayCode =
    fullCluster?.code?.trim() ||
    group.cluster.code?.trim() ||
    group.cluster.name ||
    "—";

  const nestedBranch = (group.cluster as Cluster & { branch?: number | null })
    .branch;
  const branchIdRaw = fullCluster?.branch ?? nestedBranch ?? groupBranchIdRaw;
  if (branchIdRaw == null) {
    return { clusterBranch: null, clusterDisplayCode };
  }
  const branchId = Number(branchIdRaw);
  const clusterBranch = branches.find((b) => b.id === branchId) || null;
  return { clusterBranch, clusterDisplayCode };
}

export function getEvangelismGroupMemberCount(group: EvangelismGroup): number {
  if (group.members_count != null) {
    return group.members_count;
  }
  const members = (group.members ?? []).filter(
    (member) => member.role !== "ADMIN" && member.role !== "VISITOR",
  );
  return members.length;
}

export function getEvangelismGroupCoordinatorName(group: EvangelismGroup): string {
  const named = group.coordinator?.full_name?.trim();
  if (named) return named;
  const parts = [
    group.coordinator?.first_name,
    group.coordinator?.last_name,
  ].filter(Boolean);
  if (parts.length > 0) return parts.join(" ");
  return group.coordinator?.username?.trim() || "Unknown Coordinator";
}

export function formatEvangelismGroupSchedule(group: EvangelismGroup): string {
  const parts = [group.meeting_day, group.meeting_time].filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : "No schedule";
}

export function isClusterBibleStudy(group: EvangelismGroup): boolean {
  const id = group.cluster?.id ?? group.cluster_id;
  return id != null && String(id).trim() !== "";
}

export function evangelismGroupApprovalChip(
  group: EvangelismGroup,
): { label: string; variant: "pending" | "rejected" } | null {
  if (group.approval_status === "pending") {
    return { label: "Pending", variant: "pending" };
  }
  if (group.approval_status === "rejected") {
    return { label: "Rejected", variant: "rejected" };
  }
  return null;
}
