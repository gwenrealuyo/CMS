"use client";

import { ArrowDownTrayIcon } from "@heroicons/react/24/outline";
import Button from "@/src/components/ui/Button";

interface AnalyticsExportButtonProps {
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  /** Used for aria-label context, e.g. "people summary". */
  reportName?: string;
  className?: string;
}

export default function AnalyticsExportButton({
  onClick,
  disabled = false,
  loading = false,
  reportName,
  className = "",
}: AnalyticsExportButtonProps) {
  const ariaLabel = reportName
    ? `Download ${reportName} report`
    : "Download report";

  return (
    <Button
      type="button"
      variant="secondary"
      onClick={onClick}
      disabled={disabled || loading}
      aria-label={ariaLabel}
      className={`h-[42px] gap-2 ${className}`.trim()}
    >
      <ArrowDownTrayIcon className="h-5 w-5 shrink-0" aria-hidden />
      {loading ? "Downloading…" : "Download report"}
    </Button>
  );
}
