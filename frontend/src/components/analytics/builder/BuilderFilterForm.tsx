"use client";

import type { ComplianceStatus } from "@/src/types/cluster";
import type {
  BuilderCatalogEntry,
  BuilderFilterValues,
} from "./builderCatalog";

interface BuilderFilterFormProps {
  entry: BuilderCatalogEntry;
  filters: BuilderFilterValues;
  onChange: (filters: BuilderFilterValues) => void;
}

const MONTH_OPTIONS = [6, 12, 24] as const;

function currentYear() {
  return new Date().getFullYear();
}

export default function BuilderFilterForm({
  entry,
  filters,
  onChange,
}: BuilderFilterFormProps) {
  const yearOptions = [currentYear(), currentYear() - 1, currentYear() - 2];

  const update = (patch: Partial<BuilderFilterValues>) => {
    onChange({ ...filters, ...patch });
  };

  return (
    <div className="flex flex-wrap items-end gap-4">
      {entry.filterFields.includes("months") && (
        <div>
          <label
            htmlFor="builder-months"
            className="mb-1 block text-sm font-medium text-muted-foreground"
          >
            Trend window (months)
          </label>
          <select
            id="builder-months"
            value={filters.months}
            onChange={(e) => update({ months: Number(e.target.value) })}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            {MONTH_OPTIONS.map((m) => (
              <option key={m} value={m}>
                Last {m} months
              </option>
            ))}
          </select>
        </div>
      )}

      {entry.filterFields.includes("year") && (
        <div>
          <label
            htmlFor="builder-year"
            className="mb-1 block text-sm font-medium text-muted-foreground"
          >
            Year
          </label>
          <select
            id="builder-year"
            value={filters.year}
            onChange={(e) => update({ year: Number(e.target.value) })}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            {yearOptions.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
      )}

      {entry.filterFields.includes("month") && (
        <div>
          <label
            htmlFor="builder-month"
            className="mb-1 block text-sm font-medium text-muted-foreground"
          >
            Month (optional)
          </label>
          <select
            id="builder-month"
            value={filters.month}
            onChange={(e) =>
              update({
                month: e.target.value === "" ? "" : Number(e.target.value),
              })
            }
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">Full year</option>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>
                {new Date(2000, m - 1, 1).toLocaleString("default", {
                  month: "long",
                })}
              </option>
            ))}
          </select>
        </div>
      )}

      {entry.filterFields.includes("start_date") && (
        <div>
          <label
            htmlFor="builder-start-date"
            className="mb-1 block text-sm font-medium text-muted-foreground"
          >
            Start date
          </label>
          <input
            id="builder-start-date"
            type="date"
            value={filters.start_date}
            onChange={(e) => update({ start_date: e.target.value })}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>
      )}

      {entry.filterFields.includes("end_date") && (
        <div>
          <label
            htmlFor="builder-end-date"
            className="mb-1 block text-sm font-medium text-muted-foreground"
          >
            End date
          </label>
          <input
            id="builder-end-date"
            type="date"
            value={filters.end_date}
            onChange={(e) => update({ end_date: e.target.value })}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>
      )}

      {entry.filterFields.includes("status") && (
        <div>
          <label
            htmlFor="builder-status"
            className="mb-1 block text-sm font-medium text-muted-foreground"
          >
            Status
          </label>
          <select
            id="builder-status"
            value={filters.status}
            onChange={(e) =>
              update({ status: e.target.value as ComplianceStatus | "ALL" })
            }
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="ALL">All statuses</option>
            <option value="COMPLIANT">Compliant</option>
            <option value="NON_COMPLIANT">Non-compliant</option>
            <option value="PARTIAL">Partial</option>
          </select>
        </div>
      )}
    </div>
  );
}
