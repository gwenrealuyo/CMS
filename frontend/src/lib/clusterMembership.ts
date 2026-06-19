/** Person-like shape for cluster branch checks. */
type PersonBranchLike = {
  branch?: number | null;
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
