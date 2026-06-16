"use client";

import { useMemo, useState } from "react";
import Card from "@/src/components/ui/Card";
import BuilderFilterForm from "./BuilderFilterForm";
import BuilderPreview from "./BuilderPreview";
import BuilderReportPicker from "./BuilderReportPicker";
import {
  defaultBuilderFilters,
  getBuilderCatalogEntry,
  type BuilderFilterValues,
  type BuilderPreviewKpi,
  type BuilderReportId,
} from "./builderCatalog";

interface BuilderDashboardProps {
  /** "" means all branches; otherwise a branch id string. */
  selectedBranchId: string;
}

function downloadCsv(blobPart: BlobPart, filename: string) {
  const blob = new Blob([blobPart], { type: "text/csv" });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.URL.revokeObjectURL(url);
}

export default function BuilderDashboard({
  selectedBranchId,
}: BuilderDashboardProps) {
  const [selectedId, setSelectedId] = useState<BuilderReportId | null>(null);
  const [filters, setFilters] = useState<BuilderFilterValues>(
    defaultBuilderFilters,
  );
  const [kpis, setKpis] = useState<BuilderPreviewKpi[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasRun, setHasRun] = useState(false);

  const branchParam = useMemo(
    () => (selectedBranchId ? Number(selectedBranchId) : undefined),
    [selectedBranchId],
  );

  const entry = selectedId ? getBuilderCatalogEntry(selectedId) : undefined;

  const handleSelectReport = (id: BuilderReportId) => {
    setSelectedId(id);
    setFilters(defaultBuilderFilters());
    setKpis(null);
    setError(null);
    setHasRun(false);
  };

  const handleRun = async () => {
    if (!entry) return;
    try {
      setLoading(true);
      setError(null);
      const data = await entry.fetchSummary({
        branch_id: branchParam,
        filters,
      });
      setKpis(entry.extractPreviewKpis(data));
      setHasRun(true);
    } catch (err) {
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data
          ?.error || "Failed to run report.";
      setError(message);
      setKpis(null);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    if (!entry) return;
    try {
      setExporting(true);
      const blobPart = await entry.exportCsv({
        branch_id: branchParam,
        filters,
      });
      downloadCsv(blobPart, entry.csvFilename);
    } catch (err) {
      console.error("Failed to export CSV", err);
      setError("Failed to export CSV.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <h3 className="text-base font-semibold text-foreground">
          Choose a report
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Pick a subject, set filters, preview headline metrics, and export CSV.
        </p>
        <div className="mt-4">
          <BuilderReportPicker
            selectedId={selectedId}
            onSelect={handleSelectReport}
          />
        </div>
      </Card>

      {entry && (
        <>
          <Card>
            <h3 className="text-base font-semibold text-foreground">Filters</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Branch scope follows the selector at the top of this page.
            </p>
            <div className="mt-4">
              <BuilderFilterForm
                entry={entry}
                filters={filters}
                onChange={(next) => {
                  setFilters(next);
                  setHasRun(false);
                  setKpis(null);
                  setError(null);
                }}
              />
            </div>
          </Card>

          <BuilderPreview
            reportLabel={entry.label}
            kpis={kpis}
            loading={loading}
            error={error}
            hasRun={hasRun}
            onRun={handleRun}
            onExport={handleExport}
            exporting={exporting}
          />
        </>
      )}
    </div>
  );
}
