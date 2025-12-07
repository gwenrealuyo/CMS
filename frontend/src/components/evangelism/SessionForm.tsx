"use client";

import { ChangeEvent, FormEvent, useState } from "react";
import Button from "@/src/components/ui/Button";
import ErrorMessage from "@/src/components/ui/ErrorMessage";
import { EvangelismSession } from "@/src/types/evangelism";

export interface SessionFormValues {
  evangelism_group_id: string;
  session_date: string;
  session_time: string;
  topic: string;
  notes: string;
  create_event?: boolean;
}

interface SessionFormProps {
  groupId: string;
  onSubmit: (values: SessionFormValues) => Promise<void>;
  onCancel: () => void;
  isSubmitting: boolean;
  error?: string | null;
  submitLabel?: string;
  initialData?: EvangelismSession;
}

export default function SessionForm({
  groupId,
  onSubmit,
  onCancel,
  isSubmitting,
  error,
  submitLabel = "Create Session",
  initialData,
}: SessionFormProps) {
  const [values, setValues] = useState<SessionFormValues>({
    evangelism_group_id: groupId,
    session_date: initialData?.session_date
      ? new Date(initialData.session_date).toISOString().split("T")[0]
      : new Date().toISOString().split("T")[0],
    session_time: initialData?.session_time || "",
    topic: initialData?.topic || "",
    notes: initialData?.notes || "",
    create_event: false, // Default to unchecked
  });

  const handleChange =
    (field: keyof SessionFormValues) =>
    (
      event: ChangeEvent<
        HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
      >
    ) => {
      const value =
        event.target.type === "checkbox"
          ? (event.target as HTMLInputElement).checked
          : event.target.value;
      setValues((prev) => ({
        ...prev,
        [field]: value,
      }));
    };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    await onSubmit(values);
  };

  const generateTimeOptions = () => {
    const options = [];
    for (let hour = 6; hour < 24; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        const timeString = `${hour.toString().padStart(2, "0")}:${minute
          .toString()
          .padStart(2, "0")}`;
        const displayTime = new Date(
          `2000-01-01T${timeString}`
        ).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        });
        options.push({ value: timeString, label: displayTime });
      }
    }
    return options;
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      {error && <ErrorMessage message={error} />}

      <div className="space-y-1">
        <label className="block text-sm font-medium text-gray-700">
          Session Date <span className="text-red-500">*</span>
        </label>
        <input
          type="date"
          value={values.session_date}
          onChange={handleChange("session_date")}
          required
          className="w-full rounded-md border border-gray-200 px-3 py-2 min-h-[44px] text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      <div className="space-y-1">
        <label className="block text-sm font-medium text-gray-700">
          Session Time
        </label>
        <select
          value={values.session_time}
          onChange={handleChange("session_time")}
          className="w-full rounded-md border border-gray-200 px-3 py-2 min-h-[44px] text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="">Select time</option>
          {generateTimeOptions().map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1">
        <label className="block text-sm font-medium text-gray-700">Topic</label>
        <input
          type="text"
          value={values.topic}
          onChange={handleChange("topic")}
          placeholder="Bible study topic"
          className="w-full rounded-md border border-gray-200 px-3 py-2 min-h-[44px] text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      <div className="space-y-1">
        <label className="block text-sm font-medium text-gray-700">Notes</label>
        <textarea
          value={values.notes}
          onChange={handleChange("notes")}
          placeholder="Session notes..."
          rows={4}
          className="w-full rounded-md border border-gray-200 px-3 py-2 min-h-[44px] text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      <div className="flex items-center">
        <input
          type="checkbox"
          id="create_event"
          checked={values.create_event ?? false}
          onChange={handleChange("create_event")}
          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
        />
        <label htmlFor="create_event" className="ml-2 text-sm text-gray-700">
          Create event for this session
        </label>
      </div>

      <div className="flex flex-col-reverse sm:flex-row gap-4 pt-4">
        <Button
          variant="tertiary"
          className="flex-1 min-h-[44px]"
          onClick={onCancel}
          disabled={isSubmitting}
        >
          Cancel
        </Button>
        <Button
          className="flex-1 min-h-[44px]"
          disabled={isSubmitting}
          type="submit"
        >
          {isSubmitting ? "Saving..." : submitLabel}
        </Button>
      </div>
    </form>
  );
}
