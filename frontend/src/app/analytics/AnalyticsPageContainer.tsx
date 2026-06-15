"use client";

import { useEffect, useState } from "react";
import { reportsApi } from "@/src/lib/api";
import type { ReportsScopeMeta } from "@/src/types/reports";
import AnalyticsPageView from "./AnalyticsPageView";
import type { AnalyticsTab } from "./analyticsTabs";

export default function AnalyticsPageContainer() {
  const [activeTab, setActiveTab] = useState<AnalyticsTab>("overview");
  const [meta, setMeta] = useState<ReportsScopeMeta | null>(null);
  const [metaLoading, setMetaLoading] = useState(true);
  const [metaError, setMetaError] = useState<string | null>(null);
  const [selectedBranchId, setSelectedBranchId] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    setMetaLoading(true);
    reportsApi
      .getMeta()
      .then((res) => {
        if (cancelled) return;
        setMeta(res.data);
        setSelectedBranchId(
          res.data.effective_branch_id != null
            ? String(res.data.effective_branch_id)
            : "",
        );
        setMetaError(null);
      })
      .catch((err) => {
        console.error("Failed to load reporting scope", err);
        if (!cancelled) setMetaError("Failed to load reporting scope.");
      })
      .finally(() => {
        if (!cancelled) setMetaLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <AnalyticsPageView
      activeTab={activeTab}
      onTabChange={setActiveTab}
      meta={meta}
      metaLoading={metaLoading}
      metaError={metaError}
      selectedBranchId={selectedBranchId}
      onBranchChange={setSelectedBranchId}
    />
  );
}
