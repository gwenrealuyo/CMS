/** Person-like shape for cluster branch checks. */
type PersonBranchLike = {
  branch?: number | null;
};

/**
 * Whether a person can be assigned to a branch-scoped cluster.
 * Mirrors backend `prune_members_not_matching_cluster_branch`: legacy persons
 * without a branch are not excluded from branch clusters.
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
