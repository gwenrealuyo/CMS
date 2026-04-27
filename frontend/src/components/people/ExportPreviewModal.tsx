import { Person } from "@/src/types/person";

interface ExportPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: Person[];
  onExport: (format: "excel" | "pdf" | "csv", fields: string[]) => void;
}

export default function ExportPreviewModal({
  isOpen,
  onClose,
  data,
  onExport,
}: ExportPreviewModalProps) {
  if (!isOpen) return null;

  const ALL_FIELDS: { key: string; label: string }[] = [
    { key: "first_name", label: "First Name" },
    { key: "middle_name", label: "Middle Name" },
    { key: "last_name", label: "Last Name" },
    { key: "email", label: "Email" },
    { key: "phone", label: "Phone" },
    { key: "role", label: "Role" },
    { key: "status", label: "Status" },
    { key: "country", label: "Country" },
    { key: "address", label: "Address" },
    { key: "date_of_birth", label: "Birth Date" },
    { key: "date_first_attended", label: "First Attended" },
    { key: "first_activity_attended", label: "First Activity Attended" },
    { key: "water_baptism_date", label: "Water Baptism" },
    { key: "spirit_baptism_date", label: "Spirit Baptism" },
    { key: "member_id", label: "LAMP ID" },
  ];

  const defaultSelected = new Set(
    ALL_FIELDS.map((f) => f.key).filter((k) => k !== "address")
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 !-mt-4">
      <div className="bg-white rounded-lg p-6 w-[90%] max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4 gap-4 -mr-2">
          <h2 className="text-xl font-semibold">Export Preview</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-red-500 hover:text-red-700 p-2 rounded-md hover:bg-red-50 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center shrink-0"
            aria-label="Close modal"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Field selection */}
        <div className="mb-4">
          <h3 className="text-sm font-medium text-gray-700 mb-2">
            Select fields
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
            {ALL_FIELDS.map((f) => (
              <label key={f.key} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  defaultChecked={defaultSelected.has(f.key)}
                  data-field={f.key}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span>{f.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Lightweight preview of first 5 rows, showing selected fields */}
        <div className="overflow-x-auto border rounded-lg">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50" id="export-head"></thead>
            <tbody
              className="bg-white divide-y divide-gray-200"
              id="export-body"
            ></tbody>
          </table>
        </div>

        {data.length > 5 && (
          <p className="text-sm text-gray-500 mt-4">
            Showing preview of first 5 records out of {data.length} total
            records
          </p>
        )}

        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={() =>
              onExport(
                "excel",
                Array.from(
                  document.querySelectorAll<HTMLInputElement>(
                    "input[data-field]:checked"
                  )
                ).map((el) => el.getAttribute("data-field") || "")
              )
            }
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 shadow-sm"
          >
            Export Excel
          </button>
          <button
            onClick={() =>
              onExport(
                "pdf",
                Array.from(
                  document.querySelectorAll<HTMLInputElement>(
                    "input[data-field]:checked"
                  )
                ).map((el) => el.getAttribute("data-field") || "")
              )
            }
            className="px-4 py-2 bg-rose-600 text-white rounded-lg hover:bg-rose-700 shadow-sm"
          >
            Export PDF
          </button>
          <button
            onClick={() =>
              onExport(
                "csv",
                Array.from(
                  document.querySelectorAll<HTMLInputElement>(
                    "input[data-field]:checked"
                  )
                ).map((el) => el.getAttribute("data-field") || "")
              )
            }
            className="px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 shadow-sm"
          >
            Export CSV
          </button>
        </div>
      </div>
    </div>
  );
}
