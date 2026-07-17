import { useEffect, useRef } from "react";

export interface EvangelismGroupFilterField {
  key: string;
  label: string;
  type: "text" | "select" | "date" | "number" | "range";
  options?: { value: string; label: string }[];
}

interface EvangelismGroupFilterDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectField: (field: EvangelismGroupFilterField) => void;
  /** Viewport-fixed placement; ignored when `anchored` is true. */
  position?: { top: number; left: number };
  /** Anchor under parent with absolute positioning (scrolls with page). */
  anchored?: boolean;
}

const EVANGELISM_GROUP_FILTER_FIELDS: EvangelismGroupFilterField[] = [
  { key: "name", label: "Group Name", type: "text" },
  { key: "description", label: "Description", type: "text" },
  { key: "coordinator", label: "Coordinator", type: "text" },
  { key: "cluster_code", label: "Cluster Code", type: "text" },
  { key: "location", label: "Location", type: "text" },
  { key: "meeting_schedule", label: "Meeting Schedule", type: "text" },
  { key: "member_count", label: "Member Count", type: "range" },
  { key: "visitor_count", label: "Visitor Count", type: "range" },
  {
    key: "status",
    label: "Status",
    type: "select",
    options: [
      { value: "active", label: "Active" },
      { value: "inactive", label: "Inactive" },
    ],
  },
  {
    key: "bible_sharers",
    label: "Bible Sharers",
    type: "select",
    options: [
      { value: "yes", label: "Yes" },
      { value: "no", label: "No" },
    ],
  },
];

export default function EvangelismGroupFilterDropdown({
  isOpen,
  onClose,
  onSelectField,
  position = { top: 0, left: 0 },
  anchored = false,
}: EvangelismGroupFilterDropdownProps) {
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(target as Node)
      ) {
        const clickedButton = target.closest("button");
        if (clickedButton) {
          const buttonText = clickedButton.textContent?.trim() || "";
          if (buttonText === "Filter" || buttonText.startsWith("Filter")) {
            const svgPath = clickedButton.querySelector('path[d*="M12 6v6"]');
            if (svgPath) return;
          }
        }
        onClose();
      }
    };

    if (isOpen) {
      const timeoutId = setTimeout(() => {
        document.addEventListener("mousedown", handleClickOutside);
      }, 100);

      return () => {
        clearTimeout(timeoutId);
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const adjustedPosition = {
    top: position.top,
    left: Math.max(16, Math.min(position.left, window.innerWidth - 272)),
  };

  return (
    <div
      ref={dropdownRef}
      className={
        anchored
          ? "absolute inset-x-0 top-full z-50 mt-1.5 w-full max-w-[calc(100vw-2rem)] rounded-lg border border-gray-200 bg-white py-2 shadow-lg tablet:left-auto tablet:right-0 tablet:w-64"
          : "fixed z-50 w-64 max-w-[calc(100vw-2rem)] rounded-lg border border-gray-200 bg-white py-2 shadow-lg"
      }
      style={
        anchored
          ? undefined
          : {
              top: adjustedPosition.top,
              left: adjustedPosition.left,
            }
      }
    >
      <div className="border-b border-gray-100 px-3 py-2">
        <h3 className="text-sm font-medium text-gray-900">Filter by Field</h3>
      </div>

      <div className="tablet:max-h-64 tablet:overflow-y-auto">
        {EVANGELISM_GROUP_FILTER_FIELDS.map((field) => (
          <button
            key={field.key}
            type="button"
            onClick={() => {
              onSelectField(field);
              onClose();
            }}
            className="flex min-h-[44px] w-full items-center justify-between px-3 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 md:min-h-0 md:py-2"
          >
            <span>{field.label}</span>
            <span className="text-xs capitalize text-gray-400">{field.type}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
