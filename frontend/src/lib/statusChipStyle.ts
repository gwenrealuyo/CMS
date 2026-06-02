export type StatusChipVariant = "active" | "inactive" | "primary";

export type StatusChipStyle = {
  borderColor: string;
  color: string;
};

const STATUS_CHIP_STYLES: Record<StatusChipVariant, StatusChipStyle> = {
  active: { borderColor: "#16a34a", color: "#15803d" },
  inactive: { borderColor: "#9ca3af", color: "#4b5563" },
  primary: { borderColor: "#2563eb", color: "#1d4ed8" },
};

export const STATUS_CHIP_CLASSNAME =
  "inline-flex items-center rounded-full border bg-transparent px-2 py-0.5 text-[11px] font-semibold leading-none";

export function getStatusChipStyle(
  variant: StatusChipVariant
): StatusChipStyle {
  return STATUS_CHIP_STYLES[variant];
}
