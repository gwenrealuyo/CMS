"use client";

import KpiCard from "@/src/components/analytics/KpiCard";
import AnalyticsExportButton from "@/src/components/analytics/AnalyticsExportButton";
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
            <p className="text-base text-foreground/70">
              {hasRun
                ? `Headline metrics for ${reportLabel}.`
                : "Run the report to preview headline metrics."}
            </p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap">
            <Button
              type="button"
              onClick={onRun}
              disabled={loading}
              className="w-full sm:w-auto"
            >
              {loading ? "Running…" : "Run Report"}
            </Button>
            <AnalyticsExportButton
              onClick={onExport}
              disabled={!hasRun}
              loading={exporting}
              reportName={reportLabel}
            />
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
