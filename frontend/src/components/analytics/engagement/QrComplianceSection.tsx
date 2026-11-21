"use client";

import { useCallback, useEffect, useState } from "react";
import { reportsApi } from "@/src/lib/api";
import type { QrComplianceSummary } from "@/src/types/reports";
import Card from "@/src/components/ui/Card";
import AnalyticsExportButton from "@/src/components/analytics/AnalyticsExportButton";
import LoadingSpinner from "@/src/components/ui/LoadingSpinner";
import { formatLampIdDisplay } from "@/src/lib/events/checkInUtils";

interface QrComplianceSectionProps {
  branchId?: number;
  months: number;
}

const MIN_MISSES_OPTIONS = [1, 2, 3, 5] as const;

function formatRate(rate: number | null): string {
  return rate == null ? "—" : `${rate.toFixed(1)}%`;
}

function formatPeriod(period: string): string {
  const [year, month] = period.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString("en-US", {
    month: "short",
    year: "2-digit",
  });
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Date(`${value}T12:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function QrComplianceSection({
  branchId,
  months,
}: QrComplianceSectionProps) {
  const [data, setData] = useState<QrComplianceSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [minMisses, setMinMisses] = useState<number>(2);
  const [exporting, setExporting] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await reportsApi.getQrCompliance({
        branch_id: branchId,
        months,
        min_misses: minMisses,
      });
      setData(res.data);
    } catch {
      setError("Failed to load QR compliance.");
    } finally {
      setLoading(false);
    }
  }, [branchId, months, minMisses]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleExport = async () => {
    try {
      setExporting(true);
      const res = await reportsApi.exportQrComplianceCSV({
        branch_id: branchId,
        months,
        min_misses: minMisses,
      });
      const blob = new Blob([res.data as BlobPart], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "qr_compliance.csv";
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Failed to export QR compliance CSV", err);
    } finally {
      setExporting(false);
    }
  };

  const summary = data?.summary;
  const trend = (data?.monthly_trend ?? []).filter((row) => row.tracked > 0);

  return (
    <Card title="Onsite QR Compliance">
      <div className="space-y-5">
        <p className="text-sm text-muted-foreground">
          Onsite check-ins where staff recorded whether the member brought their
          QR. Camera scans count as brought; manual entries tagged &quot;Came
          without QR&quot; count as no QR.
        </p>

        {error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : loading && !data ? (
          <div className="flex justify-center py-8">
            <LoadingSpinner />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <div className="rounded-lg border border-green-200 bg-green-50/80 p-4">
                <p className="text-2xl font-semibold text-green-700">
                  {formatRate(summary?.compliance_rate ?? null)}
                </p>
                <p className="text-sm text-muted-foreground">QR compliance</p>
              </div>
              <div className="rounded-lg border border-gray-200 bg-white p-4">
                <p className="text-2xl font-semibold text-lighthouse-navy">
                  {summary?.tracked ?? 0}
                </p>
                <p className="text-sm text-muted-foreground">
                  Onsite check-ins tracked
                </p>
              </div>
              <div className="rounded-lg border border-emerald-200 bg-emerald-50/80 p-4">
                <p className="text-2xl font-semibold text-emerald-700">
                  {summary?.brought_qr ?? 0}
                </p>
                <p className="text-sm text-muted-foreground">Brought QR</p>
              </div>
              <div className="rounded-lg border border-orange-200 bg-orange-50/80 p-4">
                <p className="text-2xl font-semibold text-orange-700">
                  {summary?.no_qr ?? 0}
                </p>
                <p className="text-sm text-muted-foreground">No QR</p>
              </div>
            </div>

            {trend.length > 0 ? (
              <div>
                <h4 className="mb-2 text-sm font-semibold text-lighthouse-navy">
                  Monthly compliance
                </h4>
                <ul className="space-y-1.5">
                  {trend.map((row) => (
                    <li
                      key={row.period}
                      className="flex items-center gap-3 text-sm"
                    >
                      <span className="w-16 shrink-0 text-muted-foreground">
                        {formatPeriod(row.period)}
                      </span>
                      <div className="h-2.5 flex-1 rounded-full bg-gray-200">
                        <div
                          className="h-2.5 rounded-full bg-green-500"
                          style={{
                            width: `${Math.min(100, row.compliance_rate ?? 0)}%`,
                          }}
                        />
                      </div>
                      <span className="w-28 shrink-0 text-right tabular-nums text-gray-700">
                        {formatRate(row.compliance_rate)}{" "}
                        <span className="text-xs text-muted-foreground">
                          ({row.no_qr}/{row.tracked})
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div>
              <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h4 className="text-sm font-semibold text-lighthouse-navy">
                    Repeat no-QR members
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    Members who came without their QR at least{" "}
                    {data?.min_misses ?? minMisses} time
                    {(data?.min_misses ?? minMisses) === 1 ? "" : "s"} in this
                    window.
                  </p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                  <div>
                    <label
                      htmlFor="qr-min-misses"
                      className="mb-1 block text-xs font-medium text-muted-foreground"
                    >
                      Minimum no-QR
                    </label>
                    <select
                      id="qr-min-misses"
                      value={minMisses}
                      onChange={(e) => setMinMisses(Number(e.target.value))}
                      className="h-[42px] w-full rounded-md border border-gray-300 px-3 py-2 sm:w-36"
                    >
                      {MIN_MISSES_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {option}+ time{option === 1 ? "" : "s"}
                        </option>
                      ))}
                    </select>
                  </div>
                  <AnalyticsExportButton
                    onClick={handleExport}
                    loading={exporting}
                    reportName="QR compliance"
                  />
                </div>
              </div>

              {(data?.members ?? []).length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  No members match this threshold.
                </p>
              ) : (
                <div className="max-h-96 overflow-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="sticky top-0 bg-gray-50">
                      <tr>
                        {[
                          "Member",
                          "LAMP ID",
                          "Cluster",
                          "No QR",
                          "Tracked",
                          "No QR %",
                          "Last no QR",
                        ].map((heading) => (
                          <th
                            key={heading}
                            className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
                          >
                            {heading}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 bg-white">
                      {data?.members.map((row) => (
                        <tr key={row.person_id}>
                          <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">
                            {row.name}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-700">
                            {row.member_id
                              ? formatLampIdDisplay(row.member_id)
                              : "—"}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-700">
                            {row.cluster_code || "—"}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-sm font-semibold text-orange-700">
                            {row.no_qr}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-700">
                            {row.tracked}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-700">
                            {formatRate(row.no_qr_rate)}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-700">
                            {formatDate(row.last_no_qr_date)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </Card>
  );
}
