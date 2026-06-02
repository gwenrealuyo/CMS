interface EvangelismToolbarSearchProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  ariaLabel?: string;
  /** When true, fills the container (e.g. grid cell) instead of max-w-md toolbar width. */
  fullWidth?: boolean;
  className?: string;
}

export const EVANGELISM_BRANCH_SELECT_BASE_CLASS =
  "rounded-lg border border-gray-300 bg-white py-2 pl-3 pr-8 text-sm text-gray-900 focus:ring-2 focus:ring-ring focus:border-transparent";

export const EVANGELISM_BRANCH_SELECT_CLASS = `${EVANGELISM_BRANCH_SELECT_BASE_CLASS} w-52 shrink-0`;

export const EVANGELISM_BRANCH_SELECT_FULL_WIDTH_CLASS = `${EVANGELISM_BRANCH_SELECT_BASE_CLASS} w-full`;

export const EVANGELISM_BRANCH_SELECT_LOCKED_CLASS = `${EVANGELISM_BRANCH_SELECT_BASE_CLASS} w-full pointer-events-none cursor-default`;

export default function EvangelismToolbarSearch({
  value,
  onChange,
  placeholder = "Search groups…",
  ariaLabel = "Search",
  fullWidth = false,
  className = "",
}: EvangelismToolbarSearchProps) {
  return (
    <div
      className={`relative min-w-[12rem] ${
        fullWidth ? "w-full min-w-0" : "max-w-md flex-1"
      } ${className}`}
    >
      <svg
        className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
        />
      </svg>
      <input
        type="text"
        aria-label={ariaLabel}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full rounded-lg border border-gray-300 py-2 pl-10 text-sm focus:border-transparent focus:ring-2 focus:ring-ring ${
          value ? "pr-10" : "pr-4"
        }`}
      />
      {value ? (
        <button
          type="button"
          onClick={() => onChange("")}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          aria-label="Clear search"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      ) : null}
    </div>
  );
}
