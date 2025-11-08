"use client";

import { AxiosError } from "axios";
import { useMemo, useState } from "react";
import DashboardLayout from "@/src/components/layout/DashboardLayout";
import Button from "@/src/components/ui/Button";
import Card from "@/src/components/ui/Card";
import ErrorMessage from "@/src/components/ui/ErrorMessage";
import LoadingSpinner from "@/src/components/ui/LoadingSpinner";
import Table from "@/src/components/ui/Table";
import Modal from "@/src/components/ui/Modal";
import MinistryForm, {
  MinistryFormValues,
} from "@/src/components/ministries/MinistryForm";
import { useMinistries } from "@/src/hooks/useMinistries";
import { usePeople } from "@/src/hooks/usePeople";

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
  } = useMinistries();
  const { people, loading: peopleLoading, error: peopleError } = usePeople();
  const [searchValue, setSearchValue] = useState(filters.search ?? "");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

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

  const handleSearch = () => {
    setFilter("search", searchValue);
  };

  const handleResetFilters = () => {
    setSearchValue("");
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
            <div className="flex gap-2">
              <Button variant="primary" onClick={() => setIsCreateOpen(true)}>
                Add Ministry
              </Button>
            </div>
          </div>

          {successMessage && (
            <div className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
              {successMessage}
            </div>
          )}

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
                <div className="flex gap-2">
                  <input
                    type="search"
                    value={searchValue}
                    onChange={(event) => setSearchValue(event.target.value)}
                    placeholder="Name, description, coordinator"
                    className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <Button variant="primary" onClick={handleSearch}>
                    Search
                  </Button>
                </div>
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
                  className="rounded-md border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
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
                  className="rounded-md border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
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
                  className="rounded-md border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="all">All</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>

              <div className="md:ml-auto">
                <Button variant="tertiary" onClick={handleResetFilters}>
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
                ]}
              />
            )}
          </Card>
        </div>
      </DashboardLayout>

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
                await fetchMinistries();

                setSuccessMessage(
                  `Ministry “${created.name}” has been created.`
                );
                setIsCreateOpen(false);
                setFormError(null);
                setTimeout(() => setSuccessMessage(null), 5000);
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
    </>
  );
}
