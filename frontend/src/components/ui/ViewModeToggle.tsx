import { Squares2X2Icon, TableCellsIcon } from "@heroicons/react/24/outline";

interface ViewModeToggleProps {
  viewMode: "table" | "cards";
  onViewModeChange: (mode: "table" | "cards") => void;
  className?: string;
}

export default function ViewModeToggle({
  viewMode,
  onViewModeChange,
  className = "",
}: ViewModeToggleProps) {
  const segmentClass = (active: boolean) =>
    `inline-flex flex-1 items-center justify-center gap-1 rounded-md px-3 py-2 text-xs font-medium transition sm:flex-none sm:py-1.5 min-h-[44px] sm:min-h-0 ${
      active
        ? "border border-gray-200 bg-white text-gray-900 shadow-sm"
        : "bg-transparent text-gray-400 hover:text-gray-600"
    }`;

  return (
    <div
      className={`flex w-full rounded-lg border border-gray-200 bg-gray-100 p-0.25 sm:inline-flex sm:w-auto sm:shrink-0 ${className}`}
    >
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
