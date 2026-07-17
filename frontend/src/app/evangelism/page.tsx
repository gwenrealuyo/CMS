"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import DashboardLayout from "@/src/components/layout/DashboardLayout";
import Button from "@/src/components/ui/Button";
import Card from "@/src/components/ui/Card";
import { LockedControlTooltip } from "@/src/components/ui/LockedControlTooltip";
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
  useEach1Reach1Goals,
  useEvangelismSummary,
} from "@/src/hooks/useEvangelism";
import {
  branchesApi,
  clustersApi,
  evangelismApi,
  peopleApi,
} from "@/src/lib/api";
import { isSelectablePerson } from "@/src/lib/peopleSelectors";
import ScalableSelect from "@/src/components/ui/ScalableSelect";
import {
  EvangelismGroup,
  EvangelismWeeklyReport,
  Prospect,
  Conversion,
  EvangelismGroupFormValues,
} from "@/src/types/evangelism";
import { Person } from "@/src/types/person";
import { Cluster } from "@/src/types/cluster";
import { Branch } from "@/src/types/branch";
import EvangelismGroupForm from "@/src/components/evangelism/EvangelismGroupForm";
import EvangelismGroupView from "@/src/components/evangelism/EvangelismGroupView";
import ProspectForm, {
  ProspectFormValues,
} from "@/src/components/evangelism/ProspectForm";
import ConversionForm, {
  ConversionFormValues,
  personIdFromConversion,
} from "@/src/components/evangelism/ConversionForm";
import EvangelismWeeklyReportForm, {
  EvangelismWeeklyReportFormValues,
} from "@/src/components/evangelism/EvangelismWeeklyReportForm";
import ViewEvangelismWeeklyReportModal from "@/src/components/evangelism/ViewEvangelismWeeklyReportModal";
import EvangelismSummary from "@/src/components/evangelism/EvangelismSummary";
import Each1Reach1Dashboard from "@/src/components/evangelism/Each1Reach1Dashboard";
import PeopleTallyReport from "@/src/components/evangelism/PeopleTallyReport";
import TallyReport from "@/src/components/evangelism/TallyReport";
import BibleSharersCoverage from "@/src/components/evangelism/BibleSharersCoverage";
import EvangelismReportsDashboard from "@/src/components/evangelism/EvangelismReportsDashboard";
import EvangelismGroupCard from "@/src/components/evangelism/EvangelismGroupCard";
import EvangelismGroupTable from "@/src/components/evangelism/EvangelismGroupTable";
import EvangelismGroupFilterDropdown, {
  EvangelismGroupFilterField,
} from "@/src/components/evangelism/EvangelismGroupFilterDropdown";
import EvangelismGroupSortDropdown from "@/src/components/evangelism/EvangelismGroupSortDropdown";
import ClusterFilterCard from "@/src/components/clusters/ClusterFilterCard";
import BulkActionsMenu from "@/src/components/people/BulkActionsMenu";
import { FilterCondition } from "@/src/components/people/FilterBar";
import ToolbarSearch from "@/src/components/ui/ToolbarSearch";
import ViewModeToggle from "@/src/components/ui/ViewModeToggle";
import {
  TOOLBAR_ACTION_BUTTON_CLASS,
  TOOLBAR_ACTIONS_ROW_CLASS,
  TOOLBAR_CARD_CLASS,
  TOOLBAR_DESKTOP_ACTION_BUTTON_CLASS,
} from "@/src/lib/toolbarStyles";
import {
  effectiveListViewMode,
  useIsTabletUp,
} from "@/src/lib/listViewMode";
import {
  EVANGELISM_BRANCH_SELECT_CLASS,
  EVANGELISM_BRANCH_SELECT_LOCKED_CLASS,
} from "@/src/components/evangelism/EvangelismToolbarSearch";
import {
  applyEvangelismGroupFilters,
  sortEvangelismGroups,
} from "@/src/lib/evangelismGroupListUtils";
import {
  formatEvangelismGroupSchedule,
  getEvangelismGroupCoordinatorName,
  getEvangelismGroupMemberCount,
  resolveEvangelismGroupClusterMeta,
} from "@/src/lib/evangelismGroupDisplay";
import { buildEvangelismWeeklyReportPayloadFromFormValues } from "@/src/lib/evangelismWeeklyReportSubmit";
import { requestNotificationsRefetch } from "@/src/lib/notificationsEvents";
import { useAuth } from "@/src/contexts/AuthContext";
import { canHardDelete } from "@/src/lib/canHardDelete";
import {
  canChangeEvangelismBranchFilter,
  EVANGELISM_BRANCH_LOCKED_HINT,
} from "@/src/lib/evangelismBranchFilter";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

const EVANGELISM_PAGE_TABS = [
  "groups",
  "each1reach1",
  "tally",
  "reports",
  "bible_sharers",
] as const;

type EvangelismPageTab = (typeof EVANGELISM_PAGE_TABS)[number];

function isEvangelismPageTab(v: string | null): v is EvangelismPageTab {
  return (
    v != null &&
    (EVANGELISM_PAGE_TABS as readonly string[]).includes(v)
  );
}

export default function EvangelismPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user, isSeniorCoordinator } = useAuth();
  const userCanHardDelete = canHardDelete(user);
  const canChangeEvangelismBranch = useMemo(
    () => canChangeEvangelismBranchFilter(user, isSeniorCoordinator),
    [user, isSeniorCoordinator],
  );
  const evangelismTallyUserIdRef = useRef<number | undefined>(undefined);

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

  const currentYear = new Date().getFullYear();
  const {
    summary,
    loading: summaryLoading,
    error: summaryError,
    fetchSummary,
  } = useEvangelismSummary(currentYear);
  const each1Reach1Filters = useMemo(
    () => ({ year: currentYear, page_size: 1000 }),
    [currentYear]
  );
  const {
    goals: each1Reach1Goals,
    loading: each1Reach1Loading,
    error: each1Reach1Error,
  } = useEach1Reach1Goals(each1Reach1Filters);

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
  const [groupListViewMode, setGroupListViewMode] = useState<"cards" | "table">(
    "cards"
  );
  const isTabletUp = useIsTabletUp();
  const effectiveGroupListViewMode = effectiveListViewMode(
    groupListViewMode,
    isTabletUp,
  );
  const [groupActiveFilters, setGroupActiveFilters] = useState<
    FilterCondition[]
  >([]);
  const [groupSortBy, setGroupSortBy] = useState("name");
  const [groupSortOrder, setGroupSortOrder] = useState<"asc" | "desc">("asc");
  const [showGroupFilterDropdown, setShowGroupFilterDropdown] = useState(false);
  const [showGroupFilterCard, setShowGroupFilterCard] = useState(false);
  const [showGroupSortDropdown, setShowGroupSortDropdown] = useState(false);
  const [selectedGroupField, setSelectedGroupField] =
    useState<EvangelismGroupFilterField | null>(null);
  const [groupFilterDropdownPosition, setGroupFilterDropdownPosition] = useState({
    top: 0,
    left: 0,
  });
  const [groupFilterCardPosition, setGroupFilterCardPosition] = useState({
    top: 0,
    left: 0,
  });
  const [groupSortDropdownPosition, setGroupSortDropdownPosition] = useState({
    top: 0,
    left: 0,
  });
  const [isGroupSelectionMode, setIsGroupSelectionMode] = useState(false);
  const [selectedGroups, setSelectedGroups] = useState<Set<string>>(new Set());
  const [bulkDeleteConfirmation, setBulkDeleteConfirmation] = useState<{
    isOpen: boolean;
    loading: boolean;
  }>({
    isOpen: false,
    loading: false,
  });
  const [markInactiveConfirmation, setMarkInactiveConfirmation] = useState<{
    isOpen: boolean;
    loading: boolean;
  }>({
    isOpen: false,
    loading: false,
  });
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
  const [hardDeleteConfirmation, setHardDeleteConfirmation] = useState<{
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
    personId: string | null;
    memberName: string | null;
    loading: boolean;
  }>({
    isOpen: false,
    personId: null,
    memberName: null,
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
    updateConversion,
  } = useConversions(conversionsFilters);

  /** All conversions (any group) so "Record conversion" only lists people with no conversion row yet. */
  const { conversions: conversionsGlobally } = useConversions();

  const personIdsWithAnyConversion = useMemo(() => {
    const ids = new Set<string>();
    for (const c of conversionsGlobally) {
      if (c.person?.id != null) ids.add(String(c.person.id));
    }
    // Include group-scoped list so a newly created conversion excludes immediately
    // before the global list refetches.
    for (const c of conversions) {
      if (c.person?.id != null) ids.add(String(c.person.id));
    }
    return ids;
  }, [conversionsGlobally, conversions]);

  const conversionVisitors = useMemo(() => {
    const visitors = prospects
      .map((prospect) => prospect.person)
      .filter((person): person is Person => Boolean(person))
      .filter((person) => person.role === "VISITOR");
    const seen = new Set<string>();
    const unique = visitors.filter((person) => {
      if (seen.has(person.id)) return false;
      seen.add(person.id);
      return true;
    });
    return unique.filter((p) => !personIdsWithAnyConversion.has(String(p.id)));
  }, [prospects, personIdsWithAnyConversion]);

  const each1Reach1Totals = useMemo(() => {
    const totals = each1Reach1Goals.reduce(
      (acc, goal) => ({
        target: acc.target + (goal.target_conversions || 0),
        achieved: acc.achieved + (goal.achieved_conversions || 0),
      }),
      { target: 0, achieved: 0 }
    );
    const percentage =
      totals.target > 0 ? (totals.achieved / totals.target) * 100 : 0;
    return { ...totals, percentage };
  }, [each1Reach1Goals]);

  const [coordinators, setCoordinators] = useState<Person[]>([]);
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [isProspectModalOpen, setIsProspectModalOpen] = useState(false);
  const [isConversionModalOpen, setIsConversionModalOpen] = useState(false);
  const [editingConversion, setEditingConversion] = useState<Conversion | null>(
    null,
  );
  const [isAddMemberModalOpen, setIsAddMemberModalOpen] = useState(false);
  const [isBulkEnrollModalOpen, setIsBulkEnrollModalOpen] = useState(false);
  const [isUpdateProgressModalOpen, setIsUpdateProgressModalOpen] =
    useState(false);
  const [selectedProspect, setSelectedProspect] = useState<Prospect | null>(
    null
  );
  const [editingReport, setEditingReport] =
    useState<EvangelismWeeklyReport | null>(null);
  const [viewingGroupReport, setViewingGroupReport] =
    useState<EvangelismWeeklyReport | null>(null);
  const [pendingDeleteGroupReport, setPendingDeleteGroupReport] =
    useState<EvangelismWeeklyReport | null>(null);
  const [activeTab, setActiveTab] = useState<EvangelismPageTab>("groups");
  const [reportsSubmitNonce, setReportsSubmitNonce] = useState(0);
  const [reportsListRefresh, setReportsListRefresh] = useState(0);
  const [reportsPresetGroupId, setReportsPresetGroupId] = useState<
    string | null
  >(null);
  const [reportsViewReportId, setReportsViewReportId] = useState<string | null>(
    null,
  );
  const [tallyYear, setTallyYear] = useState(currentYear);
  const [tallyBranch, setTallyBranch] = useState<number | "">("");
  const [tallyScope, setTallyScope] = useState("");

  const selectTab = useCallback(
    (tab: EvangelismPageTab) => {
      setActiveTab(tab);
      const params = new URLSearchParams(searchParams.toString());
      params.set("tab", tab);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  useEffect(() => {
    const tabParam = searchParams.get("tab");
    if (isEvangelismPageTab(tabParam)) {
      setActiveTab(tabParam);
    } else {
      setActiveTab("groups");
    }
  }, [searchParams]);

  const action = searchParams.get("action");

  useEffect(() => {
    if (action !== "submit-report") {
      return;
    }
    selectTab("reports");
    setReportsPresetGroupId(null);
    setEditingReport(null);
    setReportsSubmitNonce((n) => n + 1);
    router.replace(pathname);
  }, [action, pathname, router, selectTab]);

  useEffect(() => {
    const groupId = searchParams.get("group");
    const reportId = searchParams.get("report");

    if (!groupId && !reportId) {
      return;
    }

    selectTab("reports");

    if (groupId) {
      setReportsPresetGroupId(groupId);
      setReportsSubmitNonce((n) => n + 1);
    }

    if (reportId) {
      setReportsViewReportId(reportId);
    }

    router.replace(pathname);
  }, [searchParams, pathname, router, selectTab]);

  useEffect(() => {
    if (!viewEditGroup) {
      setViewingGroupReport(null);
      setPendingDeleteGroupReport(null);
    }
  }, [viewEditGroup]);

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
        const [clustersRes, branchesRes, peopleRes] = await Promise.all([
          clustersApi.getAll(),
          branchesApi.getAll(),
          peopleApi.getAll(),
        ]);
        const selectablePeople = peopleRes.data.filter(isSelectablePerson);
        setClusters(clustersRes.data);
        setBranches(branchesRes.data);
        setPeople(selectablePeople);
        setCoordinators(
          selectablePeople.filter((person) =>
            (person.module_coordinator_assignments ?? []).some(
              (assignment) => assignment.module === "EVANGELISM",
            ),
          ),
        );
      } catch (err) {
        console.error("Error loading form data:", err);
      }
    };
    loadData();
  }, []);

  useEffect(() => {
    if (!user) {
      evangelismTallyUserIdRef.current = undefined;
      return;
    }
    if (evangelismTallyUserIdRef.current !== user.id) {
      evangelismTallyUserIdRef.current = user.id;
      setTallyBranch(
        user.branch != null && user.branch !== undefined ? user.branch : "",
      );
    }
  }, [user]);

  useEffect(() => {
    if (!user || canChangeEvangelismBranch) return;
    const expected = user.branch;
    if (expected == null) return;
    if (tallyBranch !== "" && Number(tallyBranch) !== expected) {
      setTallyBranch(expected);
    }
  }, [user, canChangeEvangelismBranch, tallyBranch]);

  // Load group data when viewing
  // Note: fetchProspects and fetchConversions are not needed here because
  // useProspects and useConversions hooks automatically fetch when their filters change
  useEffect(() => {
    if (viewEditGroup) {
      fetchGroup();
      fetchReports();
    }
  }, [viewEditGroup?.id, fetchGroup, fetchReports]);

  const handleCreateGroup = async (values: EvangelismGroupFormValues) => {
    try {
      setIsSubmitting(true);
      setFormError(null);
      const memberIds =
        values.initial_member_ids?.map((id) => Number(id)).filter(Number.isFinite) ??
        [];
      await createGroup({
        name: values.name,
        description: values.description,
        ...(values.coordinator_id
          ? { coordinator_id: values.coordinator_id }
          : {}),
        ...(values.cluster_id ? { cluster_id: values.cluster_id } : {}),
        location: values.location,
        ...(values.meeting_time
          ? { meeting_time: values.meeting_time }
          : { meeting_time: null }),
        ...(values.meeting_day ? { meeting_day: values.meeting_day } : {}),
        is_active: values.is_active,
        ...(values.is_bible_sharers_group !== undefined
          ? { is_bible_sharers_group: values.is_bible_sharers_group }
          : {}),
        ...(memberIds.length > 0 ? { members: memberIds } : {}),
      });
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
      await updateGroup(viewEditGroup.id, {
        name: values.name,
        description: values.description,
        ...(values.coordinator_id
          ? { coordinator_id: values.coordinator_id }
          : {}),
        ...(values.cluster_id ? { cluster_id: values.cluster_id } : {}),
        location: values.location,
        ...(values.meeting_time
          ? { meeting_time: values.meeting_time }
          : { meeting_time: null }),
        ...(values.meeting_day ? { meeting_day: values.meeting_day } : {}),
        is_active: values.is_active,
        ...(values.is_bible_sharers_group !== undefined
          ? { is_bible_sharers_group: values.is_bible_sharers_group }
          : {}),
      });
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
      const payload = await buildEvangelismWeeklyReportPayloadFromFormValues(values);
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
      setReportsListRefresh((n) => n + 1);
      requestNotificationsRefetch();
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

  const openGroupReportView = async (report: EvangelismWeeklyReport) => {
    try {
      const res = await evangelismApi.getWeeklyReport(report.id);
      setViewingGroupReport(res.data);
    } catch {
      setViewingGroupReport(report);
    }
  };

  const confirmDeleteGroupReport = async () => {
    const rpt = pendingDeleteGroupReport;
    if (!rpt) return;
    try {
      await deleteReport(rpt.id);
      setPendingDeleteGroupReport(null);
      setViewingGroupReport(null);
      fetchReports();
      setReportsListRefresh((n) => n + 1);
    } catch (e) {
      console.error(e);
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
      const prospectMatch = prospects.find(
        (prospect) => prospect.person?.id === values.person_id,
      );
      const invited = values.date_first_invited?.trim() ?? "";
      const attended = values.date_first_attended?.trim() ?? "";
      const lessonStart = values.lesson_start_date?.trim() ?? "";
      const conversionData = {
        person_id: values.person_id,
        date_first_invited: invited || null,
        date_first_attended: attended || null,
        lesson_start_date: lessonStart || null,
        water_baptism_date: values.water_baptism_date || null,
        spirit_baptism_date: values.spirit_baptism_date || null,
        notes: values.notes,
        prospect_id: prospectMatch?.id,
        evangelism_group_id: viewEditGroup?.id
          ? String(viewEditGroup.id)
          : undefined,
      };
      await createConversion(conversionData);

      setSuccessMessage("Conversion recorded successfully.");
      setIsConversionModalOpen(false);
      setEditingConversion(null);
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
          "Failed to record conversion",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateConversion = async (values: ConversionFormValues) => {
    if (!editingConversion) return;
    try {
      setIsSubmitting(true);
      setFormError(null);
      const invited = values.date_first_invited?.trim() ?? "";
      const attended = values.date_first_attended?.trim() ?? "";
      const lessonStart = values.lesson_start_date?.trim() ?? "";
      const w = values.water_baptism_date?.trim() ?? "";
      const s = values.spirit_baptism_date?.trim() ?? "";
      await updateConversion(editingConversion.id, {
        date_first_invited: invited || null,
        date_first_attended: attended || null,
        lesson_start_date: lessonStart || null,
        notes: values.notes ?? "",
        water_baptism_date: w ? w : null,
        spirit_baptism_date: s ? s : null,
      });

      setSuccessMessage("Conversion updated successfully.");
      setIsConversionModalOpen(false);
      setEditingConversion(null);
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
          "Failed to update conversion",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredGroups = useMemo(() => {
    let result = groups.filter((group) => {
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
        filters.branch &&
        filters.branch !== "all" &&
        filters.branch !== ""
      ) {
        const cid = group.cluster_id;
        if (!cid) return false;
        const cl = clusters.find((c) => String(c.id) === String(cid));
        if (
          cl?.branch == null ||
          String(cl.branch) !== String(filters.branch)
        ) {
          return false;
        }
      }
      if (
        filters.is_active !== "all" &&
        group.is_active !== filters.is_active
      ) {
        return false;
      }
      return true;
    });

    result = applyEvangelismGroupFilters(
      result,
      groupActiveFilters,
      clusters,
      branches
    );
    return sortEvangelismGroups(
      result,
      groupSortBy,
      groupSortOrder,
      clusters,
      branches
    );
  }, [
    groups,
    filters,
    clusters,
    branches,
    groupActiveFilters,
    groupSortBy,
    groupSortOrder,
  ]);

  const hasGroupListFilters =
    Boolean(searchValue.trim()) || groupActiveFilters.length > 0;

  const handleToggleGroupSelectionMode = useCallback(() => {
    setIsGroupSelectionMode((prev) => {
      if (prev) {
        setSelectedGroups(new Set());
      }
      return !prev;
    });
  }, []);

  const handleSelectGroup = useCallback((groupId: string) => {
    setSelectedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  }, []);

  const handleSelectAllGroups = useCallback(() => {
    if (selectedGroups.size === filteredGroups.length) {
      setSelectedGroups(new Set());
    } else {
      setSelectedGroups(new Set(filteredGroups.map((g) => g.id)));
    }
  }, [filteredGroups, selectedGroups.size]);

  const handleGroupAddFilter = useCallback(
    (anchorRect: DOMRect) => {
      if (showGroupFilterDropdown || showGroupFilterCard) {
        setShowGroupFilterDropdown(false);
        setShowGroupFilterCard(false);
        setSelectedGroupField(null);
        return;
      }
      const dropdownWidth = 256;
      const viewportWidth = window.innerWidth;
      const rightEdge = anchorRect.left + dropdownWidth;
      let left = anchorRect.left;
      if (rightEdge > viewportWidth) {
        left = viewportWidth - dropdownWidth - 16;
      }
      setGroupFilterDropdownPosition({
        top: anchorRect.bottom + 8,
        left: Math.max(16, left),
      });
      setShowGroupFilterDropdown(true);
    },
    [showGroupFilterDropdown, showGroupFilterCard],
  );

  const handleGroupSelectField = useCallback(
    (field: EvangelismGroupFilterField) => {
      setSelectedGroupField(field);
      setShowGroupFilterDropdown(false);

      const cardWidth = 320;
      const viewportWidth = window.innerWidth;
      const rightEdge = groupFilterDropdownPosition.left + cardWidth;
      let left = groupFilterDropdownPosition.left;
      if (rightEdge > viewportWidth) {
        left = viewportWidth - cardWidth - 16;
      }
      setGroupFilterCardPosition({
        top: groupFilterDropdownPosition.top + 8,
        left: Math.max(16, left),
      });
      setShowGroupFilterCard(true);
    },
    [groupFilterDropdownPosition]
  );

  const handleGroupApplyFilter = useCallback((filter: FilterCondition) => {
    setGroupActiveFilters((prev) => [...prev, filter]);
    setShowGroupFilterCard(false);
    setSelectedGroupField(null);
  }, []);

  const handleGroupSortDropdown = useCallback((anchorRect: DOMRect) => {
    const dropdownWidth = 256;
    const viewportWidth = window.innerWidth;
    const rightEdge = anchorRect.left + dropdownWidth;
    let left = anchorRect.left;
    if (rightEdge > viewportWidth) {
      left = viewportWidth - dropdownWidth - 16;
    }
    setGroupSortDropdownPosition({
      top: anchorRect.bottom + 8,
      left: Math.max(16, left),
    });
    setShowGroupSortDropdown(true);
  }, []);

  const handleGroupSelectSort = useCallback(
    (sortBy: string, sortOrder: "asc" | "desc") => {
      setGroupSortBy(sortBy);
      setGroupSortOrder(sortOrder);
      setShowGroupSortDropdown(false);
    },
    []
  );

  const buildGroupExportRows = useCallback(
    (groupsToExport: EvangelismGroup[]) =>
      groupsToExport.map((group) => {
        const { clusterDisplayCode } = resolveEvangelismGroupClusterMeta(
          group,
          clusters,
          branches
        );
        return {
          Name: group.name || "",
          "Cluster Code": clusterDisplayCode || "",
          Coordinator: getEvangelismGroupCoordinatorName(group),
          Members: getEvangelismGroupMemberCount(group),
          Visitors: group.visitors_count ?? 0,
          Status: group.is_active ? "Active" : "Inactive",
          "Bible Sharers": group.is_bible_sharers_group ? "Yes" : "No",
          Location: group.location || "",
          Schedule: formatEvangelismGroupSchedule(group),
          Description: group.description || "",
        };
      }),
    [clusters, branches]
  );

  const handleBulkDeleteGroups = useCallback(() => {
    if (selectedGroups.size === 0) return;
    setBulkDeleteConfirmation({ isOpen: true, loading: false });
  }, [selectedGroups.size]);

  const confirmBulkDeleteGroups = useCallback(async () => {
    if (selectedGroups.size === 0) return;

    try {
      setBulkDeleteConfirmation((prev) => ({ ...prev, loading: true }));
      await Promise.all(
        Array.from(selectedGroups).map((groupId) => deleteGroup(groupId))
      );
      await fetchGroups();
      setSelectedGroups(new Set());
      setIsGroupSelectionMode(false);
      setBulkDeleteConfirmation({ isOpen: false, loading: false });
    } catch (error) {
      console.error("Error deleting groups:", error);
      alert("Failed to delete some groups. Please try again.");
      setBulkDeleteConfirmation((prev) => ({ ...prev, loading: false }));
    }
  }, [selectedGroups, deleteGroup, fetchGroups]);

  const handleBulkMarkInactive = useCallback(() => {
    if (selectedGroups.size === 0) return;
    setMarkInactiveConfirmation({ isOpen: true, loading: false });
  }, [selectedGroups.size]);

  const confirmBulkMarkInactive = useCallback(async () => {
    if (selectedGroups.size === 0) return;

    try {
      setMarkInactiveConfirmation((prev) => ({ ...prev, loading: true }));
      await Promise.all(
        Array.from(selectedGroups).map((groupId) =>
          updateGroup(groupId, { is_active: false })
        )
      );
      await fetchGroups();
      setSelectedGroups(new Set());
      setIsGroupSelectionMode(false);
      setMarkInactiveConfirmation({ isOpen: false, loading: false });
    } catch (error) {
      console.error("Error marking groups inactive:", error);
      alert("Failed to mark some groups as inactive. Please try again.");
      setMarkInactiveConfirmation((prev) => ({ ...prev, loading: false }));
    }
  }, [selectedGroups, updateGroup, fetchGroups]);

  const handleBulkExportGroups = useCallback(
    async (format: "excel" | "pdf" | "csv") => {
      const groupsToExport = filteredGroups.filter((g) =>
        selectedGroups.has(g.id)
      );
      if (groupsToExport.length === 0) {
        alert("Please select at least one group to export.");
        return;
      }

      const exportData = buildGroupExportRows(groupsToExport);

      if (format === "excel") {
        const XLSX = await import("xlsx");
        const worksheet = XLSX.utils.json_to_sheet(exportData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Evangelism Groups");
        XLSX.writeFile(workbook, "evangelism_groups.xlsx");
        return;
      }

      if (format === "csv") {
        const XLSX = await import("xlsx");
        const worksheet = XLSX.utils.json_to_sheet(exportData);
        const csv = XLSX.utils.sheet_to_csv(worksheet);
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = "evangelism_groups.csv";
        link.click();
        URL.revokeObjectURL(url);
        return;
      }

      const { jsPDF } = await import("jspdf");
      const autoTable = (await import("jspdf-autotable")).default;
      const doc = new jsPDF();
      const columns = Object.keys(exportData[0] || {});
      autoTable(doc, {
        head: [columns],
        body: exportData.map((row) => columns.map((col) => String(row[col as keyof typeof row] ?? ""))),
      });
      doc.save("evangelism_groups.pdf");
    },
    [filteredGroups, selectedGroups, buildGroupExportRows]
  );

  const renderEvangelismGroupsBranchSelect = () => {
    const evangelismBranchSelectInteractive = canChangeEvangelismBranch;
    const branchSelectEl = (
      <select
        aria-label="Branch"
        aria-disabled={!evangelismBranchSelectInteractive}
        tabIndex={evangelismBranchSelectInteractive ? 0 : -1}
        value={
          filters.branch === undefined ? "" : String(filters.branch)
        }
        onChange={(e) => {
          if (!evangelismBranchSelectInteractive) return;
          setFilter("branch", e.target.value || "all");
        }}
        className={
          evangelismBranchSelectInteractive
            ? EVANGELISM_BRANCH_SELECT_CLASS
            : EVANGELISM_BRANCH_SELECT_LOCKED_CLASS
        }
      >
        {canChangeEvangelismBranch ? (
          <>
            <option value="all">All branches</option>
            {branches.map((branch) => (
              <option key={branch.id} value={String(branch.id)}>
                {branch.name}
              </option>
            ))}
          </>
        ) : user?.branch != null ? (
          <>
            {branches
              .filter((b) => Number(b.id) === Number(user.branch))
              .map((branch) => (
                <option key={branch.id} value={String(branch.id)}>
                  {branch.name}
                </option>
              ))}
            {!branches.some((b) => Number(b.id) === Number(user.branch)) && (
              <option value={String(user.branch)}>
                {user.branch_name?.trim() || `Branch #${user.branch}`}
              </option>
            )}
          </>
        ) : (
          <option value="all">No branch assigned</option>
        )}
      </select>
    );

    return evangelismBranchSelectInteractive ? (
      branchSelectEl
    ) : (
      <LockedControlTooltip label={EVANGELISM_BRANCH_LOCKED_HINT}>
        {branchSelectEl}
      </LockedControlTooltip>
    );
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold text-foreground">Evangelism</h1>
            <p className="text-sm text-gray-600">
              Manage Bible Study groups, track visitors, and monitor conversion
              progress.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            {activeTab === "groups" ? (
              <Button
                variant="primary"
                onClick={() => setIsCreateOpen(true)}
                className="w-full sm:w-auto min-h-[44px]"
              >
                Create Group
              </Button>
            ) : activeTab === "reports" ? (
              <Button
                variant="primary"
                onClick={() => setReportsSubmitNonce((n) => n + 1)}
                className="w-full sm:w-auto min-h-[44px]"
              >
                Submit Report
              </Button>
            ) : null}
          </div>
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
          each1Reach1Progress={{
            year: currentYear,
            achieved: each1Reach1Totals.achieved,
            target: each1Reach1Totals.target,
            percentage: each1Reach1Totals.percentage,
            loading: each1Reach1Loading,
            error: each1Reach1Error,
          }}
        />

        {/* Tabs */}
        <div className="mt-10 border-t border-gray-200 pt-7">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-4 sm:space-x-8 overflow-x-auto">
              <button
                onClick={() => selectTab("groups")}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors whitespace-nowrap min-w-[60px] ${
                  activeTab === "groups"
                    ? "border-primary text-primary"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                Groups
              </button>
              <button
                onClick={() => selectTab("each1reach1")}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors whitespace-nowrap min-w-[100px] ${
                  activeTab === "each1reach1"
                    ? "border-primary text-primary"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                Each 1 Reach 1
              </button>
              <button
                onClick={() => selectTab("tally")}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors whitespace-nowrap min-w-[70px] ${
                  activeTab === "tally"
                    ? "border-primary text-primary"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                Tally
              </button>
              <button
                onClick={() => selectTab("reports")}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors whitespace-nowrap min-w-[70px] ${
                  activeTab === "reports"
                    ? "border-primary text-primary"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                Reports
              </button>
              <button
                onClick={() => selectTab("bible_sharers")}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors whitespace-nowrap min-w-[110px] ${
                  activeTab === "bible_sharers"
                    ? "border-primary text-primary"
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
            <div className={TOOLBAR_CARD_CLASS}>
              {/* Mobile — stacked 3-row toolbar */}
              <div className="flex flex-col gap-3 tablet:hidden">
                <ToolbarSearch
                  fullWidth
                  value={searchValue}
                  onChange={handleSearchChange}
                  placeholder="Search groups…"
                  ariaLabel="Search groups"
                />

                <div className="flex items-center justify-between gap-3">
                  {renderEvangelismGroupsBranchSelect()}
                  <ViewModeToggle
                    viewMode={groupListViewMode}
                    onViewModeChange={setGroupListViewMode}
                  />
                </div>

                <div className={TOOLBAR_ACTIONS_ROW_CLASS}>
                  <button
                    type="button"
                    onClick={handleToggleGroupSelectionMode}
                    className={`inline-flex min-h-[44px] shrink-0 items-center border px-3 py-2 text-sm font-medium leading-4 shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ring ${
                      isGroupSelectionMode
                        ? "rounded-lg border-primary/30 bg-primary/10 text-primary hover:bg-primary/15"
                        : "rounded-lg border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    <svg
                      className={`mr-1 h-4 w-4 shrink-0 ${
                        isGroupSelectionMode ? "text-primary" : "text-gray-500"
                      }`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    {isGroupSelectionMode ? "Cancel Selection" : "Select"}
                  </button>
                  {isGroupSelectionMode && selectedGroups.size > 0 && (
                    <BulkActionsMenu
                      onBulkMarkInactive={handleBulkMarkInactive}
                      onBulkDelete={
                        userCanHardDelete ? handleBulkDeleteGroups : undefined
                      }
                      onBulkExport={(format) => void handleBulkExportGroups(format)}
                      selectedCount={selectedGroups.size}
                    />
                  )}
                  <button
                    type="button"
                    onClick={(e) =>
                      handleGroupSortDropdown(
                        (e.currentTarget as HTMLButtonElement).getBoundingClientRect()
                      )
                    }
                    className={TOOLBAR_ACTION_BUTTON_CLASS}
                  >
                    <svg
                      className="mr-1 h-4 w-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12"
                      />
                    </svg>
                    Sort {groupSortOrder === "asc" ? "↑" : "↓"}
                  </button>
                  <button
                    type="button"
                    onClick={(e) =>
                      handleGroupAddFilter(
                        (e.currentTarget as HTMLButtonElement).getBoundingClientRect()
                      )
                    }
                    className={TOOLBAR_ACTION_BUTTON_CLASS}
                  >
                    <svg
                      className="mr-1 h-4 w-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                      />
                    </svg>
                    Filter
                  </button>
                </div>

                {groupActiveFilters.length > 0 && (
                  <div className="flex w-full flex-wrap items-center gap-2">
                    {groupActiveFilters.map((filter) => (
                      <span
                        key={filter.id}
                        className="chip-primary inline-flex min-h-[32px] items-center rounded-full px-2 py-1.5 text-xs font-medium"
                      >
                        <span className="max-w-[150px] truncate">
                          {filter.label}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setGroupActiveFilters((prev) =>
                              prev.filter((f) => f.id !== filter.id)
                            )
                          }
                          className="ml-1 flex min-h-[20px] min-w-[20px] flex-shrink-0 items-center justify-center text-primary hover:text-primary"
                          aria-label="Remove filter"
                        >
                          <svg
                            className="h-3 w-3"
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
                      </span>
                    ))}
                    <button
                      type="button"
                      onClick={() => setGroupActiveFilters([])}
                      className="min-h-[32px] px-2 py-1 text-xs text-gray-500 hover:text-gray-700"
                    >
                      Clear All
                    </button>
                  </div>
                )}
              </div>

              {/* Desktop — single-row toolbar */}
              <div className="hidden tablet:flex tablet:flex-wrap tablet:items-center tablet:justify-between tablet:gap-2">
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <ToolbarSearch
                    value={searchValue}
                    onChange={handleSearchChange}
                    placeholder="Search groups…"
                    ariaLabel="Search groups"
                  />
                  {renderEvangelismGroupsBranchSelect()}
                  <ViewModeToggle
                    compact
                    viewMode={groupListViewMode}
                    onViewModeChange={setGroupListViewMode}
                  />
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleToggleGroupSelectionMode}
                    className={`inline-flex shrink-0 items-center border px-3 py-2 text-sm font-medium leading-4 shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ring ${
                      isGroupSelectionMode
                        ? "rounded-lg border-primary/30 bg-primary/10 text-primary hover:bg-primary/15"
                        : "rounded-lg border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    <svg
                      className={`mr-1 h-4 w-4 shrink-0 ${
                        isGroupSelectionMode ? "text-primary" : "text-gray-500"
                      }`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    {isGroupSelectionMode ? "Cancel Selection" : "Select"}
                  </button>
                  {isGroupSelectionMode && selectedGroups.size > 0 && (
                    <BulkActionsMenu
                      onBulkMarkInactive={handleBulkMarkInactive}
                      onBulkDelete={
                        userCanHardDelete ? handleBulkDeleteGroups : undefined
                      }
                      onBulkExport={(format) => void handleBulkExportGroups(format)}
                      selectedCount={selectedGroups.size}
                    />
                  )}
                  {groupActiveFilters.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2">
                      {groupActiveFilters.map((filter) => (
                        <span
                          key={filter.id}
                          className="chip-primary inline-flex min-h-[32px] items-center rounded-full px-2 py-1.5 text-xs font-medium"
                        >
                          <span className="max-w-none truncate">{filter.label}</span>
                          <button
                            type="button"
                            onClick={() =>
                              setGroupActiveFilters((prev) =>
                                prev.filter((f) => f.id !== filter.id)
                              )
                            }
                            className="ml-1 flex min-h-[20px] min-w-[20px] flex-shrink-0 items-center justify-center text-primary hover:text-primary"
                            aria-label="Remove filter"
                          >
                            <svg
                              className="h-3 w-3"
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
                        </span>
                      ))}
                      <button
                        type="button"
                        onClick={() => setGroupActiveFilters([])}
                        className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700"
                      >
                        Clear All
                      </button>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={(e) =>
                      handleGroupSortDropdown(
                        (e.currentTarget as HTMLButtonElement).getBoundingClientRect()
                      )
                    }
                    className={TOOLBAR_DESKTOP_ACTION_BUTTON_CLASS}
                  >
                    <svg
                      className="mr-1 h-4 w-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12"
                      />
                    </svg>
                    Sort {groupSortOrder === "asc" ? "↑" : "↓"}
                  </button>
                  <button
                    type="button"
                    onClick={(e) =>
                      handleGroupAddFilter(
                        (e.currentTarget as HTMLButtonElement).getBoundingClientRect()
                      )
                    }
                    className={TOOLBAR_DESKTOP_ACTION_BUTTON_CLASS}
                  >
                    <svg
                      className="mr-1 h-4 w-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                      />
                    </svg>
                    Filter
                  </button>
                </div>
              </div>
            </div>

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
                  <div className="rounded-lg border border-dashed border-gray-200 py-16 text-center text-gray-500">
                    {hasGroupListFilters
                      ? "No groups found matching your search or filters."
                      : "No groups available yet. Create the first one to get started."}
                  </div>
                ) : (
                  <>
                    {isGroupSelectionMode && effectiveGroupListViewMode === "cards" && (
                      <div className="mb-4 flex items-center gap-2">
                        <label className="flex min-h-[44px] cursor-pointer items-center gap-2 text-sm text-gray-700">
                          <input
                            type="checkbox"
                            checked={
                              selectedGroups.size === filteredGroups.length &&
                              filteredGroups.length > 0
                            }
                            onChange={handleSelectAllGroups}
                            className="h-5 w-5 rounded border-gray-300 text-primary focus:ring-ring"
                          />
                          Select All ({selectedGroups.size} selected)
                        </label>
                      </div>
                    )}
                    {effectiveGroupListViewMode === "table" ? (
                      <EvangelismGroupTable
                        groups={filteredGroups}
                        clusters={clusters}
                        branches={branches}
                        viewHighlightedGroupId={
                          viewEditGroup?.id && viewMode === "view"
                            ? viewEditGroup.id
                            : undefined
                        }
                        isSelectionMode={isGroupSelectionMode}
                        selectedGroupIds={selectedGroups}
                        onSelectGroup={handleSelectGroup}
                        onSelectAll={handleSelectAllGroups}
                        onView={(group) => {
                          setViewEditGroup(group);
                          setViewMode("view");
                        }}
                        onEdit={(group) => {
                          setViewEditGroup(group);
                          setViewMode("edit");
                        }}
                        onDelete={(group) => {
                          setDeleteConfirmation({
                            isOpen: true,
                            group,
                            loading: false,
                          });
                        }}
                        onHardDelete={
                          userCanHardDelete
                            ? (group) => {
                                setHardDeleteConfirmation({
                                  isOpen: true,
                                  group,
                                  loading: false,
                                });
                              }
                            : undefined
                        }
                      />
                    ) : (
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {filteredGroups.map((group) => (
                          <EvangelismGroupCard
                            key={group.id}
                            group={group}
                            clusters={clusters}
                            branches={branches}
                            isViewHighlighted={
                              viewEditGroup?.id === group.id && viewMode === "view"
                            }
                            isSelectionMode={isGroupSelectionMode}
                            isBulkSelected={selectedGroups.has(group.id)}
                            onBulkSelect={() => handleSelectGroup(group.id)}
                            onClick={() => {
                              if (isGroupSelectionMode) {
                                handleSelectGroup(group.id);
                                return;
                              }
                              setViewEditGroup(group);
                              setViewMode("view");
                            }}
                          />
                        ))}
                      </div>
                    )}
                  </>
                )}
              </Card>
            )}
            <EvangelismGroupFilterDropdown
              isOpen={showGroupFilterDropdown}
              onClose={() => setShowGroupFilterDropdown(false)}
              onSelectField={handleGroupSelectField}
              position={groupFilterDropdownPosition}
            />
            {selectedGroupField && (
              <ClusterFilterCard
                field={selectedGroupField}
                isOpen={showGroupFilterCard}
                onClose={() => {
                  setShowGroupFilterCard(false);
                  setSelectedGroupField(null);
                }}
                onApplyFilter={handleGroupApplyFilter}
                position={groupFilterCardPosition}
              />
            )}
            <EvangelismGroupSortDropdown
              isOpen={showGroupSortDropdown}
              onClose={() => setShowGroupSortDropdown(false)}
              onSelectSort={handleGroupSelectSort}
              position={groupSortDropdownPosition}
              currentSortBy={groupSortBy}
              currentSortOrder={groupSortOrder}
            />
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
            <PeopleTallyReport
              year={tallyYear}
              onYearChange={setTallyYear}
              branch={tallyBranch}
              onBranchChange={(next) => {
                setTallyBranch(next);
                setTallyScope("");
              }}
              branches={branches}
              tallyScope={tallyScope}
              onTallyScopeChange={setTallyScope}
              branchSelectionLocked={!canChangeEvangelismBranch}
              branchLockedHint={EVANGELISM_BRANCH_LOCKED_HINT}
              defaultLockedBranch={
                user?.branch != null && user.branch !== undefined
                  ? user.branch
                  : ""
              }
            />
            <Card>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Weekly cluster tally
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                Unified weekly tally by cluster and ISO week (evangelism plus
                cluster reports). Click a cell for attendance drill-down.
              </p>
              <TallyReport year={new Date().getFullYear()} />
            </Card>
          </div>
        )}

        {/* Reports Tab */}
        {activeTab === "reports" && (
          <EvangelismReportsDashboard
            groups={groups}
            clusters={clusters}
            branches={branches}
            openSubmitNonce={reportsSubmitNonce}
            refreshTrigger={reportsListRefresh}
            presetGroupId={reportsPresetGroupId}
            initialViewReportId={reportsViewReportId}
          />
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
            closeOnOutsideClick={false}
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
            hideHeader={viewMode === "view"}
            title={viewMode === "edit" ? "Edit Group" : ""}
            closeOnOutsideClick={viewMode === "view"}
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
              <EvangelismGroupView
                group={viewEditGroup}
                groupData={groupData}
                clusters={clusters}
                branches={branches}
                groupLoading={groupLoading}
                reports={reports}
                reportsLoading={reportsLoading}
                prospects={prospects}
                prospectsLoading={prospectsLoading}
                conversions={conversions}
                conversionsLoading={conversionsLoading}
                onAddMember={() => setIsAddMemberModalOpen(true)}
                onBulkEnroll={() => setIsBulkEnrollModalOpen(true)}
                onRemoveMember={(person) => {
                  const memberName =
                    person.full_name || person.username || "this member";
                  setRemoveMemberConfirmation({
                    isOpen: true,
                    personId: String(person.id),
                    memberName,
                    loading: false,
                  });
                }}
                onAddReport={() => setIsReportModalOpen(true)}
                onViewReport={(r) => void openGroupReportView(r)}
                onEditReport={(report) => {
                  setEditingReport(report);
                  setIsReportModalOpen(true);
                }}
                onAddProspect={() => setIsProspectModalOpen(true)}
                onUpdateProgress={(prospect) => {
                  setSelectedProspect(prospect);
                  setIsUpdateProgressModalOpen(true);
                }}
                onAddConversion={() => {
                  setEditingConversion(null);
                  setIsConversionModalOpen(true);
                }}
                onEditConversion={(c) => {
                  setEditingConversion(c);
                  setIsConversionModalOpen(true);
                }}
                onEdit={() => setViewMode("edit")}
                onDelete={() =>
                  setDeleteConfirmation({
                    isOpen: true,
                    group: viewEditGroup,
                    loading: false,
                  })
                }
                onHardDelete={
                  userCanHardDelete
                    ? () =>
                        setHardDeleteConfirmation({
                          isOpen: true,
                          group: viewEditGroup,
                          loading: false,
                        })
                    : undefined
                }
                onClose={() => {
                  setViewEditGroup(null);
                  setViewMode("view");
                }}
              />
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
            closeOnOutsideClick={false}
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

        <ViewEvangelismWeeklyReportModal
          report={viewingGroupReport}
          isOpen={!!viewingGroupReport}
          onClose={() => setViewingGroupReport(null)}
          onEdit={() => {
            if (!viewingGroupReport) return;
            const rpt = viewingGroupReport;
            setViewingGroupReport(null);
            setEditingReport(rpt);
            setIsReportModalOpen(true);
          }}
          onDelete={() => {
            if (!viewingGroupReport) return;
            setPendingDeleteGroupReport(viewingGroupReport);
            setViewingGroupReport(null);
          }}
        />

        <ConfirmationModal
          isOpen={pendingDeleteGroupReport !== null}
          title="Delete report"
          message="Delete this evangelism weekly report? This action cannot be undone."
          confirmText="Delete"
          cancelText="Cancel"
          variant="danger"
          onClose={() => setPendingDeleteGroupReport(null)}
          onConfirm={() => void confirmDeleteGroupReport()}
        />

        {/* Prospect Modal */}
        {isProspectModalOpen && (
          <Modal
            isOpen={isProspectModalOpen}
            onClose={() => {
              setIsProspectModalOpen(false);
              setFormError(null);
            }}
            title="Add Invited Visitor"
            closeOnOutsideClick={false}
          >
            <ProspectForm
              inviters={(people.length > 0 ? people : coordinators).filter(
                isSelectablePerson
              )}
              groups={groups}
              prospectOptions={prospects}
              selectedBibleStudyGroup={
                groupData ?? viewEditGroup ?? undefined
              }
              onSubmit={handleCreateProspect}
              onCancel={() => {
                setIsProspectModalOpen(false);
                setFormError(null);
              }}
              isSubmitting={isSubmitting}
              error={formError}
            />
          </Modal>
        )}

        {/* Conversion Modal */}
        {isConversionModalOpen && (
          <Modal
            isOpen={isConversionModalOpen}
            onClose={() => {
              setIsConversionModalOpen(false);
              setEditingConversion(null);
              setFormError(null);
            }}
            title={editingConversion ? "Update Conversion" : "Record Conversion"}
            closeOnOutsideClick={false}
          >
            <ConversionForm
              key={editingConversion?.id ?? "create-conversion"}
              people={conversionVisitors}
              initialData={editingConversion ?? undefined}
              onSubmit={
                editingConversion
                  ? handleUpdateConversion
                  : handleCreateConversion
              }
              onCancel={() => {
                setIsConversionModalOpen(false);
                setEditingConversion(null);
                setFormError(null);
              }}
              isSubmitting={isSubmitting}
              error={formError}
              submitLabel={
                editingConversion ? "Save changes" : "Record Conversion"
              }
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

        {/* Mark Inactive Confirmation */}
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
                  await updateGroup(deleteConfirmation.group!.id, {
                    is_active: false,
                  });
                  await fetchGroups();
                  setDeleteConfirmation({
                    isOpen: false,
                    group: null,
                    loading: false,
                  });
                  setViewEditGroup(null);
                } catch (error) {
                  console.error("Error marking group inactive:", error);
                  setDeleteConfirmation((prev) => ({
                    ...prev,
                    loading: false,
                  }));
                }
              })();
            }
          }}
          title="Mark Group Inactive"
          message={
            <>
              Mark{" "}
              <strong className="font-semibold text-gray-900">
                {deleteConfirmation.group?.name ?? ""}
              </strong>{" "}
              as inactive? It will be hidden from the default active groups list.
            </>
          }
          confirmText="Mark Inactive"
          cancelText="Cancel"
          variant="warning"
          loading={deleteConfirmation.loading}
        />

        {userCanHardDelete && (
        <ConfirmationModal
          isOpen={hardDeleteConfirmation.isOpen}
          onClose={() =>
            setHardDeleteConfirmation({
              isOpen: false,
              group: null,
              loading: false,
            })
          }
          onConfirm={() => {
            if (hardDeleteConfirmation.group) {
              (async () => {
                try {
                  setHardDeleteConfirmation((prev) => ({
                    ...prev,
                    loading: true,
                  }));
                  await deleteGroup(hardDeleteConfirmation.group!.id);
                  await fetchGroups();
                  setHardDeleteConfirmation({
                    isOpen: false,
                    group: null,
                    loading: false,
                  });
                  setViewEditGroup(null);
                } catch (error) {
                  console.error("Error deleting group:", error);
                  setHardDeleteConfirmation((prev) => ({
                    ...prev,
                    loading: false,
                  }));
                }
              })();
            }
          }}
          title="Delete Group Permanently"
          message={
            <>
              Are you sure you want to permanently delete{" "}
              <strong className="font-semibold text-gray-900">
                {hardDeleteConfirmation.group?.name ?? ""}
              </strong>
              ? This action cannot be undone.
            </>
          }
          confirmText="Delete"
          cancelText="Cancel"
          variant="danger"
          loading={hardDeleteConfirmation.loading}
        />
        )}

        {userCanHardDelete && (
        <ConfirmationModal
          isOpen={bulkDeleteConfirmation.isOpen}
          onClose={() =>
            setBulkDeleteConfirmation({ isOpen: false, loading: false })
          }
          onConfirm={() => void confirmBulkDeleteGroups()}
          title="Delete Selected Groups"
          message={`Are you sure you want to delete ${selectedGroups.size} selected group(s)? This action cannot be undone and will permanently remove all selected groups from the system.`}
          confirmText="Delete Groups"
          cancelText="Cancel"
          variant="danger"
          loading={bulkDeleteConfirmation.loading}
        />
        )}

        <ConfirmationModal
          isOpen={markInactiveConfirmation.isOpen}
          onClose={() =>
            setMarkInactiveConfirmation({ isOpen: false, loading: false })
          }
          onConfirm={() => void confirmBulkMarkInactive()}
          title="Mark Selected Groups as Inactive"
          message={`Are you sure you want to mark ${selectedGroups.size} selected group(s) as inactive? They will no longer appear in the default active groups list.`}
          confirmText="Mark as Inactive"
          cancelText="Cancel"
          variant="warning"
          loading={markInactiveConfirmation.loading}
        />

        {/* Remove Member Confirmation */}
        <ConfirmationModal
          isOpen={removeMemberConfirmation.isOpen}
          onClose={() =>
            setRemoveMemberConfirmation({
              isOpen: false,
              personId: null,
              memberName: null,
              loading: false,
            })
          }
          onConfirm={() => {
            if (
              removeMemberConfirmation.personId &&
              viewEditGroup &&
              groupData?.members
            ) {
              (async () => {
                try {
                  setRemoveMemberConfirmation((prev) => ({
                    ...prev,
                    loading: true,
                  }));
                  const members = groupData.members;
                  if (!members) return;
                  const remaining = members
                    .filter(
                      (p) =>
                        String(p.id) !== removeMemberConfirmation.personId
                    )
                    .map((p) => Number(p.id));
                  await evangelismApi.updateGroup(viewEditGroup.id, {
                    members: remaining,
                  });
                  setRemoveMemberConfirmation({
                    isOpen: false,
                    personId: null,
                    memberName: null,
                    loading: false,
                  });
                  fetchGroup();
                  fetchGroups();
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
          message={
            <>
              Are you sure you want to remove{" "}
              <strong className="font-semibold text-gray-900">
                &quot;
                {removeMemberConfirmation.memberName ?? ""}&quot;
              </strong>{" "}
              from this group? This action cannot be undone.
            </>
          }
          confirmText="Remove"
          cancelText="Cancel"
          loading={removeMemberConfirmation.loading}
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
                groupData?.members?.map((m) => String(m.id)) || []
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
                groupData?.members?.map((m) => String(m.id)) || []
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

function getEvangelismMemberModalErrorMessage(
  err: unknown,
  fallback: string
): string {
  if (typeof err !== "object" || err === null || !("response" in err)) {
    return fallback;
  }
  const errorData = (
    err as { response?: { data?: Record<string, unknown> } }
  ).response?.data;
  if (!errorData) return fallback;
  if (typeof errorData.detail === "string") return errorData.detail;
  const firstError = Object.values(errorData)[0];
  if (Array.isArray(firstError) && firstError.length > 0) {
    return String(firstError[0]);
  }
  if (typeof firstError === "string") return firstError;
  return fallback;
}

function isEvangelismGroupMemberCandidate(person: Person): boolean {
  return isSelectablePerson(person) && person.role !== "VISITOR";
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
          isEvangelismGroupMemberCandidate(p) &&
          !existingMemberIds.includes(p.id.toString())
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
      await evangelismApi.enroll(groupId, {
        person_ids: [Number(selectedPersonId)],
      });
      onSuccess();
    } catch (err: unknown) {
      setError(
        getEvangelismMemberModalErrorMessage(err, "Failed to add member")
      );
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
          isEvangelismGroupMemberCandidate(p) &&
          !existingMemberIds.includes(p.id.toString())
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
      });
      onSuccess();
    } catch (err: unknown) {
      setError(
        getEvangelismMemberModalErrorMessage(err, "Failed to enroll members")
      );
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
                  <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-sm text-primary border border-primary/20">
                    {label}
                    <button
                      type="button"
                      onClick={() => handleRemoveMember(id)}
                      className="text-primary hover:text-primary focus:outline-none"
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pipelineStages: { value: string; label: string }[] = [
    { value: "INVITED", label: "Invited" },
    { value: "ATTENDED", label: "Attended" },
    { value: "TAKEN_NCC", label: "NCC" },
    { value: "BAPTIZED", label: "Baptized" },
    { value: "RECEIVED_HG", label: "Received HG" },
    { value: "REACHED", label: "Reached" },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStage) {
      setError("Please select a pipeline stage.");
      return;
    }

    try {
      setLoading(true);
      setError(null);
      if (selectedStage === "ATTENDED") {
        await evangelismApi.markAttended(prospect.id, {
          last_activity_date: activityDate,
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
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
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
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
          disabled={loading}
          required
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
          disabled={loading}
          type="submit"
        >
          {loading ? "Updating..." : "Update Progress"}
        </Button>
      </div>
    </form>
  );
}
