"use client";

import { FormEvent, useState } from "react";
import Button from "@/src/components/ui/Button";
import ErrorMessage from "@/src/components/ui/ErrorMessage";
import { evangelismApi } from "@/src/lib/api";
import { Prospect } from "@/src/types/evangelism";

const PIPELINE_STAGES = [
  { value: "INVITED", label: "Invited" },
  { value: "ATTENDED", label: "Attended" },
  { value: "TAKEN_NCC", label: "NCC" },
  { value: "BAPTIZED", label: "Baptized" },
  { value: "RECEIVED_HG", label: "Received HG" },
  { value: "REACHED", label: "Reached" },
];

export default function ProspectProgressForm({
  prospect,
  onSuccess,
  onCancel,
}: {
  prospect: Prospect;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [selectedStage, setSelectedStage] = useState<string>(
    prospect.pipeline_stage === "INVITED" ? "ATTENDED" : prospect.pipeline_stage,
  );
  const [activityDate, setActivityDate] = useState<string>(
    prospect.last_activity_date || new Date().toISOString().split("T")[0],
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedStage) {
      setError("Please select a pipeline stage.");
      return;
    }
    try {
      setLoading(true);
      setError(null);
      if (selectedStage === "ATTENDED") {
        await evangelismApi.markAttended(prospect.id, {
          last_activity_date: activityDate,
        });
      } else {
        await evangelismApi.updateProgress(prospect.id, {
          pipeline_stage: selectedStage,
          last_activity_date: activityDate,
        });
      }
      onSuccess();
    } catch (err: unknown) {
      const detail =
        err &&
        typeof err === "object" &&
        "response" in err &&
        (err as { response?: { data?: { detail?: string } } }).response?.data
          ?.detail;
      setError(detail || "Failed to update progress");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <ErrorMessage message={error} />}
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">
          Pipeline Stage <span className="text-red-500">*</span>
        </label>
        <select
          value={selectedStage}
          onChange={(e) => setSelectedStage(e.target.value)}
          className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-ring"
          disabled={loading}
        >
          {PIPELINE_STAGES.map((stage) => (
            <option key={stage.value} value={stage.value}>
              {stage.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">
          Activity Date <span className="text-red-500">*</span>
        </label>
        <input
          type="date"
          value={activityDate}
          onChange={(e) => setActivityDate(e.target.value)}
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
        <Button className="min-h-[44px] flex-1" disabled={loading} type="submit">
          {loading ? "Updating..." : "Update Progress"}
        </Button>
      </div>
    </form>
  );
}
