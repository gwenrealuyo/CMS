export type TallyClusterSortKey = "cluster_code" | "cluster_name";
export type TallyClusterSortDir = "asc" | "desc";

export interface TallyClusterSortableRow {
  cluster_id?: number | null;
  cluster_code?: string | null;
  cluster_name?: string | null;
  row_kind?: string | null;
}

export interface TallyClusterCellLabels {
  primary: string;
  secondary?: string;
  title?: string;
  isTotal: boolean;
}

export const DEFAULT_TALLY_CLUSTER_SORT_KEY: TallyClusterSortKey =
  "cluster_code";
export const DEFAULT_TALLY_CLUSTER_SORT_DIR: TallyClusterSortDir = "asc";

export function clusterSortHeaderLabel(key: TallyClusterSortKey): string {
  return key === "cluster_code" ? "Code" : "Name";
}

/** Code ↑ → Code ↓ → Name ↑ → Name ↓ → Code ↑ */
export function nextClusterSort(
  currentKey: TallyClusterSortKey,
  currentDir: TallyClusterSortDir,
): { key: TallyClusterSortKey; dir: TallyClusterSortDir } {
  if (currentKey === "cluster_code" && currentDir === "asc") {
    return { key: "cluster_code", dir: "desc" };
  }
  if (currentKey === "cluster_code" && currentDir === "desc") {
    return { key: "cluster_name", dir: "asc" };
  }
  if (currentKey === "cluster_name" && currentDir === "asc") {
    return { key: "cluster_name", dir: "desc" };
  }
  return { key: "cluster_code", dir: "asc" };
}

function normalizeLabel(value?: string | null): string {
  return (value || "").trim();
}

function sortLabelForKey(
  row: TallyClusterSortableRow,
  key: TallyClusterSortKey,
): string {
  if (key === "cluster_code") {
    return (
      normalizeLabel(row.cluster_code) ||
      normalizeLabel(row.cluster_name) ||
      ""
    ).toLocaleLowerCase();
  }
  return (
    normalizeLabel(row.cluster_name) ||
    normalizeLabel(row.cluster_code) ||
    ""
  ).toLocaleLowerCase();
}

export function compareClusterRows(
  left: TallyClusterSortableRow,
  right: TallyClusterSortableRow,
  key: TallyClusterSortKey,
  dir: TallyClusterSortDir,
): number {
  const direction = dir === "asc" ? 1 : -1;
  const leftLabel = sortLabelForKey(left, key);
  const rightLabel = sortLabelForKey(right, key);
  if (leftLabel < rightLabel) return -1 * direction;
  if (leftLabel > rightLabel) return 1 * direction;

  const leftOther = sortLabelForKey(
    left,
    key === "cluster_code" ? "cluster_name" : "cluster_code",
  );
  const rightOther = sortLabelForKey(
    right,
    key === "cluster_code" ? "cluster_name" : "cluster_code",
  );
  if (leftOther < rightOther) return -1;
  if (leftOther > rightOther) return 1;

  return (left.cluster_id ?? 0) - (right.cluster_id ?? 0);
}

export function clusterCellLabels(
  row: TallyClusterSortableRow,
): TallyClusterCellLabels {
  const isTotal = row.row_kind === "total";
  const code = normalizeLabel(row.cluster_code);
  const name = normalizeLabel(row.cluster_name);

  if (isTotal) {
    return {
      primary: name || "Total",
      title: name || "Total",
      isTotal: true,
    };
  }

  if (row.row_kind === "unassigned") {
    return {
      primary: name || "Unassigned",
      title: name || "Unassigned",
      isTotal: false,
    };
  }

  if (code) {
    return {
      primary: code,
      secondary: name && name !== code ? name : undefined,
      title: name || code,
      isTotal: false,
    };
  }

  return {
    primary: name || "Cluster",
    title: name || "Cluster",
    isTotal: false,
  };
}

export interface TallyCordSortableRow {
  cord_id?: number | null;
  cord_name?: string | null;
  cluster_id?: number | null;
  cluster_code?: string | null;
  cluster_name?: string | null;
  row_kind?: string | null;
}

export type TallyCordSortKey = "cord_name" | "cluster_code";

export const DEFAULT_TALLY_CORD_SORT_KEY: TallyCordSortKey = "cluster_code";
export const DEFAULT_TALLY_CORD_SORT_DIR: TallyClusterSortDir = "asc";

export function cordSortHeaderLabel(key: TallyCordSortKey): string {
  return key === "cord_name" ? "Name" : "Code";
}

/** Name ↑ → Name ↓ → Code ↑ → Code ↓ → Name ↑ */
export function nextCordSort(
  currentKey: TallyCordSortKey,
  currentDir: TallyClusterSortDir,
): { key: TallyCordSortKey; dir: TallyClusterSortDir } {
  if (currentKey === "cord_name" && currentDir === "asc") {
    return { key: "cord_name", dir: "desc" };
  }
  if (currentKey === "cord_name" && currentDir === "desc") {
    return { key: "cluster_code", dir: "asc" };
  }
  if (currentKey === "cluster_code" && currentDir === "asc") {
    return { key: "cluster_code", dir: "desc" };
  }
  return { key: "cord_name", dir: "asc" };
}

export function compareCordRows(
  left: TallyCordSortableRow,
  right: TallyCordSortableRow,
  key: TallyCordSortKey,
  dir: TallyClusterSortDir,
): number {
  return compareClusterRows(
    {
      cluster_id: left.cord_id ?? left.cluster_id,
      cluster_code: left.cluster_code,
      cluster_name: left.cord_name || left.cluster_name,
      row_kind: left.row_kind,
    },
    {
      cluster_id: right.cord_id ?? right.cluster_id,
      cluster_code: right.cluster_code,
      cluster_name: right.cord_name || right.cluster_name,
      row_kind: right.row_kind,
    },
    key === "cord_name" ? "cluster_name" : "cluster_code",
    dir,
  );
}

/** Cord name only (cluster shown in a separate column in By 5x5 mode). */
export function cordCellLabels(
  row: TallyCordSortableRow,
): TallyClusterCellLabels {
  const isTotal = row.row_kind === "total";
  const cordName = normalizeLabel(row.cord_name);

  if (isTotal) {
    return {
      primary: cordName || "Total",
      title: cordName || "Total",
      isTotal: true,
    };
  }

  if (row.row_kind === "uncorded") {
    return {
      primary: cordName || "Uncorded",
      title: cordName || "Uncorded",
      isTotal: false,
    };
  }

  return {
    primary: cordName || "Cord",
    title: cordName || "Cord",
    isTotal: false,
  };
}

/** Cluster cell for By 5x5 mode (code primary, name secondary). */
export function cordClusterCellLabels(
  row: TallyCordSortableRow,
): TallyClusterCellLabels {
  const isTotal = row.row_kind === "total";
  const code = normalizeLabel(row.cluster_code);
  const name = normalizeLabel(row.cluster_name);

  if (isTotal || row.row_kind === "uncorded") {
    return {
      primary: "—",
      title: undefined,
      isTotal,
    };
  }

  if (code) {
    return {
      primary: code,
      secondary: name && name !== code ? name : undefined,
      title: name || code,
      isTotal: false,
    };
  }

  return {
    primary: name || "—",
    title: name || undefined,
    isTotal: false,
  };
}

export function isTallyWarningRow(rowKind?: string | null): boolean {
  return rowKind === "uncorded" || rowKind === "unassigned";
}
