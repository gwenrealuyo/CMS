"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import Button from "@/src/components/ui/Button";
import ErrorMessage from "@/src/components/ui/ErrorMessage";
import ScalableSelect from "@/src/components/ui/ScalableSelect";
import { Prospect } from "@/src/types/evangelism";
import { Person } from "@/src/types/person";
import { EvangelismGroup } from "@/src/types/evangelism";

export interface ProspectFormValues {
  name: string;
  contact_info: string;
  facebook_name: string;
  invited_by_id: string;
  evangelism_group_id?: string;
  notes: string;
}

interface ProspectFormProps {
  inviters?: Person[];
  groups?: EvangelismGroup[];
  onSubmit: (values: ProspectFormValues) => Promise<void>;
  onCancel: () => void;
  isSubmitting: boolean;
  error?: string | null;
  submitLabel?: string;
  initialData?: Prospect;
  defaultGroupId?: string;
}

const DEFAULT_VALUES: ProspectFormValues = {
  name: "",
  contact_info: "",
  facebook_name: "",
  invited_by_id: "",
  evangelism_group_id: "",
  notes: "",
};

export default function ProspectForm({
  inviters = [],
  groups = [],
  onSubmit,
  onCancel,
  isSubmitting,
  error,
  submitLabel = "Create Visitor",
  initialData,
  defaultGroupId,
}: ProspectFormProps) {
  const [values, setValues] = useState<ProspectFormValues>(
    initialData
      ? {
          name: initialData.name,
          contact_info: initialData.contact_info || "",
          facebook_name: initialData.facebook_name || "",
          invited_by_id: initialData.invited_by?.id || "",
          evangelism_group_id: initialData.evangelism_group?.id || "",
          notes: initialData.notes || "",
        }
      : {
          ...DEFAULT_VALUES,
          evangelism_group_id: defaultGroupId || "",
        }
  );

  useEffect(() => {
    if (!initialData && defaultGroupId) {
      setValues((prev) => ({
        ...prev,
        evangelism_group_id: defaultGroupId,
      }));
    }
  }, [defaultGroupId, initialData]);

  const handleChange =
    (field: keyof ProspectFormValues) =>
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
    if (!values.invited_by_id) {
      return;
    }
    await onSubmit(values);
  };

  const formatPersonLabel = (person: Person) => {
    const name = `${person.first_name ?? ""} ${person.last_name ?? ""}`.trim();
    return name || person.email || person.username;
  };

  const inviterOptions = useMemo(
    () =>
      inviters
        .map((person) => ({
          label: formatPersonLabel(person),
          value: String(person.id),
        }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [inviters]
  );

  const groupOptions = useMemo(
    () =>
      groups
        .map((group) => ({
          label: group.name,
          value: String(group.id),
        }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [groups]
  );

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      {error && <ErrorMessage message={error} />}

      <div className="space-y-1">
        <label className="block text-sm font-medium text-gray-700">
          Name <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={values.name}
          onChange={handleChange("name")}
          required
          placeholder="Visitor's name"
          className="w-full rounded-md border border-gray-200 px-3 py-2 min-h-[44px] text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      <div className="space-y-1">
        <label className="block text-sm font-medium text-gray-700">
          Contact Info
        </label>
        <input
          type="text"
          value={values.contact_info}
          onChange={handleChange("contact_info")}
          placeholder="Phone or email"
          className="w-full rounded-md border border-gray-200 px-3 py-2 min-h-[44px] text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      <div className="space-y-1">
        <label className="block text-sm font-medium text-gray-700">
          Facebook Name
        </label>
        <input
          type="text"
          value={values.facebook_name}
          onChange={handleChange("facebook_name")}
          placeholder="Facebook name"
          className="w-full rounded-md border border-gray-200 px-3 py-2 min-h-[44px] text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      <div className="space-y-1">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Invited By <span className="text-red-500">*</span>
        </label>
        <ScalableSelect
          options={inviterOptions}
          value={values.invited_by_id}
          onChange={(value) =>
            setValues((prev) => ({
              ...prev,
              invited_by_id: value,
            }))
          }
          placeholder="Select inviter"
          className="w-full"
          showSearch
        />
      </div>

      <div className="space-y-1">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Bible Study Group (Optional)
        </label>
        <ScalableSelect
          options={[{ label: "Not set", value: "" }, ...groupOptions]}
          value={values.evangelism_group_id || ""}
          onChange={(value) =>
            setValues((prev) => ({
              ...prev,
              evangelism_group_id: value || undefined,
            }))
          }
          placeholder="Select Bible Study group"
          className="w-full"
          showSearch
        />
      </div>

      <div className="space-y-1">
        <label className="block text-sm font-medium text-gray-700">Notes</label>
        <textarea
          value={values.notes}
          onChange={handleChange("notes")}
          placeholder="Additional notes..."
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
