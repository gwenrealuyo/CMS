"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
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
import { isSelectablePerson } from "@/src/lib/peopleSelectors";
import { useBranches } from "@/src/hooks/useBranches";
import { ministriesApi, ministryMembersApi } from "@/src/lib/api";
import {
  BIBLE_SHARERS_MINISTRY_CODE,
  BIBLE_SHARERS_ROSTER_EMPTY_MESSAGE,
} from "@/src/lib/ministries/systemMinistries";

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
  initial_member_ids: [],
  reporter_ids: [],
  bible_sharer_ids: [],
};

/** HTML time input expects HH:mm; API may return HH:MM:SS — strip seconds for the input. */
function toTimeInputValue(apiTime: string | null | undefined): string {
  if (!apiTime) return "";
  return apiTime.length >= 5 ? apiTime.slice(0, 5) : "";
}

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
  const isCreate = !initialData;
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
          meeting_time: toTimeInputValue(initialData.meeting_time),
          meeting_day: initialData.meeting_day || "",
          is_active: initialData.is_active,
          reporter_ids: (initialData.reporter_ids || []).map(String),
          bible_sharer_ids: (initialData.bible_sharer_ids || []).map(String),
        }
      : DEFAULT_VALUES,
  );

  const [initialPickerValue, setInitialPickerValue] = useState("");
  const { branches } = useBranches();
  const [bibleSharerRosterIds, setBibleSharerRosterIds] = useState<Set<string>>(
    new Set(),
  );
  const memberPool = useMemo(
    () => (people.length ? people : coordinators).filter(isSelectablePerson),
    [people, coordinators],
  );

  const handleChange =
    (field: keyof EvangelismGroupFormValues) =>
    (
      event: ChangeEvent<
        HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
      >,
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

  const initialMemberOptions = useMemo(
    () =>
      memberPool
        .filter(
          (person) =>
            person.role !== "VISITOR" &&
            !(values.initial_member_ids || []).includes(String(person.id)),
        )
        .map((person) => ({
          label: formatPersonName(person),
          value: String(person.id),
        }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [memberPool, values.initial_member_ids],
  );

  const addInitialMember = () => {
    if (!initialPickerValue) return;
    if ((values.initial_member_ids || []).includes(initialPickerValue)) return;
    setValues((prev) => ({
      ...prev,
      initial_member_ids: [
        ...(prev.initial_member_ids || []),
        initialPickerValue,
      ],
    }));
    setInitialPickerValue("");
  };

  const removeInitialMember = (id: string) => {
    setValues((prev) => ({
      ...prev,
      initial_member_ids: (prev.initial_member_ids || []).filter(
        (x) => x !== id,
      ),
    }));
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
      .filter(isSelectablePerson)
      .map((person) => ({
        label: formatPersonName(person),
        value: String(person.id),
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [people, coordinators]);

  const clusterOptions = useMemo(
    () => [
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
    [clusters],
  );

  const selectedCluster = useMemo(
    () =>
      clusters.find((cluster) => String(cluster.id) === values.cluster_id),
    [clusters, values.cluster_id],
  );
  const isHqGroup = useMemo(() => {
    const branchId = selectedCluster?.branch;
    if (branchId == null) return false;
    const branch = branches.find((b) => Number(b.id) === Number(branchId));
    return Boolean(branch?.is_headquarters);
  }, [selectedCluster, branches]);

  useEffect(() => {
    if (!isHqGroup) {
      setBibleSharerRosterIds(new Set());
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const listRes = await ministriesApi.list({
          code: BIBLE_SHARERS_MINISTRY_CODE,
          is_system: true,
        });
        const data = listRes.data as unknown;
        const rows = Array.isArray(data)
          ? data
          : ((data as { results?: { id: number }[] })?.results ?? []);
        const ministry = rows[0];
        if (!ministry) {
          if (!cancelled) setBibleSharerRosterIds(new Set());
          return;
        }
        const membersRes = await ministryMembersApi.list({
          ministry: ministry.id,
        });
        const membersData = membersRes.data as unknown;
        const members = Array.isArray(membersData)
          ? membersData
          : ((membersData as { results?: { member?: { id: number }; member_id?: number }[] })
              ?.results ?? []);
        if (!cancelled) {
          setBibleSharerRosterIds(
            new Set(
              members.map((m) =>
                String(
                  (m as { member?: { id: number }; member_id?: number }).member
                    ?.id ??
                    (m as { member_id?: number }).member_id,
                ),
              ),
            ),
          );
        }
      } catch {
        if (!cancelled) setBibleSharerRosterIds(new Set());
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isHqGroup]);

  const roleCandidateIds = useMemo(() => {
    if (isCreate) {
      return new Set(values.initial_member_ids || []);
    }
    return new Set((initialData?.members || []).map((p) => String(p.id)));
  }, [isCreate, values.initial_member_ids, initialData?.members]);

  const roleCandidateOptions = useMemo(() => {
    return memberPool
      .filter((person) => {
        const id = String(person.id);
        if (!roleCandidateIds.has(id)) return false;
        if (id === values.coordinator_id) return false;
        return true;
      })
      .map((person) => ({
        label: formatPersonName(person),
        value: String(person.id),
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [memberPool, roleCandidateIds, values.coordinator_id]);

  const addRoleId = (field: "reporter_ids" | "bible_sharer_ids", id: string) => {
    if (!id) return;
    setValues((prev) => {
      const current = prev[field] || [];
      if (current.includes(id) || id === prev.coordinator_id) return prev;
      const next = { ...prev, [field]: [...current, id] };
      if (field === "bible_sharer_ids") {
        next.reporter_ids = (prev.reporter_ids || []).filter((x) => x !== id);
      }
      if (field === "reporter_ids" && (prev.bible_sharer_ids || []).includes(id)) {
        return prev;
      }
      return next;
    });
  };

  const removeRoleId = (field: "reporter_ids" | "bible_sharer_ids", id: string) => {
    setValues((prev) => ({
      ...prev,
      [field]: (prev[field] || []).filter((x) => x !== id),
    }));
  };

  const personLabel = (id: string) => {
    const personObj = memberPool.find((p) => String(p.id) === id);
    return personObj ? formatPersonName(personObj) : id;
  };

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
          className="w-full rounded-md border border-gray-200 px-3 py-2 min-h-[44px] text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-ring"
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
          className="w-full rounded-md border border-gray-200 px-3 py-2 min-h-[44px] text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700">
            Coordinator
          </label>
          <ScalableSelect
            options={[{ label: "Not set", value: "" }, ...coordinatorOptions]}
            value={values.coordinator_id || ""}
            onChange={(value) =>
              setValues((prev) => ({
                ...prev,
                coordinator_id: value,
                reporter_ids: (prev.reporter_ids || []).filter((id) => id !== value),
                bible_sharer_ids: (prev.bible_sharer_ids || []).filter(
                  (id) => id !== value,
                ),
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
            value={values.cluster_id || ""}
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700">
            Location
          </label>
          <input
            type="text"
            value={values.location}
            onChange={handleChange("location")}
            placeholder="Meeting location"
            className="w-full rounded-md border border-gray-200 px-3 py-2 min-h-[44px] text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>

        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700">
            Meeting Day
          </label>
          <select
            value={values.meeting_day}
            onChange={handleChange("meeting_day")}
            className="w-full rounded-md border border-gray-200 px-3 py-2 min-h-[44px] text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-ring"
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
          <input
            type="time"
            value={values.meeting_time || ""}
            onChange={handleChange("meeting_time")}
            className="w-full rounded-md border border-gray-200 px-3 py-2 min-h-[44px] text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
      </div>
      <p className="text-xs text-gray-500">
        Leave meeting time empty if the group does not have a fixed time.
      </p>

      {isCreate && (
        <div className="space-y-2 rounded-lg border border-gray-100 bg-gray-50/80 p-3">
          <p className="text-sm font-medium text-gray-800">
            Initial members (optional)
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="flex-1">
              <ScalableSelect
                options={[
                  { label: "Select people to enroll", value: "" },
                  ...initialMemberOptions,
                ]}
                value={initialPickerValue}
                onChange={(value) => setInitialPickerValue(value)}
                placeholder="Add member"
                className="w-full"
                showSearch
              />
            </div>
            <Button
              type="button"
              variant="secondary"
              onClick={addInitialMember}
              disabled={!initialPickerValue}
              className="sm:w-auto"
            >
              Add
            </Button>
          </div>
          {(values.initial_member_ids?.length ?? 0) > 0 ? (
            <ul className="flex flex-wrap gap-2 mt-2">
              {(values.initial_member_ids ?? []).map((id) => {
                const personObj = memberPool.find((p) => String(p.id) === id);
                const label = personObj ? formatPersonName(personObj) : id;
                return (
                  <li key={id}>
                    <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-sm text-primary border border-primary/20">
                      {label}
                      <button
                        type="button"
                        className="text-primary hover:text-primary"
                        onClick={() => removeInitialMember(id)}
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
            <p className="text-xs text-gray-500">
              You can add people now or enroll them later from the group view.
            </p>
          )}
        </div>
      )}

      <div className="space-y-2">
        <div className="flex items-start">
          <input
            type="checkbox"
            id="is_active"
            checked={values.is_active}
            onChange={handleChange("is_active")}
            className="h-4 w-4 text-primary focus:ring-ring border-gray-300 rounded mt-0.5"
          />
          <label
            htmlFor="is_active"
            className="ml-2 block text-sm text-gray-700 cursor-pointer"
          >
            Active
          </label>
        </div>
      </div>

      <div className="space-y-3 rounded-lg border border-gray-100 bg-gray-50/80 p-3">
        <p className="text-sm font-medium text-gray-800">
          Group roles
        </p>
        <p className="text-xs text-gray-500">
          Bible Sharers and reporters must already be members
          {isCreate ? " (add them above first)" : ""}. The coordinator
          cannot hold either role on this group.
          {isHqGroup
            ? " HQ groups can only assign Bible Sharers from the headquarters Bible Sharers ministry roster."
            : ""}
        </p>
        {(
          [
            {
              field: "bible_sharer_ids" as const,
              label: "Bible Sharers",
              hint: isHqGroup
                ? "Must be on the HQ Bible Sharers roster"
                : "Can facilitate and submit weekly reports",
              chipClass: "bg-rose-50 text-rose-800 border-rose-200",
            },
            {
              field: "reporter_ids" as const,
              label: "Reporters",
              hint: "Can submit weekly reports only",
              chipClass: "bg-amber-50 text-amber-800 border-amber-200",
            },
          ] as const
        ).map((role) => {
          const selected = values[role.field] || [];
          const options = roleCandidateOptions.filter((opt) => {
            if (selected.includes(opt.value)) return false;
            if (
              role.field === "reporter_ids" &&
              (values.bible_sharer_ids || []).includes(opt.value)
            ) {
              return false;
            }
            if (
              role.field === "bible_sharer_ids" &&
              isHqGroup &&
              !bibleSharerRosterIds.has(opt.value)
            ) {
              return false;
            }
            return true;
          });
          const hqRosterEmpty =
            role.field === "bible_sharer_ids" &&
            isHqGroup &&
            roleCandidateIds.size > 0 &&
            options.length === 0;
          return (
            <div key={role.field} className="space-y-2">
              <p className="text-sm text-gray-700">
                {role.label}{" "}
                <span className="text-xs font-normal text-gray-500">
                  ({selected.length} selected) — {role.hint}
                </span>
              </p>
              <ScalableSelect
                options={[
                  { label: `Add ${role.label.toLowerCase()}`, value: "" },
                  ...options,
                ]}
                value=""
                onChange={(value) => addRoleId(role.field, value)}
                placeholder={
                  roleCandidateIds.size === 0
                    ? "Add members first"
                    : hqRosterEmpty
                      ? BIBLE_SHARERS_ROSTER_EMPTY_MESSAGE
                      : `Add ${role.label.toLowerCase()}`
                }
                className="w-full"
                showSearch
              />
              {hqRosterEmpty && (
                <p className="text-xs text-gray-500">
                  {BIBLE_SHARERS_ROSTER_EMPTY_MESSAGE}
                </p>
              )}
              {selected.length > 0 && (
                <ul className="flex flex-wrap gap-2">
                  {selected.map((id) => (
                    <li key={id}>
                      <span
                        className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm border ${role.chipClass}`}
                      >
                        {personLabel(id)}
                        <button
                          type="button"
                          onClick={() => removeRoleId(role.field, id)}
                          aria-label={`Remove ${personLabel(id)}`}
                        >
                          ×
                        </button>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
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
