"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useClusterReports } from "@/src/hooks/useClusters";
import { useClustersDirectory } from "@/src/hooks/useClustersDirectory";
import { usePeople } from "@/src/hooks/usePeople";
import { useFamilies } from "@/src/hooks/useFamilies";
import { ClusterContentTab } from "@/src/components/clusters/ClusterContentTabs";
import ClustersPageView from "./ClustersPageView";
import { Cluster, ClusterInput } from "@/src/types/cluster";
import { ClusterWeeklyReport, ClusterWeeklyReportInput } from "@/src/types/cluster";
import { Person, PersonUI, Family } from "@/src/types/person";
import {
  clustersApi,
  branchesApi,
  clusterReportsApi,
  peopleApi,
  familiesApi,
  type ClustersListParams,
  type ClustersSummary,
} from "@/src/lib/api";
import { filtersToClustersListParams } from "@/src/lib/clustersDirectoryParams";
import { requestNotificationsRefetch } from "@/src/lib/notificationsEvents";
import { FilterCondition } from "@/src/components/people/FilterBar";
import toast from "react-hot-toast";
import { useAuth } from "@/src/contexts/AuthContext";
import { canHardDelete } from "@/src/lib/canHardDelete";
import {
  userCanManageCluster,
  clustersForReportSubmission,
  canAccessClusterReports,
} from "@/src/lib/clusterPermissions";
import { countClusterMembersFromDetails } from "@/src/lib/clusterRoster";

type PanelEntity = "cluster" | "person" | "family";
type PanelMode = "view" | "edit" | "create";
type PanelSnapshot = {
  entity: PanelEntity;
  mode: PanelMode;
  cluster: Cluster | null;
  person: Person | null;
  family: Family | null;
};

export default function ClustersPageContainer() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const action = searchParams.get("action");
  const [activeTab, setActiveTab] = useState<ClusterContentTab>("clusters");
  
  // Cluster state
  const [clusterSearchQuery, setClusterSearchQuery] = useState("");
  const [clusterActiveFilters, setClusterActiveFilters] = useState<FilterCondition[]>([]);
  const [clusterSortBy, setClusterSortBy] = useState<string>("name");
  const [clusterSortOrder, setClusterSortOrder] = useState<"asc" | "desc">("asc");
  const [clusterCurrentPage, setClusterCurrentPage] = useState(1);
  const [clusterItemsPerPage, setClusterItemsPerPage] = useState(25);
  const [selectedClusters, setSelectedClusters] = useState<Set<string>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [showInactiveClusters, setShowInactiveClusters] = useState(false);
  const [needPeopleCatalog, setNeedPeopleCatalog] = useState(false);
  const [needFamiliesCatalog, setNeedFamiliesCatalog] = useState(false);
  const [reportClusters, setReportClusters] = useState<Cluster[]>([]);
  const [directorySummary, setDirectorySummary] = useState<ClustersSummary>({
    cluster_count: 0,
    member_count: 0,
    unassigned_count: 0,
  });
  
  // Cluster modals
  const [viewCluster, setViewCluster] = useState<Cluster | null>(null);
  const [editCluster, setEditCluster] = useState<Cluster | null>(null);
  const [clusterViewMode, setClusterViewMode] = useState<"view" | "edit">("view");
  const [isClusterModalOpen, setIsClusterModalOpen] = useState(false);
  const [clusterDeleteConfirmation, setClusterDeleteConfirmation] = useState<{
    isOpen: boolean;
    cluster: Cluster | null;
    loading: boolean;
  }>({
    isOpen: false,
    cluster: null,
    loading: false,
  });
  const [bulkDeleteConfirmation, setBulkDeleteConfirmation] = useState<{
    isOpen: boolean;
    loading: boolean;
  }>({
    isOpen: false,
    loading: false,
  });
  const [markInactiveConfirmation, setMarkInactiveConfirmation] = useState<{
    isOpen: boolean;
    cluster: Cluster | null;
    loading: boolean;
  }>({
    isOpen: false,
    cluster: null,
    loading: false,
  });
  const [bulkMarkInactiveConfirmation, setBulkMarkInactiveConfirmation] =
    useState<{
      isOpen: boolean;
      loading: boolean;
    }>({
      isOpen: false,
      loading: false,
    });
  const [assignMembersModal, setAssignMembersModal] = useState<{
    isOpen: boolean;
    cluster: Cluster | null;
  }>({
    isOpen: false,
    cluster: null,
  });
  
  // Filter/Sort dropdowns
  const [showClusterFilterDropdown, setShowClusterFilterDropdown] = useState(false);
  const [showClusterFilterCard, setShowClusterFilterCard] = useState(false);
  const [showClusterSortDropdown, setShowClusterSortDropdown] = useState(false);
  const [selectedClusterField, setSelectedClusterField] = useState<any>(null);
  const [clusterFilterMenuAnchor, setClusterFilterMenuAnchor] = useState<
    "mobile" | "desktop"
  >("mobile");
  const [clusterSortMenuAnchor, setClusterSortMenuAnchor] = useState<
    "mobile" | "desktop"
  >("mobile");
  
  // Overlay modals
  const [showClusterOverPerson, setShowClusterOverPerson] = useState(false);
  const [clusterOverPerson, setClusterOverPerson] = useState<Cluster | null>(null);
  const [showFamilyOverCluster, setShowFamilyOverCluster] = useState(false);
  const [familyOverCluster, setFamilyOverCluster] = useState<Family | null>(null);
  const [showPersonOverCluster, setShowPersonOverCluster] = useState(false);
  const [personOverCluster, setPersonOverCluster] = useState<Person | null>(null);
  const [showEditClusterOverlay, setShowEditClusterOverlay] = useState(false);
  const [editClusterOverlay, setEditClusterOverlay] = useState<Cluster | null>(null);
  const [isDesktop, setIsDesktop] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelEntity, setPanelEntity] = useState<PanelEntity>("cluster");
  const [panelMode, setPanelMode] = useState<PanelMode>("view");
  const [panelCluster, setPanelCluster] = useState<Cluster | null>(null);
  const [panelPerson, setPanelPerson] = useState<Person | null>(null);
  const [panelFamily, setPanelFamily] = useState<Family | null>(null);
  const [panelHistory, setPanelHistory] = useState<PanelSnapshot[]>([]);

  const [isReportFormOpen, setReportFormOpen] = useState(false);
  const [editingReport, setEditingReport] = useState<ClusterWeeklyReport | null>(null);
  const [reportSelectedCluster, setReportSelectedCluster] = useState<Cluster | null>(null);
  const [reportDeleteConfirmation, setReportDeleteConfirmation] = useState<{
    isOpen: boolean;
    report: ClusterWeeklyReport | null;
    loading: boolean;
  }>({
    isOpen: false,
    report: null,
    loading: false,
  });
  
  const { people, peopleUI, refreshPeople } = usePeople(needPeopleCatalog);
  const { families } = useFamilies(needFamiliesCatalog);
  const { user, isSeniorCoordinator, isModuleCoordinator } = useAuth();

  const isOnlyNonSeniorClusterCoordinator =
    isModuleCoordinator("CLUSTER", "COORDINATOR") &&
    !isSeniorCoordinator("CLUSTER");
  const hasClusterModuleWideAccess =
    user?.role === "ADMIN" ||
    isSeniorCoordinator("CLUSTER") ||
    (user?.role === "PASTOR" && !isOnlyNonSeniorClusterCoordinator);

  const clusterAuthCtx = useMemo(
    () => ({
      userId: user?.id,
      role: user?.role,
      isSeniorCoordinator,
      isModuleCoordinator,
      moduleCoordinatorAssignments: user?.module_coordinator_assignments,
    }),
    [
      user?.id,
      user?.role,
      user?.module_coordinator_assignments,
      isSeniorCoordinator,
      isModuleCoordinator,
    ],
  );

  const canAccessClusterReportsUser = useMemo(
    () => canAccessClusterReports(clusterAuthCtx, reportClusters),
    [clusterAuthCtx, reportClusters],
  );

  const {
    reports,
    loading: reportsLoading,
    error: reportsError,
    createReport,
    updateReport,
    deleteReport,
    refetch: refetchReports,
  } = useClusterReports({ enabled: canAccessClusterReportsUser });

  const canChangeClusterBranchFilter = useMemo(() => {
    if (!user) return false;
    if (user.role === "ADMIN" || user.role === "PASTOR") return true;
    return isSeniorCoordinator("CLUSTER");
  }, [user, isSeniorCoordinator]);

  const [selectedBranchId, setSelectedBranchId] = useState<string>("");
  const [branchPickerOptions, setBranchPickerOptions] = useState<
    { value: string; label: string }[]
  >([]);
  const [branchesLoading, setBranchesLoading] = useState(false);
  const [branchFilterReady, setBranchFilterReady] = useState(false);
  const clusterBranchUserIdRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (!user) {
      setSelectedBranchId("");
      setBranchFilterReady(false);
      clusterBranchUserIdRef.current = undefined;
      return;
    }
    if (clusterBranchUserIdRef.current !== user.id) {
      clusterBranchUserIdRef.current = user.id;
      setSelectedBranchId(
        user.branch != null && user.branch !== undefined
          ? String(user.branch)
          : "",
      );
    } else if (user.branch != null && user.branch !== undefined) {
      setSelectedBranchId((prev) =>
        prev === "" ? String(user.branch) : prev,
      );
    }
    setBranchFilterReady(true);
  }, [user]);

  useEffect(() => {
    if (!canChangeClusterBranchFilter) {
      setBranchPickerOptions([]);
      return;
    }
    let cancelled = false;
    setBranchesLoading(true);
    branchesApi
      .getAll({ is_active: true })
      .then((res) => {
        if (cancelled) return;
        const rows = Array.isArray(res.data) ? res.data : [];
        setBranchPickerOptions(
          rows.map((b) => ({ value: String(b.id), label: b.name })),
        );
      })
      .catch((err) => {
        console.error("Failed to load branches", err);
        if (!cancelled) setBranchPickerOptions([]);
      })
      .finally(() => {
        if (!cancelled) setBranchesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [canChangeClusterBranchFilter]);

  const clusterEditableBranchSelectOptions = useMemo(
    () => [{ value: "", label: "All branches" }, ...branchPickerOptions],
    [branchPickerOptions],
  );

  const clusterBranchFilterLabel = useMemo(() => {
    if (!selectedBranchId) return "No branch";
    if (
      user?.branch_name &&
      user.branch != null &&
      String(user.branch) === selectedBranchId
    ) {
      return user.branch_name;
    }
    const opt = branchPickerOptions.find((o) => o.value === selectedBranchId);
    return opt?.label ?? `Branch #${selectedBranchId}`;
  }, [
    selectedBranchId,
    user?.branch,
    user?.branch_name,
    branchPickerOptions,
  ]);

  const clusterReadonlyBranchSelectOptions = useMemo(() => {
    if (selectedBranchId) {
      return [{ value: selectedBranchId, label: clusterBranchFilterLabel }];
    }
    return [{ value: "", label: "No branch assigned" }];
  }, [selectedBranchId, clusterBranchFilterLabel]);

  /** First manageable cluster for scoped coordinators; module-wide users leave pick unset */
  const resolveDefaultReportCluster = useCallback((): Cluster | null => {
    if (hasClusterModuleWideAccess) {
      return null;
    }
    const sortClusters = (list: Cluster[]) =>
      [...list].sort((a, b) => {
        const la = (a.name || a.code || "").toLowerCase();
        const lb = (b.name || b.code || "").toLowerCase();
        return la.localeCompare(lb);
      });
    const forReports = clustersForReportSubmission(reportClusters, clusterAuthCtx);
    if (forReports.length > 0) {
      return sortClusters(forReports)[0];
    }
    return null;
  }, [
    reportClusters,
    hasClusterModuleWideAccess,
    clusterAuthCtx,
  ]);

  useEffect(() => {
    if (action !== "submit-report") {
      return;
    }
    setActiveTab("reports");
    setEditingReport(null);
    setReportSelectedCluster(resolveDefaultReportCluster());
    setReportFormOpen(true);
    router.replace(pathname);
  }, [action, pathname, router, resolveDefaultReportCluster]);

  const directoryFilterParams = useMemo((): ClustersListParams => {
    const params: ClustersListParams = {
      ...filtersToClustersListParams(clusterActiveFilters),
    };
    if (canChangeClusterBranchFilter && selectedBranchId) {
      params.branch_id = selectedBranchId;
    }
    if (showInactiveClusters) {
      params.include_inactive = true;
    }
    return params;
  }, [
    clusterActiveFilters,
    canChangeClusterBranchFilter,
    selectedBranchId,
    showInactiveClusters,
  ]);

  const directoryOrdering = useMemo(() => {
    const prefix = clusterSortOrder === "desc" ? "-" : "";
    return `${prefix}${clusterSortBy},id`;
  }, [clusterSortBy, clusterSortOrder]);

  const {
    clusters: directoryClusters,
    totalCount: clusterTotalCount,
    loading: clustersLoading,
    refetch: refetchDirectory,
  } = useClustersDirectory({
    search: clusterSearchQuery,
    filters: directoryFilterParams,
    page: clusterCurrentPage,
    pageSize: clusterItemsPerPage,
    ordering: directoryOrdering,
    enabled: branchFilterReady,
  });

  const clusters = directoryClusters;
  const clusterPaginatedData = directoryClusters;
  const clusterTotalPages = Math.max(
    1,
    Math.ceil(clusterTotalCount / clusterItemsPerPage) || 1,
  );

  const clustersForNestedUi = useMemo(() => {
    const byId = new Map<number, Cluster>();
    for (const c of reportClusters) {
      byId.set(c.id, c);
    }
    for (const c of directoryClusters) {
      byId.set(c.id, c);
    }
    return Array.from(byId.values());
  }, [reportClusters, directoryClusters]);

  const refetchSummary = useCallback(async () => {
    if (!branchFilterReady) return;
    try {
      const params: {
        branch_id?: string;
        include_inactive?: boolean;
      } = {};
      if (canChangeClusterBranchFilter && selectedBranchId) {
        params.branch_id = selectedBranchId;
      }
      if (showInactiveClusters) {
        params.include_inactive = true;
      }
      const res = await clustersApi.summary(
        Object.keys(params).length > 0 ? params : undefined,
      );
      setDirectorySummary(res.data);
    } catch (e) {
      console.error("Failed to load clusters summary", e);
    }
  }, [
    branchFilterReady,
    canChangeClusterBranchFilter,
    selectedBranchId,
    showInactiveClusters,
  ]);

  useEffect(() => {
    refetchSummary();
  }, [refetchSummary]);

  const refreshDirectory = useCallback(async () => {
    await Promise.all([refetchDirectory(), refetchSummary()]);
  }, [refetchDirectory, refetchSummary]);

  // Page-through clusters for report pickers / access helpers (not on directory land).
  useEffect(() => {
    if (activeTab !== "reports" && action !== "submit-report") {
      return;
    }
    let cancelled = false;
    const load = async () => {
      try {
        const params: ClustersListParams = {};
        if (canChangeClusterBranchFilter && selectedBranchId) {
          params.branch_id = selectedBranchId;
        }
        if (showInactiveClusters) {
          params.include_inactive = true;
        }
        const res = await clustersApi.getAll(
          Object.keys(params).length > 0 ? params : undefined,
        );
        if (!cancelled) {
          setReportClusters(res.data);
        }
      } catch (e) {
        console.error("Failed to load report clusters", e);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [
    activeTab,
    action,
    canChangeClusterBranchFilter,
    selectedBranchId,
    showInactiveClusters,
  ]);

  useEffect(() => {
    const syncViewport = () => {
      setIsDesktop(window.innerWidth >= 1024);
    };
    syncViewport();
    window.addEventListener("resize", syncViewport);
    return () => window.removeEventListener("resize", syncViewport);
  }, []);

  useEffect(() => {
    setClusterCurrentPage(1);
  }, [
    clusterSearchQuery,
    clusterActiveFilters,
    clusterSortBy,
    clusterSortOrder,
    selectedBranchId,
    showInactiveClusters,
  ]);

  // Cluster handlers
  const handleCreateCluster = async (data: ClusterInput) => {
    try {
      await clustersApi.create(data);
      await refreshDirectory();
      setIsClusterModalOpen(false);
      setPanelOpen(false);
      setPanelCluster(null);
      toast.success("Cluster created successfully.");
    } catch (error) {
      console.error("Error creating cluster:", error);
      toast.error(
        (error as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Failed to create cluster."
      );
      throw error;
    }
  };
  
  const handleUpdateCluster = async (data: Partial<ClusterInput>) => {
    const targetCluster = editCluster || panelCluster;
    if (!targetCluster) return;

    try {
      const updatedCluster = await clustersApi.update(targetCluster.id, data);
      const updated = updatedCluster.data;

      await refreshDirectory();

      setEditCluster(null);
      setClusterViewMode("view");

      if (isDesktop && panelOpen && panelEntity === "cluster") {
        setPanelCluster(updated);
        setPanelMode("view");
        setPanelHistory((prev) => (prev.length > 0 ? prev.slice(0, -1) : prev));
      } else {
        setViewCluster(updated);
        setIsClusterModalOpen(true);
      }

      if (clusterOverPerson?.id === updated.id) {
        setClusterOverPerson(updated);
      }

      toast.success("Cluster updated successfully.");
    } catch (error) {
      console.error("Error updating cluster:", error);
      toast.error(
        (error as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Failed to update cluster."
      );
      await refreshDirectory();
      throw error;
    }
  };

  const handleHardDeleteCluster = async () => {
    if (clusterDeleteConfirmation.cluster) {
      setClusterDeleteConfirmation((prev) => ({ ...prev, loading: true }));
      try {
        await clustersApi.delete(clusterDeleteConfirmation.cluster.id);
        await refreshDirectory();
        setClusterDeleteConfirmation({
          isOpen: false,
          cluster: null,
          loading: false,
        });
        setIsClusterModalOpen(false);
        setViewCluster(null);
        setPanelOpen(false);
        setPanelCluster(null);
      } catch (error) {
        console.error("Error deleting cluster:", error);
        setClusterDeleteConfirmation((prev) => ({ ...prev, loading: false }));
      }
    }
  };

  const handleMarkInactiveCluster = async () => {
    if (!markInactiveConfirmation.cluster) return;
    setMarkInactiveConfirmation((prev) => ({ ...prev, loading: true }));
    try {
      await clustersApi.patch(markInactiveConfirmation.cluster.id, {
        is_active: false,
      });
      await refreshDirectory();
      setMarkInactiveConfirmation({
        isOpen: false,
        cluster: null,
        loading: false,
      });
      setIsClusterModalOpen(false);
      setViewCluster(null);
      setPanelOpen(false);
      setPanelCluster(null);
      toast.success("Cluster marked as inactive.");
    } catch (error) {
      console.error("Error marking cluster inactive:", error);
      toast.error("Failed to mark cluster as inactive.");
      setMarkInactiveConfirmation((prev) => ({ ...prev, loading: false }));
    }
  };

  // Selection mode handlers
  const handleToggleSelectionMode = () => {
    setIsSelectionMode((prev) => {
      const newMode = !prev;
      // Clear selection when exiting selection mode
      if (!newMode) {
        setSelectedClusters(new Set());
      }
      return newMode;
    });
  };

  // Bulk selection handlers
  const handleSelectCluster = (clusterId: string) => {
    if (!isSelectionMode) return;
    setSelectedClusters((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(clusterId)) {
        newSet.delete(clusterId);
      } else {
        newSet.add(clusterId);
      }
      return newSet;
    });
  };

  const handleSelectAllClusters = () => {
    if (!isSelectionMode) return;
    if (selectedClusters.size === clusterPaginatedData.length) {
      setSelectedClusters(new Set());
    } else {
      setSelectedClusters(new Set(clusterPaginatedData.map((c) => c.id.toString())));
    }
  };

  // Bulk mark inactive handler
  const handleBulkMarkInactive = () => {
    if (selectedClusters.size === 0) return;
    setBulkMarkInactiveConfirmation({ isOpen: true, loading: false });
  };

  const confirmBulkMarkInactiveClusters = async () => {
    if (selectedClusters.size === 0) return;

    try {
      setBulkMarkInactiveConfirmation((prev) => ({ ...prev, loading: true }));
      await Promise.all(
        Array.from(selectedClusters).map((clusterId) =>
          clustersApi.patch(Number(clusterId), { is_active: false }),
        ),
      );
      await refreshDirectory();
      setSelectedClusters(new Set());
      setIsSelectionMode(false);
      setBulkMarkInactiveConfirmation({ isOpen: false, loading: false });
      toast.success("Selected clusters marked as inactive.");
    } catch (error) {
      console.error("Error marking clusters inactive:", error);
      alert("Failed to mark some clusters as inactive. Please try again.");
      setBulkMarkInactiveConfirmation((prev) => ({ ...prev, loading: false }));
    }
  };

  // Bulk delete handler (admin only)
  const handleBulkDelete = () => {
    if (selectedClusters.size === 0) return;
    setBulkDeleteConfirmation({ isOpen: true, loading: false });
  };

  const confirmBulkDeleteClusters = async () => {
    if (selectedClusters.size === 0) return;

    try {
      setBulkDeleteConfirmation((prev) => ({ ...prev, loading: true }));
      const deletePromises = Array.from(selectedClusters).map((clusterId) =>
        clustersApi.delete(Number(clusterId))
      );
      await Promise.all(deletePromises);
      await refreshDirectory();
      setSelectedClusters(new Set());
      setIsSelectionMode(false);
      setBulkDeleteConfirmation({ isOpen: false, loading: false });
    } catch (error) {
      console.error("Error deleting clusters:", error);
      alert("Failed to delete some clusters. Please try again.");
      setBulkDeleteConfirmation((prev) => ({ ...prev, loading: false }));
    }
  };

  // Bulk export handlers
  const handleBulkExport = async (format: "excel" | "pdf" | "csv") => {
    const clustersToExport = clusters.filter((c) =>
      selectedClusters.has(c.id.toString())
    );

    if (clustersToExport.length === 0) {
      alert("Please select at least one cluster to export.");
      return;
    }

    // Import export libraries dynamically
    const XLSX = await import("xlsx");
    const { jsPDF } = await import("jspdf");
    const autoTable = (await import("jspdf-autotable")).default;

    // Prepare data
    const exportData = clustersToExport.map((cluster) => {
      const coordinator = peopleUI.find(
        (p) =>
          p.id === (cluster as any).coordinator?.id?.toString() ||
          p.id === (cluster as any).coordinator_id?.toString()
      );
      const coordinatorName = coordinator
        ? `${coordinator.first_name} ${coordinator.last_name}`
        : cluster.coordinator
          ? `${cluster.coordinator.first_name} ${cluster.coordinator.last_name}`
          : "N/A";

      const { memberCount, visitorCount } = countClusterMembersFromDetails(
        cluster,
        peopleUI
      );

      return {
        Code: cluster.code || "",
        Name: cluster.name || "",
        Location: (cluster as any).location || "",
        "Meeting Schedule": (cluster as any).meeting_schedule || "",
        Coordinator: coordinatorName,
        "Member Count": memberCount,
        "Visitor Count": visitorCount,
        "Family Count": (cluster as any).families?.length || 0,
        Description: cluster.description || "",
      };
    });

    switch (format) {
      case "excel": {
        const worksheet = XLSX.utils.json_to_sheet(exportData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Clusters");
        XLSX.writeFile(workbook, "clusters_data.xlsx");
        break;
      }
      case "pdf": {
        const doc = new jsPDF();
        const tableColumn = [
          "Code",
          "Name",
          "Location",
          "Meeting Schedule",
          "Coordinator",
          "Member Count",
          "Visitor Count",
          "Family Count",
        ];
        const tableRows = exportData.map((row) => [
          row.Code,
          row.Name,
          row.Location,
          row["Meeting Schedule"],
          row.Coordinator,
          row["Member Count"].toString(),
          row["Visitor Count"].toString(),
          row["Family Count"].toString(),
        ]);

        autoTable(doc, {
          head: [tableColumn],
          body: tableRows,
          startY: 20,
          theme: "grid",
          styles: { fontSize: 8 },
        });

        doc.save("clusters_data.pdf");
        break;
      }
      case "csv": {
        const csvContent = exportData
          .map((row) =>
            [
              row.Code,
              row.Name,
              row.Location,
              row["Meeting Schedule"],
              row.Coordinator,
              row["Member Count"],
              row["Visitor Count"],
              row["Family Count"],
              row.Description,
            ].join(",")
          )
          .join("\n");

        const blob = new Blob(
          [
            `Code,Name,Location,Meeting Schedule,Coordinator,Member Count,Visitor Count,Family Count,Description\n${csvContent}`,
          ],
          {
            type: "text/csv;charset=utf-8;",
          }
        );
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = "clusters_data.csv";
        link.click();
        break;
      }
    }
  };
  
  const confirmMarkInactiveCluster = (cluster: Cluster) => {
    setMarkInactiveConfirmation({
      isOpen: true,
      cluster,
      loading: false,
    });
  };

  const confirmHardDeleteCluster = (cluster: Cluster) => {
    setClusterDeleteConfirmation({
      isOpen: true,
      cluster,
      loading: false,
    });
  };

  const closeClusterPanel = useCallback(() => {
    setPanelOpen(false);
    setPanelEntity("cluster");
    setPanelMode("view");
    setPanelCluster(null);
    setPanelPerson(null);
    setPanelFamily(null);
    setPanelHistory([]);
  }, []);

  const pushCurrentPanelToHistory = useCallback(() => {
    if (!panelOpen) return;
    setPanelHistory((prev) => [
      ...prev,
      {
        entity: panelEntity,
        mode: panelMode,
        cluster: panelCluster,
        person: panelPerson,
        family: panelFamily,
      },
    ]);
  }, [panelOpen, panelEntity, panelMode, panelCluster, panelPerson, panelFamily]);

  const restorePanelSnapshot = useCallback((snapshot: PanelSnapshot) => {
    setPanelOpen(true);
    setPanelEntity(snapshot.entity);
    setPanelMode(snapshot.mode);
    setPanelCluster(snapshot.cluster);
    setPanelPerson(snapshot.person);
    setPanelFamily(snapshot.family);
  }, []);

  const goBackClusterPanel = useCallback(() => {
    let previousSnapshot: PanelSnapshot | null = null;
    setPanelHistory((prev) => {
      if (prev.length === 0) return prev;
      previousSnapshot = prev[prev.length - 1];
      return prev.slice(0, -1);
    });

    if (previousSnapshot) {
      restorePanelSnapshot(previousSnapshot);
      return;
    }

    closeClusterPanel();
  }, [closeClusterPanel, restorePanelSnapshot]);

  const handleCancelClusterEdit = useCallback(() => {
    if (isDesktop) {
      goBackClusterPanel();
      return;
    }
    if (viewCluster || editCluster) {
      setEditCluster(null);
      setClusterViewMode("view");
      return;
    }
    setIsClusterModalOpen(false);
    setViewCluster(null);
    setClusterViewMode("view");
  }, [isDesktop, goBackClusterPanel, viewCluster, editCluster]);

  const openClusterInteraction = useCallback(
    async (mode: PanelMode, cluster?: Cluster | null) => {
      if (mode === "create" || mode === "edit") {
        setNeedPeopleCatalog(true);
        setNeedFamiliesCatalog(true);
      }

      let resolved = cluster || null;
      if (resolved && (resolved.members == null || resolved.families == null)) {
        try {
          const res = await clustersApi.getById(resolved.id);
          resolved = res.data;
        } catch (e) {
          console.error("Failed to load cluster detail", e);
        }
      }

      if (isDesktop) {
        pushCurrentPanelToHistory();
        setIsClusterModalOpen(false);
        setPanelOpen(true);
        setPanelEntity("cluster");
        setPanelMode(mode);
        setPanelCluster(resolved);
        setPanelPerson(null);
        setPanelFamily(null);
        return;
      }

      if (mode === "view" && resolved) {
        setViewCluster(resolved);
        setEditCluster(null);
        setClusterViewMode("view");
      } else if (mode === "edit" && resolved) {
        setEditCluster(resolved);
        setViewCluster(resolved);
        setClusterViewMode("edit");
      } else {
        setEditCluster(null);
        setViewCluster(null);
        setClusterViewMode("edit");
      }
      setIsClusterModalOpen(true);
    },
    [isDesktop, pushCurrentPanelToHistory]
  );

  const openClusterId = searchParams.get("open");

  useEffect(() => {
    if (!openClusterId) {
      return;
    }

    let cancelled = false;

    const openFromGlobalSearch = async () => {
      try {
        const response = await clustersApi.getById(openClusterId);
        if (!cancelled) {
          openClusterInteraction("view", response.data);
        }
      } catch {
        // Cluster may be inaccessible; still clear the query param.
      } finally {
        if (!cancelled) {
          router.replace(pathname);
        }
      }
    };

    openFromGlobalSearch();

    return () => {
      cancelled = true;
    };
  }, [openClusterId, openClusterInteraction, pathname, router]);

  useEffect(() => {
    const tab = searchParams.get("tab");
    const clusterId = searchParams.get("cluster");
    const reportId = searchParams.get("report");

    if (tab === "reports" && !canAccessClusterReportsUser) {
      setActiveTab("clusters");
      if (clusterId || reportId) {
        router.replace(pathname);
      }
      return;
    }

    if (tab === "reports") {
      setActiveTab("reports");
    }

    if (!clusterId && !reportId) {
      return;
    }

    if (!canAccessClusterReportsUser) {
      return;
    }

    let cancelled = false;

    const handleNotificationDeepLink = async () => {
      setActiveTab("reports");

      if (reportId) {
        try {
          const response = await clusterReportsApi.getById(reportId);
          if (!cancelled) {
            setEditingReport(response.data);
            setReportFormOpen(true);
            let cluster = reportClusters.find(
              (c) => c.id === response.data.cluster,
            );
            if (!cluster) {
              try {
                const clRes = await clustersApi.getById(response.data.cluster);
                cluster = clRes.data;
              } catch {
                cluster = undefined;
              }
            }
            if (cluster) {
              setReportSelectedCluster(cluster);
            }
          }
        } catch {
          // Report may be inaccessible.
        } finally {
          if (!cancelled) {
            router.replace(pathname);
          }
        }
      } else if (clusterId) {
        let cluster = reportClusters.find((c) => String(c.id) === clusterId);
        if (!cluster) {
          try {
            const clRes = await clustersApi.getById(clusterId);
            cluster = clRes.data;
          } catch {
            cluster = undefined;
          }
        }
        if (!cancelled && cluster) {
          setReportSelectedCluster(cluster);
          setEditingReport(null);
          setReportFormOpen(true);
          router.replace(pathname);
        }
      }
    };

    handleNotificationDeepLink();

    return () => {
      cancelled = true;
    };
  }, [searchParams, reportClusters, pathname, router, canAccessClusterReportsUser]);

  const openPersonInPanel = useCallback(
    async (person: Person) => {
      let resolved = person;
      if (!Array.isArray(person.journeys)) {
        try {
          const { data } = await peopleApi.getById(String(person.id));
          resolved = data;
        } catch (e) {
          console.error("Failed to load person detail", e);
        }
      }
      if (isDesktop) {
        pushCurrentPanelToHistory();
        setPanelOpen(true);
        setPanelEntity("person");
        setPanelMode("view");
        setPanelPerson(resolved);
        setPanelCluster(null);
        setPanelFamily(null);
        return;
      }
      setPersonOverCluster(resolved);
      setShowPersonOverCluster(true);
    },
    [isDesktop, pushCurrentPanelToHistory]
  );

  const openFamilyInPanel = useCallback(
    async (family: Family) => {
      setNeedFamiliesCatalog(true);
      let resolved = family;
      if (family.members == null || family.members_details == null) {
        try {
          const { data } = await familiesApi.getById(String(family.id));
          resolved = data;
        } catch (e) {
          console.error("Failed to load family detail", e);
        }
      }
      if (isDesktop) {
        pushCurrentPanelToHistory();
        setPanelOpen(true);
        setPanelEntity("family");
        setPanelMode("view");
        setPanelFamily(resolved);
        setPanelCluster(null);
        setPanelPerson(null);
        return;
      }
      setFamilyOverCluster(resolved);
      setShowFamilyOverCluster(true);
    },
    [isDesktop, pushCurrentPanelToHistory]
  );
  
  const handleAssignMembers = async (memberIds: number[]) => {
    if (assignMembersModal.cluster) {
      try {
        // List/slim rows omit members/families; hydrate so we never wipe on replace.
        let cluster = assignMembersModal.cluster;
        if (cluster.members == null || cluster.families == null) {
          const res = await clustersApi.getById(cluster.id);
          cluster = res.data;
        }
        const updatedCluster = await clustersApi.update(cluster.id, {
          members: memberIds,
          families: cluster.families ?? [],
        } as Partial<ClusterInput>);

        const returnedIdSet = new Set(
          (updatedCluster.data.members ?? []).map((id) => String(id))
        );
        const notAssigned = memberIds.filter(
          (id) => !returnedIdSet.has(String(id))
        );
        if (notAssigned.length > 0) {
          alert(
            "Some members could not be assigned because they belong to a different branch than this cluster."
          );
        }
        
        await refreshDirectory();
        
        // Update viewCluster if it's the same cluster
        if (viewCluster && viewCluster.id === assignMembersModal.cluster.id) {
          setViewCluster(updatedCluster.data);
        }

        // Update panel cluster if it's the same cluster (desktop side panel)
        if (panelCluster && panelCluster.id === assignMembersModal.cluster.id) {
          setPanelCluster(updatedCluster.data);
        }
        
        // Update clusterOverPerson if it's the same cluster
        if (clusterOverPerson && clusterOverPerson.id === assignMembersModal.cluster.id) {
          setClusterOverPerson(updatedCluster.data);
        }
        
        setAssignMembersModal({ isOpen: false, cluster: null });
      } catch (error) {
        console.error("Error assigning members:", error);
        // On error, refetch to ensure consistency
        await refreshDirectory();
        throw error;
      }
    }
  };
  
  // Filter handlers
  const handleClusterAddFilter = (anchor: "mobile" | "desktop") => {
    setShowClusterSortDropdown(false);
    if (
      (showClusterFilterDropdown || showClusterFilterCard) &&
      clusterFilterMenuAnchor === anchor
    ) {
      setShowClusterFilterDropdown(false);
      setShowClusterFilterCard(false);
      setSelectedClusterField(null);
      return;
    }
    setShowClusterFilterCard(false);
    setSelectedClusterField(null);
    setClusterFilterMenuAnchor(anchor);
    setShowClusterFilterDropdown(true);
  };

  const handleClusterSelectField = (field: any) => {
    setSelectedClusterField(field);
    setShowClusterFilterDropdown(false);
    setShowClusterFilterCard(true);
  };

  const handleClusterApplyFilter = (filter: FilterCondition) => {
    setClusterActiveFilters((prev) => [...prev, filter]);
    setShowClusterFilterCard(false);
    setSelectedClusterField(null);
  };

  const handleClusterSortDropdown = (anchor: "mobile" | "desktop") => {
    setShowClusterFilterDropdown(false);
    setShowClusterFilterCard(false);
    setSelectedClusterField(null);
    if (showClusterSortDropdown && clusterSortMenuAnchor === anchor) {
      setShowClusterSortDropdown(false);
    } else {
      setClusterSortMenuAnchor(anchor);
      setShowClusterSortDropdown(true);
    }
  };

  const handleClusterSelectSort = (sortBy: string, sortOrder: "asc" | "desc") => {
    setClusterSortBy(sortBy);
    setClusterSortOrder(sortOrder);
    setShowClusterSortDropdown(false);
  };
  
  // Report handlers
  const syncClusterDetailsAfterReport = async (clusterId?: number) => {
    if (!clusterId) return;
    await refreshDirectory();
    try {
      const updated = await clustersApi.getById(clusterId);
      setViewCluster((prev) => (prev?.id === clusterId ? updated.data : prev));
      setPanelCluster((prev) => (prev?.id === clusterId ? updated.data : prev));
    } catch (error) {
      console.error("Failed to refresh cluster after report save", error);
    }
  };

  const handleCreateReport = async (data: ClusterWeeklyReportInput) => {
    try {
      await createReport(data);
      await syncClusterDetailsAfterReport(data.cluster);
      setReportFormOpen(false);
      setReportSelectedCluster(null);
      refetchReports();
      requestNotificationsRefetch();
    } catch (error: any) {
      throw error;
    }
  };
  
  const handleUpdateReport = async (id: number, data: Partial<ClusterWeeklyReportInput>) => {
    try {
      await updateReport(id, data);
      await syncClusterDetailsAfterReport(data.cluster);
      setEditingReport(null);
      setReportFormOpen(false);
      refetchReports();
      requestNotificationsRefetch();
    } catch (error: any) {
      throw error;
    }
  };
  
  const handleDeleteReport = async () => {
    if (reportDeleteConfirmation.report) {
      setReportDeleteConfirmation((prev) => ({ ...prev, loading: true }));
      try {
        await deleteReport(reportDeleteConfirmation.report.id);
        setReportDeleteConfirmation({
          isOpen: false,
          report: null,
          loading: false,
        });
      } catch (error) {
        console.error("Error deleting report:", error);
        setReportDeleteConfirmation((prev) => ({ ...prev, loading: false }));
      }
    }
  };
  
  const confirmReportDelete = (report: ClusterWeeklyReport) => {
    setReportDeleteConfirmation({
      isOpen: true,
      report,
      loading: false,
    });
  };
  
  return (
    <ClustersPageView
      activeTab={activeTab}
      onTabChange={setActiveTab}
      canAccessClusterReports={canAccessClusterReportsUser}
      // Clusters tab
      allClusters={clustersForNestedUi}
      clusters={clusters}
      clustersLoading={clustersLoading}
      clusterTotalCount={clusterTotalCount}
      summaryClusterCount={directorySummary.cluster_count}
      summaryMemberCount={directorySummary.member_count}
      summaryUnassignedCount={directorySummary.unassigned_count}
      onNeedPeopleCatalog={() => setNeedPeopleCatalog(true)}
      onNeedFamiliesCatalog={() => setNeedFamiliesCatalog(true)}
      clusterSearchQuery={clusterSearchQuery}
      onClusterSearchChange={setClusterSearchQuery}
      clusterBranchSelectedId={selectedBranchId}
      onClusterBranchChange={setSelectedBranchId}
      clusterBranchCanChangeFilter={canChangeClusterBranchFilter}
      clusterBranchEditableOptions={clusterEditableBranchSelectOptions}
      clusterBranchReadonlyOptions={clusterReadonlyBranchSelectOptions}
      clusterBranchesLoading={branchesLoading}
      clusterActiveFilters={clusterActiveFilters}
      onClusterFilterRemove={(filterId) => {
        setClusterActiveFilters((prev) => prev.filter((f) => f.id !== filterId));
      }}
      onClusterClearFilters={() => setClusterActiveFilters([])}
      clusterSortBy={clusterSortBy}
      clusterSortOrder={clusterSortOrder}
      clusterPaginatedData={clusterPaginatedData}
      clusterCurrentPage={clusterCurrentPage}
      clusterTotalPages={clusterTotalPages}
      clusterItemsPerPage={clusterItemsPerPage}
      onClusterPageChange={setClusterCurrentPage}
      onClusterItemsPerPageChange={(size) => {
        setClusterItemsPerPage(size);
        setClusterCurrentPage(1);
      }}
      onClusterAddFilter={handleClusterAddFilter}
      onClusterSortDropdown={handleClusterSortDropdown}
      showClusterFilterDropdown={showClusterFilterDropdown}
      showClusterFilterCard={showClusterFilterCard}
      showClusterSortDropdown={showClusterSortDropdown}
      selectedClusterField={selectedClusterField}
      clusterFilterMenuAnchor={clusterFilterMenuAnchor}
      clusterSortMenuAnchor={clusterSortMenuAnchor}
      onClusterSelectField={handleClusterSelectField}
      onClusterApplyFilter={handleClusterApplyFilter}
      onClusterSelectSort={handleClusterSelectSort}
      onCloseClusterFilterDropdown={() => setShowClusterFilterDropdown(false)}
      onCloseClusterSortDropdown={() => setShowClusterSortDropdown(false)}
      onCloseClusterFilterCard={() => {
        setShowClusterFilterCard(false);
        setSelectedClusterField(null);
      }}
      onViewCluster={(cluster) => {
        openClusterInteraction("view", cluster);
      }}
      onEditCluster={(cluster) => {
        openClusterInteraction("edit", cluster);
      }}
      onMarkInactiveCluster={confirmMarkInactiveCluster}
      onHardDeleteCluster={
        canHardDelete(user) ? confirmHardDeleteCluster : undefined
      }
      showInactiveClusters={showInactiveClusters}
      onShowInactiveClustersChange={setShowInactiveClusters}
      onCreateCluster={() => {
        openClusterInteraction("create");
      }}
      viewCluster={viewCluster}
      editCluster={editCluster}
      clusterViewMode={clusterViewMode}
      isClusterModalOpen={isClusterModalOpen}
      onCloseClusterModal={() => {
        setIsClusterModalOpen(false);
        setViewCluster(null);
        setEditCluster(null);
        setClusterViewMode("view");
        closeClusterPanel();
      }}
      onCancelClusterEdit={handleCancelClusterEdit}
      isDesktop={isDesktop}
      panelOpen={panelOpen}
      panelEntity={panelEntity}
      panelMode={panelMode}
      panelCluster={panelCluster}
      panelPerson={panelPerson}
      panelFamily={panelFamily}
      onCloseClusterPanel={closeClusterPanel}
      onBackClusterPanel={goBackClusterPanel}
      clusterDeleteConfirmation={clusterDeleteConfirmation}
      onConfirmDeleteCluster={handleHardDeleteCluster}
      onCloseDeleteConfirmation={() => {
        setClusterDeleteConfirmation({
          isOpen: false,
          cluster: null,
          loading: false,
        });
      }}
      onCreateClusterSubmit={handleCreateCluster}
      onUpdateClusterSubmit={handleUpdateCluster}
      assignMembersModal={assignMembersModal}
      onAssignMembers={handleAssignMembers}
      onCloseAssignMembers={() => setAssignMembersModal({ isOpen: false, cluster: null })}
      onOpenAssignMembers={async (cluster) => {
        setNeedPeopleCatalog(true);
        let resolved = cluster;
        if (resolved.members == null || resolved.families == null) {
          try {
            const res = await clustersApi.getById(resolved.id);
            resolved = res.data;
          } catch (e) {
            console.error("Failed to load cluster detail for assign members", e);
          }
        }
        setAssignMembersModal({ isOpen: true, cluster: resolved });
      }}
      // Overlay modals
      showClusterOverPerson={showClusterOverPerson}
      clusterOverPerson={clusterOverPerson}
      onCloseClusterOverPerson={() => {
        setShowClusterOverPerson(false);
        setClusterOverPerson(null);
      }}
      showFamilyOverCluster={showFamilyOverCluster}
      familyOverCluster={familyOverCluster}
      onCloseFamilyOverCluster={() => {
        setShowFamilyOverCluster(false);
        setFamilyOverCluster(null);
      }}
      showPersonOverCluster={showPersonOverCluster}
      personOverCluster={personOverCluster}
      onClosePersonOverCluster={() => {
        setShowPersonOverCluster(false);
        setPersonOverCluster(null);
      }}
      showEditClusterOverlay={showEditClusterOverlay}
      editClusterOverlay={editClusterOverlay}
      onCloseEditClusterOverlay={() => {
        setShowEditClusterOverlay(false);
        setEditClusterOverlay(null);
      }}
      onOpenEditClusterOverlay={async (cluster) => {
        let resolved = cluster;
        if (resolved.members == null || resolved.families == null) {
          try {
            const res = await clustersApi.getById(resolved.id);
            resolved = res.data;
          } catch (e) {
            console.error("Failed to load cluster detail for edit overlay", e);
          }
        }
        setEditClusterOverlay(resolved);
        setShowEditClusterOverlay(true);
      }}
      onUpdateClusterOverlay={async (data) => {
        if (editClusterOverlay) {
          try {
            const updated = await clustersApi.update(editClusterOverlay.id, data);
            
            await refreshDirectory();
            
            // Update clusterOverPerson if it's the same cluster
            if (clusterOverPerson && clusterOverPerson.id === editClusterOverlay.id) {
              setClusterOverPerson(updated.data);
            }
            
            // Update viewCluster if it's the same cluster
            if (viewCluster && viewCluster.id === editClusterOverlay.id) {
              setViewCluster(updated.data);
            }

            if (panelCluster?.id === editClusterOverlay.id) {
              setPanelCluster(updated.data);
            }

            setShowEditClusterOverlay(false);
            setEditClusterOverlay(null);
            toast.success("Cluster updated successfully.");
          } catch (error) {
            console.error("Error updating cluster overlay:", error);
            toast.error(
              (error as { response?: { data?: { message?: string } } })?.response?.data
                ?.message || "Failed to update cluster."
            );
            // On error, refetch to ensure consistency
            await refreshDirectory();
            throw error;
          }
        }
      }}
      // Reports tab
      reports={reports}
      reportsLoading={reportsLoading}
      reportsError={reportsError}
      isReportFormOpen={isReportFormOpen}
      onOpenReportForm={(cluster) => {
        setEditingReport(null);
        setReportSelectedCluster(
          cluster != null ? cluster : resolveDefaultReportCluster(),
        );
        setReportFormOpen(true);
      }}
      onCloseReportForm={() => {
        setReportFormOpen(false);
        setEditingReport(null);
        setReportSelectedCluster(null);
      }}
      editingReport={editingReport}
      onEditReport={(report) => {
        const cluster = reportClusters.find((c) => c.id === report.cluster);
        setReportSelectedCluster(cluster || null);
        setEditingReport(report);
        setReportFormOpen(true);
      }}
      reportSelectedCluster={reportSelectedCluster}
      onSetReportSelectedCluster={setReportSelectedCluster}
      onCreateReport={handleCreateReport}
      onUpdateReport={handleUpdateReport}
      onDeleteReport={confirmReportDelete}
      reportDeleteConfirmation={reportDeleteConfirmation}
      onConfirmDeleteReport={handleDeleteReport}
      onCloseReportDeleteConfirmation={() => {
        setReportDeleteConfirmation({
          isOpen: false,
          report: null,
          loading: false,
        });
      }}
      onViewFamily={(f) => {
        openFamilyInPanel(f);
      }}
      onViewPerson={(p) => {
        openPersonInPanel(p);
      }}
      // Data
      people={people}
      peopleUI={peopleUI}
      families={families}
      // Bulk selection
      selectedClusters={selectedClusters}
      isSelectionMode={isSelectionMode}
      onToggleSelectionMode={handleToggleSelectionMode}
      onSelectCluster={handleSelectCluster}
      onSelectAllClusters={handleSelectAllClusters}
      markInactiveConfirmation={markInactiveConfirmation}
      onConfirmMarkInactiveCluster={handleMarkInactiveCluster}
      onCloseMarkInactiveConfirmation={() => {
        setMarkInactiveConfirmation({
          isOpen: false,
          cluster: null,
          loading: false,
        });
      }}
      onBulkMarkInactive={handleBulkMarkInactive}
      bulkMarkInactiveConfirmation={bulkMarkInactiveConfirmation}
      onConfirmBulkMarkInactiveClusters={confirmBulkMarkInactiveClusters}
      onCloseBulkMarkInactiveConfirmation={() =>
        setBulkMarkInactiveConfirmation({ isOpen: false, loading: false })
      }
      onBulkDelete={canHardDelete(user) ? handleBulkDelete : undefined}
      onBulkExport={handleBulkExport}
      bulkDeleteConfirmation={bulkDeleteConfirmation}
      selectedClustersCount={selectedClusters.size}
      onConfirmBulkDeleteClusters={confirmBulkDeleteClusters}
      onCloseBulkDeleteConfirmation={() =>
        setBulkDeleteConfirmation({ isOpen: false, loading: false })
      }
    />
  );
}
