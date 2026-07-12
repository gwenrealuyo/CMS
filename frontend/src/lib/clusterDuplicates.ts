import { Cluster } from "@/src/types/cluster";

function normalizeText(value?: string | null): string {
  return (value || "").trim().toLowerCase();
}

export function findPossibleClusterNameDuplicates(
  clusters: Cluster[],
  opts: {
    name?: string | null;
    branch?: number | null;
    excludeId?: number | string | null;
  }
): Cluster[] {
  const name = normalizeText(opts.name);
  if (!name) return [];

  const excludeId =
    opts.excludeId != null && opts.excludeId !== ""
      ? String(opts.excludeId)
      : null;

  const matches = clusters.filter((cluster) => {
    if (excludeId && String(cluster.id) === excludeId) return false;
    if (cluster.is_active === false) return false;
    return normalizeText(cluster.name) === name;
  });

  if (opts.branch == null) return matches;

  return [...matches].sort((a, b) => {
    const aSame = a.branch === opts.branch ? 0 : 1;
    const bSame = b.branch === opts.branch ? 0 : 1;
    return aSame - bSame;
  });
}

export function findClusterCodeConflict(
  clusters: Cluster[],
  opts: {
    code?: string | null;
    excludeId?: number | string | null;
  }
): Cluster | null {
  const code = normalizeText(opts.code);
  if (!code) return null;

  const excludeId =
    opts.excludeId != null && opts.excludeId !== ""
      ? String(opts.excludeId)
      : null;

  return (
    clusters.find((cluster) => {
      if (excludeId && String(cluster.id) === excludeId) return false;
      return normalizeText(cluster.code) === code;
    }) ?? null
  );
}

export function describeDuplicateCluster(cluster: Cluster): string {
  const bits: string[] = [];
  if (cluster.name?.trim()) bits.push(cluster.name.trim());
  if (cluster.code?.trim()) bits.push(cluster.code.trim());
  if (bits.length === 0) bits.push(`Cluster #${cluster.id}`);
  return bits.join(" · ");
}
