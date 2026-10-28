"use client";

import { useEffect, useState } from "react";
import { evangelismApi } from "@/src/lib/api";
import BibleSharersCoverage from "@/src/components/evangelism/BibleSharersCoverage";
import SundayBibleStudyReports from "@/src/components/evangelism/SundayBibleStudyReports";
import SundayBibleStudySummaryView from "@/src/components/evangelism/SundayBibleStudySummary";

type SharerView = "roster" | "reports" | "summary";

interface BibleSharersSectionProps {
  canWriteReports: boolean;
  canDeleteReports: boolean;
  /** True only for a new navbar quick-action request to open a blank report. */
  openFormRequest?: boolean;
  /** Called once that blank report has been opened. */
  onReportRequestHandled?: () => void;
}

const VIEWS: { id: SharerView; label: string }[] = [
  { id: "roster", label: "Roster" },
  { id: "reports", label: "Sunday Bible Study Reports" },
  { id: "summary", label: "Attendance Summary" },
];

export default function BibleSharersSection({
  canWriteReports,
  canDeleteReports,
  openFormRequest = false,
  onReportRequestHandled,
}: BibleSharersSectionProps) {
  const [view, setView] = useState<SharerView>("roster");
  const [facilitators, setFacilitators] = useState<
    { id: number; name: string }[]
  >([]);

  useEffect(() => {
    if (!openFormRequest) return;
    setView("reports");
  }, [openFormRequest]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const response = await evangelismApi.sundayBibleStudyFacilitators();
        if (cancelled) return;
        setFacilitators(response.data);
      } catch (err) {
        console.error(err);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex gap-2 overflow-x-auto border-b border-gray-200">
        {VIEWS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setView(item.id)}
            className={`shrink-0 border-b-2 px-3 py-3 text-sm font-medium ${
              view === item.id
                ? "border-primary text-primary"
                : "border-transparent text-gray-500"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>
      {view === "roster" && <BibleSharersCoverage />}
      {view === "reports" && (
        <SundayBibleStudyReports
          facilitators={facilitators}
          canWrite={canWriteReports}
          canDelete={canDeleteReports}
          openFormRequest={openFormRequest}
          onFormRequestHandled={onReportRequestHandled}
        />
      )}
      {view === "summary" && <SundayBibleStudySummaryView />}
    </div>
  );
}
