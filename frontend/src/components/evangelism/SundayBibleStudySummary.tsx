"use client";

import { useCallback, useEffect, useState } from "react";
import { evangelismApi } from "@/src/lib/api";
import {
  SundayBibleStudySummary as Summary,
  SundaySessionType,
  sessionTypeLabel,
} from "@/src/types/sundayBibleStudy";
import Card from "@/src/components/ui/Card";
import ErrorMessage from "@/src/components/ui/ErrorMessage";
import LoadingSpinner from "@/src/components/ui/LoadingSpinner";
import { mostRecentSunday } from "@/src/components/evangelism/sundayBibleStudyDates";

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-gray-200 px-3 py-2">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-lg font-semibold text-gray-900">{value}</p>
    </div>
  );
}

interface SundayBibleStudySummaryViewProps {
  /** Page-header branch id; "" means all branches. */
  branchId?: string;
}

export default function SundayBibleStudySummaryView({
  branchId = "",
}: SundayBibleStudySummaryViewProps) {
  const [sessionDate, setSessionDate] = useState(mostRecentSunday);
  const [sessionType, setSessionType] = useState<"" | SundaySessionType>("");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await evangelismApi.sundayBibleStudySummary({
        session_date: sessionDate || undefined,
        session_type: sessionType || undefined,
        branch: branchId || undefined,
      });
      setSummary(response.data);
    } catch (err) {
      console.error(err);
      setError("Could not load the attendance summary.");
    } finally {
      setLoading(false);
    }
  }, [sessionDate, sessionType, branchId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-4">
      <Card>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block text-sm font-medium text-gray-700">
            Sunday
            <input
              type="date"
              value={sessionDate}
              onChange={(event) => setSessionDate(event.target.value)}
              className="mt-1 min-h-[44px] w-full rounded-md border border-gray-300 px-3"
            />
          </label>
          <label className="block text-sm font-medium text-gray-700">
            Session
            <select
              value={sessionType}
              onChange={(event) =>
                setSessionType(event.target.value as "" | SundaySessionType)
              }
              className="mt-1 min-h-[44px] w-full rounded-md border border-gray-300 px-3"
            >
              <option value="">Before and after</option>
              <option value="BEFORE_SERVICE">Before Service</option>
              <option value="AFTER_SERVICE">After Service</option>
            </select>
          </label>
        </div>
      </Card>
      {error && <ErrorMessage message={error} />}
      {loading && <LoadingSpinner />}
      {summary && !loading && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Reports" value={summary.report_count} />
            <Stat label="Cancelled" value={summary.cancelled_count} />
            <Stat label="Session attendance" value={summary.total_attendance} />
            <Stat
              label="Unique people this Sunday"
              value={summary.unique_people}
            />
          </div>
          <p className="text-sm text-gray-600">
            Session attendance adds every report. Unique people counts each
            person once across this Sunday, so someone at two reports is not
            counted twice.
          </p>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {(["BEFORE_SERVICE", "AFTER_SERVICE"] as SundaySessionType[]).map(
              (type) => {
                const bucket = summary.by_session_type[type];
                return (
                  <Card key={type}>
                    <h3 className="mb-3 text-base font-semibold text-gray-900">
                      {sessionTypeLabel(type)}
                    </h3>
                    <div className="grid grid-cols-2 gap-2">
                      <Stat label="Reports" value={bucket.report_count} />
                      <Stat label="Cancelled" value={bucket.cancelled_count} />
                      <Stat
                        label="Members"
                        value={bucket.member_attendance}
                      />
                      <Stat
                        label="First-time"
                        value={bucket.first_time_visitors}
                      />
                      <Stat
                        label="Returning"
                        value={bucket.returning_visitors}
                      />
                      <Stat label="Total" value={bucket.total_attendance} />
                    </div>
                  </Card>
                );
              },
            )}
          </div>
        </>
      )}
    </div>
  );
}
