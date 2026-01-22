"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import Button from "@/src/components/ui/Button";
import ErrorMessage from "@/src/components/ui/ErrorMessage";
import ScalableSelect from "@/src/components/ui/ScalableSelect";
import { Conversion } from "@/src/types/evangelism";
import { Person } from "@/src/types/person";
import { lessonsApi } from "@/src/lib/api";

export interface ConversionFormValues {
  person_id: string;
  water_baptism_date?: string;
  spirit_baptism_date?: string;
  lesson_start_date?: string;
  notes: string;
}

interface ConversionFormProps {
  people?: Person[];
  onSubmit: (values: ConversionFormValues) => Promise<void>;
  onCancel: () => void;
  isSubmitting: boolean;
  error?: string | null;
  submitLabel?: string;
  initialData?: Conversion;
}

export default function ConversionForm({
  people = [],
  onSubmit,
  onCancel,
  isSubmitting,
  error,
  submitLabel = "Record Conversion",
  initialData,
}: ConversionFormProps) {
  const [values, setValues] = useState<ConversionFormValues>({
    person_id: initialData?.person_id || "",
    water_baptism_date: initialData?.water_baptism_date
      ? new Date(initialData.water_baptism_date).toISOString().split("T")[0]
      : "",
    spirit_baptism_date: initialData?.spirit_baptism_date
      ? new Date(initialData.spirit_baptism_date).toISOString().split("T")[0]
      : "",
    lesson_start_date: "",
    notes: initialData?.notes || "",
  });
  const [lessonDateTouched, setLessonDateTouched] = useState(false);
  const [loadingLessonDate, setLoadingLessonDate] = useState(false);

  const handleChange =
    (field: keyof ConversionFormValues) =>
    (
      event: ChangeEvent<
        HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
      >
    ) => {
      setValues((prev) => ({
        ...prev,
        [field]: event.target.value,
      }));
    };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!values.person_id) {
      return;
    }
    await onSubmit(values);
  };

  const formatPersonLabel = (person: Person) => {
    const name = `${person.first_name ?? ""} ${person.last_name ?? ""}`.trim();
    return name || person.email || person.username;
  };

  const personOptions = useMemo(
    () =>
      people
        .map((person) => ({
          label: formatPersonLabel(person),
          value: String(person.id),
        }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [people]
  );

  useEffect(() => {
    const fetchLessonStartDate = async () => {
      if (!values.person_id) {
        setValues((prev) => ({ ...prev, lesson_start_date: "" }));
        return;
      }
      try {
        setLoadingLessonDate(true);
        const response = await lessonsApi.getProgress({
          person: values.person_id,
        });
        const progress = response.data;
        if (!progress.length) {
          if (!lessonDateTouched) {
            setValues((prev) => ({ ...prev, lesson_start_date: "" }));
          }
          return;
        }
        const earliest = [...progress]
          .sort((a, b) => a.assigned_at.localeCompare(b.assigned_at))[0];
        const assignedDate = earliest.assigned_at
          ? new Date(earliest.assigned_at).toISOString().split("T")[0]
          : "";
        if (!lessonDateTouched) {
          setValues((prev) => ({
            ...prev,
            lesson_start_date: assignedDate,
          }));
        }
      } catch (error) {
        console.error("Error loading lesson start date:", error);
      } finally {
        setLoadingLessonDate(false);
      }
    };

    fetchLessonStartDate();
    setLessonDateTouched(false);
  }, [values.person_id]);

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      {error && <ErrorMessage message={error} />}

      <div className="space-y-1">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Person <span className="text-red-500">*</span>
        </label>
        <ScalableSelect
          options={personOptions}
          value={values.person_id}
          onChange={(value) =>
            setValues((prev) => ({
              ...prev,
              person_id: value,
            }))
          }
          placeholder="Select person"
          className="w-full"
          showSearch
        />
      </div>

      <div className="space-y-1">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Lesson Start Date
        </label>
        <input
          type="date"
          value={values.lesson_start_date || ""}
          onChange={(event) => {
            setLessonDateTouched(true);
            handleChange("lesson_start_date")(event);
          }}
          className="w-full rounded-md border border-gray-200 px-3 py-2 min-h-[44px] text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        {loadingLessonDate && (
          <p className="text-xs text-gray-500">Loading lesson assignment...</p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700">
            Water Baptism Date
          </label>
          <input
            type="date"
            value={values.water_baptism_date}
            onChange={handleChange("water_baptism_date")}
            className="w-full rounded-md border border-gray-200 px-3 py-2 min-h-[44px] text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700">
            Holy Ghost Reception Date
          </label>
          <input
            type="date"
            value={values.spirit_baptism_date}
            onChange={handleChange("spirit_baptism_date")}
            className="w-full rounded-md border border-gray-200 px-3 py-2 min-h-[44px] text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="space-y-1">
        <label className="block text-sm font-medium text-gray-700">Notes</label>
        <textarea
          value={values.notes}
          onChange={handleChange("notes")}
          placeholder="Conversion notes..."
          rows={3}
          className="w-full rounded-md border border-gray-200 px-3 py-2 min-h-[44px] text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
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
