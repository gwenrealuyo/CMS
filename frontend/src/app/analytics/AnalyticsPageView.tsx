"use client";

import DashboardLayout from "@/src/components/layout/DashboardLayout";
import SegmentedControl from "@/src/components/ui/SegmentedControl";
import ErrorMessage from "@/src/components/ui/ErrorMessage";
import AnalyticsBranchSelector from "@/src/components/analytics/AnalyticsBranchSelector";
import AnalyticsPlaceholder from "@/src/components/analytics/AnalyticsPlaceholder";
import ComplianceDashboard from "@/src/components/analytics/compliance/ComplianceDashboard";
import PeopleDashboard from "@/src/components/analytics/people/PeopleDashboard";
import EngagementDashboard from "@/src/components/analytics/engagement/EngagementDashboard";
import type { ReportsScopeMeta } from "@/src/types/reports";
import {
  ANALYTICS_TABS,
  ANALYTICS_TAB_META,
  type AnalyticsTab,
} from "./analyticsTabs";

interface AnalyticsPageViewProps {
  activeTab: AnalyticsTab;
  onTabChange: (tab: AnalyticsTab) => void;
  meta: ReportsScopeMeta | null;
  metaLoading: boolean;
  metaError: string | null;
  selectedBranchId: string;
  onBranchChange: (value: string) => void;
}

export default function AnalyticsPageView({
  activeTab,
  onTabChange,
  meta,
  metaLoading,
  metaError,
  selectedBranchId,
  onBranchChange,
}: AnalyticsPageViewProps) {
  const tabMeta = ANALYTICS_TAB_META[activeTab];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground md:text-3xl">
              Analytics
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Church-wide stats and reports.
            </p>
          </div>
          {!metaLoading && !metaError && (
            <AnalyticsBranchSelector
              meta={meta}
              value={selectedBranchId}
              onChange={onBranchChange}
            />
          )}
        </div>

        {metaError ? (
          <ErrorMessage message={metaError} />
        ) : (
          <>
            <div className="overflow-x-auto">
              <SegmentedControl
                value={activeTab}
                onChange={onTabChange}
                options={ANALYTICS_TABS}
              />
            </div>

            {activeTab === "compliance" ? (
              <ComplianceDashboard selectedBranchId={selectedBranchId} />
            ) : activeTab === "people" ? (
              <PeopleDashboard selectedBranchId={selectedBranchId} />
            ) : activeTab === "engagement" ? (
              <EngagementDashboard selectedBranchId={selectedBranchId} />
            ) : (
              <AnalyticsPlaceholder
                title={tabMeta.title}
                description={tabMeta.description}
              />
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
