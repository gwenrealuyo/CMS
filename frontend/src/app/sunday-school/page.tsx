"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import DashboardLayout from "@/src/components/layout/DashboardLayout";
import Button from "@/src/components/ui/Button";
import Card from "@/src/components/ui/Card";
import ErrorMessage from "@/src/components/ui/ErrorMessage";
import LoadingSpinner from "@/src/components/ui/LoadingSpinner";
import Table from "@/src/components/ui/Table";
import Modal from "@/src/components/ui/Modal";
import ConfirmationModal from "@/src/components/ui/ConfirmationModal";
import SundaySchoolClassForm, {
  SundaySchoolClassFormValues,
} from "@/src/components/sunday-school/SundaySchoolClassForm";
import CategoryManagement from "@/src/components/sunday-school/CategoryManagement";
import ClassMembersSection from "@/src/components/sunday-school/ClassMembersSection";
import ClassSessionsSection from "@/src/components/sunday-school/ClassSessionsSection";
import SessionForm, {
  SessionFormValues,
} from "@/src/components/sunday-school/SessionForm";
import RecurringSessionForm from "@/src/components/sunday-school/RecurringSessionForm";
import AttendanceReportComponent from "@/src/components/sunday-school/AttendanceReport";
import SessionView from "@/src/components/sunday-school/SessionView";
import UnenrolledByCategory from "@/src/components/sunday-school/UnenrolledByCategory";
import SundaySchoolSummary from "@/src/components/sunday-school/SundaySchoolSummary";
import { useAuth } from "@/src/contexts/AuthContext";
import {
  useSundaySchoolCategories,
  useSundaySchoolClasses,
  useSundaySchoolClass,
  useSundaySchoolSessions,
  useSundaySchoolSummary,
  useSundaySchoolUnenrolledByCategory,
  useSundaySchoolAttendanceReport,
  useCreateRecurringSessions,
} from "@/src/hooks/useSundaySchool";
import { sundaySchoolApi } from "@/src/lib/api";
import {
  SundaySchoolClass,
  SundaySchoolSession,
  RecurringSessionData,
  ClassMemberRole,
  AttendanceReport,
} from "@/src/types/sundaySchool";

export default function SundaySchoolPage() {
  const { user } = useAuth();
  const {
    categories,
    loading: categoriesLoading,
    error: categoriesError,
    createCategory,
    updateCategory,
    deleteCategory,
  } = useSundaySchoolCategories();

  const {
    classes,
    loading: classesLoading,
    error: classesError,
    filters,
    setFilter,
    fetchClasses,
    createClass,
    updateClass,
    deleteClass,
    bulkEnroll,
  } = useSundaySchoolClasses();

  const {
    summary,
    loading: summaryLoading,
    error: summaryError,
  } = useSundaySchoolSummary();
  const {
    unenrolled,
    loading: unenrolledLoading,
    error: unenrolledError,
    fetchUnenrolled,
  } = useSundaySchoolUnenrolledByCategory();

  const [searchValue, setSearchValue] = useState(filters.search ?? "");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState(
    filters.search ?? ""
  );
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isCategoryManagementOpen, setIsCategoryManagementOpen] =
    useState(false);
  const [viewEditClass, setViewEditClass] = useState<SundaySchoolClass | null>(
    null
  );
  const [viewMode, setViewMode] = useState<"view" | "edit">("view");
  const [isSessionModalOpen, setIsSessionModalOpen] = useState(false);
  const [isRecurringModalOpen, setIsRecurringModalOpen] = useState(false);
  const [selectedSession, setSelectedSession] =
    useState<SundaySchoolSession | null>(null);
  const [viewingSession, setViewingSession] =
    useState<SundaySchoolSession | null>(null);
  const [editingSession, setEditingSession] =
    useState<SundaySchoolSession | null>(null);
  const [isAttendanceReportOpen, setIsAttendanceReportOpen] = useState(false);
  const [attendanceSessionId, setAttendanceSessionId] = useState<
    number | string | null
  >(null);
  const [viewSessionReport, setViewSessionReport] =
    useState<AttendanceReport | null>(null);
  const [viewSessionReportLoading, setViewSessionReportLoading] =
    useState(false);
  const [viewSessionReportError, setViewSessionReportError] = useState<
    string | null
  >(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    isOpen: boolean;
    class: SundaySchoolClass | null;
    loading: boolean;
  }>({
    isOpen: false,
    class: null,
    loading: false,
  });

  const {
    classData,
    loading: classLoading,
    fetchClass,
  } = useSundaySchoolClass(viewEditClass?.id || null);
  const {
    sessions,
    loading: sessionsLoading,
    fetchSessions,
    createSession,
    updateSession,
    deleteSession,
  } = useSundaySchoolSessions(viewEditClass?.id || null);
  const {
    report,
    loading: reportLoading,
    fetchReport,
  } = useSundaySchoolAttendanceReport(attendanceSessionId);
  const { createRecurring, loading: recurringLoading } =
    useCreateRecurringSessions();

  // Debounced search for better performance
  const handleSearchChange = useCallback(
    (query: string) => {
      setSearchValue(query);

      // Clear existing timeout
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }

      // Set new timeout for debounced search
      searchTimeoutRef.current = setTimeout(() => {
        setDebouncedSearchQuery(query);
        setFilter("search", query);
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

  const handleResetFilters = () => {
    setSearchValue("");
    setDebouncedSearchQuery("");
    setFilter("search", "");
    setFilter("category", "all");
    setFilter("is_active", true);
  };

  const handleCreateClass = async (values: SundaySchoolClassFormValues) => {
    try {
      setIsSubmitting(true);
      setFormError(null);
      await createClass({
        ...values,
        category_id:
          typeof values.category_id === "string"
            ? parseInt(values.category_id)
            : values.category_id,
      } as any);
      setSuccessMessage(`Class "${values.name}" has been created.`);
      setIsCreateOpen(false);
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err: any) {
      const errorData = err.response?.data || {};
      const errorValues = Object.values(errorData);
      setFormError(
        err.response?.data?.detail ||
          (errorValues.length > 0 && Array.isArray(errorValues[0])
            ? errorValues[0][0]
            : undefined) ||
          "Failed to create class"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateClass = async (values: SundaySchoolClassFormValues) => {
    if (!viewEditClass) return;
    try {
      setIsSubmitting(true);
      setFormError(null);
      await updateClass(viewEditClass.id, {
        ...values,
        category_id:
          typeof values.category_id === "string"
            ? parseInt(values.category_id)
            : values.category_id,
      } as any);
      setSuccessMessage(`Class "${values.name}" has been updated.`);
      setViewEditClass(null);
      setViewMode("view");
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err: any) {
      const errorData = err.response?.data || {};
      const errorValues = Object.values(errorData);
      setFormError(
        err.response?.data?.detail ||
          (errorValues.length > 0 && Array.isArray(errorValues[0])
            ? errorValues[0][0]
            : undefined) ||
          "Failed to update class"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteClass = async () => {
    if (!deleteConfirmation.class) return;
    try {
      setDeleteConfirmation((prev) => ({ ...prev, loading: true }));
      await deleteClass(deleteConfirmation.class!.id);
      setDeleteConfirmation({ isOpen: false, class: null, loading: false });
      setViewEditClass(null);
      setViewMode("view");
    } catch (error) {
      console.error("Error deleting class:", error);
      setDeleteConfirmation((prev) => ({ ...prev, loading: false }));
    }
  };

  const handleCreateSession = async (values: SessionFormValues) => {
    if (!viewEditClass) return;
    try {
      setIsSubmitting(true);
      setFormError(null);
      await createSession({
        ...values,
        sunday_school_class_id:
          typeof viewEditClass.id === "string"
            ? parseInt(viewEditClass.id)
            : viewEditClass.id,
      } as any);
      setSuccessMessage(
        "Session created successfully. Event added to calendar."
      );
      setIsSessionModalOpen(false);
      setEditingSession(null);
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err: any) {
      const errorData = err.response?.data || {};
      const errorValues = Object.values(errorData);
      setFormError(
        err.response?.data?.detail ||
          (errorValues.length > 0 && Array.isArray(errorValues[0])
            ? errorValues[0][0]
            : undefined) ||
          "Failed to create session"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleViewSession = async (session: SundaySchoolSession) => {
    setViewingSession(session);
    setFormError(null);

    // Fetch attendance report if event exists
    if (session.event_id) {
      setViewSessionReportLoading(true);
      setViewSessionReportError(null);
      try {
        const response = await sundaySchoolApi.getSessionAttendanceReport(
          session.id
        );
        setViewSessionReport(response.data);
      } catch (err: any) {
        setViewSessionReportError("Failed to load attendance data");
        console.error("Error fetching attendance report:", err);
      } finally {
        setViewSessionReportLoading(false);
      }
    } else {
      setViewSessionReport(null);
    }
  };

  const handleEditSession = (session: SundaySchoolSession) => {
    setEditingSession(session);
    setViewingSession(null);
    setIsSessionModalOpen(true);
    setFormError(null);
  };

  const handleUpdateSession = async (values: SessionFormValues) => {
    if (!editingSession) return;
    try {
      setIsSubmitting(true);
      setFormError(null);
      await updateSession(editingSession.id, {
        ...values,
        sunday_school_class_id:
          typeof values.sunday_school_class_id === "string"
            ? parseInt(values.sunday_school_class_id)
            : values.sunday_school_class_id,
      } as any);
      setSuccessMessage("Session updated successfully.");
      setIsSessionModalOpen(false);
      setEditingSession(null);
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err: any) {
      setFormError(
        err.response?.data?.detail ||
          (() => {
            const errorData = err.response?.data || {};
            const errorValues = Object.values(errorData);
            return errorValues.length > 0 && Array.isArray(errorValues[0])
              ? errorValues[0][0]
              : undefined;
          })() ||
          "Failed to update session"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateRecurring = async (values: RecurringSessionData) => {
    if (!viewEditClass) return;
    try {
      setIsSubmitting(true);
      setFormError(null);
      const result = await createRecurring(values);
      setSuccessMessage(
        `Created ${result.created} recurring sessions. Events added to calendar.`
      );
      setIsRecurringModalOpen(false);
      fetchSessions();
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err: any) {
      setFormError(
        err.response?.data?.detail ||
          (() => {
            const errorData = err.response?.data || {};
            const errorValues = Object.values(errorData);
            return errorValues.length > 0 && Array.isArray(errorValues[0])
              ? errorValues[0][0]
              : undefined;
          })() ||
          "Failed to create recurring sessions"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBulkEnroll = async (
    personIds: number[],
    role: ClassMemberRole
  ) => {
    if (!viewEditClass) return;
    try {
      await bulkEnroll(viewEditClass.id, personIds, role);
      await fetchClass();
      setSuccessMessage(
        `Enrolled ${personIds.length} ${
          personIds.length === 1 ? "person" : "people"
        }.`
      );
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err: any) {
      throw err;
    }
  };

  const handleBulkEnrollFromCategory = async (
    categoryId: number,
    personIds: number[],
    role: ClassMemberRole
  ) => {
    // Find a class in this category to enroll into, or use the first class
    const categoryClass = classes.find((c) => c.category.id === categoryId);
    if (!categoryClass) {
      throw new Error("No class found for this category");
    }
    try {
      await bulkEnroll(categoryClass.id, personIds, role);
      await fetchUnenrolled();
      setSuccessMessage(
        `Enrolled ${personIds.length} ${
          personIds.length === 1 ? "person" : "people"
        } into ${categoryClass.name}.`
      );
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err: any) {
      throw err;
    }
  };

  const handleViewAttendance = (session: SundaySchoolSession) => {
    if (session.id) {
      setAttendanceSessionId(session.id);
      setIsAttendanceReportOpen(true);
      fetchReport();
    }
  };

  const filteredClasses = useMemo(() => {
    let filtered = classes;

    if (debouncedSearchQuery) {
      const query = debouncedSearchQuery.toLowerCase();
      filtered = filtered.filter(
        (cls) =>
          cls.name.toLowerCase().includes(query) ||
          cls.description?.toLowerCase().includes(query) ||
          cls.yearly_theme?.toLowerCase().includes(query) ||
          cls.category.name.toLowerCase().includes(query)
      );
    }

    if (filters.category && filters.category !== "all") {
      filtered = filtered.filter(
        (cls) => cls.category.id === Number(filters.category)
      );
    }

    if (filters.is_active !== "all") {
      filtered = filtered.filter((cls) => cls.is_active === filters.is_active);
    }

    return filtered;
  }, [classes, filters, debouncedSearchQuery]);

  const classColumns = [
    {
      header: "Class",
      accessor: "name" as const,
      render: (_value: any, row: SundaySchoolClass) => (
        <div>
          <p className="font-semibold text-[#2D3748]">{row.name}</p>
          {row.description && (
            <p className="text-sm text-gray-500 line-clamp-2">
              {row.description}
            </p>
          )}
        </div>
      ),
    },
    {
      header: "Category",
      accessor: "category" as const,
      render: (_value: any, row: SundaySchoolClass) => (
        <div>
          <p className="text-sm text-gray-700">{row.category.name}</p>
          {row.category.age_range_display && (
            <p className="text-xs text-gray-500">
              {row.category.age_range_display}
            </p>
          )}
        </div>
      ),
    },
    {
      header: "Members",
      accessor: "members_count" as const,
      render: (_value: any, row: SundaySchoolClass) => (
        <div className="text-sm text-gray-700">
          <p>
            <span className="font-medium">{row.members_count || 0}</span> total
          </p>
          <p className="text-xs text-gray-500">
            {row.students_count || 0} students, {row.teachers_count || 0}{" "}
            teachers
          </p>
        </div>
      ),
    },
    {
      header: "Location",
      accessor: "room_location" as const,
      render: (value: string) => (
        <span className="text-sm text-gray-600">{value || "—"}</span>
      ),
    },
    {
      header: "Status",
      accessor: "is_active" as const,
      render: (value: boolean) => (
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
            value ? "bg-green-100 text-green-800" : "bg-gray-200 text-gray-600"
          }`}
        >
          {value ? "Active" : "Inactive"}
        </span>
      ),
    },
    {
      header: "Actions",
      accessor: "id" as const,
      render: (_value: any, row: SundaySchoolClass) => (
        <div className="flex gap-2">
          <Button
            variant="tertiary"
            onClick={() => {
              setViewEditClass(row);
              setViewMode("view");
              fetchClass();
              fetchSessions();
            }}
            className="text-xs !px-2 !py-1"
          >
            View
          </Button>
        </div>
      ),
    },
  ];

  return (
    <>
      <DashboardLayout>
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-[#2D3748]">
                Sunday School
              </h1>
              <p className="text-sm text-gray-500">
                Manage classes, enrollments, and track attendance for Sunday
                School.
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="tertiary"
                onClick={() => setIsCategoryManagementOpen(true)}
              >
                Manage Categories
              </Button>
              <Button variant="primary" onClick={() => setIsCreateOpen(true)}>
                Add Class
              </Button>
            </div>
          </div>

          {successMessage && (
            <div className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
              {successMessage}
            </div>
          )}

          {summary && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Card>
                <p className="text-sm text-gray-500">Total classes</p>
                <p className="text-3xl font-semibold text-[#2D3748]">
                  {summary.total_classes}
                </p>
              </Card>
              <Card>
                <p className="text-sm text-gray-500">Active classes</p>
                <p className="text-3xl font-semibold text-green-600">
                  {summary.active_classes}
                </p>
              </Card>
              <Card>
                <p className="text-sm text-gray-500">Total students</p>
                <p className="text-3xl font-semibold text-blue-600">
                  {summary.total_students}
                </p>
              </Card>
              <Card>
                <p className="text-sm text-gray-500">Total teachers</p>
                <p className="text-3xl font-semibold text-purple-600">
                  {summary.total_teachers}
                </p>
              </Card>
            </div>
          )}

          <Card title="Filter classes">
            <div className="flex flex-col gap-4 md:flex-row md:items-end">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Search
                </label>
                <input
                  type="search"
                  value={searchValue}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  placeholder="Name, description, category"
                  className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Category
                </label>
                <select
                  value={filters.category === "all" ? "all" : filters.category}
                  onChange={(e) =>
                    setFilter(
                      "category",
                      e.target.value === "all" ? "all" : e.target.value
                    )
                  }
                  className="rounded-md border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="all">All Categories</option>
                  {(categories || [])
                    .filter((cat) => cat.is_active)
                    .map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
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
                  onChange={(e) => {
                    const value = e.target.value;
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

          <Card title="Classes">
            {classesLoading ? (
              <div className="py-12 flex justify-center">
                <LoadingSpinner />
              </div>
            ) : classesError ? (
              <ErrorMessage message={classesError} />
            ) : filteredClasses.length === 0 ? (
              <div className="py-12 text-center">
                <h3 className="text-lg font-semibold text-gray-600">
                  No classes yet
                </h3>
                <p className="text-sm text-gray-500 mt-2">
                  Once you add your first Sunday School class, you&rsquo;ll see
                  it listed here.
                </p>
              </div>
            ) : (
              <Table data={filteredClasses} columns={classColumns} />
            )}
          </Card>

          {summary && (
            <div className="space-y-6">
              {user?.role !== "MEMBER" && (
                <SundaySchoolSummary
                  summary={summary}
                  loading={summaryLoading}
                  error={summaryError}
                />
              )}
              <UnenrolledByCategory
                unenrolled={unenrolled}
                loading={unenrolledLoading}
                error={unenrolledError}
                onBulkEnroll={handleBulkEnrollFromCategory}
              />
            </div>
          )}
        </div>
      </DashboardLayout>

      {/* Create/Edit Class Modal */}
      <Modal
        isOpen={isCreateOpen || (viewEditClass !== null && viewMode === "edit")}
        onClose={() => {
          if (!isSubmitting) {
            setIsCreateOpen(false);
            setViewEditClass(null);
            setViewMode("view");
            setFormError(null);
          }
        }}
        title={viewEditClass ? "Edit Class" : "Add Class"}
      >
        <SundaySchoolClassForm
          categories={categories}
          onSubmit={viewEditClass ? handleUpdateClass : handleCreateClass}
          onCancel={() => {
            setIsCreateOpen(false);
            setViewEditClass(null);
            setViewMode("view");
            setFormError(null);
          }}
          isSubmitting={isSubmitting}
          error={formError}
          submitLabel={viewEditClass ? "Update Class" : "Create Class"}
          initialData={viewEditClass || undefined}
        />
      </Modal>

      {/* Category Management Modal */}
      <Modal
        isOpen={isCategoryManagementOpen}
        onClose={() => setIsCategoryManagementOpen(false)}
        title="Manage Categories"
      >
        <CategoryManagement
          categories={categories}
          loading={categoriesLoading}
          error={categoriesError}
          onCreate={async (data) => {
            await createCategory(data);
          }}
          onUpdate={async (id, data) => {
            await updateCategory(id, data);
          }}
          onDelete={deleteCategory}
        />
      </Modal>

      {/* Class Detail/Edit Modal */}
      <Modal
        isOpen={viewEditClass !== null && viewMode === "view"}
        onClose={() => {
          setViewEditClass(null);
          setViewMode("view");
        }}
        title={viewEditClass?.name || "Class Details"}
        hideHeader={true}
      >
        {classLoading ? (
          <LoadingSpinner />
        ) : classData ? (
          <div className="flex flex-col h-full space-y-0">
            {/* Header */}
            <div className="flex items-center justify-between p-3 border-b border-gray-200">
              <div>
                <h2 className="text-sm font-medium text-gray-900">
                  Class Details
                </h2>
                <p className="text-[11px] text-gray-600 mt-0.5">
                  {classData.name}
                </p>
              </div>
              <button
                onClick={() => {
                  setViewEditClass(null);
                  setViewMode("view");
                }}
                className="text-red-600 hover:text-red-700 text-xl font-bold p-1 rounded-md hover:bg-red-50 transition-colors"
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

            <div className="p-5 overflow-y-auto flex-1 space-y-6">
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium text-gray-700">Category</p>
                  <p className="text-sm text-gray-900">
                    {classData.category.name}
                    {classData.category.age_range_display && (
                      <span className="text-gray-500 ml-2">
                        ({classData.category.age_range_display})
                      </span>
                    )}
                  </p>
                </div>

                {classData.description && (
                  <div>
                    <p className="text-sm font-medium text-gray-700">
                      Description
                    </p>
                    <p className="text-sm text-gray-900">
                      {classData.description}
                    </p>
                  </div>
                )}

                {classData.yearly_theme && (
                  <div>
                    <p className="text-sm font-medium text-gray-700">
                      Yearly Theme
                    </p>
                    <p className="text-sm text-gray-900">
                      {classData.yearly_theme}
                    </p>
                  </div>
                )}

                {classData.room_location && (
                  <div>
                    <p className="text-sm font-medium text-gray-700">
                      Room Location
                    </p>
                    <p className="text-sm text-gray-900">
                      {classData.room_location}
                    </p>
                  </div>
                )}

                {classData.meeting_time && (
                  <div>
                    <p className="text-sm font-medium text-gray-700">
                      Meeting Time
                    </p>
                    <p className="text-sm text-gray-900">
                      {new Date(
                        `2000-01-01T${classData.meeting_time}`
                      ).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                )}
              </div>

              <ClassMembersSection
                classData={classData}
                onBulkEnroll={handleBulkEnroll}
                onRemoveMember={async (memberId) => {
                  try {
                    await sundaySchoolApi.deleteMember(memberId);
                    await fetchClass();
                  } catch (err) {
                    console.error("Failed to remove member:", err);
                  }
                }}
              />

              <ClassSessionsSection
                classData={classData}
                sessions={sessions}
                loading={sessionsLoading}
                onCreateSession={() => {
                  setIsSessionModalOpen(true);
                  setFormError(null);
                }}
                onCreateRecurring={() => {
                  setIsRecurringModalOpen(true);
                  setFormError(null);
                }}
                onViewSession={handleViewSession}
                onEditSession={handleEditSession}
                onViewAttendance={handleViewAttendance}
              />
            </div>

            {/* Footer */}
            <div className="flex justify-between items-center p-6 border-t border-gray-200 bg-gray-50">
              <Button
                onClick={() => {
                  setDeleteConfirmation({
                    isOpen: true,
                    class: classData,
                    loading: false,
                  });
                }}
                variant="secondary"
                className="!text-red-600 py-4 px-4 text-sm font-normal bg-white border border-red-200 hover:bg-red-50 hover:border-red-300 flex items-center justify-center"
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
              </Button>
              <div className="flex gap-3">
                <Button
                  onClick={() => {
                    setViewEditClass(null);
                    setViewMode("view");
                  }}
                  variant="secondary"
                  className="!text-black py-4 px-6 text-sm font-normal bg-white border border-gray-200 hover:bg-gray-50 hover:border-gray-300 flex items-center justify-center space-x-2"
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
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                  <span>Close</span>
                </Button>
                <Button
                  onClick={() => {
                    setViewMode("edit");
                  }}
                  variant="secondary"
                  className="!text-blue-600 py-4 px-6 text-sm font-normal bg-white border border-blue-200 hover:bg-blue-50 hover:border-blue-300 flex items-center justify-center space-x-2"
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
                  <span>Edit</span>
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <ErrorMessage message="Failed to load class details" />
        )}
      </Modal>

      {/* Session Modal */}
      <Modal
        isOpen={isSessionModalOpen}
        onClose={() => {
          if (!isSubmitting) {
            setIsSessionModalOpen(false);
            setEditingSession(null);
            setFormError(null);
          }
        }}
        title={editingSession ? "Edit Session" : "Add Session"}
      >
        {viewEditClass && (
          <SessionForm
            classData={viewEditClass}
            onSubmit={
              editingSession ? handleUpdateSession : handleCreateSession
            }
            onCancel={() => {
              setIsSessionModalOpen(false);
              setEditingSession(null);
              setFormError(null);
            }}
            isSubmitting={isSubmitting}
            error={formError}
            submitLabel={editingSession ? "Update Session" : "Create Session"}
            initialData={editingSession || undefined}
          />
        )}
      </Modal>

      {/* Recurring Session Modal */}
      <Modal
        isOpen={isRecurringModalOpen}
        onClose={() => {
          if (!isSubmitting) {
            setIsRecurringModalOpen(false);
            setFormError(null);
          }
        }}
        title="Create Recurring Sessions"
      >
        {viewEditClass && (
          <RecurringSessionForm
            classData={viewEditClass}
            onSubmit={handleCreateRecurring}
            onCancel={() => {
              setIsRecurringModalOpen(false);
              setFormError(null);
            }}
            isSubmitting={isSubmitting || recurringLoading}
            error={formError}
          />
        )}
      </Modal>

      {/* Session View Modal */}
      <Modal
        isOpen={viewingSession !== null}
        onClose={() => {
          setViewingSession(null);
          setViewSessionReport(null);
          setViewSessionReportError(null);
        }}
        title="Session Details"
        hideHeader={true}
      >
        {viewingSession && viewEditClass && (
          <SessionView
            session={{
              ...viewingSession,
              sunday_school_class_name: viewEditClass.name,
            }}
            attendanceReport={viewSessionReport}
            attendanceLoading={viewSessionReportLoading}
            attendanceError={viewSessionReportError}
            onEdit={() => {
              setEditingSession(viewingSession);
              setViewingSession(null);
              setIsSessionModalOpen(true);
            }}
            onViewAttendance={() => {
              setAttendanceSessionId(viewingSession.id);
              setIsAttendanceReportOpen(true);
              setViewingSession(null);
            }}
            onClose={() => {
              setViewingSession(null);
              setViewSessionReport(null);
              setViewSessionReportError(null);
            }}
          />
        )}
      </Modal>

      {/* Attendance Report Modal */}
      <Modal
        isOpen={isAttendanceReportOpen}
        onClose={() => {
          setIsAttendanceReportOpen(false);
          setAttendanceSessionId(null);
        }}
        title="Attendance Report"
      >
        <AttendanceReportComponent
          report={report}
          loading={reportLoading}
          error={null}
        />
      </Modal>

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={deleteConfirmation.isOpen}
        onClose={() => {
          setDeleteConfirmation({ isOpen: false, class: null, loading: false });
        }}
        onConfirm={handleDeleteClass}
        title="Delete Class"
        message={`Are you sure you want to delete "${deleteConfirmation.class?.name}"? This action cannot be undone.`}
        confirmText="Delete Class"
        cancelText="Cancel"
        variant="danger"
        loading={deleteConfirmation.loading}
      />
    </>
  );
}
