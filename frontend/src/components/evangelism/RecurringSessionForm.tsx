"use client";

import { ChangeEvent, FormEvent, useState } from "react";
import Button from "@/src/components/ui/Button";
import ErrorMessage from "@/src/components/ui/ErrorMessage";
import { RecurringSessionData } from "@/src/types/evangelism";

interface RecurringSessionFormProps {
  groupId: string;
  onSubmit: (values: RecurringSessionData) => Promise<void>;
  onCancel: () => void;
  isSubmitting: boolean;
  error?: string | null;
}

export default function RecurringSessionForm({
  groupId,
  onSubmit,
  onCancel,
  isSubmitting,
  error,
}: RecurringSessionFormProps) {
  const currentYear = new Date().getFullYear();
  const firstSundayOfNovember = new Date(currentYear, 10, 1);
  while (firstSundayOfNovember.getDay() !== 0) {
    firstSundayOfNovember.setDate(firstSundayOfNovember.getDate() + 1);
  }

  const [values, setValues] = useState<RecurringSessionData>({
    evangelism_group_id: Number(groupId),
    start_date: new Date().toISOString().split("T")[0],
    end_date: firstSundayOfNovember.toISOString().split("T")[0],
    recurrence_pattern: "weekly",
    day_of_week: 0,
    default_topic: "",
  });

  const handleChange = (field: keyof RecurringSessionData) => (
    event: ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const value = event.target.value;
    setValues((prev) => ({
      ...prev,
      [field]: field === "evangelism_group_id" || field === "day_of_week" ? Number(value) : value,
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
        const timeString = `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
        const displayTime = new Date(`2000-01-01T${timeString}`).toLocaleTimeString([], {
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700">
            Start Date <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            value={values.start_date}
            onChange={handleChange("start_date")}
            required
            className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700">End Date</label>
          <input
            type="date"
            value={values.end_date}
            onChange={handleChange("end_date")}
            className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="space-y-1">
        <label className="block text-sm font-medium text-gray-700">
          Recurrence Pattern <span className="text-red-500">*</span>
        </label>
        <select
          value={values.recurrence_pattern}
          onChange={handleChange("recurrence_pattern")}
          required
          className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="weekly">Weekly</option>
          <option value="bi_weekly">Bi-weekly</option>
          <option value="monthly">Monthly</option>
        </select>
      </div>

      {values.recurrence_pattern === "weekly" && (
        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700">
            Day of Week <span className="text-red-500">*</span>
          </label>
          <select
            value={values.day_of_week}
            onChange={handleChange("day_of_week")}
            required
            className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value={0}>Monday</option>
            <option value={1}>Tuesday</option>
            <option value={2}>Wednesday</option>
            <option value={3}>Thursday</option>
            <option value={4}>Friday</option>
            <option value={5}>Saturday</option>
            <option value={6}>Sunday</option>
          </select>
        </div>
      )}

      <div className="space-y-1">
        <label className="block text-sm font-medium text-gray-700">Default Topic</label>
        <input
          type="text"
          value={values.default_topic}
          onChange={handleChange("default_topic")}
          placeholder="Default Bible study topic"
          className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      <div className="flex gap-4 pt-4">
        <Button
          variant="tertiary"
          className="flex-1"
          onClick={onCancel}
          disabled={isSubmitting}
        >
          Cancel
        </Button>
        <Button className="flex-1" disabled={isSubmitting} type="submit">
          {isSubmitting ? "Creating..." : "Create Recurring Sessions"}
        </Button>
      </div>
    </form>
  );
}

