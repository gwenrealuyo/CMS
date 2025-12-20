"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import Button from "@/src/components/ui/Button";
import ErrorMessage from "@/src/components/ui/ErrorMessage";
import ScalableSelect from "@/src/components/ui/ScalableSelect";
import {
  MinistryCadence,
  MinistryCategory,
  Ministry,
  MinistryRole,
  MinistryMember,
} from "@/src/types/ministry";
import { Person } from "@/src/types/person";
import { Branch } from "@/src/types/branch";
import { useBranches } from "@/src/hooks/useBranches";
import { useAuth } from "@/src/contexts/AuthContext";
import { formatPersonName } from "@/src/lib/name";

export interface PendingMember {
  member_id: string;
  role: MinistryRole;
  skills?: string;
  notes?: string;
}

export interface MinistryFormValues {
  name: string;
  description: string;
  category: MinistryCategory | "";
  activity_cadence: MinistryCadence;
  primary_coordinator_id: string;
  support_coordinator_ids: string[];
  branch_id: string;
  meeting_location: string;
  meeting_schedule_day: string;
  meeting_schedule_time: string;
  meeting_schedule_window: string;
  meeting_schedule_notes: string;
  communication_channel: string;
  is_active: boolean;
  members: PendingMember[];
  removed_member_ids: number[];
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
  initialData?: Ministry;
}

const DEFAULT_VALUES: MinistryFormValues = {
  name: "",
  description: "",
  category: "",
  activity_cadence: "weekly",
  primary_coordinator_id: "",
  support_coordinator_ids: [],
  branch_id: "",
  meeting_location: "",
  meeting_schedule_day: "",
  meeting_schedule_time: "",
  meeting_schedule_window: "",
  meeting_schedule_notes: "",
  communication_channel: "",
  is_active: true,
  members: [],
  removed_member_ids: [],
};

const ROLE_OPTIONS: Array<{ label: string; value: MinistryRole }> = [
  { label: "Team Member", value: "team_member" },
  { label: "Guest Helper", value: "guest_helper" },
];

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

export default function MinistryForm({
  people,
  cadenceOptions,
  categoryOptions,
  onSubmit,
  onCancel,
  isSubmitting,
  error,
  submitLabel = "Create Ministry",
  initialData,
}: MinistryFormProps) {
  // Initialize form values from initialData if provided
  const getInitialValues = (): MinistryFormValues => {
    if (!initialData) {
      return DEFAULT_VALUES;
    }

    // Parse meeting_schedule from API format to form fields
    const meetingSchedule = initialData.meeting_schedule as Record<
      string,
      string
    > | null;
    const scheduleDay = meetingSchedule?.day ?? "";
    const scheduleTime = meetingSchedule?.time ?? "";
    const scheduleWindow = meetingSchedule?.window ?? "";
    const scheduleNotes = meetingSchedule?.notes ?? "";

    // Extract support coordinator IDs
    const supportCoordinatorIds = initialData.support_coordinators.map(
      (coordinator) => String(coordinator.id)
    );

    // Extract existing members
    const existingMembers: PendingMember[] = (
      initialData.memberships || []
    ).map((membership: MinistryMember) => ({
      member_id: String(membership.member.id),
      role: membership.role,
      skills: membership.skills || "",
      notes: membership.notes || "",
    }));

    return {
      name: initialData.name ?? "",
      description: initialData.description ?? "",
      category: (initialData.category as MinistryCategory) ?? "",
      activity_cadence: initialData.activity_cadence ?? "weekly",
      primary_coordinator_id: initialData.primary_coordinator
        ? String(initialData.primary_coordinator.id)
        : "",
      support_coordinator_ids: supportCoordinatorIds,
      branch_id: initialData.branch ? String(initialData.branch) : "",
      meeting_location: initialData.meeting_location ?? "",
      meeting_schedule_day: scheduleDay,
      meeting_schedule_time: scheduleTime,
      meeting_schedule_window: scheduleWindow,
      meeting_schedule_notes: scheduleNotes,
      communication_channel: initialData.communication_channel ?? "",
      is_active: initialData.is_active ?? true,
      members: existingMembers,
      removed_member_ids: [],
    };
  };

  const { branches } = useBranches();
  const { user } = useAuth();
  const canEditBranch = user?.role === "ADMIN" || user?.role === "PASTOR";

  const [values, setValues] = useState<MinistryFormValues>(getInitialValues());
  const [supportSelectorValue, setSupportSelectorValue] = useState("");
  const [memberSearch, setMemberSearch] = useState("");
  const [showMemberDropdown, setShowMemberDropdown] = useState(false);
  const [selectedMemberRole, setSelectedMemberRole] =
    useState<MinistryRole>("team_member");

  // Reset form when initialData changes
  useEffect(() => {
    if (initialData) {
      const meetingSchedule = initialData.meeting_schedule as Record<
        string,
        string
      > | null;
      const scheduleDay = meetingSchedule?.day ?? "";
      const scheduleTime = meetingSchedule?.time ?? "";
      const scheduleWindow = meetingSchedule?.window ?? "";
      const scheduleNotes = meetingSchedule?.notes ?? "";
      const supportCoordinatorIds = initialData.support_coordinators.map(
        (coordinator) => String(coordinator.id)
      );

      // Extract existing members
      const existingMembers: PendingMember[] = (
        initialData.memberships || []
      ).map((membership: MinistryMember) => ({
        member_id: String(membership.member.id),
        role: membership.role,
        skills: membership.skills || "",
        notes: membership.notes || "",
      }));

      setValues({
        name: initialData.name ?? "",
        description: initialData.description ?? "",
        category: (initialData.category as MinistryCategory) ?? "",
        activity_cadence: initialData.activity_cadence ?? "weekly",
        primary_coordinator_id: initialData.primary_coordinator
          ? String(initialData.primary_coordinator.id)
          : "",
        support_coordinator_ids: supportCoordinatorIds,
        branch_id: initialData.branch ? String(initialData.branch) : "",
        meeting_location: initialData.meeting_location ?? "",
        meeting_schedule_day: scheduleDay,
        meeting_schedule_time: scheduleTime,
        meeting_schedule_window: scheduleWindow,
        meeting_schedule_notes: scheduleNotes,
        communication_channel: initialData.communication_channel ?? "",
        is_active: initialData.is_active ?? true,
        members: existingMembers,
        removed_member_ids: [],
      });
    } else {
      setValues(DEFAULT_VALUES);
      setMemberSearch("");
      setSelectedMemberRole("team_member");
    }
  }, [initialData]);

  const coordinatorOptions = useMemo(
    () =>
      people
        .filter(
          (person) => person.role !== "ADMIN" && person.username !== "admin"
        )
        .map((person) => ({
          label: formatPersonName(person),
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
    [
      coordinatorOptions,
      values.primary_coordinator_id,
      values.support_coordinator_ids,
    ]
  );

  // Filter available people for member selection (exclude admins and already added members)
  const availablePeopleForMembers = useMemo(
    () =>
      people
        .filter(
          (person) =>
            person.role !== "ADMIN" &&
            person.username !== "admin" &&
            !values.members.some((m) => m.member_id === String(person.id)) &&
            values.primary_coordinator_id !== String(person.id) &&
            !values.support_coordinator_ids.includes(String(person.id))
        )
        .sort((a, b) => {
          const nameA = formatPersonName(a).toLowerCase();
          const nameB = formatPersonName(b).toLowerCase();
          return nameA.localeCompare(nameB);
        }),
    [
      people,
      values.members,
      values.primary_coordinator_id,
      values.support_coordinator_ids,
    ]
  );

  const filteredMembers = useMemo(() => {
    if (!memberSearch.trim()) return availablePeopleForMembers;
    const searchLower = memberSearch.toLowerCase();
    return availablePeopleForMembers.filter(
      (person) =>
        formatPersonName(person).toLowerCase().includes(searchLower) ||
        person.email?.toLowerCase().includes(searchLower) ||
        person.role?.toLowerCase().includes(searchLower)
    );
  }, [availablePeopleForMembers, memberSearch]);

  const getInitials = (person: Person) => {
    return `${person.first_name?.[0] || ""}${
      person.last_name?.[0] || ""
    }`.toUpperCase();
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case "PASTOR":
        return "bg-purple-100 text-purple-800";
      case "COORDINATOR":
        return "bg-blue-100 text-blue-800";
      case "MEMBER":
        return "bg-green-100 text-green-800";
      case "VISITOR":
        return "bg-orange-100 text-orange-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const addMember = (person: Person) => {
    const memberId = String(person.id);
    if (!values.members.some((m) => m.member_id === memberId)) {
      setValues({
        ...values,
        members: [
          ...values.members,
          {
            member_id: memberId,
            role: selectedMemberRole,
            skills: "",
            notes: "",
          },
        ],
      });
    }
    setMemberSearch("");
    setShowMemberDropdown(false);
    setSelectedMemberRole("team_member");
  };

  const removeMember = (memberId: string) => {
    const member = values.members.find((m) => m.member_id === memberId);
    setValues({
      ...values,
      members: values.members.filter((m) => m.member_id !== memberId),
      removed_member_ids: initialData
        ? values.removed_member_ids.concat(
            initialData.memberships
              ?.filter((m: MinistryMember) => String(m.member.id) === memberId)
              .map((m: MinistryMember) => m.id) || []
          )
        : values.removed_member_ids,
    });
  };

  const updateMemberRole = (memberId: string, role: MinistryRole) => {
    setValues({
      ...values,
      members: values.members.map((m) =>
        m.member_id === memberId ? { ...m, role } : m
      ),
    });
  };

  const updateMemberSkills = (memberId: string, skills: string) => {
    setValues({
      ...values,
      members: values.members.map((m) =>
        m.member_id === memberId ? { ...m, skills } : m
      ),
    });
  };

  const updateMemberNotes = (memberId: string, notes: string) => {
    setValues({
      ...values,
      members: values.members.map((m) =>
        m.member_id === memberId ? { ...m, notes } : m
      ),
    });
  };

  const getSelectedMembersData = () => {
    return values.members
      .map((pendingMember) => {
        const person = people.find(
          (p) => String(p.id) === pendingMember.member_id
        );
        return person
          ? {
              person,
              role: pendingMember.role,
              member_id: pendingMember.member_id,
              skills: pendingMember.skills || "",
              notes: pendingMember.notes || "",
            }
          : null;
      })
      .filter(
        (
          item
        ): item is {
          person: Person;
          role: MinistryRole;
          member_id: string;
          skills: string;
          notes: string;
        } => item !== null
      );
  };

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

  const handleChange =
    (field: keyof MinistryFormValues) =>
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
      support_coordinator_ids: prev.support_coordinator_ids.filter(
        (item) => item !== id
      ),
    }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await onSubmit(values);
    // Only reset form if not editing (no initialData)
    if (!initialData) {
      setValues(DEFAULT_VALUES);
      setSupportSelectorValue("");
      setMemberSearch("");
      setSelectedMemberRole("team_member");
    }
  };

  const disableSubmit =
    isSubmitting ||
    values.name.trim().length === 0 ||
    values.activity_cadence === undefined;

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
            className="w-full rounded-md border border-gray-200 px-3 py-2 min-h-[44px] text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
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
            className="w-full rounded-md border border-gray-200 px-3 py-2 min-h-[44px] text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Category
          </label>
          <select
            value={values.category}
            onChange={handleChange("category")}
            className="w-full rounded-md border border-gray-200 px-3 py-2 min-h-[44px] text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
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
            className="w-full rounded-md border border-gray-200 px-3 py-2 min-h-[44px] text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
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
              className="w-full sm:w-auto min-h-[44px]"
            >
              Add Coordinator
            </Button>
          </div>
          {values.support_coordinator_ids.length > 0 ? (
            <ul className="mt-3 flex flex-wrap gap-2">
              {values.support_coordinator_ids.map((id) => {
                const label =
                  coordinatorOptions.find((option) => option.value === id)
                    ?.label ?? id;
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
              Add as many coordinating team members as needed. They&rsquo;ll
              appear here once added.
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
            className="w-full rounded-md border border-gray-200 px-3 py-2 min-h-[44px] text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
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
            className="w-full rounded-md border border-gray-200 px-3 py-2 min-h-[44px] text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <p className="mt-1 text-xs text-gray-500">
            Optional link to the group chat, email list, or coordination doc.
          </p>
        </div>

        <div className="md:col-span-2 border border-gray-200 rounded-lg p-4 bg-gray-50">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">
            Meeting Schedule
          </h3>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Typical Day
              </label>
              <select
                value={values.meeting_schedule_day}
                onChange={handleChange("meeting_schedule_day")}
                className="w-full rounded-md border border-gray-200 px-3 py-2 min-h-[44px] text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
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
                className="w-full rounded-md border border-gray-200 px-3 py-2 min-h-[44px] text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
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
                className="w-full rounded-md border border-gray-200 px-3 py-2 min-h-[44px] text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
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
                className="w-full rounded-md border border-gray-200 px-3 py-2 min-h-[44px] text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>
          <p className="mt-2 text-xs text-gray-500">
            Fill in what you know—leave fields blank if the ministry only serves
            seasonally or on-demand.
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
          <label
            htmlFor="is_active"
            className="text-sm font-medium text-gray-700"
          >
            Ministry is active
          </label>
        </div>

        {/* Members Section */}
        <div className="md:col-span-2 border border-gray-200 rounded-lg p-4 bg-gray-50">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">
            Members ({values.members.length})
          </h3>

          {/* Add Member Search */}
          <div className="relative mb-4">
            <div className="flex gap-2 mb-2">
              <div className="flex-1">
                <input
                  type="text"
                  value={memberSearch}
                  onChange={(e) => {
                    setMemberSearch(e.target.value);
                    setShowMemberDropdown(true);
                  }}
                  onFocus={() => setShowMemberDropdown(true)}
                  className="w-full rounded-md border border-gray-200 px-3 py-2 min-h-[44px] text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="Search members by name, email, or role..."
                />
              </div>
              <select
                value={selectedMemberRole}
                onChange={(e) =>
                  setSelectedMemberRole(e.target.value as MinistryRole)
                }
                className="rounded-md border border-gray-200 px-3 py-2 min-h-[44px] text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {ROLE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Dropdown with filtered members */}
            {showMemberDropdown && memberSearch && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                {filteredMembers.length === 0 ? (
                  <div className="px-3 py-2 text-gray-500 text-sm">
                    No members found matching &ldquo;{memberSearch}&rdquo;
                  </div>
                ) : (
                  filteredMembers.map((person) => (
                    <button
                      key={person.id}
                      type="button"
                      onClick={() => addMember(person)}
                      className="w-full px-3 py-2 text-left hover:bg-gray-50 flex items-center space-x-3 text-gray-900"
                    >
                      <div className="w-8 h-8 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-full flex items-center justify-center text-white text-xs font-semibold">
                        {getInitials(person)}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-sm">
                          {formatPersonName(person)}
                        </p>
                        <div className="flex items-center space-x-1 mt-0.5">
                          <span
                            className={`px-1.5 py-0.5 rounded-full text-xs font-medium ${getRoleColor(
                              person.role
                            )}`}
                          >
                            {person.role.toLowerCase()}
                          </span>
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Selected Members Display */}
          {values.members.length > 0 ? (
            <div className="space-y-3">
              {getSelectedMembersData().map(
                ({ person, role, member_id, skills, notes }) => (
                  <div
                    key={member_id}
                    className="bg-white border border-gray-200 rounded-lg p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className="w-8 h-8 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-full flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
                          {getInitials(person)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {formatPersonName(person)}
                          </p>
                          <div className="flex flex-col gap-2 mt-2">
                            <select
                              value={role}
                              onChange={(e) =>
                                updateMemberRole(
                                  member_id,
                                  e.target.value as MinistryRole
                                )
                              }
                              className="text-xs rounded border border-gray-300 px-2 py-1 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 w-full"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {ROLE_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                            <input
                              type="text"
                              value={skills}
                              onChange={(e) =>
                                updateMemberSkills(member_id, e.target.value)
                              }
                              placeholder="Skills/Designation (e.g., Pianist, Singer)"
                              className="text-xs rounded border border-gray-300 px-2 py-1 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 w-full"
                              onClick={(e) => e.stopPropagation()}
                            />
                            <textarea
                              value={notes}
                              onChange={(e) =>
                                updateMemberNotes(member_id, e.target.value)
                              }
                              placeholder="Notes (optional)"
                              rows={2}
                              className="text-xs rounded border border-gray-300 px-2 py-1 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 w-full resize-none"
                              onClick={(e) => e.stopPropagation()}
                            />
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeMember(member_id)}
                        className="text-gray-400 hover:text-red-500 flex-shrink-0 mt-1"
                        aria-label={`Remove ${formatPersonName(person)}`}
                      >
                        <svg
                          className="w-5 h-5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M6 18L18 6M6 6l12 12"
                          />
                        </svg>
                      </button>
                    </div>
                  </div>
                )
              )}
            </div>
          ) : (
            <p className="text-xs text-gray-500 italic">
              No members added yet. Use the search above to add members to this
              ministry.
            </p>
          )}

          {/* Click outside to close dropdown */}
          {showMemberDropdown && (
            <div
              className="fixed inset-0 z-0"
              onClick={() => setShowMemberDropdown(false)}
            />
          )}
        </div>
      </div>

      <div className="flex flex-col-reverse sm:flex-row gap-3">
        <Button
          type="button"
          variant="tertiary"
          onClick={() => {
            if (!isSubmitting) {
              setValues(DEFAULT_VALUES);
              setSupportSelectorValue("");
              setMemberSearch("");
              setSelectedMemberRole("team_member");
              onCancel();
            }
          }}
          disabled={isSubmitting}
          className="w-full sm:flex-1 min-h-[44px]"
        >
          Cancel
        </Button>
        <Button
          type="submit"
          variant="primary"
          disabled={disableSubmit}
          className="w-full sm:flex-1 min-h-[44px]"
        >
          {isSubmitting ? "Saving..." : submitLabel}
        </Button>
      </div>
    </form>
  );
}
