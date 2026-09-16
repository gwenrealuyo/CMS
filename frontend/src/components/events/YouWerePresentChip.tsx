import { AttendanceMode } from "@/src/types/event";

export default function YouWerePresentChip({
  mode,
  size = "md",
}: {
  mode?: AttendanceMode | null;
  size?: "sm" | "md";
}) {
  const modeLabel =
    mode === "ONLINE" ? "Online" : mode === "ONSITE" ? "Onsite" : null;
  const className =
    size === "sm"
      ? "inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-800 border border-emerald-200"
      : "inline-flex items-center px-3 py-1 text-sm font-medium text-emerald-800 bg-emerald-50 rounded-full border border-emerald-200";

  return (
    <span className={className}>
      You were present
      {modeLabel ? ` · ${modeLabel}` : ""}
    </span>
  );
}
