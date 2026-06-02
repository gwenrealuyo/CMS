export type BranchBadgeStyle = {
  backgroundColor: string;
  borderColor: string;
  color: string;
};

const HQ_BRANCH_BADGE: BranchBadgeStyle = {
  backgroundColor: "#e0f2fe",
  borderColor: "#0284c7",
  color: "#0369a1",
};

const BRANCH_BADGE_STYLES: BranchBadgeStyle[] = [
  {
    backgroundColor: "#dcfce7",
    borderColor: "#16a34a",
    color: "#15803d",
  },
  {
    backgroundColor: "#f3e8ff",
    borderColor: "#9333ea",
    color: "#7e22ce",
  },
  {
    backgroundColor: "#ffedd5",
    borderColor: "#ea580c",
    color: "#c2410c",
  },
  {
    backgroundColor: "#fce7f3",
    borderColor: "#db2777",
    color: "#be185d",
  },
  {
    backgroundColor: "#e0e7ff",
    borderColor: "#4f46e5",
    color: "#4338ca",
  },
  {
    backgroundColor: "#fef9c3",
    borderColor: "#ca8a04",
    color: "#a16207",
  },
  {
    backgroundColor: "#fee2e2",
    borderColor: "#dc2626",
    color: "#b91c1c",
  },
];

const NEUTRAL_CODE_BADGE: BranchBadgeStyle = {
  backgroundColor: "#f3f4f6",
  borderColor: "#f3f4f6",
  color: "#374151",
};

export const CLUSTER_BADGE_CLASSNAME =
  "inline-flex items-center gap-1 rounded-full border box-border px-2.5 h-6 text-xs font-semibold leading-none";

export const CLUSTER_CODE_BADGE_CLASSNAME = `${CLUSTER_BADGE_CLASSNAME} font-extrabold`;

export const CLUSTER_BRANCH_CHIP_CLASSNAME = `${CLUSTER_BADGE_CLASSNAME} bg-transparent`;

/** @deprecated Use CLUSTER_BRANCH_CHIP_CLASSNAME */
export const BRANCH_CHIP_CLASSNAME = CLUSTER_BRANCH_CHIP_CLASSNAME;

function resolveBranchBadgeStyle(
  branchId: number,
  isHeadquarters: boolean
): BranchBadgeStyle {
  if (isHeadquarters) {
    return HQ_BRANCH_BADGE;
  }
  const index =
    ((branchId % BRANCH_BADGE_STYLES.length) + BRANCH_BADGE_STYLES.length) %
    BRANCH_BADGE_STYLES.length;
  return BRANCH_BADGE_STYLES[index];
}

export function getBranchFilledBadgeStyle(
  branchId: number,
  isHeadquarters: boolean
): BranchBadgeStyle {
  const style = resolveBranchBadgeStyle(branchId, isHeadquarters);
  return {
    backgroundColor: style.backgroundColor,
    borderColor: style.backgroundColor,
    color: style.color,
  };
}

export function getBranchOutlineBadgeStyle(
  branchId: number,
  isHeadquarters: boolean
): BranchBadgeStyle {
  const style = resolveBranchBadgeStyle(branchId, isHeadquarters);
  return {
    backgroundColor: "transparent",
    borderColor: style.borderColor,
    color: style.color,
  };
}

export function getClusterCodeBadgeStyle(
  branchId: number | null | undefined,
  isHeadquarters = false
): BranchBadgeStyle {
  if (branchId == null) {
    return NEUTRAL_CODE_BADGE;
  }
  return getBranchFilledBadgeStyle(branchId, isHeadquarters);
}

/** @deprecated Use getBranchOutlineBadgeStyle */
export function getBranchChipStyle(
  branchId: number,
  isHeadquarters: boolean
): Pick<BranchBadgeStyle, "borderColor" | "color"> {
  const style = getBranchOutlineBadgeStyle(branchId, isHeadquarters);
  return { borderColor: style.borderColor, color: style.color };
}

export function getBranchDisplayCode(branch: {
  code?: string | null;
  name: string;
  is_headquarters?: boolean;
}): string {
  const label = branch.code?.trim() || branch.name;
  return branch.is_headquarters ? `${label} (HQ)` : label;
}
