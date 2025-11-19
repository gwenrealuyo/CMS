"use client";

import { ChangeEvent, FormEvent, useState, useMemo } from "react";
import Button from "@/src/components/ui/Button";
import ErrorMessage from "@/src/components/ui/ErrorMessage";
import { SundaySchoolClass, RecurringSessionData } from "@/src/types/sundaySchool";

interface RecurringSessionFormProps {
  classData: SundaySchoolClass;
  onSubmit: (values: RecurringSessionData) => Promise<void>;
  onCancel: () => void;
  isSubmitting: boolean;
  error?: string | null;
}

const DAYS_OF_WEEK = [
  { label: "Monday", value: 0 },
  { label: "Tuesday", value: 1 },
  { label: "Wednesday", value: 2 },
  { label: "Thursday", value: 3 },
  { label: "Friday", value: 4 },
  { label: "Saturday", value: 5 },
  { label: "Sunday", value: 6 },
];

const getFirstSundayOfNovember = (year: number): string => {
  const nov1 = new Date(year, 10, 1); // Month 10 = November
  const dayOfWeek = nov1.getDay(); // 0 = Sunday, 1 = Monday, etc.
  const daysToAdd = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
  const firstSunday = new Date(nov1);
  firstSunday.setDate(nov1.getDate() + daysToAdd);
  return firstSunday.toISOString().split('T')[0];
};

export default function RecurringSessionForm({
  classData,
  onSubmit,
  onCancel,
  isSubmitting,
  error,
}: RecurringSessionFormProps) {
  const currentYear = new Date().getFullYear();
  const defaultEndDate = getFirstSundayOfNovember(currentYear);
  
  const [values, setValues] = useState<RecurringSessionData>({
    sunday_school_class_id: classData.id,
    start_date: new Date().toISOString().split("T")[0],
    end_date: defaultEndDate,
    num_occurrences: "",
    recurrence_pattern: "weekly",
    day_of_week: 6, // Default to Sunday
    default_lesson_title: "",
  });

  const [useEndDate, setUseEndDate] = useState(true);

  const previewDates = useMemo(() => {
    if (!values.start_date) return [];
    const dates: string[] = [];
    const start = new Date(values.start_date);
    let current = new Date(start);
    const maxDates = 10; // Show preview of first 10 dates

    if (values.recurrence_pattern === "weekly" && values.day_of_week !== undefined) {
      // Adjust to the correct day of week
      const currentDay = current.getDay();
      const targetDay = values.day_of_week === 0 ? 0 : values.day_of_week; // Sunday = 0
      const daysToAdd = (targetDay - currentDay + 7) % 7;
      if (daysToAdd > 0) {
        current.setDate(current.getDate() + daysToAdd);
      }
    }

    const endCondition = useEndDate
      ? values.end_date
        ? new Date(values.end_date)
        : null
      : values.num_occurrences
      ? parseInt(values.num_occurrences)
      : null;

    for (let i = 0; i < maxDates; i++) {
      if (useEndDate && endCondition && current > endCondition) break;
      if (!useEndDate && endCondition && i >= endCondition) break;

      dates.push(new Date(current).toISOString().split("T")[0]);

      // Calculate next date
      if (values.recurrence_pattern === "weekly") {
        current.setDate(current.getDate() + 7);
      } else if (values.recurrence_pattern === "bi_weekly") {
        current.setDate(current.getDate() + 14);
      } else if (values.recurrence_pattern === "monthly") {
        current.setMonth(current.getMonth() + 1);
      }
    }

    return dates;
  }, [values, useEndDate]);

  const handleChange = (field: keyof RecurringSessionData) => (
    event: ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const value = event.target.value;
    setValues((prev) => ({
      ...prev,
      [field]: field === "num_occurrences" ? (value ? parseInt(value) : undefined) : value,
    }));
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const payload: RecurringSessionData = {
      sunday_school_class_id: classData.id,
      start_date: values.start_date,
      recurrence_pattern: values.recurrence_pattern,
      default_lesson_title: values.default_lesson_title,
    };

    if (useEndDate) {
      if (values.end_date) {
        payload.end_date = values.end_date;
      }
    } else {
      if (values.num_occurrences) {
        payload.num_occurrences = values.num_occurrences;
      }
    }

    if (values.recurrence_pattern === "weekly") {
      payload.day_of_week = values.day_of_week;
    }

    await onSubmit(payload);
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      {error && <ErrorMessage message={error} />}

      <div className="space-y-1">
        <label className="block text-sm font-medium text-gray-700">Class</label>
        <input
          type="text"
          value={classData.name}
          disabled
          className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm bg-gray-50 text-gray-600"
        />
      </div>

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
        <label className="block text-sm font-medium text-gray-700">Recurrence Pattern</label>
        <select
          value={values.recurrence_pattern}
          onChange={handleChange("recurrence_pattern")}
          className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="weekly">Weekly</option>
          <option value="bi_weekly">Bi-weekly</option>
          <option value="monthly">Monthly</option>
        </select>
      </div>

      {values.recurrence_pattern === "weekly" && (
        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700">Day of Week</label>
          <select
            value={values.day_of_week}
            onChange={(e) => setValues({ ...values, day_of_week: parseInt(e.target.value) })}
            className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            {DAYS_OF_WEEK.map((day) => (
              <option key={day.value} value={day.value}>
                {day.label}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="space-y-2">
        <div className="flex items-center space-x-2">
          <input
            type="radio"
            id="use_end_date"
            checked={useEndDate}
            onChange={() => setUseEndDate(true)}
            className="text-blue-600 focus:ring-blue-500"
          />
          <label htmlFor="use_end_date" className="text-sm font-medium text-gray-700">
            End Date
          </label>
        </div>
        {useEndDate && (
          <input
            type="date"
            value={values.end_date}
            onChange={handleChange("end_date")}
            className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        )}

        <div className="flex items-center space-x-2">
          <input
            type="radio"
            id="use_num_occurrences"
            checked={!useEndDate}
            onChange={() => setUseEndDate(false)}
            className="text-blue-600 focus:ring-blue-500"
          />
          <label htmlFor="use_num_occurrences" className="text-sm font-medium text-gray-700">
            Number of Occurrences
          </label>
        </div>
        {!useEndDate && (
          <input
            type="number"
            min="1"
            max="52"
            value={values.num_occurrences || ""}
            onChange={handleChange("num_occurrences")}
            placeholder="e.g., 12"
            className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        )}
      </div>

      <div className="space-y-1">
        <label className="block text-sm font-medium text-gray-700">Default Lesson Title</label>
        <input
          type="text"
          value={values.default_lesson_title}
          onChange={handleChange("default_lesson_title")}
          placeholder="Optional: default lesson title for all sessions"
          className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      {previewDates.length > 0 && (
        <div className="bg-gray-50 border border-gray-200 rounded-md p-4">
          <p className="text-sm font-medium text-gray-700 mb-2">
            Preview (first {previewDates.length} sessions):
          </p>
          <div className="space-y-1">
            {previewDates.map((date, idx) => (
              <p key={idx} className="text-xs text-gray-600">
                {new Date(date).toLocaleDateString()}
              </p>
            ))}
          </div>
        </div>
      )}

      <div className="bg-blue-50 border border-blue-200 rounded-md p-3 text-sm text-blue-800">
        <p className="font-medium">Note:</p>
        <p>Events will be automatically created on the calendar for each session.</p>
      </div>

      <div className="flex gap-4 pt-4">
        <Button type="button" variant="tertiary" className="flex-1" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" className="flex-1" disabled={isSubmitting}>
          {isSubmitting ? "Creating..." : `Create ${previewDates.length > 0 ? previewDates.length : ""} Sessions`}
        </Button>
      </div>
    </form>
  );
}

