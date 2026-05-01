"use client";

import { useMemo, useState } from "react";

export interface ResourceOption {
  id: number;
  name: string;
  /** Right column label (e.g. cluster code). Defaults to #{id} when omitted. */
  trailingLabel?: string;
}

interface ResourceAssignmentMultiPickerProps {
  resources: ResourceOption[];
  selectedIds: number[];
  onSelectedIdsChange: (ids: number[]) => void;
  loading?: boolean;
  disabled?: boolean;
  emptyMessage?: string;
  /** For accessibility: id of element that labels this control */
  labelledBy?: string;
}

export default function ResourceAssignmentMultiPicker({
  resources,
  selectedIds,
  onSelectedIdsChange,
  loading = false,
  disabled = false,
  emptyMessage = "No resources loaded.",
  labelledBy,
}: ResourceAssignmentMultiPickerProps) {
  const [query, setQuery] = useState("");
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return resources;
    return resources.filter((r) => {
      const nameHit = r.name.toLowerCase().includes(q);
      const trail = (r.trailingLabel ?? "").toLowerCase();
      return nameHit || trail.includes(q);
    });
  }, [resources, query]);

  const filteredIds = useMemo(() => filtered.map((r) => r.id), [filtered]);

  const allFilteredSelected =
    filteredIds.length > 0 && filteredIds.every((id) => selectedSet.has(id));

  const toggleId = (id: number) => {
    if (disabled) return;
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onSelectedIdsChange([...next].sort((a, b) => a - b));
  };

  const selectAllFiltered = () => {
    if (disabled || filteredIds.length === 0) return;
    const next = new Set(selectedIds);
    for (const id of filteredIds) next.add(id);
    onSelectedIdsChange([...next].sort((a, b) => a - b));
  };

  const clearSelection = () => {
    if (disabled) return;
    onSelectedIdsChange([]);
  };

  const countLabel = `${selectedIds.length} selected`;

  return (
    <div className="space-y-3" role="group" aria-labelledby={labelledBy}>
      <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
        <label className="sr-only" htmlFor="resource-multi-search">
          Filter resources by name
        </label>
        <input
          id="resource-multi-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search resources…"
          disabled={disabled || loading}
          className="w-full sm:max-w-xs min-h-[40px] px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB] disabled:bg-gray-100"
          autoComplete="off"
        />
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={selectAllFiltered}
            disabled={
              disabled || loading || filteredIds.length === 0 || allFilteredSelected
            }
            className="text-sm font-medium text-[#2563EB] hover:text-blue-800 disabled:opacity-40 disabled:cursor-not-allowed min-h-[40px] px-2"
          >
            Select all shown
          </button>
          <button
            type="button"
            onClick={clearSelection}
            disabled={disabled || loading || selectedIds.length === 0}
            className="text-sm font-medium text-gray-700 hover:text-gray-900 disabled:opacity-40 disabled:cursor-not-allowed min-h-[40px] px-2"
          >
            Clear selection
          </button>
        </div>
      </div>

      <p className="text-xs text-gray-600" aria-live="polite">
        {countLabel}
        {query.trim() ? ` · ${filtered.length} shown` : ""}
      </p>

      {loading ? (
        <div className="flex items-center gap-2 py-6 text-sm text-gray-500 border border-gray-200 rounded-lg bg-gray-50 justify-center">
          <span>Loading resources…</span>
        </div>
      ) : resources.length === 0 ? (
        <div className="py-6 text-sm text-gray-500 text-center border border-dashed border-gray-200 rounded-lg bg-gray-50">
          {emptyMessage}
        </div>
      ) : (
        <ul
          className="max-h-56 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100 bg-white"
          role="listbox"
          aria-multiselectable="true"
        >
          {filtered.length === 0 ? (
            <li className="px-3 py-4 text-sm text-gray-500 text-center">
              No matches for &quot;{query.trim()}&quot;.
            </li>
          ) : (
            filtered.map((r) => {
              const checked = selectedSet.has(r.id);
              return (
                <li key={r.id} role="option" aria-selected={checked}>
                  <label className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-gray-50 focus-within:bg-gray-50 min-h-[44px]">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleId(r.id)}
                      disabled={disabled}
                      className="h-4 w-4 rounded border-gray-300 text-[#2563EB] focus:ring-[#2563EB]"
                    />
                    <span className="text-sm text-gray-900 flex-1 truncate">
                      {r.name}
                    </span>
                    <span className="text-xs text-gray-400 shrink-0 font-mono">
                      {r.trailingLabel ?? `#${r.id}`}
                    </span>
                  </label>
                </li>
              );
            })
          )}
        </ul>
      )}
    </div>
  );
}
