"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import Button from "@/src/components/ui/Button";
import ErrorMessage from "@/src/components/ui/ErrorMessage";
import ScalableSelect from "@/src/components/ui/ScalableSelect";
import { MinistryCadence, MinistryCategory } from "@/src/types/ministry";
import { Person } from "@/src/types/person";

export interface MinistryFormValues {
  name: string;
  description: string;
  category: MinistryCategory | "";
  activity_cadence: MinistryCadence;
  primary_coordinator_id: string;
  support_coordinator_ids: string[];
  meeting_location: string;
  meeting_schedule_day: string;
  meeting_schedule_time: string;
  meeting_schedule_window: string;
  meeting_schedule_notes: string;
  communication_channel: string;
  is_active: boolean;
}

interface Option {
  label: string;
  value: string;
}

interface MinistryFormProps {
  people: Person[];
  cadenceOptions: Option[];
  categoryOptions: Option[];
  onSubmit: (values: MinistryFormValues) => Promise<void>;
  onCancel: () => void;
  isSubmitting: boolean;
  error?: string | null;
  submitLabel?: string;
}

const DEFAULT_VALUES: MinistryFormValues = {
  name: "",
  description: "",
  category: "",
  activity_cadence: "weekly",
  primary_coordinator_id: "",
  support_coordinator_ids: [],
  meeting_location: "",
  meeting_schedule_day: "",
  meeting_schedule_time: "",
  meeting_schedule_window: "",
  meeting_schedule_notes: "",
  communication_channel: "",
  is_active: true,
};

const DAYS_OF_WEEK = [
  { label: "Not set", value: "" },
  { label: "Sunday", value: "Sunday" },
  { label: "Monday", value: "Monday" },
  { label: "Tuesday", value: "Tuesday" },
  { label: "Wednesday", value: "Wednesday" },
  { label: "Thursday", value: "Thursday" },
  { label: "Friday", value: "Friday" },
  { label: "Saturday", value: "Saturday" },
];

const formatPersonLabel = (person: Person) => {
  const name = `${person.first_name ?? ""} ${person.last_name ?? ""}`.trim();
  return name || person.email || person.username;
};

export default function MinistryForm({
  people,
  cadenceOptions,
  categoryOptions,
  onSubmit,
  onCancel,
  isSubmitting,
  error,
  submitLabel = "Create Ministry",
}: MinistryFormProps) {
  const [values, setValues] = useState<MinistryFormValues>(DEFAULT_VALUES);
  const [supportSelectorValue, setSupportSelectorValue] = useState("");

  const coordinatorOptions = useMemo(
    () =>
      people
        .map((person) => ({
          label: formatPersonLabel(person),
          value: String(person.id),
        }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [people]
  );

  const supportOptions = useMemo(
    () =>
      coordinatorOptions.map((option) => ({
        ...option,
        disabled:
          option.value === values.primary_coordinator_id ||
          values.support_coordinator_ids.includes(option.value),
      })),
    [coordinatorOptions, values.primary_coordinator_id, values.support_coordinator_ids]
  );

  useEffect(() => {
    setValues((prev) => {
      if (
        prev.primary_coordinator_id &&
        prev.support_coordinator_ids.includes(prev.primary_coordinator_id)
      ) {
        return {
          ...prev,
          support_coordinator_ids: prev.support_coordinator_ids.filter(
            (id) => id !== prev.primary_coordinator_id
          ),
        };
      }
      return prev;
    });
  }, [values.primary_coordinator_id]);

  const handleChange = (field: keyof MinistryFormValues) => (
    event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
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

  const handleAddSupportCoordinator = () => {
    if (!supportSelectorValue) return;
    setValues((prev) => ({
      ...prev,
      support_coordinator_ids: Array.from(
        new Set([...prev.support_coordinator_ids, supportSelectorValue])
      ),
    }));
    setSupportSelectorValue("");
  };

  const handleRemoveSupportCoordinator = (id: string) => {
    setValues((prev) => ({
      ...prev,
      support_coordinator_ids: prev.support_coordinator_ids.filter((item) => item !== id),
    }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await onSubmit(values);
    setValues(DEFAULT_VALUES);
    setSupportSelectorValue("");
  };

  const disableSubmit =
    isSubmitting || values.name.trim().length === 0 || values.activity_cadence === undefined;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && <ErrorMessage message={error} />}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Ministry Name<span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            required
            value={values.name}
            onChange={handleChange("name")}
            placeholder="e.g. Worship Team"
            className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Description
          </label>
          <textarea
            value={values.description}
            onChange={handleChange("description")}
            rows={3}
            placeholder="Describe the ministry's focus and activities."
            className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Category
          </label>
          <select
            value={values.category}
            onChange={handleChange("category")}
            className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            {categoryOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Activity Cadence<span className="text-red-500">*</span>
          </label>
          <select
            required
            value={values.activity_cadence}
            onChange={handleChange("activity_cadence")}
            className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            {cadenceOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Primary Coordinator
          </label>
          <ScalableSelect
            options={[{ label: "Not set", value: "" }, ...coordinatorOptions]}
            value={values.primary_coordinator_id}
            onChange={(value) =>
              setValues((prev) => ({
                ...prev,
                primary_coordinator_id: value,
              }))
            }
            placeholder="Select primary coordinator"
            className="w-full"
            showSearch
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Supporting Coordinators
          </label>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="sm:flex-1">
              <ScalableSelect
                options={supportOptions}
                value={supportSelectorValue}
                onChange={setSupportSelectorValue}
                placeholder="Search and pick coordinator to add"
                className="w-full"
                showSearch
              />
            </div>
            <Button
              type="button"
              variant="secondary"
              onClick={handleAddSupportCoordinator}
              disabled={!supportSelectorValue}
              className="sm:w-auto"
            >
              Add Coordinator
            </Button>
          </div>
          {values.support_coordinator_ids.length > 0 ? (
            <ul className="mt-3 flex flex-wrap gap-2">
              {values.support_coordinator_ids.map((id) => {
                const label = coordinatorOptions.find((option) => option.value === id)?.label ?? id;
                return (
                  <li key={id}>
                    <span className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-sm text-blue-700 border border-blue-200">
                      {label}
                      <button
                        type="button"
                        onClick={() => handleRemoveSupportCoordinator(id)}
                        className="text-blue-600 hover:text-blue-800 focus:outline-none"
                        aria-label={`Remove ${label}`}
                      >
                        ×
                      </button>
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="mt-2 text-xs text-gray-500">
              Add as many coordinating team members as needed. They'll appear here once added.
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Meeting Location
          </label>
          <input
            type="text"
            value={values.meeting_location}
            onChange={handleChange("meeting_location")}
            placeholder="e.g. Main Building Room 203"
            className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Communication Channel
          </label>
          <input
            type="url"
            value={values.communication_channel}
            onChange={handleChange("communication_channel")}
            placeholder="https://..."
            className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <p className="mt-1 text-xs text-gray-500">
            Optional link to the group chat, email list, or coordination doc.
          </p>
        </div>

        <div className="md:col-span-2 border border-gray-200 rounded-lg p-4 bg-gray-50">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Meeting Schedule</h3>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Typical Day
              </label>
              <select
                value={values.meeting_schedule_day}
                onChange={handleChange("meeting_schedule_day")}
                className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {DAYS_OF_WEEK.map((option) => (
                  <option key={option.value || "unset"} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Typical Time
              </label>
              <input
                type="time"
                value={values.meeting_schedule_time}
                onChange={handleChange("meeting_schedule_time")}
                className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Season / Window
              </label>
              <input
                type="text"
                value={values.meeting_schedule_window}
                onChange={handleChange("meeting_schedule_window")}
                placeholder="e.g. Holy Week, Summer Camp, Anniversary Week"
                className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Additional Notes
              </label>
              <textarea
                value={values.meeting_schedule_notes}
                onChange={handleChange("meeting_schedule_notes")}
                rows={2}
                placeholder="Optional: add rotation details, prep time, or other schedule notes."
                className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>
          <p className="mt-2 text-xs text-gray-500">
            Fill in what you know—leave fields blank if the ministry only serves seasonally or
            on-demand.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <input
            id="is_active"
            type="checkbox"
            checked={values.is_active}
            onChange={handleChange("is_active")}
            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <label htmlFor="is_active" className="text-sm font-medium text-gray-700">
            Ministry is active
          </label>
        </div>
      </div>

      <div className="flex justify-end gap-3">
        <Button
          type="button"
          variant="tertiary"
          onClick={() => {
            if (!isSubmitting) {
              setValues(DEFAULT_VALUES);
              setSupportSelectorValue("");
              onCancel();
            }
          }}
          disabled={isSubmitting}
        >
          Cancel
        </Button>
        <Button type="submit" variant="primary" disabled={disableSubmit}>
          {isSubmitting ? "Saving..." : submitLabel}
        </Button>
      </div>
    </form>
  );
}

