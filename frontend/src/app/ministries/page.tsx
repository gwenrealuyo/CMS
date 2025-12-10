"use client";

import { AxiosError } from "axios";
import { useMemo, useState, useEffect, useRef, useCallback } from "react";
import toast from "react-hot-toast";
import DashboardLayout from "@/src/components/layout/DashboardLayout";
import Button from "@/src/components/ui/Button";
import Card from "@/src/components/ui/Card";
import ErrorMessage from "@/src/components/ui/ErrorMessage";
import LoadingSpinner from "@/src/components/ui/LoadingSpinner";
import Table from "@/src/components/ui/Table";
import Modal from "@/src/components/ui/Modal";
import ConfirmationModal from "@/src/components/ui/ConfirmationModal";
import MinistryForm, {
  MinistryFormValues,
} from "@/src/components/ministries/MinistryForm";
import MinistryView from "@/src/components/ministries/MinistryView";
import { useMinistries } from "@/src/hooks/useMinistries";
import { usePeople } from "@/src/hooks/usePeople";
import { Ministry, MinistryMember } from "@/src/types/ministry";

export default function MinistriesPage() {
  const {
    ministries,
    filters,
    setFilter,
    loading,
    error,
    cadenceOptions,
    categoryOptions,
    fetchMinistries,
    createMinistry,
    updateMinistry,
    deleteMinistry,
    addMember,
    updateMember,
    removeMember,
  } = useMinistries();
  const { people, loading: peopleLoading, error: peopleError } = usePeople();
  const [searchQuery, setSearchQuery] = useState(filters.search ?? "");
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [viewMinistry, setViewMinistry] = useState<Ministry | null>(null);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [editMinistry, setEditMinistry] = useState<Ministry | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    isOpen: boolean;
    ministry: Ministry | null;
    loading: boolean;
  }>({
    isOpen: false,
    ministry: null,
    loading: false,
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const cadenceOptionsForForm = useMemo(
    () => cadenceOptions.filter((option) => option.value !== "all"),
    [cadenceOptions]
  );

  const categoryOptionsForForm = useMemo(
    () => [
      { label: "Uncategorized", value: "" },
      ...categoryOptions.filter((option) => option.value !== "all"),
    ],
    [categoryOptions]
  );

  const stats = useMemo(() => {
    const total = ministries.length;
    const active = ministries.filter((ministry) => ministry.is_active).length;
    const byCadence = ministries.reduce<Record<string, number>>(
      (acc, ministry) => {
        acc[ministry.activity_cadence] =
          (acc[ministry.activity_cadence] || 0) + 1;
        return acc;
      },
      {}
    );
    return { total, active, byCadence };
  }, [ministries]);

  // Debounced search for better performance
  const handleSearchChange = useCallback(
    (query: string) => {
      setSearchQuery(query);
      setIsSearching(true);

      // Clear existing timeout
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }

      // Set new timeout for debounced search
      searchTimeoutRef.current = setTimeout(() => {
        setFilter("search", query);
        setIsSearching(false);
      }, 300); // 300ms delay
    },
    [setFilter]
  );

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  // Sync searchQuery with filter when filter changes externally (e.g., reset)
  useEffect(() => {
    if (filters.search !== searchQuery) {
      setSearchQuery(filters.search ?? "");
    }
  }, [filters.search, searchQuery]);

  const handleResetFilters = () => {
    setSearchQuery("");
    setFilter("search", "");
    setFilter("activity_cadence", "all");
    setFilter("category", "all");
    setFilter("is_active", true);
  };

  const cadenceLabels: Record<string, string> = {
    weekly: "Weekly",
    monthly: "Monthly",
    seasonal: "Seasonal",
    event_driven: "Event Driven",
    holiday: "Holiday",
    ad_hoc: "Ad Hoc",
  };

  const categoryLabels: Record<string, string> = {
    worship: "Worship",
    outreach: "Outreach",
    care: "Care",
    logistics: "Logistics",
    other: "Other",
  };

  const handleView = (ministry: Ministry) => {
    setViewMinistry(ministry);
    setIsViewOpen(true);
  };

  const handleEdit = (ministry: Ministry) => {
    setEditMinistry(ministry);
    setIsEditOpen(true);
    setFormError(null);
  };

  const handleDelete = (ministry: Ministry) => {
    setDeleteConfirmation({
      isOpen: true,
      ministry,
      loading: false,
    });
  };

  const closeDeleteConfirmation = () => {
    setDeleteConfirmation({
      isOpen: false,
      ministry: null,
      loading: false,
    });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirmation.ministry) return;

    try {
      setDeleteConfirmation((prev) => ({ ...prev, loading: true }));
      await deleteMinistry(deleteConfirmation.ministry.id);
      await fetchMinistries();
      setDeleteConfirmation({
        isOpen: false,
        ministry: null,
        loading: false,
      });
      toast.success(
        `Ministry "${deleteConfirmation.ministry.name}" has been deleted.`
      );
    } catch (error) {
      console.error("Error deleting ministry:", error);
      setDeleteConfirmation((prev) => ({ ...prev, loading: false }));
      toast.error("Failed to delete ministry. Please try again.");
    }
  };

  return (
    <>
      <DashboardLayout>
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-[#2D3748]">
                Ministry Teams
              </h1>
              <p className="text-sm text-gray-500">
                Track coordinators, cadence, and active members of each
                ministry.
              </p>
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              <Button
                variant="primary"
                onClick={() => setIsCreateOpen(true)}
                className="w-full sm:w-auto min-h-[44px]"
              >
                Add Ministry
              </Button>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <p className="text-sm text-gray-500">Total ministries</p>
              <p className="text-3xl font-semibold text-[#2D3748]">
                {stats.total}
              </p>
            </Card>
            <Card>
              <p className="text-sm text-gray-500">Active ministries</p>
              <p className="text-3xl font-semibold text-green-600">
                {stats.active}
              </p>
            </Card>
            <Card>
              <p className="text-sm text-gray-500">Weekly cadence</p>
              <p className="text-3xl font-semibold text-blue-600">
                {stats.byCadence.weekly ?? 0}
              </p>
            </Card>
            <Card>
              <p className="text-sm text-gray-500">Ad hoc & seasonal</p>
              <p className="text-3xl font-semibold text-orange-500">
                {(stats.byCadence.ad_hoc ?? 0) +
                  (stats.byCadence.seasonal ?? 0)}
              </p>
            </Card>
          </div>

          <Card title="Filter ministries">
            <div className="flex flex-col gap-4 md:flex-row md:items-end">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Search
                </label>
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(event) => handleSearchChange(event.target.value)}
                  placeholder="Name, description, coordinator"
                  className="w-full rounded-md border border-gray-200 px-3 py-2 min-h-[44px] text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Cadence
                </label>
                <select
                  value={filters.activity_cadence ?? "all"}
                  onChange={(event) =>
                    setFilter(
                      "activity_cadence",
                      event.target.value as typeof filters.activity_cadence
                    )
                  }
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
                  Category
                </label>
                <select
                  value={filters.category ?? "all"}
                  onChange={(event) =>
                    setFilter(
                      "category",
                      event.target.value as typeof filters.category
                    )
                  }
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
                  Status
                </label>
                <select
                  value={
                    filters.is_active === "all"
                      ? "all"
                      : filters.is_active
                      ? "active"
                      : "inactive"
                  }
                  onChange={(event) => {
                    const value = event.target.value;
                    if (value === "all") {
                      setFilter("is_active", "all");
                    } else {
                      setFilter("is_active", value === "active");
                    }
                  }}
                  className="w-full rounded-md border border-gray-200 px-3 py-2 min-h-[44px] text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="all">All</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>

              <div className="w-full sm:w-auto md:ml-auto">
                <Button
                  variant="tertiary"
                  onClick={handleResetFilters}
                  className="w-full sm:w-auto min-h-[44px]"
                >
                  Reset
                </Button>
              </div>
            </div>
          </Card>

          <Card title="Ministry roster">
            {loading ? (
              <div className="py-12 flex justify-center">
                <LoadingSpinner />
              </div>
            ) : error ? (
              <ErrorMessage message={error} />
            ) : ministries.length === 0 ? (
              <div className="py-12 text-center">
                <h3 className="text-lg font-semibold text-gray-600">
                  No ministries yet
                </h3>
                <p className="text-sm text-gray-500 mt-2">
                  Once you add your first ministry team, you&rsquo;ll see it
                  listed here.
                </p>
              </div>
            ) : (
              <Table
                data={ministries.map((ministry) => ({
                  ...ministry,
                  membersCount: ministry.memberships.length,
                }))}
                columns={[
                  {
                    header: "Ministry",
                    accessor: "name" as const,
                    render: (_value, row: any) => (
                      <div>
                        <p className="font-semibold text-[#2D3748]">
                          {row.name}
                        </p>
                        {row.description && (
                          <p className="text-sm text-gray-500 line-clamp-2">
                            {row.description}
                          </p>
                        )}
                      </div>
                    ),
                  },
                  {
                    header: "Coordinators",
                    accessor: "primary_coordinator" as const,
                    render: (_value, row: any) => (
                      <div className="text-sm text-gray-700">
                        {row.primary_coordinator ? (
                          <p>
                            Primary:{" "}
                            <span className="font-medium">
                              {row.primary_coordinator.first_name}{" "}
                              {row.primary_coordinator.last_name}
                            </span>
                          </p>
                        ) : (
                          <p className="text-gray-400">Unset</p>
                        )}
                        {row.support_coordinators.length > 0 && (
                          <p className="text-xs text-gray-500">
                            Support:{" "}
                            {row.support_coordinators
                              .map((person: any) =>
                                `${person.first_name ?? ""} ${
                                  person.last_name ?? ""
                                }`.trim()
                              )
                              .join(", ")}
                          </p>
                        )}
                      </div>
                    ),
                  },
                  {
                    header: "Cadence",
                    accessor: "activity_cadence" as const,
                    render: (_value, row: any) => (
                      <div className="text-sm text-gray-700">
                        {cadenceLabels[row.activity_cadence] ?? "—"}
                        {row.meeting_location && (
                          <p className="text-xs text-gray-500">
                            {row.meeting_location}
                          </p>
                        )}
                      </div>
                    ),
                  },
                  {
                    header: "Category",
                    accessor: "category" as const,
                    render: (_value, row: any) =>
                      row.category
                        ? categoryLabels[row.category] ?? row.category
                        : "—",
                  },
                  {
                    header: "Members",
                    accessor: "membersCount" as const,
                    render: (value: number) => (
                      <span className="text-sm font-medium text-[#2D3748]">
                        {value}
                      </span>
                    ),
                  },
                  {
                    header: "Contact",
                    accessor: "communication_channel" as const,
                    render: (value: string) =>
                      value ? (
                        <a
                          href={value}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-blue-600 hover:underline"
                        >
                          Channel link
                        </a>
                      ) : (
                        <span className="text-sm text-gray-400">Not set</span>
                      ),
                  },
                  {
                    header: "Status",
                    accessor: "is_active" as const,
                    render: (value: boolean) => (
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
                          value
                            ? "bg-green-100 text-green-800"
                            : "bg-gray-200 text-gray-600"
                        }`}
                      >
                        {value ? "Active" : "Inactive"}
                      </span>
                    ),
                  },
                  {
                    header: "Actions",
                    accessor: "id" as const,
                    render: (_value, row: any) => (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleView(row as Ministry)}
                          className="flex items-center justify-center p-2 text-green-600 hover:bg-green-50 rounded-md transition-colors"
                          title="View Ministry"
                        >
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                            />
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                            />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleEdit(row as Ministry)}
                          className="flex items-center justify-center p-2 text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                          title="Edit Ministry"
                        >
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                            />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDelete(row as Ministry)}
                          className="flex items-center justify-center p-2 text-red-600 hover:bg-red-50 rounded-md transition-colors"
                          title="Delete Ministry"
                        >
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                            />
                          </svg>
                        </button>
                      </div>
                    ),
                  },
                ]}
              />
            )}
          </Card>
        </div>
      </DashboardLayout>

      <Modal
        isOpen={isViewOpen}
        onClose={() => {
          setIsViewOpen(false);
          setViewMinistry(null);
        }}
        title=""
        hideHeader={true}
      >
        {viewMinistry && (
          <MinistryView
            ministry={viewMinistry}
            onEdit={() => {
              setIsViewOpen(false);
              setEditMinistry(viewMinistry);
              setIsEditOpen(true);
              setViewMinistry(null);
            }}
            onDelete={() => {
              setIsViewOpen(false);
              handleDelete(viewMinistry);
              setViewMinistry(null);
            }}
            onCancel={() => {
              setIsViewOpen(false);
              setViewMinistry(null);
            }}
            onClose={() => {
              setIsViewOpen(false);
              setViewMinistry(null);
            }}
          />
        )}
      </Modal>

      <Modal
        isOpen={isCreateOpen}
        onClose={() => {
          if (!isSubmitting) {
            setIsCreateOpen(false);
            setFormError(null);
          }
        }}
        title="Add Ministry"
      >
        {peopleError && <ErrorMessage message={peopleError} />}
        {peopleLoading ? (
          <div className="py-12 flex justify-center">
            <LoadingSpinner />
          </div>
        ) : (
          <MinistryForm
            people={people}
            cadenceOptions={cadenceOptionsForForm}
            categoryOptions={categoryOptionsForForm}
            onSubmit={async (values: MinistryFormValues) => {
              try {
                setIsSubmitting(true);
                setFormError(null);

                const meetingSchedule: Record<string, string> = {};
                if (values.meeting_schedule_day) {
                  meetingSchedule.day = values.meeting_schedule_day;
                }
                if (values.meeting_schedule_time) {
                  meetingSchedule.time = values.meeting_schedule_time;
                }
                if (values.meeting_schedule_window) {
                  meetingSchedule.window = values.meeting_schedule_window;
                }
                if (values.meeting_schedule_notes) {
                  meetingSchedule.notes = values.meeting_schedule_notes;
                }

                const supportIds = Array.from(
                  new Set(
                    values.support_coordinator_ids
                      .filter(Boolean)
                      .map((id) => Number(id))
                      .filter((id) => !Number.isNaN(id))
                  )
                );

                const payload = {
                  name: values.name.trim(),
                  description: values.description,
                  category: values.category,
                  activity_cadence: values.activity_cadence,
                  primary_coordinator_id: values.primary_coordinator_id
                    ? Number(values.primary_coordinator_id)
                    : null,
                  support_coordinator_ids: supportIds,
                  meeting_location: values.meeting_location,
                  meeting_schedule:
                    Object.keys(meetingSchedule).length > 0
                      ? meetingSchedule
                      : null,
                  communication_channel:
                    values.communication_channel || undefined,
                  is_active: values.is_active,
                };

                const created = await createMinistry(payload);

                // Add members to the newly created ministry
                if (values.members && values.members.length > 0) {
                  try {
                    await Promise.all(
                      values.members.map((member) =>
                        addMember({
                          ministry: created.id,
                          member_id: Number(member.member_id),
                          role: member.role,
                          skills: member.skills || "",
                          notes: member.notes || "",
                        } as Partial<MinistryMember>)
                      )
                    );
                  } catch (memberError) {
                    console.error("Error adding members:", memberError);
                    toast.error(
                      "Ministry created but some members could not be added."
                    );
                  }
                }

                await fetchMinistries();

                toast.success(`Ministry "${created.name}" has been created.`);
                setIsCreateOpen(false);
                setFormError(null);
              } catch (submitError) {
                if (submitError instanceof AxiosError) {
                  const data = submitError.response?.data;
                  if (data && typeof data === "object") {
                    let message =
                      (Array.isArray((data as any).non_field_errors) &&
                        (data as any).non_field_errors[0]) ||
                      (typeof (data as any).detail === "string" &&
                        (data as any).detail);

                    if (!message) {
                      const firstFieldError = Object.values(
                        data as Record<string, unknown>
                      ).find(
                        (value) =>
                          Array.isArray(value) && typeof value[0] === "string"
                      ) as string[] | undefined;
                      message = firstFieldError ? firstFieldError[0] : null;
                    }

                    setFormError(
                      message ??
                        "Unable to create ministry. Please fix the highlighted fields."
                    );
                  } else {
                    setFormError(
                      "Unable to create ministry. Please fix the highlighted fields."
                    );
                  }
                } else if (submitError instanceof Error) {
                  setFormError(submitError.message);
                } else {
                  setFormError("Unable to create ministry. Please try again.");
                }
              } finally {
                setIsSubmitting(false);
              }
            }}
            onCancel={() => {
              if (!isSubmitting) {
                setIsCreateOpen(false);
                setFormError(null);
              }
            }}
            isSubmitting={isSubmitting}
            error={formError}
            submitLabel="Create Ministry"
          />
        )}
      </Modal>

      <ConfirmationModal
        isOpen={deleteConfirmation.isOpen}
        onClose={closeDeleteConfirmation}
        onConfirm={handleDeleteConfirm}
        title="Delete Ministry"
        message={`Are you sure you want to delete the "${deleteConfirmation.ministry?.name}" ministry? This action cannot be undone and will permanently remove this ministry from the system.`}
        confirmText="Delete Ministry"
        cancelText="Cancel"
        variant="danger"
        loading={deleteConfirmation.loading}
      />

      <Modal
        isOpen={isEditOpen}
        onClose={() => {
          if (!isSubmitting) {
            setIsEditOpen(false);
            setEditMinistry(null);
            setFormError(null);
          }
        }}
        title="Edit Ministry"
      >
        {peopleError && <ErrorMessage message={peopleError} />}
        {peopleLoading ? (
          <div className="py-12 flex justify-center">
            <LoadingSpinner />
          </div>
        ) : editMinistry ? (
          <MinistryForm
            people={people}
            cadenceOptions={cadenceOptionsForForm}
            categoryOptions={categoryOptionsForForm}
            initialData={editMinistry}
            onSubmit={async (values: MinistryFormValues) => {
              try {
                setIsSubmitting(true);
                setFormError(null);

                const meetingSchedule: Record<string, string> = {};
                if (values.meeting_schedule_day) {
                  meetingSchedule.day = values.meeting_schedule_day;
                }
                if (values.meeting_schedule_time) {
                  meetingSchedule.time = values.meeting_schedule_time;
                }
                if (values.meeting_schedule_window) {
                  meetingSchedule.window = values.meeting_schedule_window;
                }
                if (values.meeting_schedule_notes) {
                  meetingSchedule.notes = values.meeting_schedule_notes;
                }

                const supportIds = Array.from(
                  new Set(
                    values.support_coordinator_ids
                      .filter(Boolean)
                      .map((id) => Number(id))
                      .filter((id) => !Number.isNaN(id))
                  )
                );

                const payload = {
                  name: values.name.trim(),
                  description: values.description,
                  category: values.category,
                  activity_cadence: values.activity_cadence,
                  primary_coordinator_id: values.primary_coordinator_id
                    ? Number(values.primary_coordinator_id)
                    : null,
                  support_coordinator_ids: supportIds,
                  meeting_location: values.meeting_location,
                  meeting_schedule:
                    Object.keys(meetingSchedule).length > 0
                      ? meetingSchedule
                      : null,
                  communication_channel:
                    values.communication_channel || undefined,
                  is_active: values.is_active,
                };

                const updated = await updateMinistry(editMinistry.id, payload);

                // Sync memberships: add new, remove deleted, update roles
                try {
                  const existingMemberships = editMinistry.memberships || [];

                  // Remove deleted members
                  if (
                    values.removed_member_ids &&
                    values.removed_member_ids.length > 0
                  ) {
                    await Promise.all(
                      values.removed_member_ids.map((id) => removeMember(id))
                    );
                  }

                  // Add new members or update existing ones
                  await Promise.all(
                    values.members.map(async (member) => {
                      const existingMembership = existingMemberships.find(
                        (m: any) => String(m.member.id) === member.member_id
                      );

                      if (!existingMembership) {
                        // New member - add it
                        await addMember({
                          ministry: updated.id,
                          member_id: Number(member.member_id),
                          role: member.role,
                          skills: member.skills || "",
                          notes: member.notes || "",
                        } as Partial<MinistryMember>);
                      } else {
                        // Existing member - check if any fields changed
                        const needsUpdate =
                          existingMembership.role !== member.role ||
                          (existingMembership.skills || "") !==
                            (member.skills || "") ||
                          (existingMembership.notes || "") !==
                            (member.notes || "");

                        if (needsUpdate) {
                          await updateMember(existingMembership.id, {
                            role: member.role,
                            skills: member.skills || "",
                            notes: member.notes || "",
                          });
                        }
                      }
                    })
                  );
                } catch (memberError) {
                  console.error("Error syncing members:", memberError);
                  toast.error(
                    "Ministry updated but some member changes could not be applied."
                  );
                }

                await fetchMinistries();

                toast.success(`Ministry “${updated.name}” has been updated.`);
                setIsEditOpen(false);
                setEditMinistry(null);
                setFormError(null);
              } catch (submitError) {
                if (submitError instanceof AxiosError) {
                  const data = submitError.response?.data;
                  if (data && typeof data === "object") {
                    let message =
                      (Array.isArray((data as any).non_field_errors) &&
                        (data as any).non_field_errors[0]) ||
                      (typeof (data as any).detail === "string" &&
                        (data as any).detail);

                    if (!message) {
                      const firstFieldError = Object.values(
                        data as Record<string, unknown>
                      ).find(
                        (value) =>
                          Array.isArray(value) && typeof value[0] === "string"
                      ) as string[] | undefined;
                      message = firstFieldError ? firstFieldError[0] : null;
                    }

                    setFormError(
                      message ??
                        "Unable to update ministry. Please fix the highlighted fields."
                    );
                  } else {
                    setFormError(
                      "Unable to update ministry. Please fix the highlighted fields."
                    );
                  }
                } else if (submitError instanceof Error) {
                  setFormError(submitError.message);
                } else {
                  setFormError("Unable to update ministry. Please try again.");
                }
              } finally {
                setIsSubmitting(false);
              }
            }}
            onCancel={() => {
              if (!isSubmitting) {
                setIsEditOpen(false);
                setEditMinistry(null);
                setFormError(null);
              }
            }}
            isSubmitting={isSubmitting}
            error={formError}
            submitLabel="Update Ministry"
          />
        ) : null}
      </Modal>
    </>
  );
}
