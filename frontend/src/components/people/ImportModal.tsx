import { useState } from "react";

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (rows: Record<string, string>[]) => Promise<void> | void;
}

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.replace(/\r\n?/g, "\n").split("\n").filter(Boolean);
  if (lines.length === 0) return [];
  const headers = lines[0]
    .split(",")
    .map((h) => h.trim().replace(/^\uFEFF/, ""));
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols: string[] = [];
    // naive CSV parsing with quotes support
    const line = lines[i];
    let cur = "";
    let inQuotes = false;
    for (let c = 0; c < line.length; c++) {
      const ch = line[c];
      if (ch === '"') {
        inQuotes = !inQuotes;
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
}: ImportModalProps) {
  const [fileName, setFileName] = useState<string>("");
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [loading, setLoading] = useState(false);
  const [duplicateInfo, setDuplicateInfo] = useState<{
    nameDuplicates: number[];
    memberIdDuplicates: number[];
  }>({ nameDuplicates: [], memberIdDuplicates: [] });

  if (!isOpen) return null;

  const handleFile = async (file: File) => {
    const text = await file.text();
    const parsed = parseCSV(text);
    setFileName(file.name);
    setRows(parsed);
    // detect duplicates
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

  const handleImport = async () => {
    try {
      setLoading(true);
      await onImport(rows);
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const headers = rows[0] ? Object.keys(rows[0]) : [];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 !-mt-4">
      <div className="bg-white rounded-lg p-6 w-[90%] max-w-3xl max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Import People (CSV)</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            ✕
          </button>
        </div>

        <div className="border border-dashed border-gray-300 rounded-lg p-6 text-center mb-4">
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleFile(f);
            }}
          />
          {fileName && <p className="mt-2 text-sm text-gray-600">{fileName}</p>}
          <p className="text-xs text-gray-500 mt-2">
            Expected headers: first_name, middle_name, last_name, email, phone,
            role, status, country, address, date_of_birth, date_first_attended,
            first_activity_attended, water_baptism_date, spirit_baptism_date,
            member_id
          </p>
        </div>

        {rows.length > 0 && (
          <div className="overflow-x-auto border rounded">
            <table className="min-w-full text-xs">
              <thead className="bg-gray-50">
                <tr>
                  {headers.map((h) => (
                    <th
                      key={h}
                      className="px-3 py-2 text-left font-medium text-gray-600 uppercase"
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
                      <td key={h} className="px-3 py-2 text-gray-800">
                        {r[h]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length > 5 && (
              <p className="p-2 text-xs text-gray-500">
                Showing first 5 of {rows.length}
              </p>
            )}
          </div>
        )}

        {(duplicateInfo.nameDuplicates.length > 0 ||
          duplicateInfo.memberIdDuplicates.length > 0) && (
          <div className="mt-3 p-3 rounded-lg border border-amber-200 bg-amber-50 text-amber-800 text-sm">
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

        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleImport}
            disabled={
              rows.length === 0 ||
              loading ||
              duplicateInfo.nameDuplicates.length > 0 ||
              duplicateInfo.memberIdDuplicates.length > 0
            }
            className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "Importing…" : "Import"}
          </button>
        </div>
      </div>
    </div>
  );
}
