"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { Person } from "@/src/types/person";
import {
  PEOPLE_EXPORT_FIELDS,
  type PeopleExportFormat,
} from "@/src/lib/peopleImport";

export { PEOPLE_EXPORT_FIELDS };
export type { PeopleExportFormat };

const FORMAT_BUTTONS: {
  format: PeopleExportFormat;
  label: string;
  className: string;
}[] = [
  {
    format: "excel",
    label: "Export Excel",
    className:
      "rounded-lg bg-emerald-600 px-4 py-2 text-white shadow-sm hover:bg-emerald-700",
  },
  {
    format: "pdf",
    label: "Export PDF",
    className:
      "rounded-lg bg-rose-600 px-4 py-2 text-white shadow-sm hover:bg-rose-700",
  },
  {
    format: "csv",
    label: "Export CSV",
    className:
      "rounded-lg bg-sky-600 px-4 py-2 text-white shadow-sm hover:bg-sky-700",
  },
];

interface ExportPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: Person[];
  onExport: (format: PeopleExportFormat, fields: string[]) => void;
  /** When set (e.g. from Bulk Actions), only show that format's export button. */
  lockedFormat?: PeopleExportFormat | null;
}

function getSelectedFields(): string[] {
  return Array.from(
    document.querySelectorAll<HTMLInputElement>("input[data-field]:checked")
  ).map((el) => el.getAttribute("data-field") || "");
}

export default function ExportPreviewModal({
  isOpen,
  onClose,
  data,
  onExport,
  lockedFormat = null,
}: ExportPreviewModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const defaultSelected = new Set(
    PEOPLE_EXPORT_FIELDS.map((f) => f.key).filter((k) => k !== "address")
  );

  const buttons = lockedFormat
    ? FORMAT_BUTTONS.filter((b) => b.format === lockedFormat)
    : FORMAT_BUTTONS;

  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4 !mt-0"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="flex max-h-[85vh] w-full max-w-4xl flex-col overflow-hidden rounded-lg bg-white shadow-xl">
        <div className="overflow-y-auto p-4 sm:p-6">
          <div className="mb-4 flex items-center justify-between gap-4">
            <h2 className="text-xl font-semibold">Export Preview</h2>
            <button
              type="button"
              onClick={onClose}
              className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-md p-2 text-red-500 transition-colors hover:bg-red-50 hover:text-red-700"
              aria-label="Close modal"
            >
              <svg
                className="h-5 w-5"
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
            <h3 className="mb-2 text-sm font-medium text-gray-700">
              Select fields
            </h3>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-4">
              {PEOPLE_EXPORT_FIELDS.map((f) => (
                <label key={f.key} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    defaultChecked={defaultSelected.has(f.key)}
                    data-field={f.key}
                    className="rounded border-gray-300 text-primary focus:ring-ring"
                  />
                  <span>{f.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Lightweight preview of first 5 rows, showing selected fields */}
          <div className="overflow-x-auto rounded-lg border">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50" id="export-head"></thead>
              <tbody
                className="divide-y divide-gray-200 bg-white"
                id="export-body"
              ></tbody>
            </table>
          </div>

          {data.length > 5 && (
            <p className="mt-4 text-sm text-gray-500">
              Showing preview of first 5 records out of {data.length} total
              records
            </p>
          )}
          {data.length > 0 && data.length <= 5 && (
            <p className="mt-4 text-sm text-gray-500">
              Exporting {data.length} record{data.length === 1 ? "" : "s"}
            </p>
          )}

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
            {buttons.map((button) => (
              <button
                key={button.format}
                type="button"
                onClick={() => onExport(button.format, getSelectedFields())}
                className={button.className}
              >
                {button.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
