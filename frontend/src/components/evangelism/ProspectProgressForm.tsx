"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import Button from "@/src/components/ui/Button";
import ErrorMessage from "@/src/components/ui/ErrorMessage";
import { evangelismApi } from "@/src/lib/api";
import { getLocalTodayDateString } from "@/src/lib/date";
import { useEventTypeOptions } from "@/src/hooks/useEventTypeOptions";
import {
  isClusterReportFirstActivity,
  isEvangelismReportFirstActivity,
  isReportBackedFirstActivity,
} from "@/src/lib/prospectAttendActivity";
import { Prospect } from "@/src/types/evangelism";

export default function ProspectProgressForm({
  prospect,
  onSuccess,
  onCancel,
}: {
  prospect: Prospect;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const todayDateMax = getLocalTodayDateString();
  const { eventTypes, loading: eventTypesLoading } = useEventTypeOptions();
  const [activityCode, setActivityCode] = useState("");
  const [activityDate, setActivityDate] = useState<string>(
    prospect.last_activity_date || todayDateMax,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clusterId =
    prospect.inviter_cluster?.id ?? prospect.endorsed_cluster?.id ?? null;
  const clusterHref = clusterId
    ? `/clusters?open=${clusterId}`
    : "/clusters";
  const groupId = prospect.evangelism_group?.id;
  const evangelismHref = groupId
    ? `/evangelism?group=${groupId}`
    : "/evangelism";

  const blocksSubmit = isReportBackedFirstActivity(activityCode);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!activityCode) {
      setError("Please select the activity they attended.");
      return;
    }
    if (blocksSubmit) {
      return;
    }
    if (activityDate > todayDateMax) {
      setError("Activity date cannot be in the future.");
      return;
    }
    try {
      setLoading(true);
      setError(null);
      await evangelismApi.markAttended(prospect.id, {
        last_activity_date: activityDate,
        first_activity_attended: activityCode,
      });
      onSuccess();
    } catch (err: unknown) {
      const payload =
        typeof err === "object" && err !== null && "response" in err
          ? (err as { response?: { data?: { detail?: unknown; error?: unknown } } })
              .response?.data
          : undefined;
      const detail = payload?.detail ?? payload?.error;
      setError(
        typeof detail === "string" && detail.trim()
          ? detail
          : "Failed to mark attended",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <ErrorMessage message={error} />}
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">
          Activity attended <span className="text-red-500">*</span>
        </label>
        <select
          aria-label="Activity attended"
          value={activityCode}
          onChange={(e) => {
            setActivityCode(e.target.value);
            setError(null);
          }}
          className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-ring"
          disabled={loading || eventTypesLoading}
          required
        >
          <option value="">
            {eventTypesLoading ? "Loading activities…" : "Select activity"}
          </option>
          {eventTypes.map((type) => (
            <option key={type.code} value={type.code}>
              {type.label}
            </option>
          ))}
        </select>
      </div>
      {isClusterReportFirstActivity(activityCode) && (
        <div
          className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
          role="status"
        >
          Record this attendance on a{" "}
          <Link href={clusterHref} className="font-medium text-primary underline">
            cluster weekly report
          </Link>{" "}
          instead of marking them attended here.
        </div>
      )}
      {isEvangelismReportFirstActivity(activityCode) && (
        <div
          className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
          role="status"
        >
          Record this attendance on an{" "}
          <Link
            href={evangelismHref}
            className="font-medium text-primary underline"
          >
            evangelism weekly report
          </Link>{" "}
          instead of marking them attended here.
        </div>
      )}
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">
          Activity date <span className="text-red-500">*</span>
        </label>
        <input
          type="date"
          aria-label="Activity date"
          value={activityDate}
          onChange={(e) => setActivityDate(e.target.value)}
          max={todayDateMax}
          className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-ring"
          disabled={loading}
          required
        />
      </div>
      <div className="flex flex-col-reverse gap-4 pt-4 sm:flex-row">
        <Button
          variant="tertiary"
          className="min-h-[44px] flex-1"
          onClick={onCancel}
          disabled={loading}
        >
          Cancel
        </Button>
        <Button
          className="min-h-[44px] flex-1"
          disabled={loading || blocksSubmit || !activityCode}
          type="submit"
        >
          {loading ? "Saving…" : "Mark attended"}
        </Button>
      </div>
    </form>
  );
}
