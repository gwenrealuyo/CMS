"use client";

import { ChangeEvent, FormEvent, useState } from "react";
import Button from "@/src/components/ui/Button";
import ErrorMessage from "@/src/components/ui/ErrorMessage";
import { SundaySchoolSession, SundaySchoolClass } from "@/src/types/sundaySchool";

export interface SessionFormValues {
  sunday_school_class_id: number | string;
  session_date: string;
  session_time: string;
  lesson_title: string;
  notes: string;
}

interface SessionFormProps {
  classData: SundaySchoolClass;
  onSubmit: (values: SessionFormValues) => Promise<void>;
  onCancel: () => void;
  isSubmitting: boolean;
  error?: string | null;
  submitLabel?: string;
  initialData?: SundaySchoolSession;
}

export default function SessionForm({
  classData,
  onSubmit,
  onCancel,
  isSubmitting,
  error,
  submitLabel = "Create Session",
  initialData,
}: SessionFormProps) {
  const [values, setValues] = useState<SessionFormValues>(
    initialData
      ? {
          sunday_school_class_id: classData.id,
          session_date: initialData.session_date,
          session_time: initialData.session_time || "",
          lesson_title: initialData.lesson_title || "",
          notes: initialData.notes || "",
        }
      : {
          sunday_school_class_id: classData.id,
          session_date: new Date().toISOString().split("T")[0],
          session_time: classData.meeting_time || "",
          lesson_title: "",
          notes: "",
        }
  );

  const handleChange = (field: keyof SessionFormValues) => (
    event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    setValues((prev) => ({
      ...prev,
      [field]: event.target.value,
    }));
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    await onSubmit(values);
  };

  // Generate time options in 30-minute intervals
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

      <div className="space-y-1">
        <label className="block text-sm font-medium text-gray-700">
          Class
        </label>
        <input
          type="text"
          value={classData.name}
          disabled
          className="w-full rounded-md border border-gray-200 px-3 py-2 min-h-[44px] text-sm bg-gray-50 text-gray-600"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
      </div>

      <div className="space-y-1">
        <label className="block text-sm font-medium text-gray-700">
          Lesson Title
        </label>
        <input
          type="text"
          value={values.lesson_title}
          onChange={handleChange("lesson_title")}
          placeholder="What lesson or theme will be covered?"
          className="w-full rounded-md border border-gray-200 px-3 py-2 min-h-[44px] text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      <div className="space-y-1">
        <label className="block text-sm font-medium text-gray-700">Notes</label>
        <textarea
          value={values.notes}
          onChange={handleChange("notes")}
          rows={3}
          placeholder="Additional notes..."
          className="w-full rounded-md border border-gray-200 px-3 py-2 min-h-[44px] text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-md p-3 text-sm text-blue-800">
        <p className="font-medium">Note:</p>
        <p>An event will be automatically created on the calendar for this session.</p>
      </div>

      <div className="flex flex-col-reverse sm:flex-row gap-3 pt-4">
        <Button 
          type="button" 
          variant="tertiary" 
          className="w-full sm:flex-1 min-h-[44px]" 
          onClick={onCancel} 
          disabled={isSubmitting}
        >
          Cancel
        </Button>
        <Button 
          type="submit" 
          variant="primary" 
          className="w-full sm:flex-1 min-h-[44px]" 
          disabled={isSubmitting}
        >
          {isSubmitting ? "Saving..." : submitLabel}
        </Button>
      </div>
    </form>
  );
}

