import { Squares2X2Icon, TableCellsIcon } from "@heroicons/react/24/outline";

interface ViewModeToggleProps {
  viewMode: "table" | "cards";
  onViewModeChange: (mode: "table" | "cards") => void;
  className?: string;
  /** Always compact inline control (desktop toolbar rows). */
  compact?: boolean;
  /** Keep full-width segmented control (stacked toolbars). */
  fullWidth?: boolean;
}

export default function ViewModeToggle({
  viewMode,
  onViewModeChange,
  className = "",
  compact = false,
  fullWidth = false,
}: ViewModeToggleProps) {
  const segmentClass = (active: boolean) => {
    const base = compact
      ? "inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-medium transition"
      : fullWidth
        ? "inline-flex flex-1 items-center justify-center gap-1 rounded-md px-3 py-2 text-xs font-medium transition min-h-[44px]"
        : "inline-flex flex-1 items-center justify-center gap-1 rounded-md px-3 py-2 text-xs font-medium transition md:flex-none md:py-1.5 min-h-[44px] md:min-h-0";

    return `${base} ${
      active
        ? "border border-primary bg-primary text-white shadow-sm"
        : "bg-transparent text-gray-500 hover:text-gray-700"
    }`;
  };

  const containerClass = compact
    ? `inline-flex shrink-0 rounded-lg border border-gray-300 bg-white p-0.5 ${className}`
    : fullWidth
      ? `flex w-full rounded-lg border border-gray-300 bg-white p-0.5 ${className}`
      : `flex w-full rounded-lg border border-gray-300 bg-white p-0.5 md:inline-flex md:w-auto md:shrink-0 ${className}`;

  return (
    <div className={containerClass}>
      <button
        type="button"
        onClick={() => onViewModeChange("table")}
        className={segmentClass(viewMode === "table")}
      >
        <TableCellsIcon className="h-3.5 w-3.5 shrink-0" />
        Table
      </button>
      <button
        type="button"
        onClick={() => onViewModeChange("cards")}
        className={segmentClass(viewMode === "cards")}
      >
        <Squares2X2Icon className="h-3.5 w-3.5 shrink-0" />
        Cards
      </button>
    </div>
  );
}
