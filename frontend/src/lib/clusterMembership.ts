/** Person-like shape for cluster branch checks. */
type PersonBranchLike = {
  branch?: number | null;
};

type PersonClusterLike = {
  cluster_ids?: Array<string | number>;
  cluster_labels?: string[];
};

/**
 * Whether a person can be assigned to a branch-scoped cluster.
 * Legacy persons without a branch may appear; the backend assigns the cluster
 * branch when they are added.
 */
export function personMatchesClusterBranch(
  person: PersonBranchLike,
  clusterBranch: number | null | undefined
): boolean {
  if (clusterBranch == null) {
    return true;
  }
  if (person.branch == null || person.branch === undefined) {
    return true;
  }
  return Number(person.branch) === Number(clusterBranch);
}

/** Cluster IDs the person belongs to other than ``currentClusterId``. */
export function otherClusterIdsForPerson(
  person: PersonClusterLike,
  currentClusterId?: number | null
): number[] {
  const ids = (person.cluster_ids ?? []).map(Number).filter((id) => !Number.isNaN(id));
  if (currentClusterId == null) {
    return ids;
  }
  const current = Number(currentClusterId);
  return ids.filter((id) => id !== current);
}

/** Human-readable labels for other-cluster membership (best-effort from list payload). */
export function otherClusterLabelsForPerson(
  person: PersonClusterLike,
  currentClusterId?: number | null
): string[] {
  const otherIds = otherClusterIdsForPerson(person, currentClusterId);
  if (otherIds.length === 0) {
    return [];
  }
  const labels = person.cluster_labels ?? [];
  if (labels.length === 0) {
    return otherIds.map((id) => `Cluster ${id}`);
  }
  // List payloads keep cluster_ids and cluster_labels in the same order.
  const allIds = (person.cluster_ids ?? []).map(Number);
  const matched = otherIds.map((id) => {
    const idx = allIds.indexOf(id);
    if (idx >= 0 && labels[idx]) {
      return labels[idx];
    }
    return `Cluster ${id}`;
  });
  return matched;
}

export function formatOtherClusterLabels(labels: string[]): string {
  if (labels.length === 0) return "";
  if (labels.length === 1) return labels[0];
  if (labels.length === 2) return `${labels[0]} and ${labels[1]}`;
  return `${labels.slice(0, -1).join(", ")}, and ${labels[labels.length - 1]}`;
}
