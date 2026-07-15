"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import DashboardLayout from "@/src/components/layout/DashboardLayout";
import PersonForm from "@/src/components/people/PersonForm";
import PersonProfile from "@/src/components/people/PersonProfile";
import FamilyForm from "@/src/components/families/FamilyForm";
import Button from "@/src/components/ui/Button";
import Modal from "@/src/components/ui/Modal";
import ConfirmationModal from "@/src/components/ui/ConfirmationModal";
import FamilyView from "@/src/components/families/FamilyView";
import FilterBar, {
  FilterCondition,
} from "@/src/components/people/FilterBar";
import Pagination from "@/src/components/ui/Pagination";
import DataTable from "@/src/components/people/DataTable";
import PersonDetailPanel from "@/src/components/people/PersonDetailPanel";
import { Person, PersonUI, Family, Journey } from "@/src/types/person";
import { Cluster } from "@/src/types/cluster";
import { usePeople } from "@/src/hooks/usePeople";
import { usePeopleDirectory } from "@/src/hooks/usePeopleDirectory";
import { useFamilies } from "@/src/hooks/useFamilies";
import { useBranches } from "@/src/hooks/useBranches";
import { clustersApi, peopleApi, familiesApi, journeysApi, eventTypesApi, eventsApi, User } from "@/src/lib/api";
import {
  filtersToPeopleListParams,
  sortFieldToOrdering,
} from "@/src/lib/peopleDirectoryParams";
import {
  formatPeopleImportApiError,
  mapImportRowToPerson,
  normalizeImportRow,
} from "@/src/lib/peopleImport";
import { useAuth } from "@/src/contexts/AuthContext";
import { canHardDelete } from "@/src/lib/canHardDelete";
import {
  canChangePeopleBranchFilter,
} from "@/src/lib/peopleBranchFilter";
import UserLoginCredentialsModal from "@/src/components/people/UserLoginCredentialsModal";
import PeopleDirectoryEmptyState from "@/src/components/people/PeopleDirectoryEmptyState";
import { Branch } from "@/src/types/branch";
import AssignMembersModal from "@/src/components/clusters/AssignMembersModal";
import FamilyManagementDashboard from "@/src/components/families/FamilyManagementDashboard";
import ClusterFilterDropdown from "@/src/components/clusters/ClusterFilterDropdown";
import ClusterFilterCard from "@/src/components/clusters/ClusterFilterCard";
import ClusterSortDropdown from "@/src/components/clusters/ClusterSortDropdown";
import ClusterCard from "@/src/components/clusters/ClusterCard";
import ClusterForm from "@/src/components/clusters/ClusterForm";
import ClusterView from "@/src/components/clusters/ClusterView";
import AddFamilyMemberModal from "@/src/components/families/AddFamilyMemberModal";
import ClusterReportsDashboard from "@/src/components/reports/ClusterReportsDashboard";
import ClusterWeeklyReportForm from "@/src/components/reports/ClusterWeeklyReportForm";

const DEFAULT_PEOPLE_BRANCH_FILTER_ID = "default-branch";

function buildDefaultBranchFilter(
  user: User,
  branches: Branch[],
): FilterCondition | null {
  if (user.branch == null || user.branch === undefined) return null;
  const bid = String(user.branch);
  const resolvedName =
    user.branch_name?.trim() ||
    branches.find((b) => Number(b.id) === Number(user.branch))?.name ||
    null;
  const chipDisplay = resolvedName ? `Branch is ${resolvedName}` : "Branch";
  return {
    id: DEFAULT_PEOPLE_BRANCH_FILTER_ID,
    field: "branch",
    operator: "is",
    value: bid,
    label: "Branch",
    chipDisplay,
  };
}

export default function PeoplePage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const action = searchParams.get("action");
  const [activeTab, setActiveTab] = useState<
    "people" | "families" | "clusters" | "reports"
  >("people");
  const SHOW_TABS = false;
  useEffect(() => {
    setActiveTab("people");
  }, []);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState<"person" | "family" | "cluster">(
    "person",
  );
  const [createInitialData, setCreateInitialData] = useState<
    Partial<Person> | undefined
  >(undefined);
  const [personPanelOpen, setPersonPanelOpen] = useState(false);
  const [personPanelMode, setPersonPanelMode] = useState<
    "view" | "edit" | "create"
  >("view");
  const [personPanelPerson, setPersonPanelPerson] = useState<Person | null>(
    null,
  );
  const [personPanelInitialData, setPersonPanelInitialData] = useState<
    Partial<Person> | undefined
  >(undefined);
  // Start false so SSR and the first client render match; set real value in useEffect.
  const [isDesktop, setIsDesktop] = useState(false);
  const [viewEditPerson, setViewEditPerson] = useState<Person | null>(null);
  const viewEditPersonRef = useRef<Person | null>(null);
  useEffect(() => {
    viewEditPersonRef.current = viewEditPerson;
  }, [viewEditPerson]);
  const [viewMode, setViewMode] = useState<"view" | "edit">("view");
  const [startOnTimelineTab, setStartOnTimelineTab] = useState(false);
  const [editFamily, setEditFamily] = useState<Family | null>(null);
  const [viewFamily, setViewFamily] = useState<Family | null>(null);
  const [familyViewMode, setFamilyViewMode] = useState<"view" | "edit">("view");
  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    isOpen: boolean;
    family: Family | null;
    loading: boolean;
  }>({
    isOpen: false,
    family: null,
    loading: false,
  });
  const [loginCredentialsModal, setLoginCredentialsModal] = useState<{
    isOpen: boolean;
    person: Person | null;
    temporaryPassword?: string;
  }>({
    isOpen: false,
    person: null,
  });

  useEffect(() => {
    const onResize = () => setIsDesktop(window.innerWidth >= 1024);
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const openCreatePersonModal = useCallback((initialData?: Partial<Person>) => {
    setModalType("person");
    setCreateInitialData(initialData);
    setViewEditPerson(null);
    setViewMode("view");
    setPersonPanelOpen(false);
    setPersonPanelMode("view");
    setPersonPanelPerson(null);
    setPersonPanelInitialData(undefined);
    setStartOnTimelineTab(false);
    setIsModalOpen(true);
  }, []);

  const openPersonInteraction = useCallback(
    (
      mode: "view" | "edit" | "create",
      person?: Person | null,
      initialData?: Partial<Person>,
    ) => {
      if (mode === "create") {
        openCreatePersonModal(initialData);
        return;
      }

      if (person && person.can_view_profile === false) {
        setDirectoryAccessNotice(
          mode === "edit"
            ? "You can only edit people in your cluster. Assign them to your cluster first (Clusters → Assign Members), then try again."
            : "You can only view profiles of people in your cluster. Assign them to your cluster first, then open their profile.",
        );
        return;
      }

      if (person) {
        setCreateInitialData(undefined);
        setViewEditPerson(person);
        setViewMode(mode);
      }

      if (isDesktop) {
        setPersonPanelMode(mode);
        setPersonPanelOpen(true);
        setPersonPanelPerson(person || null);
        setPersonPanelInitialData(undefined);
        setStartOnTimelineTab(false);
      } else {
        setModalType("person");
        setIsModalOpen(true);
      }
    },
    [isDesktop, openCreatePersonModal],
  );

  const closePersonPanel = useCallback(() => {
    setPersonPanelOpen(false);
    setPersonPanelMode("view");
    setPersonPanelPerson(null);
    setPersonPanelInitialData(undefined);
    setStartOnTimelineTab(false);
    setViewMode("view");
    setViewEditPerson(null);
  }, []);

  const openPersonId = searchParams.get("open");
  const openPersonModeParam = searchParams.get("mode");

  useEffect(() => {
    if (!openPersonId) {
      return;
    }

    let cancelled = false;
    const mode =
      openPersonModeParam === "edit" ? ("edit" as const) : ("view" as const);

    const openFromDeepLink = async () => {
      try {
        const response = await peopleApi.getById(openPersonId);
        if (!cancelled) {
          openPersonInteraction(mode, response.data);
        }
      } catch {
        setDirectoryAccessNotice(
          mode === "edit"
            ? "You can only edit people in your cluster. Assign them to your cluster first (Clusters → Assign Members), then try again."
            : "You can only view profiles of people in your cluster. Assign them to your cluster first, then open their profile.",
        );
      } finally {
        if (!cancelled) {
          router.replace(pathname);
        }
      }
    };

    openFromDeepLink();

    return () => {
      cancelled = true;
    };
  }, [
    openPersonId,
    openPersonModeParam,
    openPersonInteraction,
    pathname,
    router,
  ]);

  useEffect(() => {
    if (action === "create") {
      openCreatePersonModal();
      router.replace(pathname);
    }
    if (action === "add-visitor") {
      openCreatePersonModal({
        role: "VISITOR",
        status: "ACTIVE",
      });
      router.replace(pathname);
    }
  }, [action, openCreatePersonModal, pathname, router]);
  const [bulkDeleteConfirmation, setBulkDeleteConfirmation] = useState<{
    isOpen: boolean;
    people: Person[];
    loading: boolean;
  }>({
    isOpen: false,
    people: [],
    loading: false,
  });
  // const [people, setPeople] = useState<Person[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilters, setActiveFilters] = useState<FilterCondition[]>([]);
  const [directoryPage, setDirectoryPage] = useState(1);
  const [directoryPageSize, setDirectoryPageSize] = useState(25);
  const [directorySortBy, setDirectorySortBy] = useState("last_name");
  const [directorySortDir, setDirectorySortDir] = useState<"asc" | "desc">(
    "asc",
  );
  const peopleBranchFilterUserIdRef = useRef<number | undefined>(undefined);

  const needFullPeopleCatalog =
    activeTab === "families" ||
    activeTab === "clusters" ||
    // Person create/edit needs peopleOptions for membership pickers; profile view does not.
    (personPanelOpen && personPanelMode !== "view") ||
    (isModalOpen &&
      (modalType === "family" ||
        modalType === "cluster" ||
        modalType === "person"));

  const {
    people,
    peopleUI,
    createPerson,
    deletePerson,
    updatePerson,
    refreshPeople,
  } = usePeople(needFullPeopleCatalog);

  const {
    families,
    createFamily,
    updateFamily,
    deleteFamily,
    refreshFamilies,
  } = useFamilies(
    activeTab === "families" ||
      (isModalOpen && modalType === "family") ||
      (personPanelOpen && personPanelMode !== "view"),
  );
  const { branches } = useBranches();
  const { user, isSeniorCoordinator, isModuleCoordinator, isPlainMember } =
    useAuth();
  const plainMember = isPlainMember();
  const addPeopleButtonLabel = plainMember ? "Add Visitor" : "Add Person";
  const createPeopleTitle = plainMember ? "Create Visitor" : "Create Person";
  const isAdmin = user?.role === "ADMIN";
  const openAddPeopleFlow = useCallback(() => {
    openCreatePersonModal(plainMember ? { role: "VISITOR" } : undefined);
  }, [openCreatePersonModal, plainMember]);
  const userCanHardDelete = canHardDelete(user);
  const canChangeBranchFilter = useMemo(
    () => canChangePeopleBranchFilter(user, isSeniorCoordinator),
    [user, isSeniorCoordinator],
  );
  const visibleBranches = useMemo(() => {
    if (canChangeBranchFilter) {
      return branches.filter((b) => b.is_active);
    }
    if (user?.branch == null || user.branch === undefined) {
      return [];
    }
    return branches.filter((b) => Number(b.id) === Number(user.branch));
  }, [canChangeBranchFilter, branches, user?.branch]);
  const userBranchName = useMemo(() => {
    if (user?.branch_name?.trim()) return user.branch_name.trim();
    const match = branches.find(
      (b) => user?.branch != null && Number(b.id) === Number(user.branch),
    );
    return match?.name ?? null;
  }, [user?.branch, user?.branch_name, branches]);
  const userBranchCode = useMemo(() => {
    const match = branches.find(
      (b) => user?.branch != null && Number(b.id) === Number(user.branch),
    );
    return match?.code?.trim() || null;
  }, [user?.branch, branches]);
  const userBranchId = useMemo(() => {
    if (user?.branch == null || user.branch === undefined) return null;
    const id = Number(user.branch);
    return Number.isNaN(id) ? null : id;
  }, [user?.branch]);
  const isClusterCoordinator = useMemo(
    () => isModuleCoordinator("CLUSTER"),
    [isModuleCoordinator],
  );
  const lockedBranchFilterIds = useMemo(
    () => (canChangeBranchFilter ? [] : [DEFAULT_PEOPLE_BRANCH_FILTER_ID]),
    [canChangeBranchFilter],
  );

  const directoryFilterParams = useMemo(() => {
    const params = filtersToPeopleListParams(activeFilters);
    if (
      !canChangeBranchFilter &&
      user?.branch != null &&
      params.branch == null &&
      !params.branch__in
    ) {
      params.branch = user.branch;
    }
    return params;
  }, [activeFilters, canChangeBranchFilter, user?.branch]);

  const directoryOrdering = useMemo(
    () => sortFieldToOrdering(directorySortBy, directorySortDir),
    [directorySortBy, directorySortDir],
  );

  const {
    peopleUI: directoryPeopleUI,
    totalCount: directoryTotalCount,
    loading: directoryLoading,
    refetch: refetchDirectory,
  } = usePeopleDirectory({
    search: searchQuery,
    filters: directoryFilterParams,
    page: directoryPage,
    pageSize: directoryPageSize,
    ordering: directoryOrdering,
    enabled: activeTab === "people",
  });

  useEffect(() => {
    setDirectoryPage(1);
  }, [searchQuery, directoryFilterParams, directoryOrdering]);

  const [directoryAccessNotice, setDirectoryAccessNotice] = useState<
    string | null
  >(null);

  useEffect(() => {
    if (!user) {
      peopleBranchFilterUserIdRef.current = undefined;
      setActiveFilters([]);
      return;
    }
    if (peopleBranchFilterUserIdRef.current !== user.id) {
      peopleBranchFilterUserIdRef.current = user.id;
      if (!canChangePeopleBranchFilter(user, isSeniorCoordinator)) {
        const f = buildDefaultBranchFilter(user, []);
        setActiveFilters(f ? [f] : []);
      } else {
        setActiveFilters([]);
      }
    }
  }, [user, isSeniorCoordinator]);

  useEffect(() => {
    if (
      user == null ||
      user.branch == null ||
      user.branch === undefined ||
      canChangeBranchFilter
    ) {
      return;
    }
    setActiveFilters((prev) => {
      const idx = prev.findIndex(
        (f) => f.id === DEFAULT_PEOPLE_BRANCH_FILTER_ID,
      );
      if (idx === -1) return prev;
      const updated = buildDefaultBranchFilter(user, branches);
      if (!updated) return prev;
      const cur = prev[idx];
      if (
        cur.label === updated.label &&
        cur.value === updated.value &&
        cur.operator === updated.operator &&
        cur.chipDisplay === updated.chipDisplay
      ) {
        return prev;
      }
      const next = [...prev];
      next[idx] = updated;
      return next;
    });
  }, [user, branches, canChangeBranchFilter]);

  // Clusters
  const [allClusters, setAllClusters] = useState<Cluster[]>([]);
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [showReportForm, setShowReportForm] = useState(false);
  const [reportSelectedCluster, setReportSelectedCluster] =
    useState<Cluster | null>(null);
  const [reportsRefreshTrigger, setReportsRefreshTrigger] = useState(0);
  const [showPersonOverCluster, setShowPersonOverCluster] = useState(false);
  const [personOverCluster, setPersonOverCluster] = useState<Person | null>(
    null,
  );
  const personOverClusterRef = useRef<Person | null>(null);
  useEffect(() => {
    personOverClusterRef.current = personOverCluster;
  }, [personOverCluster]);
  const [showFamilyOverCluster, setShowFamilyOverCluster] = useState(false);
  const [familyOverCluster, setFamilyOverCluster] = useState<Family | null>(
    null,
  );
  const [showClusterOverPerson, setShowClusterOverPerson] = useState(false);
  const [clusterOverPerson, setClusterOverPerson] = useState<Cluster | null>(
    null,
  );
  const [showEditClusterOverlay, setShowEditClusterOverlay] = useState(false);
  const [editClusterOverlay, setEditClusterOverlay] = useState<Cluster | null>(
    null,
  );
  const [showEditFamilyOverlay, setShowEditFamilyOverlay] = useState(false);
  const [editFamilyOverlay, setEditFamilyOverlay] = useState<Family | null>(
    null,
  );
  const [clustersLoading, setClustersLoading] = useState<boolean>(false);
  const [clusterSearchQuery, setClusterSearchQuery] = useState<string>("");
  const [clusterActiveFilters, setClusterActiveFilters] = useState<
    FilterCondition[]
  >([]);
  const [clusterSortBy, setClusterSortBy] = useState<string>("name");
  const [clusterSortOrder, setClusterSortOrder] = useState<"asc" | "desc">(
    "asc",
  );
  const [showClusterFilterDropdown, setShowClusterFilterDropdown] =
    useState(false);
  const [clusterFilterDropdownPosition, setClusterFilterDropdownPosition] =
    useState({
      top: 0,
      left: 0,
    });
  const [showClusterFilterCard, setShowClusterFilterCard] = useState(false);
  const [clusterFilterCardPosition, setClusterFilterCardPosition] = useState({
    top: 0,
    left: 0,
  });
  const [selectedClusterField, setSelectedClusterField] = useState<any>(null);
  const [showClusterSortDropdown, setShowClusterSortDropdown] = useState(false);
  const [clusterSortDropdownPosition, setClusterSortDropdownPosition] =
    useState({
      top: 0,
      left: 0,
    });
  const [clusterCurrentPage, setClusterCurrentPage] = useState(1);
  const [clusterItemsPerPage, setClusterItemsPerPage] = useState(12);
  const [clusterFiltering, setClusterFiltering] = useState(false);
  const [viewCluster, setViewCluster] = useState<Cluster | null>(null);
  const [editCluster, setEditCluster] = useState<Cluster | null>(null);
  const [clusterViewMode, setClusterViewMode] = useState<"view" | "edit">(
    "view",
  );
  const [clusterDeleteConfirmation, setClusterDeleteConfirmation] = useState<{
    isOpen: boolean;
    cluster: Cluster | null;
    loading: boolean;
  }>({
    isOpen: false,
    cluster: null,
    loading: false,
  });

  // Helper: open Assign-to-Cluster modal ensuring clusters are loaded
  const openSelectClusterForPerson = async (p: Person) => {
    if (!clusters || clusters.length === 0) {
      await fetchClusters();
    }
    setSelectClusterModal({ isOpen: true, person: p });
  };

  const [selectFamilyModal, setSelectFamilyModal] = useState<{
    isOpen: boolean;
    person: Person | null;
  }>({ isOpen: false, person: null });

  // Search for Assign-to-Family modal
  const [familySelectSearch, setFamilySelectSearch] = useState("");

  const [selectClusterModal, setSelectClusterModal] = useState<{
    isOpen: boolean;
    person: Person | null;
  }>({ isOpen: false, person: null });

  // Overlay for creating a new family without closing other modals
  const [showCreateFamilyOverlay, setShowCreateFamilyOverlay] = useState(false);

  // Search for Assign-to-Cluster modal
  const [clusterSelectSearch, setClusterSelectSearch] = useState("");
  const [showCreateClusterOverlay, setShowCreateClusterOverlay] =
    useState(false);
  const [clusterCreateContextPerson, setClusterCreateContextPerson] =
    useState<Person | null>(null);
  const [personDeleteConfirmation, setPersonDeleteConfirmation] = useState<{
    isOpen: boolean;
    person: Person | null;
    loading: boolean;
  }>({
    isOpen: false,
    person: null,
    loading: false,
  });
  const [assignMembersModal, setAssignMembersModal] = useState<{
    isOpen: boolean;
    cluster: Cluster | null;
  }>({
    isOpen: false,
    cluster: null,
  });
  const [addFamilyMemberModal, setAddFamilyMemberModal] = useState<{
    isOpen: boolean;
    family: Family | null;
  }>({
    isOpen: false,
    family: null,
  });

  // Debounced search is handled inside usePeopleDirectory
  const handleSearchChange = useCallback((query: string) => {
    setSearchQuery(query);
    setDirectoryPage(1);
  }, []);

  const fetchClusters = async () => {
    try {
      setClustersLoading(true);
      const res = await clustersApi.getAll();
      const clusterData = res.data as unknown as Cluster[];
      setAllClusters(clusterData);
      setClusters(clusterData);
    } catch (e) {
      console.error("Failed to load clusters", e);
    } finally {
      setClustersLoading(false);
    }
  };

  // Ensure clusters are available for person create/edit membership fields
  useEffect(() => {
    const personFormVisible =
      (isModalOpen && modalType === "person") ||
      (personPanelOpen &&
        (personPanelMode === "create" ||
          personPanelMode === "edit" ||
          (personPanelMode === "view" && viewMode === "edit")));
    if (personFormVisible && clusters.length === 0 && !clustersLoading) {
      void fetchClusters();
    }
  }, [
    isModalOpen,
    modalType,
    personPanelOpen,
    personPanelMode,
    viewMode,
    clusters.length,
    clustersLoading,
  ]);

  /** Refetch open person profiles when cluster membership changes so journey timelines stay in sync. */
  const refreshOpenPersonProfilesAfterClusterMemberChange = async (
    previousMemberIds: Array<string | number> | undefined,
    nextMemberIds: Array<string | number> | undefined,
  ) => {
    const prev = new Set((previousMemberIds ?? []).map((id) => String(id)));
    const next = new Set((nextMemberIds ?? []).map((id) => String(id)));
    const affected = new Set<string>();
    Array.from(next).forEach((id) => {
      if (!prev.has(id)) affected.add(id);
    });
    Array.from(prev).forEach((id) => {
      if (!next.has(id)) affected.add(id);
    });
    const viewId = viewEditPersonRef.current?.id;
    const overId = personOverClusterRef.current?.id;
    // Member ids from API may be string or number; use == so "7" matches 7.
    const idsToFetch = Array.from(affected).filter(
      (id) =>
        (viewId != null && id == viewId) || (overId != null && id == overId),
    );
    for (const pid of idsToFetch) {
      try {
        const res = await peopleApi.getById(String(pid));
        const p = res.data;
        setViewEditPerson((cur) => (cur != null && cur.id == pid ? p : cur));
        setPersonOverCluster((cur) => (cur != null && cur.id == pid ? p : cur));
      } catch (e) {
        console.error("Failed to refresh person after cluster change:", e);
      }
    }
  };

  // Cluster filter and sort functions
  const applyClusterFilters = () => {
    setClusterFiltering(true);

    // Use setTimeout to allow UI to update before heavy computation
    setTimeout(() => {
      let filtered = [...allClusters];

      // Apply search filter
      if (clusterSearchQuery) {
        const q = clusterSearchQuery.toLowerCase();
        filtered = filtered.filter((c) => {
          const name = (c.name || "").toLowerCase();
          const code = (c.code || "").toLowerCase();
          const desc = (c.description || "").toLowerCase();
          const loc = (c as any).location?.toLowerCase() || "";
          const schedule = (c as any).meeting_schedule?.toLowerCase() || "";
          return (
            name.includes(q) ||
            code.includes(q) ||
            desc.includes(q) ||
            loc.includes(q) ||
            schedule.includes(q)
          );
        });
      }

      // Apply active filters
      clusterActiveFilters.forEach((filter) => {
        filtered = filtered.filter((cluster) => {
          switch (filter.field) {
            case "coordinator":
              const coordinator = peopleUI.find(
                (person) => person.id === (cluster as any).coordinator,
              );
              const coordinatorName = coordinator
                ? `${coordinator.first_name} ${coordinator.last_name}`.toLowerCase()
                : "";
              return coordinatorName.includes(
                (filter.value as string).toLowerCase(),
              );

            case "location":
              const location = (cluster as any).location?.toLowerCase() || "";
              return location.includes((filter.value as string).toLowerCase());

            case "meeting_schedule":
              const schedule =
                (cluster as any).meeting_schedule?.toLowerCase() || "";
              return schedule.includes((filter.value as string).toLowerCase());

            case "member_count":
              const memberCount = (cluster as any).members?.length || 0;
              const [min, max] = Array.isArray(filter.value)
                ? filter.value
                : [0, 1000];
              return (
                memberCount >= parseInt(min.toString()) &&
                memberCount <= parseInt(max.toString())
              );

            case "family_count":
              const familyCount = (cluster as any).families?.length || 0;
              const [minFam, maxFam] = Array.isArray(filter.value)
                ? filter.value
                : [0, 1000];
              return (
                familyCount >= parseInt(minFam.toString()) &&
                familyCount <= parseInt(maxFam.toString())
              );

            default:
              return true;
          }
        });
      });

      // Apply sorting
      filtered.sort((a, b) => {
        let aValue: any, bValue: any;

        switch (clusterSortBy) {
          case "name":
            aValue = (a.name || "").toLowerCase();
            bValue = (b.name || "").toLowerCase();
            break;
          case "member_count":
            aValue = (a as any).members?.length || 0;
            bValue = (b as any).members?.length || 0;
            break;
          case "visitor_count":
            // Count visitors in cluster members
            const aVisitors = ((a as any).members || []).filter(
              (memberId: string) => {
                const person = peopleUI.find((p) => p.id === memberId);
                return person?.role === "VISITOR";
              },
            ).length;
            const bVisitors = ((b as any).members || []).filter(
              (memberId: string) => {
                const person = peopleUI.find((p) => p.id === memberId);
                return person?.role === "VISITOR";
              },
            ).length;
            aValue = aVisitors;
            bValue = bVisitors;
            break;
          case "family_count":
            aValue = (a as any).families?.length || 0;
            bValue = (b as any).families?.length || 0;
            break;
          case "created_at":
            aValue = new Date((a as any).created_at || 0);
            bValue = new Date((b as any).created_at || 0);
            break;
          default:
            aValue = (a.name || "").toLowerCase();
            bValue = (b.name || "").toLowerCase();
        }

        if (aValue < bValue) return clusterSortOrder === "asc" ? -1 : 1;
        if (aValue > bValue) return clusterSortOrder === "asc" ? 1 : -1;
        return 0;
      });

      setClusters(filtered);
      setClusterFiltering(false);
    }, 0);
  };

  // Pagination logic
  const clusterTotalPages = Math.ceil(clusters.length / clusterItemsPerPage);
  const clusterStartIndex = (clusterCurrentPage - 1) * clusterItemsPerPage;
  const clusterEndIndex = clusterStartIndex + clusterItemsPerPage;
  const clusterPaginatedData = clusters.slice(
    clusterStartIndex,
    clusterEndIndex,
  );

  // Reset to first page when filters change
  useEffect(() => {
    setClusterCurrentPage(1);
  }, [
    clusterSearchQuery,
    clusterActiveFilters,
    clusterSortBy,
    clusterSortOrder,
  ]);

  const handleClusterFilterChange = (filters: FilterCondition[]) => {
    setClusterActiveFilters(filters);
  };

  const handleClusterSortChange = (
    sortBy: string,
    sortOrder: "asc" | "desc",
  ) => {
    setClusterSortBy(sortBy);
    setClusterSortOrder(sortOrder);
  };

  // Cluster filter handlers
  const handleClusterAddFilter = (anchorRect: DOMRect) => {
    const dropdownWidth = 256; // w-64 in ClusterFilterDropdown
    const viewportWidth = window.innerWidth;
    const rightEdge = anchorRect.left + dropdownWidth;

    let left = anchorRect.left;
    if (rightEdge > viewportWidth) {
      left = viewportWidth - dropdownWidth - 16; // 16px margin
    }

    setClusterFilterDropdownPosition({
      top: anchorRect.bottom + 8,
      left: Math.max(16, left), // 16px minimum margin
    });
    setShowClusterFilterDropdown(true);
  };

  const handleClusterSelectField = (field: any) => {
    setSelectedClusterField(field);
    setShowClusterFilterDropdown(false);

    // Position the filter card
    const cardWidth = 320; // w-80 in ClusterFilterCard
    const viewportWidth = window.innerWidth;
    const rightEdge = clusterFilterDropdownPosition.left + cardWidth;

    let left = clusterFilterDropdownPosition.left;
    if (rightEdge > viewportWidth) {
      left = viewportWidth - cardWidth - 16;
    }

    setClusterFilterCardPosition({
      top: clusterFilterDropdownPosition.top + 8,
      left: Math.max(16, left),
    });
    setShowClusterFilterCard(true);
  };

  const handleClusterApplyFilter = (filter: FilterCondition) => {
    setClusterActiveFilters((prev) => [...prev, filter]);
    setShowClusterFilterCard(false);
    setSelectedClusterField(null);
  };

  // Cluster sort handler
  const handleClusterSortDropdown = (anchorRect: DOMRect) => {
    const dropdownWidth = 256; // w-64 in ClusterSortDropdown
    const viewportWidth = window.innerWidth;
    const rightEdge = anchorRect.left + dropdownWidth;

    let left = anchorRect.left;
    if (rightEdge > viewportWidth) {
      left = viewportWidth - dropdownWidth - 16; // 16px margin
    }

    setClusterSortDropdownPosition({
      top: anchorRect.bottom + 8,
      left: Math.max(16, left), // 16px minimum margin
    });
    setShowClusterSortDropdown(true);
  };

  const handleClusterSelectSort = (
    sortBy: string,
    sortOrder: "asc" | "desc",
  ) => {
    setClusterSortBy(sortBy);
    setClusterSortOrder(sortOrder);
    setShowClusterSortDropdown(false);
  };

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      setShowClusterFilterDropdown(false);
      setShowClusterFilterCard(false);
      setShowClusterSortDropdown(false);
    };

    if (
      showClusterFilterDropdown ||
      showClusterFilterCard ||
      showClusterSortDropdown
    ) {
      document.addEventListener("click", handleClickOutside);
    }

    return () => {
      document.removeEventListener("click", handleClickOutside);
    };
  }, [
    showClusterFilterDropdown,
    showClusterFilterCard,
    showClusterSortDropdown,
  ]);

  // Apply cluster filters when dependencies change
  useEffect(() => {
    applyClusterFilters();
  }, [
    allClusters,
    clusterSearchQuery,
    clusterActiveFilters,
    clusterSortBy,
    clusterSortOrder,
  ]);

  const handleCreateCluster = async (data: Partial<Cluster>) => {
    try {
      const nextMembers = (data as { members?: Array<string | number> })
        .members;
      await clustersApi.create(data as any);
      await fetchClusters();
      await refreshOpenPersonProfilesAfterClusterMemberChange([], nextMembers);
      setIsModalOpen(false);
    } catch (error) {
      console.error("Error creating cluster:", error);
      alert("Failed to create cluster. Please try again.");
      throw error;
    }
  };

  const handleUpdateCluster = async (data: Partial<Cluster>) => {
    if (editCluster) {
      try {
        const prevMembers = (editCluster as { members?: unknown }).members as
          | Array<string | number>
          | undefined;
        const updatedCluster = await clustersApi.update(
          editCluster.id,
          data as any,
        );
        await fetchClusters();
        if ((data as { members?: unknown }).members !== undefined) {
          await refreshOpenPersonProfilesAfterClusterMemberChange(
            prevMembers,
            (data as { members?: Array<string | number> }).members,
          );
        }

        if (viewCluster) {
          // If editing from view, update the viewCluster with new data and return to view mode
          setViewCluster(updatedCluster.data);
          setEditCluster(null);
          setClusterViewMode("view");
        } else {
          // If editing directly, close the modal
          setIsModalOpen(false);
          setEditCluster(null);
          setViewCluster(null);
          setClusterViewMode("view");
        }
      } catch (error) {
        console.error("Error updating cluster:", error);
        alert("Failed to update cluster. Please try again.");
        throw error;
      }
    }
  };

  const handleAssignMembers = async (memberIds: string[]) => {
    if (assignMembersModal.cluster) {
      try {
        const prevMembers =
          (
            assignMembersModal.cluster as unknown as {
              members?: Array<string | number>;
            }
          ).members || [];
        // Include existing families so backend validators that require it won't fail
        const updated = await clustersApi.update(assignMembersModal.cluster.id, {
          members: memberIds,
          families: (assignMembersModal.cluster as any).families || [],
        } as any);
        const returnedIdSet = new Set(
          (updated.data.members ?? []).map((id: number) => String(id))
        );
        const notAssigned = memberIds.filter(
          (id) => !returnedIdSet.has(String(id))
        );
        if (notAssigned.length > 0) {
          alert(
            "Some members could not be assigned because they belong to a different branch than this cluster."
          );
        }
        await fetchClusters();
        await refreshOpenPersonProfilesAfterClusterMemberChange(
          prevMembers,
          memberIds,
        );

        // Update viewCluster if it's the same cluster
        if (viewCluster && viewCluster.id === assignMembersModal.cluster.id) {
          const updatedCluster = await clustersApi.getById(viewCluster.id);
          setViewCluster(updatedCluster.data);
        }

        setAssignMembersModal({ isOpen: false, cluster: null });
      } catch (error) {
        console.error("Error assigning members:", error);
        alert("Failed to assign members. Please try again.");
        throw error;
      }
    }
  };

  const handleAddFamilyMembers = async (memberIds: string[]) => {
    if (addFamilyMemberModal.family) {
      try {
        await updateFamily(addFamilyMemberModal.family.id, {
          members: memberIds,
        });

        // Refresh families and update viewFamily if it's the same family
        await refreshFamilies();
        if (viewFamily && viewFamily.id === addFamilyMemberModal.family.id) {
          const updatedFamily = families.find(
            (f: Family) => f.id === viewFamily.id,
          );
          if (updatedFamily) {
            setViewFamily(updatedFamily);
          }
        }

        setAddFamilyMemberModal({ isOpen: false, family: null });
      } catch (error) {
        console.error("Error adding family members:", error);
        alert("Failed to add family members. Please try again.");
        throw error;
      }
    }
  };

  const handleDeleteCluster = async () => {
    if (clusterDeleteConfirmation.cluster) {
      setClusterDeleteConfirmation((prev) => ({ ...prev, loading: true }));
      try {
        await clustersApi.delete(clusterDeleteConfirmation.cluster.id);
        await fetchClusters();
        setClusterDeleteConfirmation({
          isOpen: false,
          cluster: null,
          loading: false,
        });
      } catch (error) {
        console.error("Error deleting cluster:", error);
        alert("Failed to delete cluster. Please try again.");
        setClusterDeleteConfirmation((prev) => ({ ...prev, loading: false }));
      }
    }
  };

  const confirmClusterDelete = (cluster: Cluster) => {
    setClusterDeleteConfirmation({
      isOpen: true,
      cluster,
      loading: false,
    });
  };

  const closeClusterDeleteConfirmation = () => {
    setClusterDeleteConfirmation({
      isOpen: false,
      cluster: null,
      loading: false,
    });
  };

  const handleDeletePerson = async () => {
    if (personDeleteConfirmation.person) {
      setPersonDeleteConfirmation((prev) => ({ ...prev, loading: true }));
      try {
        await deletePerson(personDeleteConfirmation.person.id);
        await refetchDirectory();
        setPersonDeleteConfirmation({
          isOpen: false,
          person: null,
          loading: false,
        });
        setIsModalOpen(false);
        setPersonPanelOpen(false);
        setPersonPanelPerson(null);
        setViewEditPerson(null);
      } catch (error) {
        console.error("Failed to delete person:", error);
        setPersonDeleteConfirmation((prev) => ({ ...prev, loading: false }));
      }
    }
  };

  const closePersonDeleteConfirmation = () => {
    setPersonDeleteConfirmation({
      isOpen: false,
      person: null,
      loading: false,
    });
  };

  // Directory rows come from the paginated server API (see usePeopleDirectory above).
  const filteredPeopleUI = directoryPeopleUI;

  // const handleCreatePerson = (personData: Partial<Person>) => {
  //   const newPerson = {
  //     ...personData,
  //     id: Date.now().toString(),
  //     dateFirstAttended: new Date(),
  //     journeys: [],
  //   } as Person;
  //   setPeople([...people, newPerson]);
  //   setIsModalOpen(false);
  // };

  const handleCreatePerson = async (personData: Partial<Person> | FormData) => {
    try {
      const result = await createPerson(personData);
      if (!isDesktop) {
        setIsModalOpen(false);
      }
      return result; // Return the created person for journey handling
    } catch (err) {
      console.error(err);
      alert("Failed to save person.");
      throw err;
    }
  };

  const handleCreateFamily = async (familyData: Partial<Family>) => {
    try {
      await createFamily(familyData);
      setIsModalOpen(false);
      setEditFamily(null);
    } catch (error) {
      console.error("Error creating family:", error);
      throw error;
    }
  };

  const handleUpdateFamily = async (familyData: Partial<Family>) => {
    if (!editFamily) return;

    // Capture current values to avoid stale closures
    const currentEditFamilyId = editFamily.id;
    const isInFamilyViewEditMode = familyViewMode === "edit";

    try {
      // updateFamily returns the updated family data
      const updatedFamily = await updateFamily(currentEditFamilyId, familyData);

      // Update viewFamily if we're editing from view mode (same pattern as Person and Cluster updates)
      if (isInFamilyViewEditMode && viewFamily) {
        // Update viewFamily with new data and return to view mode
        // This matches the working pattern used in handleUpdateCluster and PersonForm onSubmit
        setViewFamily(updatedFamily);
        setFamilyViewMode("view");
      }

      // Update familyOverCluster if it matches
      setFamilyOverCluster((currentFamilyOverCluster) => {
        if (
          currentFamilyOverCluster &&
          currentFamilyOverCluster.id === currentEditFamilyId
        ) {
          return updatedFamily;
        }
        return currentFamilyOverCluster;
      });

      // Note: setFamilyViewMode("view") is now called above when in edit mode

      // Refresh families list in the background (don't await - let it update in background)
      // NOTE: We skip refreshFamilies when in edit mode within FamilyView because we already
      // have the updated data from the API response, and calling refreshFamilies might trigger
      // a re-render with stale data before viewFamily is updated
      if (!isInFamilyViewEditMode) {
        refreshFamilies().catch((err) => {
          console.error("Error refreshing families:", err);
        });
      }

      // Only close modal if we're not in FamilyView edit mode
      if (!isInFamilyViewEditMode) {
        setIsModalOpen(false);
      }
      setEditFamily(null);
    } catch (error) {
      console.error("Error updating family:", error);
      throw error;
    }
  };

  const handleDeleteFamily = async () => {
    if (!deleteConfirmation.family) return;

    try {
      setDeleteConfirmation((prev) => ({ ...prev, loading: true }));
      await deleteFamily(deleteConfirmation.family.id);
      setDeleteConfirmation({
        isOpen: false,
        family: null,
        loading: false,
      });
    } catch (error) {
      console.error("Error deleting family:", error);
      alert("Failed to delete family. Please try again.");
      setDeleteConfirmation((prev) => ({ ...prev, loading: false }));
    }
  };

  const closeDeleteConfirmation = () => {
    setDeleteConfirmation({
      isOpen: false,
      family: null,
      loading: false,
    });
  };

  const getPeopleForFamily = (family: Family) => {
    return people.filter((person) => (family.members ?? []).includes(person.id));
  };

  const handleBulkDelete = async (people: Person[]) => {
    setBulkDeleteConfirmation({
      isOpen: true,
      people,
      loading: false,
    });
  };

  const confirmBulkDelete = async () => {
    if (!bulkDeleteConfirmation.people.length) return;

    try {
      setBulkDeleteConfirmation((prev) => ({ ...prev, loading: true }));
      await Promise.all(
        bulkDeleteConfirmation.people.map((person) => deletePerson(person.id)),
      );
      await refetchDirectory();
      setBulkDeleteConfirmation({
        isOpen: false,
        people: [],
        loading: false,
      });
    } catch (error) {
      console.error("Error deleting people:", error);
      alert("Failed to delete some people. Please try again.");
      setBulkDeleteConfirmation((prev) => ({ ...prev, loading: false }));
    }
  };

  const closeBulkDeleteConfirmation = () => {
    setBulkDeleteConfirmation({
      isOpen: false,
      people: [],
      loading: false,
    });
  };

  const handleBulkExport = (
    people: Person[],
    format: "excel" | "pdf" | "csv",
  ) => {
    // The export functionality is handled within DataTable component
    console.log(`Exporting ${people.length} people to ${format}`);
  };

  const handleImportPeople = async (rows: Record<string, string>[]) => {
    let eventTypes: { code: string; label: string }[] = [];
    try {
      const response = await eventTypesApi
        .list()
        .catch(() =>
          eventsApi.listTypes().catch(() => ({
            data: [] as { code: string; label: string }[],
          }))
        );
      eventTypes = response.data ?? [];
    } catch {
      eventTypes = [];
    }

    const resolveActivityCode = (value: string) => {
      const trimmed = value.trim();
      if (!trimmed) return undefined;
      const byCode = eventTypes.find(
        (t) => t.code.toLowerCase() === trimmed.toLowerCase()
      );
      if (byCode) return byCode.code;
      const byLabel = eventTypes.find(
        (t) => t.label.toLowerCase() === trimmed.toLowerCase()
      );
      return byLabel?.code;
    };

    const defaultBranchId =
      user?.branch != null ? Number(user.branch) : null;

    let created = 0;
    const failures: string[] = [];
    const skipped: string[] = [];

    for (let i = 0; i < rows.length; i++) {
      const rowNumber = i + 2; // header is row 1
      const normalized = normalizeImportRow(rows[i]);
      const payload = mapImportRowToPerson(normalized, {
        defaultBranchId,
        resolveActivityCode,
      });

      if (!payload) {
        skipped.push(`Row ${rowNumber}: missing first_name or last_name`);
        continue;
      }

      if (payload.branch == null) {
        failures.push(`Row ${rowNumber}: branch is required`);
        continue;
      }

      try {
        await peopleApi.create(payload);
        created += 1;
      } catch (error) {
        const name = `${payload.first_name} ${payload.last_name}`.trim();
        failures.push(
          `Row ${rowNumber} (${name}): ${formatPeopleImportApiError(error)}`
        );
      }
    }

    await refetchDirectory();
    if (needFullPeopleCatalog) {
      await refreshPeople();
    }

    const parts = [`Imported ${created} of ${rows.length} people.`];
    if (skipped.length) {
      parts.push(
        `Skipped ${skipped.length}:\n${skipped.slice(0, 8).join("\n")}`
      );
    }
    if (failures.length) {
      parts.push(
        `Failed ${failures.length}:\n${failures.slice(0, 8).join("\n")}`
      );
    }

    if (created === 0 && (failures.length > 0 || skipped.length > 0)) {
      throw new Error(parts.join("\n\n"));
    }

    alert(parts.join("\n\n"));
  };

  const handleApplyFilter = (filter: FilterCondition) => {
    setActiveFilters([...activeFilters, filter]);
    setDirectoryPage(1);
  };

  const handleRemoveFilter = (filterId: string) => {
    if (lockedBranchFilterIds.includes(filterId)) {
      return;
    }
    setActiveFilters(activeFilters.filter((f) => f.id !== filterId));
    setDirectoryPage(1);
  };

  const handleRemoveFilterIds = useCallback(
    (filterIds: string[]) => {
      const removable = filterIds.filter(
        (id) => !lockedBranchFilterIds.includes(id),
      );
      if (removable.length === 0) return;
      setActiveFilters((prev) =>
        prev.filter((f) => !removable.includes(f.id)),
      );
      setDirectoryPage(1);
    },
    [lockedBranchFilterIds],
  );

  const handleClearAllFilters = () => {
    if (!canChangeBranchFilter && user) {
      const f = buildDefaultBranchFilter(user, branches);
      setActiveFilters(f ? [f] : []);
      setDirectoryPage(1);
      return;
    }
    setActiveFilters([]);
    setDirectoryPage(1);
  };

  const hasActiveSearchOrFilters = useMemo(() => {
    if (searchQuery.trim()) return true;
    const nonDefaultFilters = activeFilters.filter(
      (f) => f.id !== DEFAULT_PEOPLE_BRANCH_FILTER_ID,
    );
    return nonDefaultFilters.length > 0;
  }, [searchQuery, activeFilters]);

  const personPanelTitle =
    personPanelMode === "create"
      ? createPeopleTitle
      : personPanelMode === "edit"
        ? "Edit Profile"
        : personPanelPerson
          ? "Profile"
          : "Person Details";

  const refreshPersonJourneyData = async (personId: string) => {
    try {
      const [personResponse, journeysResponse] = await Promise.all([
        peopleApi.getById(personId),
        journeysApi.getByUser(personId),
      ]);
      const refreshedPerson: Person = {
        ...personResponse.data,
        journeys: journeysResponse.data,
      };
      setViewEditPerson((current) =>
        current && String(current.id) === personId ? refreshedPerson : current,
      );
      setPersonPanelPerson((current) =>
        current && String(current.id) === personId ? refreshedPerson : current,
      );
      setPersonOverCluster((current) =>
        current && String(current.id) === personId ? refreshedPerson : current,
      );
    } catch (error) {
      console.error("Failed to refresh person journey data:", error);
    }
  };

  const renderPersonFlow = (isPanel: boolean) => {
    if (viewEditPerson) {
      if (viewMode === "view") {
        return (
          <PersonProfile
            person={viewEditPerson}
            clusters={clusters}
            families={families}
            showTopHeader={!isPanel}
            hideDeleteButton={!userCanHardDelete}
            hideEditButton={
              plainMember &&
              !!user?.id &&
              String(viewEditPerson.id) !== String(user.id)
            }
            onViewFamily={(f) => {
              setFamilyOverCluster(f);
              setShowFamilyOverCluster(true);
            }}
            onViewCluster={(c) => {
              setClusterOverPerson(c);
              setShowClusterOverPerson(true);
            }}
            onNoFamilyClick={(p) => {
              setSelectFamilyModal({ isOpen: true, person: p });
            }}
            onNoClusterClick={(p) => {
              openSelectClusterForPerson(p);
            }}
            onEdit={() => {
              setViewMode("edit");
              if (isPanel) setPersonPanelMode("edit");
            }}
            onDelete={() => {
              setPersonDeleteConfirmation({
                isOpen: true,
                person: viewEditPerson,
                loading: false,
              });
            }}
            onAddTimeline={() => {
              setViewMode("edit");
              setStartOnTimelineTab(true);
              if (isPanel) setPersonPanelMode("edit");
            }}
            onClose={() => {
              if (isPanel) {
                closePersonPanel();
              } else {
                setIsModalOpen(false);
                setViewEditPerson(null);
              }
            }}
          />
        );
      }

      return (
        <PersonForm
          initialData={viewEditPerson}
          isEditingFromProfile={true}
          startOnTimelineTab={startOnTimelineTab}
          panelLayout={isPanel}
          peopleOptions={people}
          familyOptions={families}
          clusterOptions={clusters}
          onJourneySaved={refreshPersonJourneyData}
          onSubmit={async (data) => {
            const result = await updatePerson(viewEditPerson.id, data);
            setViewEditPerson(result);
            setViewMode("view");
            setPersonPanelPerson(result);
            setPersonPanelMode("view");
            setStartOnTimelineTab(false);
            // updatePerson already patches the catalog when loaded; avoid full getAll.
            await Promise.all([
              refetchDirectory(),
              refreshFamilies(),
              fetchClusters(),
            ]);
            return result;
          }}
          onClose={() => {
            if (isPanel) {
              closePersonPanel();
            } else {
              setIsModalOpen(false);
              setViewEditPerson(null);
              setStartOnTimelineTab(false);
            }
          }}
          onBackToProfile={() => {
            setViewMode("view");
            setPersonPanelMode("view");
            setStartOnTimelineTab(false);
          }}
        />
      );
    }

    return (
      <PersonForm
        onJourneySaved={refreshPersonJourneyData}
        onSubmit={async (data) => {
          const created = await handleCreatePerson(data);
          if (created) {
            setViewEditPerson(created as Person);
            setViewMode("view");
            setPersonPanelPerson(created as Person);
            setPersonPanelMode("view");
            setPersonPanelOpen(true);
            setCreateInitialData(undefined);
            setPersonPanelInitialData(undefined);
            // createPerson already patches the catalog when loaded; avoid full getAll.
            await Promise.all([
              refetchDirectory(),
              refreshFamilies(),
              fetchClusters(),
            ]);

            if (
              user?.role === "ADMIN" &&
              created.role !== "VISITOR"
            ) {
              setLoginCredentialsModal({
                isOpen: true,
                person: created as Person,
                temporaryPassword: created.temporary_password,
              });
            }
          }
          return created;
        }}
        onClose={() => {
          if (isPanel) {
            closePersonPanel();
          } else {
            setIsModalOpen(false);
            setCreateInitialData(undefined);
          }
        }}
        initialData={isPanel ? personPanelInitialData : createInitialData}
        panelLayout={isPanel}
        peopleOptions={people}
        familyOptions={families}
        clusterOptions={clusters}
      />
    );
  };

  return (
    <DashboardLayout>
      {/* Page header with add people action */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-foreground">People</h1>
        <Button
          onClick={openAddPeopleFlow}
          className="w-full sm:w-auto"
        >
          {addPeopleButtonLabel}
        </Button>
      </div>
      {SHOW_TABS && (
        <div className="fixed top-16 left-64 right-0 z-20 bg-white py-4 px-6 flex justify-between items-center border-b border-gray-200">
          <div className="flex space-x-4">
            <button
              className={`px-4 py-2 font-medium rounded-md ${
                activeTab === "people"
                  ? "bg-primary text-white"
                  : "text-gray-600 hover:text-gray-900"
              }`}
              onClick={() => setActiveTab("people")}
            >
              People
            </button>
            <button
              className={`px-4 py-2 font-medium rounded-md ${
                activeTab === "families"
                  ? "bg-primary text-white"
                  : "text-gray-600 hover:text-gray-900"
              }`}
              onClick={() => setActiveTab("families")}
            >
              Families
            </button>
            <button
              className={`px-4 py-2 font-medium rounded-md ${
                activeTab === "clusters"
                  ? "bg-primary text-white"
                  : "text-gray-600 hover:text-gray-900"
              }`}
              onClick={() => {
                setActiveTab("clusters");
                if (clusters.length === 0 && !clustersLoading) fetchClusters();
              }}
            >
              Clusters
            </button>
            <button
              className={`px-4 py-2 font-medium rounded-md ${
                activeTab === "reports"
                  ? "bg-primary text-white"
                  : "text-gray-600 hover:text-gray-900"
              }`}
              onClick={() => {
                setActiveTab("reports");
                if (clusters.length === 0 && !clustersLoading) fetchClusters();
              }}
            >
              Reports
            </button>
          </div>
          {activeTab !== "reports" && (
            <Button
              onClick={() => {
                if (activeTab === "people") {
                  openAddPeopleFlow();
                  return;
                }
                setModalType(activeTab === "families" ? "family" : "cluster");
                setIsModalOpen(true);
              }}
            >
              Add{" "}
              {activeTab === "people"
                ? plainMember
                  ? "Visitor"
                  : "Person"
                : activeTab === "families"
                  ? "Family"
                  : "Cluster"}
            </Button>
          )}
        </div>
      )}

      <div className={SHOW_TABS ? "pt-20" : "pt-6"}>
        {activeTab === "people" && (
          <div
            className={
              personPanelOpen
                ? "lg:grid lg:grid-cols-[minmax(0,1fr)_500px] lg:gap-6 lg:items-start"
                : ""
            }
          >
            <div className="space-y-6">
              <FilterBar
                searchQuery={searchQuery}
                onSearchChange={handleSearchChange}
                activeFilters={activeFilters}
                onRemoveFilter={handleRemoveFilter}
                onRemoveFilterIds={handleRemoveFilterIds}
                onClearAllFilters={handleClearAllFilters}
                onApplyFilter={handleApplyFilter}
                isSearching={directoryLoading}
                branches={visibleBranches}
                canChangeBranchFilter={canChangeBranchFilter}
                lockedFilterIds={lockedBranchFilterIds}
              />

              {!canChangeBranchFilter &&
                user?.branch != null &&
                user.branch !== undefined && (
                  <div
                    className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-900"
                    role="status"
                  >
                    <p>
                      Showing people in{" "}
                      <span className="font-semibold">
                        {userBranchName ?? "your branch"}
                      </span>{" "}
                      only. People in other branches are not listed in the
                      directory.
                    </p>
                    {isClusterCoordinator && (
                      <p className="mt-1 text-blue-800">
                        To manage cluster members, use{" "}
                        <a
                          href="/clusters"
                          className="font-medium underline hover:text-blue-950"
                        >
                          Clusters
                        </a>
                        .
                      </p>
                    )}
                  </div>
                )}

              {directoryAccessNotice && (
                <div
                  className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 flex items-start justify-between gap-3"
                  role="alert"
                >
                  <div className="space-y-1">
                    <p>{directoryAccessNotice}</p>
                    {isClusterCoordinator && (
                      <p className="text-amber-800">
                        Tip: find them in search, then assign from{" "}
                        <a
                          href="/clusters"
                          className="font-medium underline hover:text-amber-950"
                        >
                          Clusters
                        </a>
                        .
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setDirectoryAccessNotice(null)}
                    className="text-amber-700 hover:text-amber-900 shrink-0"
                    aria-label="Dismiss notice"
                  >
                    ×
                  </button>
                </div>
              )}

              {(searchQuery || activeFilters.length > 0) && (
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-sm text-gray-600">
                  <div className="flex flex-wrap items-center gap-2">
                    <span>
                      {directoryLoading
                        ? "Searching..."
                        : `${directoryTotalCount} result${
                            directoryTotalCount !== 1 ? "s" : ""
                          } found`}
                    </span>
                  </div>
                </div>
              )}

              {directoryLoading ? (
                <div className="text-center py-8 text-sm text-gray-500">
                  Loading people…
                </div>
              ) : filteredPeopleUI.length === 0 ? (
                <PeopleDirectoryEmptyState
                  canChangeBranchFilter={canChangeBranchFilter}
                  branchName={userBranchName}
                  hasActiveSearchOrFilters={hasActiveSearchOrFilters}
                  userRole={user?.role}
                  isClusterCoordinator={isClusterCoordinator}
                />
              ) : (
                <DataTable
                  people={filteredPeopleUI as unknown as Person[]}
                  highlightedPersonId={
                    personPanelOpen
                      ? personPanelPerson?.id || viewEditPerson?.id || null
                      : null
                  }
                  onView={(p) => openPersonInteraction("view", p)}
                  onEdit={(p) => {
                    if (
                      plainMember &&
                      !!user?.id &&
                      String(p.id) !== String(user.id)
                    ) {
                      return;
                    }
                    openPersonInteraction("edit", p);
                  }}
                  canEditPerson={(p) =>
                    !plainMember ||
                    (!!user?.id && String(p.id) === String(user.id))
                  }
                  onDelete={
                    isAdmin
                      ? (p) => {
                          setPersonDeleteConfirmation({
                            isOpen: true,
                            person: p,
                            loading: false,
                          });
                        }
                      : undefined
                  }
                  onBulkDelete={userCanHardDelete ? handleBulkDelete : undefined}
                  onBulkExport={handleBulkExport}
                  onImport={handleImportPeople}
                  onExportAll={() =>
                    peopleApi.getAllMatching({
                      ...directoryFilterParams,
                      search: searchQuery.trim() || undefined,
                      ordering: directoryOrdering,
                      has_name: true,
                      exclude_username: "admin",
                    })
                  }
                  defaultBranchId={userBranchId}
                  defaultBranchCode={userBranchCode}
                  sidePanelOpen={personPanelOpen}
                  page={directoryPage}
                  pageSize={directoryPageSize}
                  totalCount={directoryTotalCount}
                  onPageChange={setDirectoryPage}
                  onPageSizeChange={(size) => {
                    setDirectoryPageSize(size);
                    setDirectoryPage(1);
                  }}
                  sortBy={directorySortBy}
                  sortDir={directorySortDir}
                  onSortChange={(field, dir) => {
                    setDirectorySortBy(field);
                    setDirectorySortDir(dir);
                    setDirectoryPage(1);
                  }}
                />
              )}
            </div>
            {personPanelOpen && (
              <PersonDetailPanel
                isOpen={personPanelOpen}
                title={personPanelTitle}
                onClose={closePersonPanel}
              >
                {renderPersonFlow(true)}
              </PersonDetailPanel>
            )}
          </div>
        )}

        {activeTab === "families" && (
          <FamilyManagementDashboard
            people={peopleUI}
            onCreateFamily={() => {
              setModalType("family");
              setIsModalOpen(true);
            }}
            onViewFamily={async (family) => {
              try {
                const { data } = await familiesApi.getById(String(family.id));
                setViewFamily(data);
              } catch {
                setViewFamily(family);
              }
              setFamilyViewMode("view");
              setModalType("family");
              setIsModalOpen(true);
            }}
            onEditFamily={async (family) => {
              try {
                const { data } = await familiesApi.getById(String(family.id));
                setEditFamily(data);
                setViewFamily(data);
              } catch {
                setEditFamily(family);
                setViewFamily(family);
              }
              setFamilyViewMode("edit");
              setModalType("family");
              setIsModalOpen(true);
            }}
            onDeleteFamily={(family) => {
              setDeleteConfirmation({
                isOpen: true,
                family,
                loading: false,
              });
            }}
            onViewPerson={(p) => {
              setViewEditPerson(p as unknown as Person);
              setViewMode("view");
              setIsModalOpen(true);
              setModalType("person");
            }}
            onAssignMember={(personId, familyId) => {
              console.log("Assign member:", personId, "to family:", familyId);
            }}
            onRemoveMember={(personId, familyId) => {
              console.log("Remove member:", personId, "from family:", familyId);
            }}
          />
        )}

        {activeTab === "clusters" && (
          <div className="space-y-6">
            {clustersLoading ? (
              <p className="text-sm text-gray-500 mt-4">Loading…</p>
            ) : (
              <div className="">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <div className="w-8 h-8 chip-primary-surface rounded-lg flex items-center justify-center">
                          <svg
                            className="w-4 h-4 text-primary"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                            />
                          </svg>
                        </div>
                      </div>
                      <div className="ml-3">
                        <p className="text-sm font-medium text-gray-500">
                          Total Clusters
                        </p>
                        <p className="text-2xl font-semibold text-gray-900">
                          {allClusters.length}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <div className="w-8 h-8 chip-green-surface rounded-lg flex items-center justify-center">
                          <svg
                            className="w-4 h-4 text-green-600"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M16 14a4 4 0 10-8 0m8 0v1a2 2 0 002 2h1m-11-3v1a2 2 0 01-2 2H5m11-10a3 3 0 11-6 0 3 3 0 016 0z"
                            />
                          </svg>
                        </div>
                      </div>
                      <div className="ml-3">
                        <p className="text-sm font-medium text-gray-500">
                          Total Members
                        </p>
                        <p className="text-2xl font-semibold text-gray-900">
                          {allClusters.reduce(
                            (acc, c) => acc + ((c as any).members?.length ?? 0),
                            0,
                          )}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <div className="w-8 h-8 chip-orange-surface rounded-lg flex items-center justify-center">
                          <svg
                            className="w-4 h-4 text-orange-600"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z"
                            />
                          </svg>
                        </div>
                      </div>
                      <div className="ml-3">
                        <p className="text-sm font-medium text-gray-500">
                          Unassigned Members
                        </p>
                        <p className="text-2xl font-semibold text-gray-900">
                          {
                            people.filter(
                              (p) =>
                                p.username !== "admin" &&
                                p.role !== "ADMIN" &&
                                !allClusters.some((c) =>
                                  (c as any).members?.includes(p.id),
                                ),
                            ).length
                          }
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Search Bar for Clusters */}
                <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6 shadow-sm mb-6">
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
                    <div className="flex-1 max-w-md">
                      <div className="relative">
                        <svg
                          className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                          />
                        </svg>
                        <input
                          type="text"
                          placeholder="Search clusters…"
                          value={clusterSearchQuery}
                          onChange={(e) =>
                            setClusterSearchQuery(e.target.value)
                          }
                          className={`w-full pl-10 py-2 min-h-[44px] border border-gray-300 rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent text-sm ${
                            clusterSearchQuery ? "pr-10" : "pr-4"
                          }`}
                        />
                        {clusterSearchQuery && (
                          <button
                            type="button"
                            onClick={() => setClusterSearchQuery("")}
                            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 min-h-[44px] min-w-[44px] flex items-center justify-center"
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
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Filter and Sort Buttons */}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:ml-4">
                      {/* Active Filters Display */}
                      {clusterActiveFilters.length > 0 && (
                        <div className="flex flex-wrap items-center gap-2">
                          {clusterActiveFilters.map((filter) => (
                            <span
                              key={filter.id}
                              className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium chip-primary"
                            >
                              {filter.label}
                              <button
                                onClick={() => {
                                  const newFilters =
                                    clusterActiveFilters.filter(
                                      (f) => f.id !== filter.id,
                                    );
                                  setClusterActiveFilters(newFilters);
                                }}
                                className="ml-1 text-primary hover:text-primary"
                              >
                                <svg
                                  className="w-3 h-3"
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
                            onClick={() => setClusterActiveFilters([])}
                            className="text-xs text-gray-500 hover:text-gray-700 min-h-[44px] px-2"
                          >
                            Clear All
                          </button>
                        </div>
                      )}

                      {/* Sort Button */}
                      <button
                        onClick={(e) =>
                          handleClusterSortDropdown(
                            (
                              e.currentTarget as HTMLButtonElement
                            ).getBoundingClientRect(),
                          )
                        }
                        className="inline-flex items-center px-3 py-2 min-h-[44px] border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ring transition-colors"
                      >
                        <svg
                          className="w-4 h-4 mr-1"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d={
                              clusterSortOrder === "asc"
                                ? "M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12"
                                : "M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12"
                            }
                          />
                        </svg>
                        Sort {clusterSortOrder === "asc" ? "↑" : "↓"}
                      </button>

                      {/* Filter Button */}
                      <button
                        onClick={(e) =>
                          handleClusterAddFilter(
                            (
                              e.currentTarget as HTMLButtonElement
                            ).getBoundingClientRect(),
                          )
                        }
                        className="inline-flex items-center px-3 py-2 min-h-[44px] border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ring transition-colors"
                      >
                        <svg
                          className="w-4 h-4 mr-1"
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

                {/* Divider */}
                <div className="border-t border-gray-200 my-6"></div>

                {clusters.length === 0 ? (
                  <p className="text-sm text-gray-500">No clusters found.</p>
                ) : (
                  <>
                    {clusterFiltering ? (
                      <div className="flex items-center justify-center py-8">
                        <div className="flex items-center gap-2 text-gray-500">
                          <svg
                            className="animate-spin h-5 w-5"
                            fill="none"
                            viewBox="0 0 24 24"
                          >
                            <circle
                              className="opacity-25"
                              cx="12"
                              cy="12"
                              r="10"
                              stroke="currentColor"
                              strokeWidth="4"
                            ></circle>
                            <path
                              className="opacity-75"
                              fill="currentColor"
                              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                            ></path>
                          </svg>
                          <span>Filtering clusters...</span>
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {clusterPaginatedData.map((c) => (
                          <ClusterCard
                            key={c.id}
                            cluster={c}
                            peopleUI={peopleUI}
                            onView={() => {
                              setViewCluster(c);
                              setClusterViewMode("view");
                              setIsModalOpen(true);
                              setModalType("cluster");
                            }}
                            onEdit={() => {
                              setEditCluster(c);
                              setClusterViewMode("edit");
                              setIsModalOpen(true);
                              setModalType("cluster");
                            }}
                            onDelete={() => confirmClusterDelete(c)}
                          />
                        ))}
                      </div>
                    )}

                    {/* Pagination */}
                    <Pagination
                      currentPage={clusterCurrentPage}
                      totalPages={clusterTotalPages}
                      onPageChange={setClusterCurrentPage}
                      itemsPerPage={clusterItemsPerPage}
                      totalItems={clusters.length}
                      onItemsPerPageChange={(newItemsPerPage) => {
                        setClusterItemsPerPage(newItemsPerPage);
                        setClusterCurrentPage(1);
                      }}
                    />
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === "reports" && (
          <ClusterReportsDashboard
            clusters={clusters}
            refreshTrigger={reportsRefreshTrigger}
          />
        )}
      </div>
      <Modal
        isOpen={
          isModalOpen &&
          !(
            isDesktop &&
            modalType === "person" &&
            activeTab === "people" &&
            viewEditPerson !== null
          )
        }
        onClose={() => {
          setIsModalOpen(false);
          setViewEditPerson(null);
          setEditFamily(null);
          setViewFamily(null);
          setFamilyViewMode("view");
          setStartOnTimelineTab(false);
          setViewCluster(null);
          setEditCluster(null);
          setClusterViewMode("view");
          setPersonDeleteConfirmation({
            isOpen: false,
            person: null,
            loading: false,
          });
        }}
        title={
          modalType === "person"
            ? viewEditPerson === null
              ? createPeopleTitle
              : viewMode === "view"
                ? ""
                : "Edit Profile"
            : modalType === "family"
              ? familyViewMode === "view"
                ? ""
                : "Edit Family"
              : modalType === "cluster"
                ? clusterViewMode === "view"
                  ? ""
                  : "Edit Cluster"
                : ""
        }
        hideHeader={
          (modalType === "person" && !!viewEditPerson && viewMode === "view") ||
          (modalType === "family" &&
            !!viewFamily &&
            familyViewMode === "view") ||
          (modalType === "cluster" &&
            !!viewCluster &&
            clusterViewMode === "view")
        }
      >
        {modalType === "person" ? (
          renderPersonFlow(false)
        ) : modalType === "family" ? (
          <>
            {viewFamily ? (
              familyViewMode === "view" ? (
                <>
                  <FamilyView
                    family={viewFamily}
                    familyMembers={peopleUI.filter((person) =>
                      (viewFamily.members ?? []).includes(person.id),
                    )}
                    clusters={clusters}
                    onViewPerson={(p) => {
                      setPersonOverCluster(p as Person);
                      setShowPersonOverCluster(true);
                    }}
                    onEdit={() => {
                      setEditFamily(viewFamily);
                      setFamilyViewMode("edit");
                    }}
                    onDelete={() => {
                      setDeleteConfirmation({
                        isOpen: true,
                        family: viewFamily,
                        loading: false,
                      });
                    }}
                    onClose={() => {
                      setIsModalOpen(false);
                      setViewFamily(null);
                      setFamilyViewMode("view");
                    }}
                    onAddMember={() => {
                      setAddFamilyMemberModal({
                        isOpen: true,
                        family: viewFamily,
                      });
                    }}
                  />
                </>
              ) : (
                <FamilyForm
                  onSubmit={handleUpdateFamily}
                  onClose={() => {
                    setFamilyViewMode("view");
                    setEditFamily(null);
                  }}
                  onDelete={(family) => {
                    setDeleteConfirmation({
                      isOpen: true,
                      family,
                      loading: false,
                    });
                  }}
                  initialData={editFamily || undefined}
                  availableMembers={peopleUI}
                  showDeleteButton={false}
                />
              )
            ) : editFamily ? (
              <FamilyForm
                onSubmit={handleUpdateFamily}
                onClose={() => {
                  setIsModalOpen(false);
                  setEditFamily(null);
                }}
                onDelete={(family) => {
                  setDeleteConfirmation({
                    isOpen: true,
                    family,
                    loading: false,
                  });
                }}
                initialData={editFamily || undefined}
                availableMembers={peopleUI}
                showDeleteButton={false}
              />
            ) : (
              <FamilyForm
                onSubmit={handleCreateFamily}
                onClose={() => setIsModalOpen(false)}
                initialData={undefined}
                availableMembers={peopleUI}
              />
            )}
          </>
        ) : modalType === "cluster" ? (
          <>
            {viewCluster && clusterViewMode === "view" ? (
              <ClusterView
                cluster={viewCluster}
                clusterMembers={peopleUI.filter((person) =>
                  (viewCluster as any).members?.includes(person.id),
                )}
                clusterFamilies={families.filter((family) =>
                  (viewCluster as any).families?.includes(family.id),
                )}
                coordinator={peopleUI.find(
                  (person) => person.id === (viewCluster as any).coordinator,
                )}
                onEdit={() => {
                  setEditCluster(viewCluster);
                  setClusterViewMode("edit");
                }}
                onDelete={() => {
                  setClusterDeleteConfirmation({
                    isOpen: true,
                    cluster: viewCluster,
                    loading: false,
                  });
                }}
                onClose={() => {
                  setIsModalOpen(false);
                  setViewCluster(null);
                }}
                onAssignMembers={() => {
                  setAssignMembersModal({
                    isOpen: true,
                    cluster: viewCluster,
                  });
                }}
                onSubmitReport={() => {
                  // Open the weekly report form on top of the current modal
                  if (viewCluster) {
                    setReportSelectedCluster(viewCluster);
                  }
                  setShowReportForm(true);
                }}
                onViewPerson={(p) => {
                  // Open person profile above the cluster view
                  setPersonOverCluster(p as Person);
                  setShowPersonOverCluster(true);
                }}
                onViewFamily={(f) => {
                  setFamilyOverCluster(f);
                  setShowFamilyOverCluster(true);
                }}
              />
            ) : editCluster ? (
              <ClusterForm
                onSubmit={handleUpdateCluster}
                onCancel={() => {
                  if (viewCluster) {
                    // If editing from view, return to view mode
                    setEditCluster(null);
                    setClusterViewMode("view");
                  } else {
                    // If editing directly, close the modal
                    setIsModalOpen(false);
                    setEditCluster(null);
                    setViewCluster(null);
                    setClusterViewMode("view");
                  }
                }}
                initialData={editCluster || undefined}
              />
            ) : (
              <ClusterForm
                onSubmit={handleCreateCluster}
                onCancel={() => setIsModalOpen(false)}
              />
            )}
          </>
        ) : (
          <ClusterForm
            onSubmit={handleCreateCluster}
            onCancel={() => setIsModalOpen(false)}
          />
        )}
      </Modal>

      <ConfirmationModal
        isOpen={deleteConfirmation.isOpen}
        onClose={closeDeleteConfirmation}
        onConfirm={handleDeleteFamily}
        title="Delete Family"
        message={`Are you sure you want to delete the "${deleteConfirmation.family?.name}" family? This action cannot be undone and will remove all family members from this family.`}
        confirmText="Delete Family"
        cancelText="Cancel"
        variant="danger"
        loading={deleteConfirmation.loading}
      />

      <ConfirmationModal
        isOpen={bulkDeleteConfirmation.isOpen}
        onClose={closeBulkDeleteConfirmation}
        onConfirm={confirmBulkDelete}
        title="Delete Selected People"
        message={`Are you sure you want to delete ${bulkDeleteConfirmation.people.length} selected people? This action cannot be undone and will permanently remove all selected people from the system.`}
        confirmText="Delete People"
        cancelText="Cancel"
        variant="danger"
        loading={bulkDeleteConfirmation.loading}
      />

      <ConfirmationModal
        isOpen={clusterDeleteConfirmation.isOpen}
        onClose={closeClusterDeleteConfirmation}
        onConfirm={handleDeleteCluster}
        title="Delete Cluster"
        message={`Are you sure you want to delete the "${clusterDeleteConfirmation.cluster?.name}" cluster? This action cannot be undone and will permanently remove this cluster from the system.`}
        confirmText="Delete Cluster"
        cancelText="Cancel"
        variant="danger"
        loading={clusterDeleteConfirmation.loading}
      />

      <ConfirmationModal
        isOpen={personDeleteConfirmation.isOpen}
        onClose={closePersonDeleteConfirmation}
        onConfirm={handleDeletePerson}
        title="Delete Person"
        message={`Are you sure you want to delete "${personDeleteConfirmation.person?.first_name} ${personDeleteConfirmation.person?.last_name}"? This action cannot be undone and will permanently remove this person from the system.`}
        confirmText="Delete Person"
        cancelText="Cancel"
        variant="danger"
        loading={personDeleteConfirmation.loading}
      />

      {assignMembersModal.cluster && (
      <AssignMembersModal
        cluster={assignMembersModal.cluster}
        peopleUI={peopleUI}
        isOpen={assignMembersModal.isOpen}
        onClose={() => setAssignMembersModal({ isOpen: false, cluster: null })}
        onAssignMembers={handleAssignMembers}
      />
    )}

      {addFamilyMemberModal.family && (
        <AddFamilyMemberModal
          family={addFamilyMemberModal.family}
          peopleUI={peopleUI}
          isOpen={addFamilyMemberModal.isOpen}
          onClose={() =>
            setAddFamilyMemberModal({ isOpen: false, family: null })
          }
          onAddMembers={handleAddFamilyMembers}
        />
      )}

      {/* Submit Weekly Report Modal (overlays View Cluster modal) */}
      {showReportForm && (
        <Modal
          isOpen={showReportForm}
          onClose={() => {
            setShowReportForm(false);
            setReportSelectedCluster(null);
          }}
          title="Submit Weekly Report"
          className="!mt-0"
        >
          <ClusterWeeklyReportForm
            cluster={reportSelectedCluster}
            clusters={clusters}
            isOpen={showReportForm}
            onClose={() => {
              setShowReportForm(false);
              setReportSelectedCluster(null);
            }}
            onSubmit={async (data) => {
              const { clusterReportsApi } = await import("@/src/lib/api");
              await clusterReportsApi.create(data as any);
              setShowReportForm(false);
              setReportSelectedCluster(null);
              // Trigger refresh of reports dashboard
              setReportsRefreshTrigger((prev) => prev + 1);
            }}
          />
        </Modal>
      )}

      {/* Person Profile Modal (overlays View Cluster modal) */}
      {showPersonOverCluster && personOverCluster && (
        <Modal
          isOpen={showPersonOverCluster}
          onClose={() => {
            setShowPersonOverCluster(false);
            setPersonOverCluster(null);
          }}
          title=""
          hideHeader
          className="!mt-0 z-[50]"
        >
          <PersonProfile
            person={personOverCluster}
            clusters={clusters}
            families={families}
            hideDeleteButton={!userCanHardDelete}
            hideEditButton={
              plainMember &&
              !!user?.id &&
              String(personOverCluster.id) !== String(user.id)
            }
            onViewFamily={(f) => {
              setFamilyOverCluster(f);
              setShowFamilyOverCluster(true);
            }}
            onViewCluster={(c) => {
              setClusterOverPerson(c);
              setShowClusterOverPerson(true);
            }}
            onNoFamilyClick={(p) => {
              setSelectFamilyModal({ isOpen: true, person: p });
            }}
            onNoClusterClick={(p) => {
              openSelectClusterForPerson(p);
            }}
            onEdit={() => {
              // Switch to edit within this overlay
              setIsModalOpen(false);
              setShowPersonOverCluster(false);
              setViewEditPerson(personOverCluster);
              setViewMode("edit");
              setStartOnTimelineTab(false);
              setModalType("person");
              setIsModalOpen(true);
            }}
            onDelete={() => {
              setPersonDeleteConfirmation({
                isOpen: true,
                person: personOverCluster,
                loading: false,
              });
            }}
            onAddTimeline={() => {
              setIsModalOpen(false);
              setShowPersonOverCluster(false);
              setViewEditPerson(personOverCluster);
              setViewMode("edit");
              setStartOnTimelineTab(true);
              setModalType("person");
              setIsModalOpen(true);
            }}
            onClose={() => {
              setShowPersonOverCluster(false);
              setPersonOverCluster(null);
            }}
          />
        </Modal>
      )}

      {/* Family View Modal (overlays View Cluster modal) */}
      {showFamilyOverCluster && familyOverCluster && (
        <Modal
          isOpen={showFamilyOverCluster}
          onClose={() => {
            setShowFamilyOverCluster(false);
            setFamilyOverCluster(null);
          }}
          title=""
          hideHeader
          className="!mt-0 z-[50]"
        >
          <FamilyView
            family={familyOverCluster}
            familyMembers={peopleUI.filter((p) =>
              (familyOverCluster.members ?? []).includes(p.id),
            )}
            clusters={clusters}
            onEdit={() => {
              setEditFamilyOverlay(familyOverCluster);
              setShowEditFamilyOverlay(true);
            }}
            onDelete={() => {
              setDeleteConfirmation({
                isOpen: true,
                family: familyOverCluster,
                loading: false,
              });
            }}
            onClose={() => {
              setShowFamilyOverCluster(false);
              setFamilyOverCluster(null);
            }}
          />
        </Modal>
      )}

      {/* Cluster View Modal (overlays Person/Family modals) */}
      {showClusterOverPerson && clusterOverPerson && (
        <Modal
          isOpen={showClusterOverPerson}
          onClose={() => {
            setShowClusterOverPerson(false);
            setClusterOverPerson(null);
          }}
          title=""
          hideHeader
          className="!mt-0 z-[50]"
        >
          <ClusterView
            cluster={clusterOverPerson}
            clusterMembers={peopleUI.filter((p) =>
              ((clusterOverPerson as any).members || []).includes(p.id),
            )}
            clusterFamilies={families.filter((f) =>
              ((clusterOverPerson as any).families || []).includes(f.id),
            )}
            coordinator={peopleUI.find(
              (p) => p.id === (clusterOverPerson as any).coordinator,
            )}
            onEdit={() => {
              setEditClusterOverlay(clusterOverPerson);
              setShowEditClusterOverlay(true);
            }}
            onDelete={() => {}}
            onClose={() => {
              setShowClusterOverPerson(false);
              setClusterOverPerson(null);
            }}
            onAssignMembers={() => {
              setAssignMembersModal({
                isOpen: true,
                cluster: clusterOverPerson,
              });
            }}
            onSubmitReport={() => {
              setReportSelectedCluster(clusterOverPerson);
              setShowReportForm(true);
            }}
            onViewFamily={(f) => {
              setFamilyOverCluster(f);
              setShowFamilyOverCluster(true);
            }}
          />
        </Modal>
      )}

      {/* Edit Cluster Overlay Modal (top-most) */}
      {showEditClusterOverlay && editClusterOverlay && (
        <Modal
          isOpen={showEditClusterOverlay}
          onClose={() => {
            setShowEditClusterOverlay(false);
            setEditClusterOverlay(null);
          }}
          title="Edit Cluster"
          className="!mt-0 z-[50]"
        >
          <ClusterForm
            onSubmit={async (data) => {
              // Directly update the cluster in overlay context
              if (editClusterOverlay) {
                const prevMembers =
                  (editClusterOverlay as { members?: unknown }).members || [];
                await clustersApi.update(editClusterOverlay.id, data as any);
                await fetchClusters();
                if ((data as { members?: unknown }).members !== undefined) {
                  await refreshOpenPersonProfilesAfterClusterMemberChange(
                    prevMembers as Array<string | number>,
                    (data as { members?: Array<string | number> }).members,
                  );
                }
                try {
                  const refreshed = await clustersApi.getById(
                    editClusterOverlay.id,
                  );
                  setClusterOverPerson(refreshed.data);
                } catch (e) {
                  // noop
                }
              }
              setShowEditClusterOverlay(false);
              setEditClusterOverlay(null);
            }}
            onCancel={() => {
              setShowEditClusterOverlay(false);
              setEditClusterOverlay(null);
            }}
            initialData={editClusterOverlay}
          />
        </Modal>
      )}

      {/* Edit Family Overlay Modal (top-most) */}
      {showEditFamilyOverlay && editFamilyOverlay && (
        <Modal
          isOpen={showEditFamilyOverlay}
          onClose={() => {
            setShowEditFamilyOverlay(false);
            setEditFamilyOverlay(null);
          }}
          title="Edit Family"
          className="!mt-0 z-[50]"
        >
          <FamilyForm
            onSubmit={async (data) => {
              if (!editFamilyOverlay) return;
              // updateFamily returns the updated family data
              const updatedFamily = await updateFamily(
                editFamilyOverlay.id,
                data,
              );

              // Update viewFamily/familyOverCluster immediately with the response (before refresh)
              if (viewFamily && viewFamily.id === editFamilyOverlay.id) {
                setViewFamily(updatedFamily);
              }
              if (
                familyOverCluster &&
                familyOverCluster.id === editFamilyOverlay.id
              ) {
                setFamilyOverCluster(updatedFamily);
              }

              // Refresh families list in the background (don't await - let it update in background)
              refreshFamilies().catch((err) => {
                console.error("Error refreshing families:", err);
              });

              setShowEditFamilyOverlay(false);
              setEditFamilyOverlay(null);
            }}
            onClose={() => {
              setShowEditFamilyOverlay(false);
              setEditFamilyOverlay(null);
            }}
            onDelete={(family) => {
              setDeleteConfirmation({ isOpen: true, family, loading: false });
            }}
            initialData={editFamilyOverlay}
            availableMembers={peopleUI}
            showDeleteButton={false}
          />
        </Modal>
      )}

      {/* Create Family Overlay Modal */}
      {showCreateFamilyOverlay && (
        <Modal
          isOpen={showCreateFamilyOverlay}
          onClose={() => setShowCreateFamilyOverlay(false)}
          title="Create Family"
          className="!mt-0 z-[50]"
        >
          <FamilyForm
            onSubmit={async (data) => {
              await createFamily(data as any);
              await refreshFamilies();
              setShowCreateFamilyOverlay(false);
            }}
            onClose={() => setShowCreateFamilyOverlay(false)}
            initialData={undefined}
            availableMembers={peopleUI}
          />
        </Modal>
      )}

      {/* Cluster Filter Dropdown */}
      <ClusterFilterDropdown
        isOpen={showClusterFilterDropdown}
        onClose={() => setShowClusterFilterDropdown(false)}
        onSelectField={handleClusterSelectField}
        position={clusterFilterDropdownPosition}
      />

      {/* Cluster Filter Card */}
      {selectedClusterField && (
        <ClusterFilterCard
          field={selectedClusterField}
          isOpen={showClusterFilterCard}
          onClose={() => {
            setShowClusterFilterCard(false);
            setSelectedClusterField(null);
          }}
          onApplyFilter={handleClusterApplyFilter}
          position={clusterFilterCardPosition}
        />
      )}

      {/* Cluster Sort Dropdown */}
      <ClusterSortDropdown
        isOpen={showClusterSortDropdown}
        onClose={() => setShowClusterSortDropdown(false)}
        onSelectSort={handleClusterSelectSort}
        position={clusterSortDropdownPosition}
        currentSortBy={clusterSortBy}
        currentSortOrder={clusterSortOrder}
      />

      {/* Select Existing Family or Create */}
      {selectFamilyModal.isOpen && selectFamilyModal.person && (
        <Modal
          isOpen={selectFamilyModal.isOpen}
          onClose={() => setSelectFamilyModal({ isOpen: false, person: null })}
          title="Assign to Family"
          className="!mt-0 z-[50]"
        >
          <div className="space-y-3 p-1">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">
                Select an existing family
              </span>
              <button
                className="text-sm text-primary hover:text-primary"
                onClick={() => {
                  setShowCreateFamilyOverlay(true);
                }}
              >
                + Create New Family
              </button>
            </div>

            {/* Search */}
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Search families..."
                value={familySelectSearch}
                onChange={(e) => setFamilySelectSearch(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-ring focus:border-transparent"
              />
              <span className="text-xs text-gray-500 whitespace-nowrap">
                {families.length} total
              </span>
            </div>

            {(() => {
              const term = familySelectSearch.toLowerCase();
              const filtered = (
                term
                  ? families.filter((f) => f.name.toLowerCase().includes(term))
                  : families
              )
                .slice()
                .sort((a, b) => a.name.localeCompare(b.name));

              return (
                <div className="max-h-[min(60vh,32rem)] overflow-y-auto border border-gray-200 rounded-md">
                  {filtered.map((f) => (
                    <button
                      key={f.id}
                      onClick={async () => {
                        const target = f;
                        const updatedMembers = Array.from(
                          new Set([
                            ...(target.members ?? []),
                            selectFamilyModal.person!.id,
                          ]),
                        );
                        await updateFamily(target.id, {
                          name: target.name,
                          leader: target.leader || undefined,
                          members: updatedMembers,
                          address: target.address,
                          notes: target.notes,
                        });
                        await refreshFamilies();
                        await refetchDirectory();
                        let latestPerson: Person | null = null;
                        let updatedJourneys: Journey[] = [];
                        try {
                          const [personResponse, journeysResponse] =
                            await Promise.all([
                              peopleApi.getById(
                                String(selectFamilyModal.person!.id),
                              ),
                              journeysApi.getByUser(
                                String(selectFamilyModal.person!.id),
                              ),
                            ]);
                          latestPerson = personResponse.data;
                          updatedJourneys = journeysResponse.data;
                        } catch (error) {
                          console.error(
                            "Failed to refresh person details after family update:",
                            error,
                          );
                        }

                        if (latestPerson) {
                          const nextPerson: Person = {
                            ...latestPerson,
                            journeys: updatedJourneys.length
                              ? updatedJourneys
                              : latestPerson.journeys,
                          };

                          setViewEditPerson((current) =>
                            current && current.id === nextPerson.id
                              ? nextPerson
                              : current,
                          );
                          setPersonPanelPerson((current) =>
                            current && current.id === nextPerson.id
                              ? nextPerson
                              : current,
                          );
                          setPersonOverCluster((current) =>
                            current && current.id === nextPerson.id
                              ? nextPerson
                              : current,
                          );
                        }
                        setSelectFamilyModal({ isOpen: false, person: null });
                      }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 border-b last:border-b-0"
                    >
                      {f.name}{" "}
                      <span className="text-gray-500">
                        ({(f.members ?? []).length})
                      </span>
                    </button>
                  ))}
                  {filtered.length === 0 && (
                    <div className="px-3 py-6 text-sm text-gray-500 text-center">
                      No families found
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </Modal>
      )}

      {/* Select Existing Cluster or Create */}
      {selectClusterModal.isOpen && selectClusterModal.person && (
        <Modal
          isOpen={selectClusterModal.isOpen}
          onClose={() => setSelectClusterModal({ isOpen: false, person: null })}
          title="Assign to Cluster"
          className="!mt-0 z-[50]"
        >
          <div className="space-y-3 p-1">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">
                Select an existing cluster
              </span>
              <button
                className="text-sm text-primary hover:text-primary"
                onClick={() => {
                  setClusterCreateContextPerson(selectClusterModal.person!);
                  setShowCreateClusterOverlay(true);
                }}
              >
                + Create New Cluster
              </button>
            </div>

            {/* Search */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <input
                type="text"
                placeholder="Search clusters..."
                value={clusterSelectSearch}
                onChange={(e) => setClusterSelectSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    e.stopPropagation();
                  }
                }}
                className="w-full px-3 py-2 min-h-[44px] border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-ring focus:border-transparent"
              />
              <span className="text-xs text-gray-500 whitespace-nowrap flex items-center">
                {clusters.length} total
              </span>
            </div>

            {clustersLoading && (
              <div className="px-3 py-6 text-sm text-gray-500 text-center">
                Loading clusters...
              </div>
            )}
            {!clustersLoading &&
              (() => {
                const term = clusterSelectSearch.toLowerCase();
                const filtered = term
                  ? clusters.filter(
                      (c) =>
                        (c.name || "").toLowerCase().includes(term) ||
                        ((c as any).code || "").toLowerCase().includes(term),
                    )
                  : clusters;

                return (
                  <div className="max-h-[min(60vh,32rem)] overflow-y-auto border border-gray-200 rounded-md">
                    {filtered.map((c) => (
                      <button
                        type="button"
                        key={c.id}
                        onClick={async () => {
                          const target = c as any;
                          const members = Array.isArray(target.members)
                            ? target.members
                            : [];
                          const updatedMembers = Array.from(
                            new Set([
                              ...members,
                              selectClusterModal.person!.id,
                            ]),
                          );
                          await clustersApi.update(c.id, {
                            name: c.name,
                            code: (c as any).code,
                            coordinator: (c as any).coordinator,
                            families: (c as any).families || [],
                            members: updatedMembers,
                            location: (c as any).location,
                            meeting_schedule: (c as any).meeting_schedule,
                            description: c.description,
                          } as any);
                          await fetchClusters();
                          await refreshOpenPersonProfilesAfterClusterMemberChange(
                            members,
                            updatedMembers,
                          );
                          setSelectClusterModal({
                            isOpen: false,
                            person: null,
                          });
                        }}
                        className="w-full text-left px-3 py-2 min-h-[44px] text-sm hover:bg-gray-50 border-b last:border-b-0"
                      >
                        {(() => {
                          const code = (c as any).code as string | undefined;
                          const name = c.name || "Cluster";
                          return code ? (
                            <>
                              <span className="font-semibold">{code}</span>
                              {` - ${name}`}
                            </>
                          ) : (
                            name
                          );
                        })()}
                      </button>
                    ))}
                    {filtered.length === 0 && (
                      <div className="px-3 py-6 text-sm text-gray-500 text-center">
                        No clusters found
                      </div>
                    )}
                  </div>
                );
              })()}
          </div>
        </Modal>
      )}

      {/* Create Cluster Overlay Modal */}
      {showCreateClusterOverlay && (
        <Modal
          isOpen={showCreateClusterOverlay}
          onClose={() => setShowCreateClusterOverlay(false)}
          title="Create Cluster"
          className="!mt-0 z-[50]"
        >
          <ClusterForm
            onSubmit={async (data) => {
              await handleCreateCluster(data as any);
              setShowCreateClusterOverlay(false);
              // clear context
              setClusterCreateContextPerson(null);
            }}
            onCancel={() => setShowCreateClusterOverlay(false)}
            initialData={(() => {
              const p = clusterCreateContextPerson || selectClusterModal.person;
              if (!p) return undefined;
              const base: any = {
                members: [p.id],
                coordinator: p.id,
              };
              const personFamilies = families.filter((f) =>
                (f.members ?? []).includes(p.id),
              );
              const unattachedFamilyIds = personFamilies
                .filter((f) => {
                  // A family is considered attached if:
                  // 1) It is directly associated via cluster.families, or
                  // 2) Any of its members appear in any cluster's members
                  const isDirectlyAttached = clusters.some((c) =>
                    ((c as any).families || []).includes(f.id),
                  );
                  if (isDirectlyAttached) return false;
                  const anyMemberInAnyCluster = clusters.some((c) => {
                    const cm: string[] = ((c as any).members || []) as string[];
                    return f.members?.some((mid) => cm.includes(mid));
                  });
                  return !anyMemberInAnyCluster;
                })
                .map((f) => f.id);
              if (unattachedFamilyIds.length > 0) {
                base.families = unattachedFamilyIds;
              }
              return base;
            })()}
          />
        </Modal>
      )}

      {loginCredentialsModal.person && (
        <UserLoginCredentialsModal
          isOpen={loginCredentialsModal.isOpen}
          onClose={() =>
            setLoginCredentialsModal({ isOpen: false, person: null })
          }
          fullName={
            `${loginCredentialsModal.person.first_name ?? ""} ${loginCredentialsModal.person.last_name ?? ""}`.trim() ||
            loginCredentialsModal.person.username
          }
          username={loginCredentialsModal.person.username}
          temporaryPassword={loginCredentialsModal.temporaryPassword}
          variant="created"
        />
      )}
    </DashboardLayout>
  );
}
