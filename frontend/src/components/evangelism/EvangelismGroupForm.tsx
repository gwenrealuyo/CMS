"use client";

import { ChangeEvent, FormEvent, useMemo, useState } from "react";
import Button from "@/src/components/ui/Button";
import ErrorMessage from "@/src/components/ui/ErrorMessage";
import ScalableSelect from "@/src/components/ui/ScalableSelect";
import {
  EvangelismGroup,
  EvangelismGroupFormValues,
} from "@/src/types/evangelism";
import { Person } from "@/src/types/person";
import { Cluster } from "@/src/types/cluster";
import { formatPersonName } from "@/src/lib/name";

interface EvangelismGroupFormProps {
  coordinators?: Person[];
  people?: Person[];
  clusters?: Cluster[];
  onSubmit: (values: EvangelismGroupFormValues) => Promise<void>;
  onCancel: () => void;
  isSubmitting: boolean;
  error?: string | null;
  submitLabel?: string;
  initialData?: EvangelismGroup;
}

const DEFAULT_VALUES: EvangelismGroupFormValues = {
  name: "",
  description: "",
  coordinator_id: "",
  cluster_id: "",
  location: "",
  meeting_time: "",
  meeting_day: "",
  is_active: true,
  is_bible_sharers_group: false,
};

export default function EvangelismGroupForm({
  coordinators = [],
  people = [],
  clusters = [],
  onSubmit,
  onCancel,
  isSubmitting,
  error,
  submitLabel = "Create Group",
  initialData,
}: EvangelismGroupFormProps) {
  const [values, setValues] = useState<EvangelismGroupFormValues>(
    initialData
      ? {
          name: initialData.name,
          description: initialData.description || "",
          coordinator_id: initialData.coordinator?.id
            ? String(initialData.coordinator.id)
            : "",
          cluster_id: initialData.cluster?.id
            ? String(initialData.cluster.id)
            : "",
          location: initialData.location || "",
          meeting_time: initialData.meeting_time || "",
          meeting_day: initialData.meeting_day || "",
          is_active: initialData.is_active,
          is_bible_sharers_group: initialData.is_bible_sharers_group || false,
        }
      : DEFAULT_VALUES
  );

  const handleChange =
    (field: keyof EvangelismGroupFormValues) =>
    (
      event: ChangeEvent<
        HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
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

  const dayOptions = [
    { value: "", label: "Select day" },
    { value: "MONDAY", label: "Monday" },
    { value: "TUESDAY", label: "Tuesday" },
    { value: "WEDNESDAY", label: "Wednesday" },
    { value: "THURSDAY", label: "Thursday" },
    { value: "FRIDAY", label: "Friday" },
    { value: "SATURDAY", label: "Saturday" },
    { value: "SUNDAY", label: "Sunday" },
  ];

  const coordinatorOptions = useMemo(() => {
    const base = people.length > 0 ? people : coordinators;
    return base
      .filter(
        (person) => person.role !== "ADMIN" && person.username !== "admin"
      )
      .map((person) => ({
        label: formatPersonName(person),
        value: String(person.id),
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [people, coordinators]);

  const clusterOptions = useMemo(
    () =>
      [
        { label: "No cluster", value: "" },
        ...clusters
          .map((cluster) => {
            const name = cluster.name?.trim();
            const code = cluster.code?.trim();
            const label =
              name && code ? `${name} (${code})` : name || code || "Cluster";
            return {
              label,
              value: String(cluster.id),
            };
          })
          .sort((a, b) => a.label.localeCompare(b.label)),
      ],
    [clusters]
  );

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      {error && <ErrorMessage message={error} />}

      <div className="space-y-1">
        <label className="block text-sm font-medium text-gray-700">
          Group Name <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={values.name}
          onChange={handleChange("name")}
          required
          placeholder="e.g., North Bible Study"
          className="w-full rounded-md border border-gray-200 px-3 py-2 min-h-[44px] text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      <div className="space-y-1">
        <label className="block text-sm font-medium text-gray-700">
          Description
        </label>
        <textarea
          value={values.description}
          onChange={handleChange("description")}
          placeholder="Group description..."
          rows={3}
          className="w-full rounded-md border border-gray-200 px-3 py-2 min-h-[44px] text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700">
            Coordinator
          </label>
          <ScalableSelect
            options={[{ label: "Not set", value: "" }, ...coordinatorOptions]}
            value={values.coordinator_id}
            onChange={(value) =>
              setValues((prev) => ({
                ...prev,
                coordinator_id: value,
              }))
            }
            placeholder="Select coordinator"
            className="w-full"
            showSearch
          />
        </div>

        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700">
            Cluster (Optional)
          </label>
          <ScalableSelect
            options={clusterOptions}
            value={values.cluster_id}
            onChange={(value) =>
              setValues((prev) => ({
                ...prev,
                cluster_id: value,
              }))
            }
            placeholder="Select cluster"
            className="w-full"
            showSearch
          />
        </div>
      </div>

      <div className="space-y-1">
        <label className="block text-sm font-medium text-gray-700">
          Location
        </label>
        <input
          type="text"
          value={values.location}
          onChange={handleChange("location")}
          placeholder="Meeting location"
          className="w-full rounded-md border border-gray-200 px-3 py-2 min-h-[44px] text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700">
            Meeting Day
          </label>
          <select
            value={values.meeting_day}
            onChange={handleChange("meeting_day")}
            className="w-full rounded-md border border-gray-200 px-3 py-2 min-h-[44px] text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            {dayOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700">
            Meeting Time
          </label>
          <select
            value={values.meeting_time}
            onChange={handleChange("meeting_time")}
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

      <div className="space-y-2">
        <div className="flex items-start">
          <input
            type="checkbox"
            id="is_active"
            checked={values.is_active}
            onChange={handleChange("is_active")}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded mt-0.5"
          />
          <label
            htmlFor="is_active"
            className="ml-2 block text-sm text-gray-700 cursor-pointer"
          >
            Active
          </label>
        </div>

        <div className="flex items-start">
          <input
            type="checkbox"
            id="is_bible_sharers_group"
            checked={values.is_bible_sharers_group || false}
            onChange={handleChange("is_bible_sharers_group")}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded mt-0.5"
          />
          <label
            htmlFor="is_bible_sharers_group"
            className="ml-2 block text-sm text-gray-700 cursor-pointer"
          >
            Bible Sharers Group
            <span className="ml-2 text-xs text-gray-500 font-normal">
              (Mark this group as a Bible Sharers group. Bible Sharers are
              capable of facilitating bible studies and can step in when a
              cluster doesn't have someone to facilitate.)
            </span>
          </label>
        </div>
      </div>

      <div className="flex flex-col-reverse sm:flex-row gap-4 pt-4">
        <Button
          variant="tertiary"
          className="w-full sm:flex-1 min-h-[44px]"
          onClick={onCancel}
          disabled={isSubmitting}
        >
          Cancel
        </Button>
        <Button
          className="w-full sm:flex-1 min-h-[44px]"
          disabled={isSubmitting}
          type="submit"
        >
          {isSubmitting ? "Saving..." : submitLabel}
        </Button>
      </div>
    </form>
  );
}
