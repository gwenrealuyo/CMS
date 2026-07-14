"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  PEOPLE_EXPORT_FIELDS,
  buildImportHeaderMap,
  getPeopleImportTemplateCsv,
  normalizeImportHeader,
} from "@/src/lib/peopleImport";

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (rows: Record<string, string>[]) => Promise<void> | void;
  /** Numeric branch PK used in the CSV template `branch` column. */
  defaultBranchId?: number | null;
  /** Branch code shown in help text (not the numeric ID). */
  defaultBranchCode?: string | null;
}

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.replace(/\r\n?/g, "\n").split("\n").filter(Boolean);
  if (lines.length === 0) return [];
  const headerMap = buildImportHeaderMap();
  const headers = lines[0]
    .split(",")
    .map((h) => normalizeImportHeader(h, headerMap));
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols: string[] = [];
    const line = lines[i];
    let cur = "";
    let inQuotes = false;
    for (let c = 0; c < line.length; c++) {
      const ch = line[c];
      if (ch === '"') {
        if (inQuotes && line[c + 1] === '"') {
          cur += '"';
          c += 1;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === "," && !inQuotes) {
        cols.push(cur);
        cur = "";
      } else {
        cur += ch;
      }
    }
    cols.push(cur);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => (row[h] = (cols[idx] ?? "").trim()));
    rows.push(row);
  }
  return rows;
}

export default function ImportModal({
  isOpen,
  onClose,
  onImport,
  defaultBranchId = null,
  defaultBranchCode = null,
}: ImportModalProps) {
  const [fileName, setFileName] = useState<string>("");
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duplicateInfo, setDuplicateInfo] = useState<{
    nameDuplicates: number[];
    memberIdDuplicates: number[];
  }>({ nameDuplicates: [], memberIdDuplicates: [] });

  useEffect(() => {
    if (!isOpen) {
      setFileName("");
      setRows([]);
      setLoading(false);
      setError(null);
      setDuplicateInfo({ nameDuplicates: [], memberIdDuplicates: [] });
      return;
    }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleFile = async (file: File) => {
    setError(null);
    const text = await file.text();
    const parsed = parseCSV(text);
    setFileName(file.name);
    setRows(parsed);
    const nameKeyToIndex: Record<string, number> = {};
    const nameDupIdxs: number[] = [];
    const memberIdToIndex: Record<string, number> = {};
    const memberDupIdxs: number[] = [];
    parsed.forEach((r, i) => {
      const fn = (r["first_name"] || "").trim().toLowerCase();
      const ln = (r["last_name"] || "").trim().toLowerCase();
      const mk = `${fn}|${ln}`;
      if (fn || ln) {
        if (nameKeyToIndex[mk] !== undefined) {
          nameDupIdxs.push(i);
        } else {
          nameKeyToIndex[mk] = i;
        }
      }

      const mid = (r["member_id"] || "").trim().toLowerCase();
      if (mid) {
        if (memberIdToIndex[mid] !== undefined) {
          memberDupIdxs.push(i);
        } else {
          memberIdToIndex[mid] = i;
        }
      }
    });
    setDuplicateInfo({
      nameDuplicates: nameDupIdxs,
      memberIdDuplicates: memberDupIdxs,
    });
  };

  const handleDownloadTemplate = () => {
    const blob = new Blob(
      [getPeopleImportTemplateCsv({ branchId: defaultBranchId })],
      {
        type: "text/csv;charset=utf-8;",
      }
    );
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "people_import_template.csv";
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const handleImport = async () => {
    try {
      setLoading(true);
      setError(null);
      await onImport(rows);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed.");
    } finally {
      setLoading(false);
    }
  };

  const headers = rows[0] ? Object.keys(rows[0]) : [];
  const expectedHeaders = [
    ...PEOPLE_EXPORT_FIELDS.map((f) => f.key),
    "branch",
  ].join(", ");

  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4 !mt-0"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="max-h-[85vh] w-full max-w-3xl overflow-y-auto rounded-lg bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900">
            Import People (CSV)
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-xl text-gray-500 hover:text-gray-700"
          >
            ✕
          </button>
        </div>

        <div className="border border-dashed border-gray-300 rounded-lg p-6 text-center mb-4">
          <input
            type="file"
            accept=".csv,text/csv"
            className="text-sm text-gray-900"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleFile(f);
            }}
          />
          {fileName && <p className="mt-2 text-base text-gray-900">{fileName}</p>}
          <p className="mt-3 text-sm text-gray-900">
            <span className="font-semibold">Expected headers:</span>{" "}
            {expectedHeaders}
          </p>
          <p className="mt-2 text-sm text-gray-900">
            <span className="font-semibold">Export label headers</span> (e.g.{" "}
            <span className="font-semibold">&quot;First Name&quot;</span>) are
            also accepted.
            {defaultBranchCode?.trim() ? (
              <>
                {" "}
                Branch is set to your branch (
                <span className="font-semibold">
                  {defaultBranchCode.trim()}
                </span>
                ) in the template; it also defaults to your branch when omitted.
              </>
            ) : defaultBranchId != null ? (
              <>
                {" "}
                <span className="font-semibold">Branch</span> is prefilled in
                the template from your account; it also defaults to your branch
                when omitted.
              </>
            ) : (
              <>
                {" "}
                <span className="font-semibold">Branch</span> defaults to your
                branch when omitted.
              </>
            )}
          </p>
          <button
            type="button"
            onClick={handleDownloadTemplate}
            className="mt-4 text-lg font-semibold text-primary hover:underline"
          >
            Download CSV template
          </button>
        </div>

        {rows.length > 0 && (
          <div className="overflow-x-auto border rounded">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {headers.map((h) => (
                    <th
                      key={h}
                      className="px-3 py-2 text-left font-medium text-gray-700 uppercase"
                    >
                      {h.replace(/_/g, " ")}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 5).map((r, i) => (
                  <tr key={i} className="border-t">
                    {headers.map((h) => (
                      <td key={h} className="px-3 py-2 text-gray-900">
                        {r[h]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length > 5 && (
              <p className="p-2 text-sm text-gray-700">
                Showing first 5 of {rows.length}
              </p>
            )}
          </div>
        )}

        {(duplicateInfo.nameDuplicates.length > 0 ||
          duplicateInfo.memberIdDuplicates.length > 0) && (
          <div className="mt-3 p-3 rounded-lg border border-amber-200 bg-amber-50 text-base text-amber-900">
            <p className="font-medium mb-1">Duplicates detected</p>
            {duplicateInfo.nameDuplicates.length > 0 && (
              <p>
                • Same First/Last Name: {duplicateInfo.nameDuplicates.length}{" "}
                row(s)
              </p>
            )}
            {duplicateInfo.memberIdDuplicates.length > 0 && (
              <p>
                • Same LAMP ID: {duplicateInfo.memberIdDuplicates.length} row(s)
              </p>
            )}
            <p className="mt-1">
              Please resolve duplicates in your CSV to proceed.
            </p>
          </div>
        )}

        {error && (
          <div className="mt-3 p-3 rounded-lg border border-red-200 bg-red-50 text-base text-red-900 whitespace-pre-wrap">
            {error}
          </div>
        )}

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-300 px-4 py-2 text-base text-gray-800 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleImport}
            disabled={
              rows.length === 0 ||
              loading ||
              duplicateInfo.nameDuplicates.length > 0 ||
              duplicateInfo.memberIdDuplicates.length > 0
            }
            className="rounded-lg bg-primary px-4 py-2 text-base text-white hover:bg-lighthouse-navy disabled:opacity-50"
          >
            {loading ? "Importing…" : "Import"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
