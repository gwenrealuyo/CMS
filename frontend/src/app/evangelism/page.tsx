"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import toast from "react-hot-toast";
import DashboardLayout from "@/src/components/layout/DashboardLayout";
import Button from "@/src/components/ui/Button";
import Card from "@/src/components/ui/Card";
import ErrorMessage from "@/src/components/ui/ErrorMessage";
import LoadingSpinner from "@/src/components/ui/LoadingSpinner";
import Modal from "@/src/components/ui/Modal";
import ConfirmationModal from "@/src/components/ui/ConfirmationModal";
import {
  useEvangelismGroups,
  useEvangelismGroup,
  useEvangelismWeeklyReports,
  useProspects,
  useConversions,
  useEvangelismSummary,
} from "@/src/hooks/useEvangelism";
import { branchesApi, clustersApi, evangelismApi, peopleApi } from "@/src/lib/api";
import ScalableSelect from "@/src/components/ui/ScalableSelect";
import {
  EvangelismGroup,
  EvangelismWeeklyReport,
  Prospect,
  Conversion,
  EvangelismGroupFormValues,
  ClassMemberRole,
  EvangelismGroupMember,
} from "@/src/types/evangelism";
import { Person } from "@/src/types/person";
import { Cluster } from "@/src/types/cluster";
import { Branch } from "@/src/types/branch";
import EvangelismGroupForm from "@/src/components/evangelism/EvangelismGroupForm";
import GroupMembersSection from "@/src/components/evangelism/GroupMembersSection";
import GroupReportsSection from "@/src/components/evangelism/GroupReportsSection";
import GroupProspectsSection from "@/src/components/evangelism/GroupProspectsSection";
import GroupConversionsSection from "@/src/components/evangelism/GroupConversionsSection";
import ProspectForm, {
  ProspectFormValues,
} from "@/src/components/evangelism/ProspectForm";
import ConversionForm, {
  ConversionFormValues,
} from "@/src/components/evangelism/ConversionForm";
import EvangelismWeeklyReportForm, {
  EvangelismWeeklyReportFormValues,
} from "@/src/components/evangelism/EvangelismWeeklyReportForm";
import EvangelismSummary from "@/src/components/evangelism/EvangelismSummary";
import Each1Reach1Dashboard from "@/src/components/evangelism/Each1Reach1Dashboard";
import PeopleTallyReport from "@/src/components/evangelism/PeopleTallyReport";
import TallyReport from "@/src/components/evangelism/TallyReport";
import BibleSharersCoverage from "@/src/components/evangelism/BibleSharersCoverage";

export default function EvangelismPage() {
  const {
    groups,
    loading: groupsLoading,
    error: groupsError,
    filters,
    setFilter,
    fetchGroups,
    createGroup,
    updateGroup,
    deleteGroup,
    bulkEnroll,
  } = useEvangelismGroups();

  const {
    summary,
    loading: summaryLoading,
    error: summaryError,
    fetchSummary,
  } = useEvangelismSummary();

  const [searchValue, setSearchValue] = useState(filters.search ?? "");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState(
    filters.search ?? ""
  );
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [viewEditGroup, setViewEditGroup] = useState<EvangelismGroup | null>(
    null
  );
  const [viewMode, setViewMode] = useState<"view" | "edit">("view");
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    isOpen: boolean;
    group: EvangelismGroup | null;
    loading: boolean;
  }>({
    isOpen: false,
    group: null,
    loading: false,
  });
  const [removeMemberConfirmation, setRemoveMemberConfirmation] = useState<{
    isOpen: boolean;
    memberId: string | null;
    memberName: string | null;
    loading: boolean;
  }>({
    isOpen: false,
    memberId: null,
    memberName: null,
    loading: false,
  });
  const [roleChangeConfirmation, setRoleChangeConfirmation] = useState<{
    isOpen: boolean;
    member: EvangelismGroupMember | null;
    nextRole: ClassMemberRole | null;
    loading: boolean;
  }>({
    isOpen: false,
    member: null,
    nextRole: null,
    loading: false,
  });

  const {
    groupData,
    loading: groupLoading,
    fetchGroup,
  } = useEvangelismGroup(viewEditGroup?.id || null);
  const {
    reports,
    loading: reportsLoading,
    fetchReports,
    createReport,
    updateReport,
    deleteReport,
  } = useEvangelismWeeklyReports(viewEditGroup?.id || null);

  // Memoize filters to prevent unnecessary re-renders
  const prospectsFilters = useMemo(
    () => (viewEditGroup ? { evangelism_group: viewEditGroup.id } : undefined),
    [viewEditGroup?.id]
  );
  const conversionsFilters = useMemo(
    () => (viewEditGroup ? { evangelism_group: viewEditGroup.id } : undefined),
    [viewEditGroup?.id]
  );

  const {
    prospects,
    loading: prospectsLoading,
    fetchProspects,
    createProspect,
    updateProspect,
  } = useProspects(prospectsFilters);
  const {
    conversions,
    loading: conversionsLoading,
    fetchConversions,
    createConversion,
  } = useConversions(conversionsFilters);

  const conversionVisitors = useMemo(() => {
    const visitors = prospects
      .map((prospect) => prospect.person)
      .filter((person): person is Person => Boolean(person))
      .filter((person) => person.role === "VISITOR");
    const seen = new Set<string>();
    return visitors.filter((person) => {
      if (seen.has(person.id)) return false;
      seen.add(person.id);
      return true;
    });
  }, [prospects]);

  const [coordinators, setCoordinators] = useState<Person[]>([]);
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [isProspectModalOpen, setIsProspectModalOpen] = useState(false);
  const [isConversionModalOpen, setIsConversionModalOpen] = useState(false);
  const [isAddMemberModalOpen, setIsAddMemberModalOpen] = useState(false);
  const [isBulkEnrollModalOpen, setIsBulkEnrollModalOpen] = useState(false);
  const [isUpdateProgressModalOpen, setIsUpdateProgressModalOpen] =
    useState(false);
  const [selectedProspect, setSelectedProspect] = useState<Prospect | null>(
    null
  );
  const [editingReport, setEditingReport] =
    useState<EvangelismWeeklyReport | null>(null);
  const [activeTab, setActiveTab] = useState<
    "groups" | "each1reach1" | "tally" | "reports" | "bible_sharers"
  >("groups");
  const [tallyYear, setTallyYear] = useState(new Date().getFullYear());

  const roleLabels: Record<ClassMemberRole, string> = {
    LEADER: "Leader",
    ASSISTANT_LEADER: "Assistant Leader",
    MEMBER: "Member",
  };

  // Debounced search
  const handleSearchChange = useCallback(
    (query: string) => {
      setSearchValue(query);
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
      searchTimeoutRef.current = setTimeout(() => {
        setDebouncedSearchQuery(query);
        setFilter("search", query);
      }, 300);
    },
    [setFilter]
  );

  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  // Load coordinators, clusters, branches, and people for forms
  useEffect(() => {
    const loadData = async () => {
      try {
        const [coordinatorsRes, clustersRes, branchesRes, peopleRes] =
          await Promise.all([
          peopleApi.search({ role: "COORDINATOR" }),
          clustersApi.getAll(),
          branchesApi.getAll(),
          peopleApi.getAll(),
        ]);
        setCoordinators(coordinatorsRes.data);
        setClusters(clustersRes.data);
        setBranches(branchesRes.data);
        setPeople(peopleRes.data.filter((person) => person.role !== "ADMIN"));
      } catch (err) {
        console.error("Error loading form data:", err);
      }
    };
    loadData();
  }, []);

  // Load group data when viewing
  // Note: fetchProspects and fetchConversions are not needed here because
  // useProspects and useConversions hooks automatically fetch when their filters change
  useEffect(() => {
    if (viewEditGroup) {
      fetchGroup();
      fetchReports();
    }
  }, [viewEditGroup?.id, fetchGroup, fetchReports]);

  const handleResetFilters = () => {
    setSearchValue("");
    setDebouncedSearchQuery("");
    setFilter("search", "");
    setFilter("cluster", "all");
    setFilter("is_active", true);
  };

  const handleCreateGroup = async (values: EvangelismGroupFormValues) => {
    try {
      setIsSubmitting(true);
      setFormError(null);
      await createGroup(values);
      setSuccessMessage(`Group "${values.name}" has been created.`);
      setIsCreateOpen(false);
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err: any) {
      const errorData = err.response?.data || {};
      const firstError = Object.values(errorData)[0] as string[] | undefined;
      setFormError(
        err.response?.data?.detail ||
          firstError?.[0] ||
          "Failed to create group"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateGroup = async (values: EvangelismGroupFormValues) => {
    if (!viewEditGroup) return;
    try {
      setIsSubmitting(true);
      setFormError(null);
      await updateGroup(viewEditGroup.id, values);
      setSuccessMessage(`Group "${values.name}" has been updated.`);
      setViewEditGroup(null);
      setViewMode("view");
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err: any) {
      const errorData = err.response?.data || {};
      const firstError = Object.values(errorData)[0] as string[] | undefined;
      setFormError(
        err.response?.data?.detail ||
          firstError?.[0] ||
          "Failed to update group"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitReport = async (
    values: EvangelismWeeklyReportFormValues
  ) => {
    if (!viewEditGroup) return;
    try {
      setIsSubmitting(true);
      setFormError(null);
      const prospectIds = values.visitors_attended
        .filter((id) => id.startsWith("prospect:"))
        .map((id) => id.replace("prospect:", ""));
      const existingVisitorIds = values.visitors_attended.filter(
        (id) => !id.startsWith("prospect:")
      );
      const createdVisitorIds: string[] = [];

      for (const prospectId of prospectIds) {
        const response = await evangelismApi.markAttended(prospectId, {
          last_activity_date: values.meeting_date,
        });
        const personId = response.data?.person?.id;
        if (personId) {
          createdVisitorIds.push(String(personId));
        }
      }

      const payload = {
        ...values,
        conversions_this_week: 0,
        members_attended: values.members_attended.map((id) => Number(id)),
        visitors_attended: [...existingVisitorIds, ...createdVisitorIds].map(
          (id) => Number(id)
        ),
      };
      if (editingReport) {
        await updateReport(editingReport.id, payload);
        setSuccessMessage("Report updated successfully.");
      } else {
        await createReport(payload);
        setSuccessMessage("Report submitted successfully.");
      }
      setIsReportModalOpen(false);
      setEditingReport(null);
      fetchReports();
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err: any) {
      const errorData = err.response?.data || {};
      const firstError = Object.values(errorData)[0] as string[] | undefined;
      setFormError(
        err.response?.data?.detail ||
          firstError?.[0] ||
          "Failed to submit report"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateProspect = async (values: ProspectFormValues) => {
    try {
      setIsSubmitting(true);
      setFormError(null);
      const prospectData = {
        ...values,
        evangelism_group_id: viewEditGroup?.id
          ? String(viewEditGroup.id)
          : values.evangelism_group_id,
      };
      await createProspect(prospectData);
      setSuccessMessage("Visitor created successfully.");
      setIsProspectModalOpen(false);
      if (viewEditGroup) {
        fetchProspects();
      }
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err: any) {
      const errorData = err.response?.data || {};
      const firstError = Object.values(errorData)[0] as string[] | undefined;
      setFormError(
        err.response?.data?.detail ||
          firstError?.[0] ||
          "Failed to create visitor"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateConversion = async (values: ConversionFormValues) => {
    try {
      setIsSubmitting(true);
      setFormError(null);
      const { lesson_start_date, ...conversionValues } = values;
      const prospectMatch = prospects.find(
        (prospect) => prospect.person?.id === values.person_id
      );
      const conversionData = {
        ...conversionValues,
        prospect_id: prospectMatch?.id,
        evangelism_group_id: viewEditGroup?.id
          ? String(viewEditGroup.id)
          : undefined,
      };
      await createConversion(conversionData);
      setSuccessMessage("Conversion recorded successfully.");
      setIsConversionModalOpen(false);
      if (viewEditGroup) {
        fetchConversions();
      }
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err: any) {
      const errorData = err.response?.data || {};
      const firstError = Object.values(errorData)[0] as string[] | undefined;
      setFormError(
        err.response?.data?.detail ||
          firstError?.[0] ||
          "Failed to record conversion"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredGroups = useMemo(() => {
    return groups.filter((group) => {
      if (
        filters.search &&
        !group.name.toLowerCase().includes(filters.search.toLowerCase())
      ) {
        return false;
      }
      if (
        filters.cluster &&
        filters.cluster !== "all" &&
        group.cluster?.id !== filters.cluster
      ) {
        return false;
      }
      if (
        filters.is_active !== "all" &&
        group.is_active !== filters.is_active
      ) {
        return false;
      }
      return true;
    });
  }, [groups, filters]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold text-[#2D3748]">Evangelism</h1>
            <p className="text-sm text-gray-600">
              Manage Bible Study groups, track visitors, and monitor conversion
              progress.
            </p>
          </div>
          <Button
            variant="primary"
            onClick={() => setIsCreateOpen(true)}
            className="w-full sm:w-auto min-h-[44px]"
          >
            Create Group
          </Button>
        </div>

        {successMessage && (
          <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded">
            {successMessage}
          </div>
        )}

        {groupsError && <ErrorMessage message={groupsError} />}

        {/* Summary Cards */}
        <EvangelismSummary
          summary={summary}
          loading={summaryLoading}
          error={summaryError}
        />

        {/* Tabs */}
        <div className="mt-10 border-t border-gray-200 pt-7">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-4 sm:space-x-8 overflow-x-auto">
              <button
                onClick={() => setActiveTab("groups")}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors whitespace-nowrap min-w-[60px] ${
                  activeTab === "groups"
                    ? "border-[#2563EB] text-[#2563EB]"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                Groups
              </button>
              <button
                onClick={() => setActiveTab("each1reach1")}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors whitespace-nowrap min-w-[100px] ${
                  activeTab === "each1reach1"
                    ? "border-[#2563EB] text-[#2563EB]"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                Each 1 Reach 1
              </button>
              <button
                onClick={() => setActiveTab("tally")}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors whitespace-nowrap min-w-[70px] ${
                  activeTab === "tally"
                    ? "border-[#2563EB] text-[#2563EB]"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                Tally
              </button>
              <button
                onClick={() => setActiveTab("reports")}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors whitespace-nowrap min-w-[70px] ${
                  activeTab === "reports"
                    ? "border-[#2563EB] text-[#2563EB]"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                Reports
              </button>
              <button
                onClick={() => setActiveTab("bible_sharers")}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors whitespace-nowrap min-w-[110px] ${
                  activeTab === "bible_sharers"
                    ? "border-[#2563EB] text-[#2563EB]"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                Bible Sharers
              </button>
            </nav>
          </div>
        </div>

        {/* Groups Tab */}
        {activeTab === "groups" && (
          <div className="space-y-6">
            {/* Filters */}
            <Card title="Search & Filter">
              <div className="flex flex-col sm:flex-row gap-4">
                <input
                  type="text"
                  placeholder="Search groups by name or description..."
                  value={searchValue}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className="flex-1 w-full px-4 py-2 min-h-[44px] border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                />
                <Button
                  variant="tertiary"
                  onClick={handleResetFilters}
                  className="w-full sm:w-auto min-h-[44px]"
                >
                  Reset
                </Button>
              </div>
            </Card>

            {/* Groups List */}
            {groupsLoading ? (
              <Card title="Evangelism Groups">
                <div className="flex justify-center py-8">
                  <LoadingSpinner />
                </div>
              </Card>
            ) : (
              <Card
                title="Evangelism Groups"
                headerAction={
                  <Button
                    onClick={() => setIsCreateOpen(true)}
                    className="text-sm w-full sm:w-auto min-h-[44px]"
                  >
                    Add Group
                  </Button>
                }
              >
                {filteredGroups.length === 0 ? (
                  <div className="text-center text-gray-500 py-16 border border-dashed border-gray-200 rounded-lg">
                    {searchValue
                      ? "No groups found matching your search."
                      : "No groups available yet. Create the first one to get started."}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredGroups.map((group) => {
                      const isSelected =
                        viewEditGroup?.id === group.id && viewMode === "view";

                      return (
                        <button
                          key={group.id}
                          type="button"
                          onClick={() => {
                            setViewEditGroup(group);
                            setViewMode("view");
                          }}
                          className={`w-full text-left border rounded-lg px-4 py-3 transition-colors ${
                            isSelected
                              ? "border-blue-500 bg-blue-50"
                              : "border-gray-200 hover:border-blue-200 hover:bg-blue-50/30"
                          }`}
                        >
                          <div className="flex justify-between items-start gap-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h4 className="text-lg font-semibold text-[#2D3748]">
                                  {group.name}
                                </h4>
                                {group.is_bible_sharers_group && (
                                  <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-semibold text-blue-700">
                                    Bible Sharers
                                  </span>
                                )}
                                {!group.is_active && (
                                  <span className="inline-flex items-center rounded-full bg-gray-200 px-2 py-0.5 text-[11px] font-semibold text-gray-600">
                                    Inactive
                                  </span>
                                )}
                                {group.is_active && (
                                  <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-semibold text-green-700">
                                    Active
                                  </span>
                                )}
                              </div>
                              {group.description && (
                                <p className="text-sm text-gray-500 mt-1 line-clamp-2">
                                  {group.description}
                                </p>
                              )}
                              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 mt-2 text-sm text-gray-600">
                                {group.coordinator && (
                                  <span>
                                    Coordinator:{" "}
                                    <span className="font-medium">
                                      {group.coordinator.full_name}
                                    </span>
                                  </span>
                                )}
                                {group.cluster && (
                                  <span>
                                    Cluster:{" "}
                                    <span className="font-medium">
                                      {group.cluster.name}
                                    </span>
                                  </span>
                                )}
                                <span>
                                  Members:{" "}
                                  <span className="font-medium">
                                    {group.members_count || 0}
                                  </span>
                                </span>
                              </div>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </Card>
            )}
          </div>
        )}

        {/* Each 1 Reach 1 Tab */}
        {activeTab === "each1reach1" && (
          <div className="space-y-6">
            <Each1Reach1Dashboard year={new Date().getFullYear()} />
          </div>
        )}

        {/* Tally Tab */}
        {activeTab === "tally" && (
          <div className="space-y-6">
            <PeopleTallyReport year={tallyYear} onYearChange={setTallyYear} />
          </div>
        )}

        {/* Reports Tab */}
        {activeTab === "reports" && (
          <div className="space-y-6">
            <TallyReport year={new Date().getFullYear()} />
          </div>
        )}

        {/* Bible Sharers Tab */}
        {activeTab === "bible_sharers" && (
          <div className="space-y-6">
            <BibleSharersCoverage />
          </div>
        )}

        {/* Create Group Modal */}
        {isCreateOpen && (
          <Modal
            isOpen={isCreateOpen}
            onClose={() => {
              setIsCreateOpen(false);
              setFormError(null);
            }}
            title="Create Evangelism Group"
          >
            <EvangelismGroupForm
              coordinators={coordinators}
              people={people}
              clusters={clusters}
              onSubmit={handleCreateGroup}
              onCancel={() => {
                setIsCreateOpen(false);
                setFormError(null);
              }}
              isSubmitting={isSubmitting}
              error={formError}
            />
          </Modal>
        )}

        {/* View/Edit Group Modal */}
        {viewEditGroup && (
          <Modal
            isOpen={!!viewEditGroup}
            onClose={() => {
              setViewEditGroup(null);
              setViewMode("view");
              setFormError(null);
            }}
            title={
              viewMode === "view"
                ? `View Group: ${viewEditGroup.name}`
                : "Edit Group"
            }
          >
            {viewMode === "edit" ? (
              <EvangelismGroupForm
                coordinators={coordinators}
                people={people}
                clusters={clusters}
                onSubmit={handleUpdateGroup}
                onCancel={() => {
                  setViewMode("view");
                  setFormError(null);
                }}
                isSubmitting={isSubmitting}
                error={formError}
                submitLabel="Update Group"
                initialData={groupData || viewEditGroup}
              />
            ) : (
              <div className="space-y-6">
                {groupLoading ? (
                  <LoadingSpinner />
                ) : (
                  <>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 mt-0.5">
                          <svg
                            className="w-5 h-5 text-blue-600"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                            />
                          </svg>
                        </div>
                        <div className="flex-1">
                          <p className="text-sm text-gray-500">Coordinator</p>
                          <p className="font-medium">
                            {groupData?.coordinator?.full_name || "N/A"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 mt-0.5">
                          <svg
                            className="w-5 h-5 text-purple-600"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                            />
                          </svg>
                        </div>
                        <div className="flex-1">
                          <p className="text-sm text-gray-500">Cluster</p>
                          <p className="font-medium">
                            {groupData?.cluster?.name || "N/A"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 mt-0.5">
                          <svg
                            className="w-5 h-5 text-indigo-600"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M7 7h10M7 11h10M7 15h10M5 5h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2z"
                            />
                          </svg>
                        </div>
                        <div className="flex-1">
                          <p className="text-sm text-gray-500">Branch Code</p>
                          <p className="font-medium">
                            {(() => {
                              const clusterId = groupData?.cluster?.id;
                              const clusterMatch = clusters.find(
                                (cluster) => cluster.id === clusterId
                              );
                              const branchMatch = branches.find(
                                (branch) => branch.id === clusterMatch?.branch
                              );
                              return branchMatch?.code || "N/A";
                            })()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 mt-0.5">
                          <svg
                            className="w-5 h-5 text-green-600"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                            />
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                            />
                          </svg>
                        </div>
                        <div className="flex-1">
                          <p className="text-sm text-gray-500">Location</p>
                          <p className="font-medium">
                            {groupData?.location || "N/A"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 mt-0.5">
                          <svg
                            className="w-5 h-5 text-orange-600"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                            />
                          </svg>
                        </div>
                        <div className="flex-1">
                          <p className="text-sm text-gray-500">Meeting Time</p>
                          <p className="font-medium">
                            {groupData?.meeting_day}{" "}
                            {groupData?.meeting_time || ""}
                          </p>
                        </div>
                      </div>
                    </div>
                    {groupData?.description && (
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 mt-0.5">
                          <svg
                            className="w-5 h-5 text-amber-600"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                            />
                          </svg>
                        </div>
                        <div className="flex-1">
                          <p className="text-sm text-gray-500">Description</p>
                          <p className="font-medium">{groupData.description}</p>
                        </div>
                      </div>
                    )}

                    <GroupMembersSection
                      members={groupData?.members || []}
                      onAddMember={() => setIsAddMemberModalOpen(true)}
                      onBulkEnroll={() => setIsBulkEnrollModalOpen(true)}
                      onRemoveMember={(member) => {
                        const memberName =
                          member.person?.full_name ||
                          member.person?.username ||
                          "this member";
                        setRemoveMemberConfirmation({
                          isOpen: true,
                          memberId: member.id,
                          memberName,
                          loading: false,
                        });
                      }}
                      onUpdateRole={(member, role) => {
                        if (role === member.role) return;
                        setRoleChangeConfirmation({
                          isOpen: true,
                          member,
                          nextRole: role,
                          loading: false,
                        });
                      }}
                      loading={groupLoading}
                    />

                    <GroupReportsSection
                      reports={reports}
                      onAddReport={() => setIsReportModalOpen(true)}
                      onEditReport={(report) => {
                        setEditingReport(report);
                        setIsReportModalOpen(true);
                      }}
                      loading={reportsLoading}
                    />

                    <GroupProspectsSection
                      prospects={prospects}
                      onAddProspect={() => setIsProspectModalOpen(true)}
                      onUpdateProgress={(prospect) => {
                        setSelectedProspect(prospect);
                        setIsUpdateProgressModalOpen(true);
                      }}
                      loading={prospectsLoading}
                    />

                    <GroupConversionsSection
                      conversions={conversions}
                      onAddConversion={() => setIsConversionModalOpen(true)}
                      loading={conversionsLoading}
                    />

                    <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-3 px-6 pt-6 pb-6 border-t border-gray-200 bg-gray-50 -mx-6 !-mb-6 rounded-b-lg">
                      {/* Mobile buttons - full width with text */}
                      <div className="flex flex-col md:hidden gap-3 w-full">
                        <Button
                          onClick={() => {
                            setViewMode("edit");
                          }}
                          variant="secondary"
                          className="!text-blue-600 py-3 px-4 text-sm font-medium bg-white border border-blue-300 hover:bg-blue-50 hover:border-blue-400 flex items-center justify-center space-x-2 min-h-[44px] w-full"
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
                        <Button
                          onClick={() => {
                            setViewEditGroup(null);
                            setViewMode("view");
                          }}
                          variant="secondary"
                          className="!text-gray-700 py-3 px-4 text-sm font-medium bg-white border border-gray-300 hover:bg-gray-50 hover:border-gray-400 flex items-center justify-center space-x-2 min-h-[44px] w-full"
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
                          <span>Cancel</span>
                        </Button>
                        <div className="border-t border-gray-200 my-1"></div>
                        <Button
                          onClick={() =>
                            setDeleteConfirmation({
                              isOpen: true,
                              group: viewEditGroup,
                              loading: false,
                            })
                          }
                          variant="secondary"
                          className="!text-red-600 py-3 px-4 text-sm font-medium bg-white border border-red-300 hover:bg-red-50 hover:border-red-400 flex items-center justify-center space-x-2 min-h-[44px] w-full"
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
                          <span>Delete</span>
                        </Button>
                      </div>

                      {/* Desktop/Tablet buttons - icon-only delete on left, cancel/edit on right */}
                      <div className="hidden md:flex md:items-center md:justify-between md:w-full">
                        <Button
                          onClick={() =>
                            setDeleteConfirmation({
                              isOpen: true,
                              group: viewEditGroup,
                              loading: false,
                            })
                          }
                          variant="secondary"
                          className="!text-red-600 px-4 md:py-4 text-sm font-normal bg-white border border-red-200 hover:bg-red-50 hover:border-red-300 flex items-center justify-center min-h-[44px]"
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
                        <div className="flex items-center gap-3">
                          <Button
                            onClick={() => {
                              setViewEditGroup(null);
                              setViewMode("view");
                            }}
                            variant="secondary"
                            className="!text-black px-6 md:py-4 text-sm font-normal bg-white border border-gray-200 hover:bg-gray-50 hover:border-gray-300 flex items-center justify-center space-x-2 min-h-[44px]"
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
                            <span>Cancel</span>
                          </Button>
                          <Button
                            onClick={() => {
                              setViewMode("edit");
                            }}
                            variant="secondary"
                            className="!text-blue-600 px-6 md:py-4 text-sm font-normal bg-white border border-blue-200 hover:bg-blue-50 hover:border-blue-300 flex items-center justify-center space-x-2 min-h-[44px]"
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
                  </>
                )}
              </div>
            )}
          </Modal>
        )}

        {/* Report Modal */}
        {isReportModalOpen && viewEditGroup && (
          <Modal
            isOpen={isReportModalOpen}
            onClose={() => {
              setIsReportModalOpen(false);
              setEditingReport(null);
              setFormError(null);
            }}
            title={editingReport ? "Edit Report" : "Submit Report"}
          >
            <EvangelismWeeklyReportForm
              group={viewEditGroup}
              prospects={prospects}
              onSubmit={handleSubmitReport}
              onCancel={() => {
                setIsReportModalOpen(false);
                setEditingReport(null);
                setFormError(null);
              }}
              isSubmitting={isSubmitting}
              error={formError}
              initialData={editingReport || undefined}
            />
          </Modal>
        )}

        {/* Prospect Modal */}
        {isProspectModalOpen && (
          <Modal
            isOpen={isProspectModalOpen}
            onClose={() => {
              setIsProspectModalOpen(false);
              setFormError(null);
            }}
            title="Add Visitor"
          >
            <ProspectForm
              inviters={(people.length > 0 ? people : coordinators).filter(
                (person) => person.role !== "ADMIN"
              )}
              groups={groups}
              onSubmit={handleCreateProspect}
              onCancel={() => {
                setIsProspectModalOpen(false);
                setFormError(null);
              }}
              isSubmitting={isSubmitting}
              error={formError}
              defaultGroupId={viewEditGroup ? String(viewEditGroup.id) : undefined}
            />
          </Modal>
        )}

        {/* Conversion Modal */}
        {isConversionModalOpen && (
          <Modal
            isOpen={isConversionModalOpen}
            onClose={() => {
              setIsConversionModalOpen(false);
              setFormError(null);
            }}
            title="Record Conversion"
          >
            <ConversionForm
              people={conversionVisitors}
              onSubmit={handleCreateConversion}
              onCancel={() => {
                setIsConversionModalOpen(false);
                setFormError(null);
              }}
              isSubmitting={isSubmitting}
              error={formError}
            />
          </Modal>
        )}

        {/* Update Progress Modal */}
        {isUpdateProgressModalOpen && selectedProspect && (
          <Modal
            isOpen={isUpdateProgressModalOpen}
            onClose={() => {
              setIsUpdateProgressModalOpen(false);
              setSelectedProspect(null);
              setFormError(null);
            }}
            title="Update Progress"
          >
            <UpdateProgressModalContent
              prospect={selectedProspect}
              onSuccess={async () => {
                setIsUpdateProgressModalOpen(false);
                setSelectedProspect(null);
                await fetchProspects();
              }}
              onCancel={() => {
                setIsUpdateProgressModalOpen(false);
                setSelectedProspect(null);
                setFormError(null);
              }}
            />
          </Modal>
        )}


        {/* Delete Confirmation */}
        <ConfirmationModal
          isOpen={deleteConfirmation.isOpen}
          onClose={() =>
            setDeleteConfirmation({
              isOpen: false,
              group: null,
              loading: false,
            })
          }
          onConfirm={() => {
            if (deleteConfirmation.group) {
              (async () => {
                try {
                  setDeleteConfirmation((prev) => ({ ...prev, loading: true }));
                  await deleteGroup(deleteConfirmation.group!.id);
                  setDeleteConfirmation({
                    isOpen: false,
                    group: null,
                    loading: false,
                  });
                  setViewEditGroup(null);
                } catch (error) {
                  console.error("Error deleting group:", error);
                  setDeleteConfirmation((prev) => ({
                    ...prev,
                    loading: false,
                  }));
                }
              })();
            }
          }}
          title="Delete Group"
          message={`Are you sure you want to delete "${deleteConfirmation.group?.name}"? This action cannot be undone.`}
          confirmText="Delete"
          cancelText="Cancel"
          loading={deleteConfirmation.loading}
        />

        {/* Remove Member Confirmation */}
        <ConfirmationModal
          isOpen={removeMemberConfirmation.isOpen}
          onClose={() =>
            setRemoveMemberConfirmation({
              isOpen: false,
              memberId: null,
              memberName: null,
              loading: false,
            })
          }
          onConfirm={() => {
            if (removeMemberConfirmation.memberId) {
              (async () => {
                try {
                  setRemoveMemberConfirmation((prev) => ({
                    ...prev,
                    loading: true,
                  }));
                  await evangelismApi.deleteMember(
                    removeMemberConfirmation.memberId!
                  );
                  setRemoveMemberConfirmation({
                    isOpen: false,
                    memberId: null,
                    memberName: null,
                    loading: false,
                  });
                  fetchGroup();
                } catch (error) {
                  console.error("Error removing member:", error);
                  setRemoveMemberConfirmation((prev) => ({
                    ...prev,
                    loading: false,
                  }));
                }
              })();
            }
          }}
          title="Remove Member"
          message={`Are you sure you want to remove "${removeMemberConfirmation.memberName}" from this group? This action cannot be undone.`}
          confirmText="Remove"
          cancelText="Cancel"
          loading={removeMemberConfirmation.loading}
        />

        {/* Role Change Confirmation */}
        <ConfirmationModal
          isOpen={roleChangeConfirmation.isOpen}
          onClose={() =>
            setRoleChangeConfirmation({
              isOpen: false,
              member: null,
              nextRole: null,
              loading: false,
            })
          }
          onConfirm={() => {
            if (roleChangeConfirmation.member && roleChangeConfirmation.nextRole) {
              (async () => {
                try {
                  setRoleChangeConfirmation((prev) => ({
                    ...prev,
                    loading: true,
                  }));
                  const member = roleChangeConfirmation.member!;
                  await evangelismApi.updateMember(member.id, {
                    evangelism_group: member.evangelism_group,
                    person_id: member.person?.id,
                    role: roleChangeConfirmation.nextRole,
                    is_active: member.is_active,
                    notes: member.notes ?? "",
                  });
                  setRoleChangeConfirmation({
                    isOpen: false,
                    member: null,
                    nextRole: null,
                    loading: false,
                  });
                  await fetchGroup();
                  toast.success("Member role updated successfully.");
                } catch (error) {
                  console.error("Error updating member role:", error);
                  toast.error("Failed to update member role.");
                  setRoleChangeConfirmation((prev) => ({
                    ...prev,
                    loading: false,
                  }));
                }
              })();
            }
          }}
          title="Change Member Role"
          message={
            roleChangeConfirmation.member && roleChangeConfirmation.nextRole
              ? `Change "${roleChangeConfirmation.member.person?.full_name || roleChangeConfirmation.member.person?.username || "this member"}" to ${roleLabels[roleChangeConfirmation.nextRole]}?`
              : "Change this member's role?"
          }
          confirmText="Update Role"
          cancelText="Cancel"
          loading={roleChangeConfirmation.loading}
        />

        {/* Add Member Modal */}
        {isAddMemberModalOpen && viewEditGroup && (
          <Modal
            isOpen={isAddMemberModalOpen}
            onClose={() => setIsAddMemberModalOpen(false)}
            title="Add Member to Group"
          >
            <AddMemberModalContent
              groupId={String(viewEditGroup.id)}
              existingMemberIds={
                groupData?.members?.map(
                  (m) => m.person?.id?.toString() || ""
                ) || []
              }
              people={people}
              onSuccess={() => {
                setIsAddMemberModalOpen(false);
                fetchGroup();
                setSuccessMessage("Member added successfully.");
                setTimeout(() => setSuccessMessage(null), 5000);
              }}
              onCancel={() => setIsAddMemberModalOpen(false)}
            />
          </Modal>
        )}

        {/* Bulk Enroll Modal */}
        {isBulkEnrollModalOpen && viewEditGroup && (
          <Modal
            isOpen={isBulkEnrollModalOpen}
            onClose={() => setIsBulkEnrollModalOpen(false)}
            title="Bulk Add Members"
          >
            <BulkEnrollModalContent
              groupId={String(viewEditGroup.id)}
              existingMemberIds={
                groupData?.members?.map(
                  (m) => m.person?.id?.toString() || ""
                ) || []
              }
              people={people}
              onSuccess={() => {
                setIsBulkEnrollModalOpen(false);
                fetchGroup();
                setSuccessMessage("Members enrolled successfully.");
                setTimeout(() => setSuccessMessage(null), 5000);
              }}
              onCancel={() => setIsBulkEnrollModalOpen(false)}
            />
          </Modal>
        )}
      </div>
    </DashboardLayout>
  );
}

// Add Member Modal Content Component
function AddMemberModalContent({
  groupId,
  existingMemberIds,
  people,
  onSuccess,
  onCancel,
}: {
  groupId: string;
  existingMemberIds: string[];
  people: Person[];
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [selectedPersonId, setSelectedPersonId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const formatPersonLabel = (person: Person) => {
    const name = `${person.first_name ?? ""} ${person.last_name ?? ""}`.trim();
    return name || person.email || person.username;
  };

  const availablePeople = useMemo(
    () =>
      people.filter(
        (p) =>
          p.role !== "VISITOR" && !existingMemberIds.includes(p.id.toString())
      ),
    [people, existingMemberIds]
  );

  const personOptions = useMemo(
    () =>
      availablePeople
        .map((person) => ({
          label: formatPersonLabel(person),
          value: String(person.id),
        }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [availablePeople]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPersonId) return;

    try {
      setLoading(true);
      setError(null);
      await evangelismApi.createMember({
        evangelism_group: Number(groupId),
        person_id: Number(selectedPersonId),
        role: "MEMBER",
      } as any);
      onSuccess();
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to add member");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <ErrorMessage message={error} />}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Select Person <span className="text-red-500">*</span>
        </label>
        <ScalableSelect
          options={personOptions}
          value={selectedPersonId}
          onChange={setSelectedPersonId}
          placeholder="Select a person"
          className="w-full z-[60]"
          showSearch
        />
      </div>
      <div className="flex flex-col-reverse sm:flex-row gap-4 pt-4">
        <Button
          variant="tertiary"
          className="flex-1 min-h-[44px]"
          onClick={onCancel}
          disabled={loading}
        >
          Cancel
        </Button>
        <Button
          className="flex-1 min-h-[44px]"
          disabled={loading || !selectedPersonId}
          type="submit"
        >
          {loading ? "Adding..." : "Add Member"}
        </Button>
      </div>
    </form>
  );
}

// Bulk Enroll Modal Content Component
function BulkEnrollModalContent({
  groupId,
  existingMemberIds,
  people,
  onSuccess,
  onCancel,
}: {
  groupId: string;
  existingMemberIds: string[];
  people: Person[];
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [selectedPersonIds, setSelectedPersonIds] = useState<string[]>([]);
  const [memberSelectorValue, setMemberSelectorValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const formatPersonLabel = (person: Person) => {
    const name = `${person.first_name ?? ""} ${person.last_name ?? ""}`.trim();
    return name || person.email || person.username;
  };

  const availablePeople = useMemo(
    () =>
      people.filter(
        (p) =>
          p.role !== "VISITOR" && !existingMemberIds.includes(p.id.toString())
      ),
    [people, existingMemberIds]
  );

  const memberOptions = useMemo(
    () =>
      availablePeople
        .map((person) => ({
          label: formatPersonLabel(person),
          value: String(person.id),
          disabled: selectedPersonIds.includes(String(person.id)),
        }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [availablePeople, selectedPersonIds]
  );

  const handleAddMember = () => {
    if (!memberSelectorValue) return;
    if (!selectedPersonIds.includes(memberSelectorValue)) {
      setSelectedPersonIds([...selectedPersonIds, memberSelectorValue]);
    }
    setMemberSelectorValue("");
  };

  const handleRemoveMember = (id: string) => {
    setSelectedPersonIds(selectedPersonIds.filter((item) => item !== id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedPersonIds.length === 0) return;

    try {
      setLoading(true);
      setError(null);
      await evangelismApi.enroll(groupId, {
        person_ids: selectedPersonIds.map(Number),
        role: "MEMBER",
      });
      onSuccess();
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to enroll members");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <ErrorMessage message={error} />}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Select Members
        </label>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="sm:flex-1">
            <ScalableSelect
              options={memberOptions}
              value={memberSelectorValue}
              onChange={setMemberSelectorValue}
              placeholder="Search and pick member to add"
              className="w-full z-[60]"
              showSearch
            />
          </div>
          <Button
            type="button"
            variant="secondary"
            onClick={handleAddMember}
            disabled={!memberSelectorValue}
            className="sm:w-auto"
          >
            Add Member
          </Button>
        </div>
        {selectedPersonIds.length > 0 ? (
          <ul className="mt-3 flex flex-wrap gap-2">
            {selectedPersonIds.map((id) => {
              const label =
                memberOptions.find((option) => option.value === id)?.label ??
                id;
              return (
                <li key={id}>
                  <span className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-sm text-blue-700 border border-blue-200">
                    {label}
                    <button
                      type="button"
                      onClick={() => handleRemoveMember(id)}
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
            Add as many members as needed. They&rsquo;ll appear here once added.
          </p>
        )}
      </div>

      <div className="flex flex-col-reverse sm:flex-row gap-4 pt-4">
        <Button
          variant="tertiary"
          className="flex-1 min-h-[44px]"
          onClick={onCancel}
          disabled={loading}
        >
          Cancel
        </Button>
        <Button
          className="flex-1 min-h-[44px]"
          disabled={loading || selectedPersonIds.length === 0}
          type="submit"
        >
          {loading
            ? "Enrolling..."
            : `Enroll ${selectedPersonIds.length} Member${
                selectedPersonIds.length !== 1 ? "s" : ""
              }`}
        </Button>
      </div>
    </form>
  );
}

// Update Progress Modal Content Component
function UpdateProgressModalContent({
  prospect,
  onSuccess,
  onCancel,
}: {
  prospect: Prospect;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [selectedStage, setSelectedStage] = useState<string>("ATTENDED");
  const [activityDate, setActivityDate] = useState<string>(
    prospect.last_activity_date || new Date().toISOString().split("T")[0]
  );
  const [firstName, setFirstName] = useState<string>("");
  const [lastName, setLastName] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pipelineStages: { value: string; label: string }[] = [
    { value: "INVITED", label: "Invited" },
    { value: "ATTENDED", label: "Attended" },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStage) {
      setError("Please select a pipeline stage.");
      return;
    }

    const nameParts = prospect.name?.trim().split(/\s+/) || [];
    const needsName =
      selectedStage === "ATTENDED" && !prospect.person && nameParts.length < 2;
    if (needsName && (!firstName.trim() || !lastName.trim())) {
      setError("First name and last name are required for attendance.");
      return;
    }

    try {
      setLoading(true);
      setError(null);
      if (selectedStage === "ATTENDED") {
        await evangelismApi.markAttended(prospect.id, {
          last_activity_date: activityDate,
          first_name: needsName ? firstName.trim() : undefined,
          last_name: needsName ? lastName.trim() : undefined,
        });
      } else {
        await evangelismApi.updateProgress(prospect.id, {
          pipeline_stage: selectedStage,
          last_activity_date: activityDate,
        });
      }
      onSuccess();
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to update progress");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <ErrorMessage message={error} />}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Pipeline Stage <span className="text-red-500">*</span>
        </label>
        <select
          value={selectedStage}
          onChange={(e) => setSelectedStage(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          disabled={loading}
        >
          {pipelineStages.map((stage) => (
            <option key={stage.value} value={stage.value}>
              {stage.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Activity Date <span className="text-red-500">*</span>
        </label>
        <input
          type="date"
          value={activityDate}
          onChange={(e) => setActivityDate(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          disabled={loading}
          required
        />
      </div>
      {selectedStage === "ATTENDED" &&
        !prospect.person &&
        (prospect.name?.trim().split(/\s+/).length || 0) < 2 && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                First Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={loading}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Last Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={loading}
                required
              />
            </div>
          </div>
        )}
      <div className="flex flex-col-reverse sm:flex-row gap-4 pt-4">
        <Button
          variant="tertiary"
          className="flex-1 min-h-[44px]"
          onClick={onCancel}
          disabled={loading}
        >
          Cancel
        </Button>
        <Button
          className="flex-1 min-h-[44px]"
          disabled={loading}
          type="submit"
        >
          {loading ? "Updating..." : "Update Progress"}
        </Button>
      </div>
    </form>
  );
}

