"use client";

import { ChangeEvent, FormEvent, useMemo, useState } from "react";
import Button from "@/src/components/ui/Button";
import ErrorMessage from "@/src/components/ui/ErrorMessage";
import ScalableSelect from "@/src/components/ui/ScalableSelect";
import { Conversion } from "@/src/types/evangelism";
import { Person } from "@/src/types/person";

export interface ConversionFormValues {
  person_id: string;
  converted_by_id: string;
  conversion_date: string;
  water_baptism_date?: string;
  spirit_baptism_date?: string;
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
    converted_by_id: initialData?.converted_by_id || "",
    conversion_date: initialData?.conversion_date
      ? new Date(initialData.conversion_date).toISOString().split("T")[0]
      : new Date().toISOString().split("T")[0],
    water_baptism_date: initialData?.water_baptism_date
      ? new Date(initialData.water_baptism_date).toISOString().split("T")[0]
      : "",
    spirit_baptism_date: initialData?.spirit_baptism_date
      ? new Date(initialData.spirit_baptism_date).toISOString().split("T")[0]
      : "",
    notes: initialData?.notes || "",
  });

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
    if (
      !values.person_id ||
      !values.converted_by_id ||
      !values.conversion_date
    ) {
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
          Invited By <span className="text-red-500">*</span>
        </label>
        <ScalableSelect
          options={personOptions}
          value={values.converted_by_id}
          onChange={(value) =>
            setValues((prev) => ({
              ...prev,
              converted_by_id: value,
            }))
          }
          placeholder="Select inviter"
          className="w-full"
          showSearch
        />
      </div>

      <div className="space-y-1">
        <label className="block text-sm font-medium text-gray-700">
          Conversion Date <span className="text-red-500">*</span>
        </label>
        <input
          type="date"
          value={values.conversion_date}
          onChange={handleChange("conversion_date")}
          required
          className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
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
            className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
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
            className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
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
          {isSubmitting ? "Saving..." : submitLabel}
        </Button>
      </div>
    </form>
  );
}
