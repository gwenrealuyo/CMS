export type BranchChipStyle = {
  borderColor: string;
  color: string;
};

const HQ_BRANCH_CHIP_STYLE: BranchChipStyle = {
  borderColor: "#0284c7",
  color: "#0369a1",
};

const BRANCH_CHIP_STYLES: BranchChipStyle[] = [
  { borderColor: "#16a34a", color: "#15803d" }, // green
  { borderColor: "#9333ea", color: "#7e22ce" }, // purple
  { borderColor: "#ea580c", color: "#c2410c" }, // orange
  { borderColor: "#db2777", color: "#be185d" }, // pink
  { borderColor: "#4f46e5", color: "#4338ca" }, // indigo
  { borderColor: "#ca8a04", color: "#a16207" }, // yellow
  { borderColor: "#dc2626", color: "#b91c1c" }, // red
];

export const BRANCH_CHIP_CLASSNAME =
  "inline-flex items-center gap-1 rounded-full border bg-transparent px-2 py-0.5 text-[10px] font-semibold leading-none";

export function getBranchChipStyle(
  branchId: number,
  isHeadquarters: boolean
): BranchChipStyle {
  if (isHeadquarters) {
    return HQ_BRANCH_CHIP_STYLE;
  }
  const index =
    ((branchId % BRANCH_CHIP_STYLES.length) + BRANCH_CHIP_STYLES.length) %
    BRANCH_CHIP_STYLES.length;
  return BRANCH_CHIP_STYLES[index];
}
