import { Squares2X2Icon, TableCellsIcon } from "@heroicons/react/24/outline";

interface ViewModeToggleProps {
  viewMode: "table" | "cards";
  onViewModeChange: (mode: "table" | "cards") => void;
  className?: string;
  /** Always compact inline control (desktop toolbar rows). */
  compact?: boolean;
}

export default function ViewModeToggle({
  viewMode,
  onViewModeChange,
  className = "",
  compact = false,
}: ViewModeToggleProps) {
  const segmentClass = (active: boolean) => {
    const base = compact
      ? "inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-medium transition"
      : "inline-flex flex-1 items-center justify-center gap-1 rounded-md px-3 py-2 text-xs font-medium transition md:flex-none md:py-1.5 min-h-[44px] md:min-h-0";

    return `${base} ${
      active
        ? "border border-gray-200 bg-white text-gray-900 shadow-sm"
        : "bg-transparent text-gray-400 hover:text-gray-600"
    }`;
  };

  const containerClass = compact
    ? `inline-flex shrink-0 rounded-lg border border-gray-200 bg-gray-100 p-0.25 ${className}`
    : `flex w-full rounded-lg border border-gray-200 bg-gray-100 p-0.25 md:inline-flex md:w-auto md:shrink-0 ${className}`;

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
