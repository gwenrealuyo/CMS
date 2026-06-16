"use client";

import KpiCard from "@/src/components/analytics/KpiCard";
import Button from "@/src/components/ui/Button";
import Card from "@/src/components/ui/Card";
import ErrorMessage from "@/src/components/ui/ErrorMessage";
import LoadingSpinner from "@/src/components/ui/LoadingSpinner";
import type { BuilderPreviewKpi } from "./builderCatalog";

interface BuilderPreviewProps {
  reportLabel: string;
  kpis: BuilderPreviewKpi[] | null;
  loading: boolean;
  error: string | null;
  hasRun: boolean;
  onRun: () => void;
  onExport: () => void;
  exporting: boolean;
}

export default function BuilderPreview({
  reportLabel,
  kpis,
  loading,
  error,
  hasRun,
  onRun,
  onExport,
  exporting,
}: BuilderPreviewProps) {
  return (
    <Card>
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-base font-semibold text-foreground">Preview</h3>
            <p className="text-sm text-muted-foreground">
              {hasRun
                ? `Headline metrics for ${reportLabel}.`
                : "Run the report to preview headline metrics."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={onRun} disabled={loading}>
              {loading ? "Running…" : "Run Report"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={onExport}
              disabled={exporting || !hasRun}
            >
              {exporting ? "Exporting…" : "Export CSV"}
            </Button>
          </div>
        </div>

        {error && <ErrorMessage message={error} />}

        {loading && (
          <div className="flex items-center justify-center py-8">
            <LoadingSpinner />
          </div>
        )}

        {!loading && hasRun && kpis && kpis.length > 0 && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {kpis.map((kpi) => (
              <KpiCard
                key={kpi.label}
                label={kpi.label}
                value={kpi.value}
                hint={kpi.hint}
              />
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}
