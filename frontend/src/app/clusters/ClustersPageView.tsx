"use client";

import { useState, useEffect, useMemo } from "react";
import DashboardLayout from "@/src/components/layout/DashboardLayout";
import ClusterContentTabs, {
  ClusterContentTab,
} from "@/src/components/clusters/ClusterContentTabs";
import ClusterComplianceTab from "@/src/components/clusters/ClusterComplianceTab";
import ClusterCard from "@/src/components/clusters/ClusterCard";
import ClusterView from "@/src/components/clusters/ClusterView";
import ClusterForm from "@/src/components/clusters/ClusterForm";
import ClusterReportsDashboard from "@/src/components/reports/ClusterReportsDashboard";
import ClusterFilterDropdown from "@/src/components/clusters/ClusterFilterDropdown";
import ClusterFilterCard from "@/src/components/clusters/ClusterFilterCard";
import ClusterSortDropdown from "@/src/components/clusters/ClusterSortDropdown";
import AssignMembersModal from "@/src/components/clusters/AssignMembersModal";
import PersonProfile from "@/src/components/people/PersonProfile";
import PersonDetailPanel from "@/src/components/people/PersonDetailPanel";
import FamilyView from "@/src/components/families/FamilyView";
import ActionMenu from "@/src/components/families/ActionMenu";
import BulkActionsMenu from "@/src/components/people/BulkActionsMenu";
import Modal from "@/src/components/ui/Modal";
import ConfirmationModal from "@/src/components/ui/ConfirmationModal";
import Pagination from "@/src/components/ui/Pagination";
import Button from "@/src/components/ui/Button";
import ToolbarSearch from "@/src/components/ui/ToolbarSearch";
import ViewModeToggle from "@/src/components/ui/ViewModeToggle";
import {
  TOOLBAR_BRANCH_SELECT_CLASS,
  TOOLBAR_BRANCH_SELECT_FULL_WIDTH_CLASS,
  TOOLBAR_BRANCH_SELECT_LOCKED_CLASS,
  TOOLBAR_CARD_CLASS,
  TOOLBAR_DESKTOP_ACTION_BUTTON_CLASS,
  TOOLBAR_STACKED_ACTION_BUTTON_CLASS,
  TOOLBAR_STACKED_ACTIONS_ROW_CLASS,
  TOOLBAR_STACKED_CONTROLS_CLASS,
} from "@/src/lib/toolbarStyles";
import LoadingSpinner from "@/src/components/ui/LoadingSpinner";
import ErrorMessage from "@/src/components/ui/ErrorMessage";
import { LockedControlTooltip } from "@/src/components/ui/LockedControlTooltip";
import { Cluster, ClusterInput } from "@/src/types/cluster";
import {
  ClusterWeeklyReport,
  ClusterWeeklyReportInput,
} from "@/src/types/cluster";
import { Person, PersonUI, Family } from "@/src/types/person";
import { FilterCondition } from "@/src/components/people/FilterBar";
import { useAuth } from "@/src/contexts/AuthContext";
import {
  userCanManageCluster,
  clustersForReportSubmission,
  isClusterReporterOnly,
} from "@/src/lib/clusterPermissions";
import {
  countClusterMembersFromDetails,
  resolveClusterRosterFamilies,
  resolveClusterRosterPeople,
} from "@/src/lib/clusterRoster";
import { resolveFamilyMembers } from "@/src/lib/familyRoster";
import { TABLE_ENTITY_LINK_CLASS } from "@/src/lib/tableEntityLink";
import { useBranches } from "@/src/hooks/useBranches";
import {
  getBranchChipStyle,
  getBranchDisplayCode,
} from "@/src/lib/branchChipColor";

interface ClustersPageViewProps {
  activeTab: ClusterContentTab;
  onTabChange: (tab: ClusterContentTab) => void;
  canAccessClusterReports: boolean;
  // Clusters tab props
  allClusters: Cluster[];
  clusters: Cluster[];
  clustersLoading: boolean;
  clusterTotalCount: number;
  summaryClusterCount: number;
  summaryMemberCount: number;
  summaryUnassignedCount: number;
  onNeedPeopleCatalog?: () => void;
  onNeedFamiliesCatalog?: () => void;
  clusterSearchQuery: string;
  onClusterSearchChange: (query: string) => void;
  clusterBranchSelectedId: string;
  onClusterBranchChange: (branchId: string) => void;
  clusterBranchCanChangeFilter: boolean;
  clusterBranchEditableOptions: { value: string; label: string }[];
  clusterBranchReadonlyOptions: { value: string; label: string }[];
  clusterBranchesLoading: boolean;
  clusterActiveFilters: FilterCondition[];
  onClusterFilterRemove: (filterId: string) => void;
  onClusterClearFilters: () => void;
  clusterSortBy: string;
  clusterSortOrder: "asc" | "desc";
  clusterPaginatedData: Cluster[];
  clusterCurrentPage: number;
  clusterTotalPages: number;
  clusterItemsPerPage: number;
  onClusterPageChange: (page: number) => void;
  onClusterItemsPerPageChange: (size: number) => void;
  onClusterAddFilter: (anchor: "mobile" | "desktop") => void;
  onClusterSortDropdown: (anchor: "mobile" | "desktop") => void;
  showClusterFilterDropdown: boolean;
  showClusterFilterCard: boolean;
  showClusterSortDropdown: boolean;
  selectedClusterField: any;
  clusterFilterMenuAnchor: "mobile" | "desktop";
  clusterSortMenuAnchor: "mobile" | "desktop";
  onClusterSelectField: (field: any) => void;
  onClusterApplyFilter: (filter: FilterCondition) => void;
  onClusterSelectSort: (sortBy: string, sortOrder: "asc" | "desc") => void;
  onCloseClusterFilterDropdown: () => void;
  onCloseClusterSortDropdown: () => void;
  onCloseClusterFilterCard: () => void;
  onViewCluster: (cluster: Cluster) => void;
  onEditCluster: (cluster: Cluster) => void;
  onMarkInactiveCluster: (cluster: Cluster) => void;
  onHardDeleteCluster?: (cluster: Cluster) => void;
  showInactiveClusters: boolean;
  onShowInactiveClustersChange: (show: boolean) => void;
  onCreateCluster: () => void;
  viewCluster: Cluster | null;
  editCluster: Cluster | null;
  clusterViewMode: "view" | "edit";
  isClusterModalOpen: boolean;
  onCloseClusterModal: () => void;
  onCancelClusterEdit: () => void;
  isDesktop: boolean;
  panelOpen: boolean;
  panelEntity: "cluster" | "person" | "family";
  panelMode: "view" | "edit" | "create";
  panelCluster: Cluster | null;
  panelPerson: Person | null;
  panelFamily: Family | null;
  onCloseClusterPanel: () => void;
  onBackClusterPanel: () => void;
  clusterDeleteConfirmation: {
    isOpen: boolean;
    cluster: Cluster | null;
    loading: boolean;
  };
  onConfirmDeleteCluster: () => void;
  onCloseDeleteConfirmation: () => void;
  markInactiveConfirmation: {
    isOpen: boolean;
    cluster: Cluster | null;
    loading: boolean;
  };
  onConfirmMarkInactiveCluster: () => void;
  onCloseMarkInactiveConfirmation: () => void;
  onCreateClusterSubmit: (data: ClusterInput) => Promise<void>;
  onUpdateClusterSubmit: (data: Partial<ClusterInput>) => Promise<void>;
  assignMembersModal: { isOpen: boolean; cluster: Cluster | null };
  onAssignMembers: (memberIds: number[]) => Promise<void>;
  onCloseAssignMembers: () => void;
  onOpenAssignMembers: (cluster: Cluster) => void | Promise<void>;
  // Overlay modals
  showClusterOverPerson: boolean;
  clusterOverPerson: Cluster | null;
  onCloseClusterOverPerson: () => void;
  showFamilyOverCluster: boolean;
  familyOverCluster: Family | null;
  onCloseFamilyOverCluster: () => void;
  showPersonOverCluster: boolean;
  personOverCluster: Person | null;
  onClosePersonOverCluster: () => void;
  showEditClusterOverlay: boolean;
  editClusterOverlay: Cluster | null;
  onCloseEditClusterOverlay: () => void;
  onOpenEditClusterOverlay: (cluster: Cluster) => void | Promise<void>;
  onUpdateClusterOverlay: (data: Partial<ClusterInput>) => Promise<void>;
  onViewFamily?: (family: Family) => void;
  onViewPerson?: (person: Person) => void;
  // Reports tab props
  reports: ClusterWeeklyReport[];
  reportsLoading: boolean;
  reportsError: string | null;
  isReportFormOpen: boolean;
  onOpenReportForm: (cluster?: Cluster | null) => void;
  onCloseReportForm: () => void;
  editingReport: ClusterWeeklyReport | null;
  onEditReport: (report: ClusterWeeklyReport) => void;
  reportSelectedCluster: Cluster | null;
  onSetReportSelectedCluster: (cluster: Cluster | null) => void;
  onCreateReport: (data: ClusterWeeklyReportInput) => Promise<void>;
  onUpdateReport: (
    id: number,
    data: Partial<ClusterWeeklyReportInput>
  ) => Promise<void>;
  onDeleteReport: (report: ClusterWeeklyReport) => void;
  reportDeleteConfirmation: {
    isOpen: boolean;
    report: ClusterWeeklyReport | null;
    loading: boolean;
  };
  onConfirmDeleteReport: () => void;
  onCloseReportDeleteConfirmation: () => void;
  // Data
  people: Person[];
  peopleUI: PersonUI[];
  families: Family[];
  // Bulk selection
  selectedClusters: Set<string>;
  isSelectionMode: boolean;
  onToggleSelectionMode: () => void;
  onSelectCluster: (clusterId: string) => void;
  onSelectAllClusters: () => void;
  onBulkDelete?: () => void;
  onBulkMarkInactive: () => void;
  onBulkExport: (format: "excel" | "pdf" | "csv") => void;
  bulkDeleteConfirmation: {
    isOpen: boolean;
    loading: boolean;
  };
  bulkMarkInactiveConfirmation: {
    isOpen: boolean;
    loading: boolean;
  };
  selectedClustersCount: number;
  onConfirmBulkDeleteClusters: () => void;
  onCloseBulkDeleteConfirmation: () => void;
  onConfirmBulkMarkInactiveClusters: () => void;
  onCloseBulkMarkInactiveConfirmation: () => void;
}

export default function ClustersPageView({
  activeTab,
  onTabChange,
  canAccessClusterReports,
  allClusters,
  clusters,
  clustersLoading,
  clusterTotalCount,
  summaryClusterCount,
  summaryMemberCount,
  summaryUnassignedCount,
  onNeedPeopleCatalog,
  onNeedFamiliesCatalog,
  clusterSearchQuery,
  onClusterSearchChange,
  clusterBranchSelectedId,
  onClusterBranchChange,
  clusterBranchCanChangeFilter,
  clusterBranchEditableOptions,
  clusterBranchReadonlyOptions,
  clusterBranchesLoading,
  clusterActiveFilters,
  onClusterFilterRemove,
  onClusterClearFilters,
  clusterSortBy,
  clusterSortOrder,
  clusterPaginatedData,
  clusterCurrentPage,
  clusterTotalPages,
  clusterItemsPerPage,
  onClusterPageChange,
  onClusterItemsPerPageChange,
  onClusterAddFilter,
  onClusterSortDropdown,
  showClusterFilterDropdown,
  showClusterFilterCard,
  showClusterSortDropdown,
  selectedClusterField,
  clusterFilterMenuAnchor,
  clusterSortMenuAnchor,
  onClusterSelectField,
  onClusterApplyFilter,
  onClusterSelectSort,
  onCloseClusterFilterDropdown,
  onCloseClusterSortDropdown,
  onCloseClusterFilterCard,
  onViewCluster,
  onEditCluster,
  onMarkInactiveCluster,
  onHardDeleteCluster,
  showInactiveClusters,
  onShowInactiveClustersChange,
  onCreateCluster,
  viewCluster,
  editCluster,
  clusterViewMode,
  isClusterModalOpen,
  onCloseClusterModal,
  onCancelClusterEdit,
  isDesktop,
  panelOpen,
  panelEntity,
  panelMode,
  panelCluster,
  panelPerson,
  panelFamily,
  onCloseClusterPanel,
  onBackClusterPanel,
  clusterDeleteConfirmation,
  onConfirmDeleteCluster,
  onCloseDeleteConfirmation,
  markInactiveConfirmation,
  onConfirmMarkInactiveCluster,
  onCloseMarkInactiveConfirmation,
  onCreateClusterSubmit,
  onUpdateClusterSubmit,
  assignMembersModal,
  onAssignMembers,
  onCloseAssignMembers,
  onOpenAssignMembers,
  showClusterOverPerson,
  clusterOverPerson,
  onCloseClusterOverPerson,
  showFamilyOverCluster,
  familyOverCluster,
  onCloseFamilyOverCluster,
  showPersonOverCluster,
  personOverCluster,
  onClosePersonOverCluster,
  showEditClusterOverlay,
  editClusterOverlay,
  onCloseEditClusterOverlay,
  onOpenEditClusterOverlay,
  onUpdateClusterOverlay,
  onViewFamily,
  onViewPerson,
  reports,
  reportsLoading,
  reportsError,
  isReportFormOpen,
  onOpenReportForm,
  onCloseReportForm,
  editingReport,
  onEditReport,
  reportSelectedCluster,
  onSetReportSelectedCluster,
  onCreateReport,
  onUpdateReport,
  onDeleteReport,
  reportDeleteConfirmation,
  onConfirmDeleteReport,
  onCloseReportDeleteConfirmation,
  people,
  peopleUI,
  families,
  selectedClusters,
  isSelectionMode,
  onToggleSelectionMode,
  onSelectCluster,
  onSelectAllClusters,
  onBulkDelete,
  onBulkMarkInactive,
  onBulkExport,
  bulkDeleteConfirmation,
  bulkMarkInactiveConfirmation,
  selectedClustersCount,
  onConfirmBulkDeleteClusters,
  onCloseBulkDeleteConfirmation,
  onConfirmBulkMarkInactiveClusters,
  onCloseBulkMarkInactiveConfirmation,
}: ClustersPageViewProps) {
  const [clusterListViewMode, setClusterListViewMode] = useState<"cards" | "table">(
    "cards"
  );

  const { user, isSeniorCoordinator, isModuleCoordinator } = useAuth();
  const { branches } = useBranches();

  const branchById = useMemo(() => {
    const map = new Map<number, (typeof branches)[number]>();
    branches.forEach((branch) => map.set(branch.id, branch));
    return map;
  }, [branches]);
  /** CLUSTER-level coordinator assignment without senior — uses Submit Report primary like backend scope */
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

  const isClusterReporterOnlyUser = isClusterReporterOnly(clusterAuthCtx);

  const showGlobalSubmitReport =
    hasClusterModuleWideAccess ||
    isOnlyNonSeniorClusterCoordinator ||
    isClusterReporterOnlyUser ||
    allClusters.some((c) => userCanManageCluster(c, clusterAuthCtx));

  const reportFormClusters = useMemo(() => {
    let base: Cluster[];
    if (hasClusterModuleWideAccess) {
      base = allClusters;
    } else {
      base = clustersForReportSubmission(allClusters, clusterAuthCtx);
    }
    if (!hasClusterModuleWideAccess && editingReport?.cluster != null) {
      const cid = editingReport.cluster;
      if (!base.some((c) => Number(c.id) === Number(cid))) {
        const extra = allClusters.find((c) => Number(c.id) === Number(cid));
        if (extra) {
          return [...base, extra];
        }
      }
    }
    return base;
  }, [
    allClusters,
    hasClusterModuleWideAccess,
    clusterAuthCtx,
    user?.module_coordinator_assignments,
    editingReport?.cluster,
  ]);

  /** Matches backend `ClusterWeeklyReportViewSet._check_compliance_access` */
  const canAccessCompliance =
    user?.role === "ADMIN" ||
    user?.role === "PASTOR" ||
    isSeniorCoordinator("CLUSTER");

  useEffect(() => {
    if (!canAccessCompliance && activeTab === "compliance") {
      onTabChange("clusters");
    }
  }, [canAccessCompliance, activeTab, onTabChange]);

  useEffect(() => {
    if (!canAccessClusterReports && activeTab === "reports") {
      onTabChange("clusters");
    }
  }, [canAccessClusterReports, activeTab, onTabChange]);

  // Calculate stats from summary endpoint (branch-scoped; not toolbar text filters)
  const totalMembers = summaryMemberCount;
  const unassignedMembers = summaryUnassignedCount;

  const useStackedToolbar = isDesktop && panelOpen;

  const clusterBranchSelectInteractive =
    clusterBranchCanChangeFilter && !clusterBranchesLoading;

  const clusterBranchHoverHint = useMemo(() => {
    if (clusterBranchSelectInteractive) return "";
    if (clusterBranchesLoading && clusterBranchCanChangeFilter) {
      return "Loading branches…";
    }
    return "Branch is limited to your assignment. Pastors, admins, and senior cluster coordinators can switch branches.";
  }, [
    clusterBranchSelectInteractive,
    clusterBranchesLoading,
    clusterBranchCanChangeFilter,
  ]);

  const renderClusterBranchSelect = (fullWidth = false) => {
    const options =
      clusterBranchesLoading && clusterBranchCanChangeFilter ? (
        <option value="">Loading…</option>
      ) : (
        (
          clusterBranchCanChangeFilter
            ? clusterBranchEditableOptions
            : clusterBranchReadonlyOptions
        ).map((opt) => (
          <option
            key={opt.value === "" ? "__all_branches__" : opt.value}
            value={opt.value}
          >
            {opt.label}
          </option>
        ))
      );

    const selectEl = (
      <select
        aria-label="Branch"
        aria-disabled={!clusterBranchSelectInteractive}
        tabIndex={clusterBranchSelectInteractive ? 0 : -1}
        value={clusterBranchSelectedId}
        onChange={(e) => {
          if (!clusterBranchSelectInteractive) return;
          onClusterBranchChange(e.target.value);
        }}
        className={
          clusterBranchSelectInteractive
            ? fullWidth
              ? TOOLBAR_BRANCH_SELECT_FULL_WIDTH_CLASS
              : TOOLBAR_BRANCH_SELECT_CLASS
            : TOOLBAR_BRANCH_SELECT_LOCKED_CLASS
        }
      >
        {options}
      </select>
    );

    return clusterBranchSelectInteractive ? (
      selectEl
    ) : (
      <LockedControlTooltip label={clusterBranchHoverHint}>
        {selectEl}
      </LockedControlTooltip>
    );
  };

  const getPanelTitle = () => {
    if (panelEntity === "cluster") {
      if (panelMode === "create") return "Create Cluster";
      if (panelMode === "edit") return "Edit Cluster";
      return "Cluster";
    }
    if (panelEntity === "person") return "Profile";
    return "Family";
  };

  const renderClusterFlow = (isPanel: boolean) => {
    const currentViewCluster = isPanel ? panelCluster : viewCluster;
    const isViewMode = isPanel ? panelMode === "view" : clusterViewMode === "view";
    const currentEditCluster =
      isPanel && panelMode === "edit"
        ? panelCluster
        : !isPanel
        ? editCluster
        : null;

    const manageCluster =
      !!currentViewCluster &&
      userCanManageCluster(currentViewCluster as Cluster, clusterAuthCtx);

    if (isViewMode && currentViewCluster) {
      return (
        <ClusterView
          cluster={currentViewCluster as any}
          clusterMembers={resolveClusterRosterPeople(
            currentViewCluster as Cluster,
            peopleUI
          )}
          clusterFamilies={resolveClusterRosterFamilies(
            currentViewCluster as Cluster,
            families
          )}
          coordinator={peopleUI.find(
            (p) => p.id === currentViewCluster.coordinator?.id?.toString()
          )}
          onEdit={() => onEditCluster(currentViewCluster)}
          onDelete={() => onMarkInactiveCluster(currentViewCluster)}
          onHardDelete={
            onHardDeleteCluster
              ? () => onHardDeleteCluster(currentViewCluster)
              : undefined
          }
          onClose={isPanel ? onCloseClusterPanel : onCloseClusterModal}
          onAssignMembers={() => onOpenAssignMembers(currentViewCluster)}
          onSubmitReport={() => {
            onTabChange("reports");
            onOpenReportForm(currentViewCluster);
            if (isPanel) {
              onCloseClusterPanel();
            }
          }}
          onViewFamily={onViewFamily}
          onViewPerson={onViewPerson}
          showTopHeader={!isPanel}
          showSubmitReportButton={
            !hasClusterModuleWideAccess && manageCluster
          }
          canManageCluster={manageCluster}
        />
      );
    }

    return (
      <ClusterForm
        initialData={currentEditCluster || undefined}
        panelLayout={isPanel}
        onNeedCatalogs={() => {
          onNeedPeopleCatalog?.();
          onNeedFamiliesCatalog?.();
        }}
        onSubmit={async (data) => {
          if (currentEditCluster) {
            await onUpdateClusterSubmit(data);
          } else {
            await onCreateClusterSubmit(data);
          }
        }}
        onCancel={isPanel ? onBackClusterPanel : onCancelClusterEdit}
        error={null}
        submitting={false}
      />
    );
  };

  const renderPersonFlow = (isPanel: boolean) => {
    const selectedPerson = isPanel ? panelPerson : personOverCluster;
    if (!selectedPerson) return null;

    return (
      <PersonProfile
        person={selectedPerson}
        clusters={allClusters as any}
        families={families}
        onViewFamily={(f) => {
          if (onViewFamily) {
            onViewFamily(f);
          }
        }}
        onViewCluster={(c) => {
          const cluster = allClusters.find((cl) => cl.id === (c as any).id);
          if (cluster) {
            onViewCluster(cluster);
          }
        }}
        onNoFamilyClick={() => {}}
        onNoClusterClick={() => {}}
        onEdit={() => {
          if (isPanel) {
            onBackClusterPanel();
          } else {
            onClosePersonOverCluster();
          }
        }}
        onDelete={() => {
          if (isPanel) {
            onBackClusterPanel();
          } else {
            onClosePersonOverCluster();
          }
        }}
        onAddTimeline={() => {
          if (isPanel) {
            onBackClusterPanel();
          } else {
            onClosePersonOverCluster();
          }
        }}
        onClose={isPanel ? onBackClusterPanel : onClosePersonOverCluster}
        hideEditButton={true}
        hideDeleteButton={true}
        showTopHeader={!isPanel}
      />
    );
  };

  const renderFamilyFlow = (isPanel: boolean) => {
    const selectedFamily = isPanel ? panelFamily : familyOverCluster;
    if (!selectedFamily) return null;

    return (
      <FamilyView
        family={selectedFamily}
        familyMembers={resolveFamilyMembers(selectedFamily, peopleUI)}
        clusters={allClusters as any}
        onEdit={() => {
          if (isPanel) {
            onBackClusterPanel();
          } else {
            onCloseFamilyOverCluster();
          }
        }}
        onDelete={() => {
          if (isPanel) {
            onBackClusterPanel();
          } else {
            onCloseFamilyOverCluster();
          }
        }}
        onClose={isPanel ? onBackClusterPanel : onCloseFamilyOverCluster}
        hideEditButton={true}
        hideDeleteButton={true}
        showTopHeader={!isPanel}
      />
    );
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="relative isolate flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-1 min-w-0">
            <h1 className="text-2xl font-bold text-foreground">Clusters</h1>
            <p className="text-sm text-gray-600">
              Manage clusters and weekly reports
            </p>
          </div>
          <div className="relative z-10 flex shrink-0 flex-col gap-2 sm:flex-row sm:gap-2">
            {activeTab === "clusters" &&
              (hasClusterModuleWideAccess ? (
                <Button onClick={onCreateCluster} className="w-full md:w-auto">
                  Add Cluster
                </Button>
              ) : (
                showGlobalSubmitReport && (
                  <Button
                    onClick={() => onOpenReportForm()}
                    className="w-full md:w-auto"
                  >
                    Submit Report
                  </Button>
                )
              ))}
            {activeTab === "reports" && showGlobalSubmitReport && (
              <Button
                onClick={() => onOpenReportForm()}
                className="w-full md:w-auto"
              >
                Submit Report
              </Button>
            )}
          </div>
        </div>

        <ClusterContentTabs
          activeTab={activeTab}
          onTabChange={onTabChange}
          showComplianceTab={canAccessCompliance}
          showReportsTab={canAccessClusterReports}
        />

        {activeTab === "clusters" && (
          <div
            className={
              isDesktop && panelOpen
                ? "grid gap-6 lg:grid-cols-[minmax(0,1fr)_500px]"
                : ""
            }
          >
            <div className="space-y-6 min-w-0">
            {/* Stats Cards */}
            <div
              className={
                panelOpen
                  ? "grid grid-cols-1 sm:grid-cols-2 gap-4"
                  : "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
              }
            >
              <div
                className="bg-white rounded-lg border border-gray-200 p-4 md:p-6 py-4 card-shadow"
                role="region"
                aria-label="Total Clusters"
              >
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div
                      className="p-1.5 chip-primary-surface rounded-lg"
                      aria-hidden="true"
                    >
                      <svg
                        className="w-5 h-5 text-primary"
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
                    <p
                      className="text-sm font-medium text-gray-600"
                      aria-label="Metric label"
                    >
                      Total Clusters
                    </p>
                    <p
                      className="text-2xl font-semibold text-gray-900"
                      aria-label="Total clusters value"
                    >
                      {summaryClusterCount}
                    </p>
                    <p
                      className="text-xs text-gray-500 mt-1"
                      aria-label="Metric description"
                    >
                      Total number of clusters
                    </p>
                  </div>
                </div>
              </div>
              <div
                className="bg-white rounded-lg border border-gray-200 p-4 md:p-6 py-4 card-shadow"
                role="region"
                aria-label="Total Members"
              >
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div
                      className="p-1.5 chip-green-surface rounded-lg"
                      aria-hidden="true"
                    >
                      <svg
                        className="w-5 h-5 text-green-600"
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
                    <p
                      className="text-sm font-medium text-gray-600"
                      aria-label="Metric label"
                    >
                      Total Members
                    </p>
                    <p
                      className="text-2xl font-semibold text-gray-900"
                      aria-label="Total members value"
                    >
                      {totalMembers}
                    </p>
                    <p
                      className="text-xs text-gray-500 mt-1"
                      aria-label="Metric description"
                    >
                      Members across all clusters
                    </p>
                  </div>
                </div>
              </div>
              <div
                className="bg-white rounded-lg border border-gray-200 p-4 md:p-6 py-4 card-shadow"
                role="region"
                aria-label="Unassigned Members"
              >
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div
                      className="p-1.5 chip-orange-surface rounded-lg"
                      aria-hidden="true"
                    >
                      <svg
                        className="w-5 h-5 text-orange-600"
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
                    <p
                      className="text-sm font-medium text-gray-600"
                      aria-label="Metric label"
                    >
                      Unassigned Members
                    </p>
                    <p
                      className="text-2xl font-semibold text-gray-900"
                      aria-label="Unassigned members value"
                    >
                      {unassignedMembers}
                    </p>
                    <p
                      className="text-xs text-gray-500 mt-1"
                      aria-label="Metric description"
                    >
                      Members not in any cluster
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Search + branch + actions (Families-style toolbar) */}
            <div className={TOOLBAR_CARD_CLASS}>
              {/* Stacked 3-row toolbar (mobile, or desktop with detail panel open) */}
              <div
                className={
                  useStackedToolbar
                    ? "flex flex-col gap-3"
                    : "flex flex-col gap-3 tablet:hidden"
                }
              >
                <ToolbarSearch
                  fullWidth
                  value={clusterSearchQuery}
                  onChange={onClusterSearchChange}
                  placeholder="Search clusters…"
                  ariaLabel="Search clusters"
                />

                <div className={TOOLBAR_STACKED_CONTROLS_CLASS}>
                  {renderClusterBranchSelect(true)}

                  <label className="flex items-center gap-2 text-sm text-gray-600">
                    <input
                      type="checkbox"
                      checked={showInactiveClusters}
                      onChange={(e) =>
                        onShowInactiveClustersChange(e.target.checked)
                      }
                      className="rounded border-gray-300 text-primary focus:ring-ring"
                    />
                    Show inactive
                  </label>

                  <ViewModeToggle
                    fullWidth
                    viewMode={clusterListViewMode}
                    onViewModeChange={setClusterListViewMode}
                  />
                </div>

                <div className="relative">
                  <div className={TOOLBAR_STACKED_ACTIONS_ROW_CLASS}>
                    {hasClusterModuleWideAccess && (
                      <button
                        type="button"
                        onClick={onToggleSelectionMode}
                        className={`${TOOLBAR_STACKED_ACTION_BUTTON_CLASS} ${
                          isSelectionMode
                            ? "border-primary/30 bg-primary/10 text-primary hover:bg-primary/15"
                            : ""
                        }`}
                      >
                        <svg
                          className={`mr-1 h-4 w-4 shrink-0 ${
                            isSelectionMode ? "text-primary" : "text-gray-500"
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
                        <span className="truncate">
                          {isSelectionMode ? "Cancel" : "Select"}
                        </span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => onClusterSortDropdown("mobile")}
                      className={TOOLBAR_STACKED_ACTION_BUTTON_CLASS}
                    >
                      <svg
                        className="w-4 h-4 mr-1 shrink-0"
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
                      <span className="truncate">
                        Sort {clusterSortOrder === "asc" ? "↑" : "↓"}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onClusterAddFilter("mobile")}
                      className={TOOLBAR_STACKED_ACTION_BUTTON_CLASS}
                    >
                      <svg
                        className="w-4 h-4 mr-1 shrink-0"
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

                  {clusterSortMenuAnchor === "mobile" && (
                    <ClusterSortDropdown
                      isOpen={showClusterSortDropdown}
                      onClose={onCloseClusterSortDropdown}
                      onSelectSort={onClusterSelectSort}
                      currentSortBy={clusterSortBy}
                      currentSortOrder={clusterSortOrder}
                      anchored
                    />
                  )}

                  {clusterFilterMenuAnchor === "mobile" && (
                    <>
                      <ClusterFilterDropdown
                        isOpen={showClusterFilterDropdown}
                        onClose={onCloseClusterFilterDropdown}
                        onSelectField={onClusterSelectField}
                        anchored
                      />
                      {selectedClusterField && (
                        <ClusterFilterCard
                          field={selectedClusterField}
                          isOpen={showClusterFilterCard}
                          onClose={onCloseClusterFilterCard}
                          onApplyFilter={onClusterApplyFilter}
                          anchored
                        />
                      )}
                    </>
                  )}
                </div>

                {hasClusterModuleWideAccess &&
                  isSelectionMode &&
                  selectedClusters.size > 0 && (
                    <BulkActionsMenu
                      onBulkMarkInactive={onBulkMarkInactive}
                      onBulkDelete={onBulkDelete}
                      onBulkExport={onBulkExport}
                      selectedCount={selectedClusters.size}
                    />
                  )}

                {clusterActiveFilters.length > 0 && (
                  <div className="flex w-full flex-wrap items-center gap-2">
                    {clusterActiveFilters.map((filter) => (
                      <span
                        key={filter.id}
                        className="inline-flex min-h-[32px] items-center rounded-full px-2 py-1.5 text-xs font-medium chip-primary"
                      >
                        <span className="max-w-[150px] truncate">
                          {filter.label}
                        </span>
                        <button
                          type="button"
                          onClick={() => onClusterFilterRemove(filter.id)}
                          className="ml-1 flex min-h-[20px] min-w-[20px] flex-shrink-0 items-center justify-center text-primary hover:text-primary"
                          aria-label="Remove filter"
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
                      type="button"
                      onClick={onClusterClearFilters}
                      className="min-h-[32px] px-2 py-1 text-xs text-gray-500 hover:text-gray-700"
                    >
                      Clear All
                    </button>
                  </div>
                )}
              </div>

              {/* Desktop — single-row toolbar */}
              <div
                className={
                  useStackedToolbar
                    ? "hidden"
                    : "hidden tablet:flex tablet:flex-wrap tablet:items-center tablet:justify-between tablet:gap-2"
                }
              >
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <ToolbarSearch
                    value={clusterSearchQuery}
                    onChange={onClusterSearchChange}
                    placeholder="Search clusters…"
                    ariaLabel="Search clusters"
                  />
                  <div className="min-w-0 flex-1 max-w-xs">
                    {renderClusterBranchSelect()}
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <label className="flex items-center gap-2 text-sm text-gray-600 whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={showInactiveClusters}
                      onChange={(e) =>
                        onShowInactiveClustersChange(e.target.checked)
                      }
                      className="rounded border-gray-300 text-primary focus:ring-ring"
                    />
                    Show inactive
                  </label>
                  <ViewModeToggle
                    compact
                    viewMode={clusterListViewMode}
                    onViewModeChange={setClusterListViewMode}
                  />
                  {hasClusterModuleWideAccess && (
                    <>
                      <button
                        type="button"
                        onClick={onToggleSelectionMode}
                        className={`inline-flex shrink-0 items-center rounded-lg border px-3 py-2 text-sm font-medium leading-4 shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ring ${
                          isSelectionMode
                            ? "border-primary/30 bg-primary/10 text-primary hover:bg-primary/15"
                            : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                        }`}
                      >
                        <svg
                          className={`mr-1 h-4 w-4 shrink-0 ${
                            isSelectionMode ? "text-primary" : "text-gray-500"
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
                        {isSelectionMode ? "Cancel Selection" : "Select"}
                      </button>
                      {isSelectionMode && selectedClusters.size > 0 && (
                        <BulkActionsMenu
                          onBulkMarkInactive={onBulkMarkInactive}
                          onBulkDelete={onBulkDelete}
                          onBulkExport={onBulkExport}
                          selectedCount={selectedClusters.size}
                        />
                      )}
                    </>
                  )}
                  {clusterActiveFilters.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2">
                      {clusterActiveFilters.map((filter) => (
                        <span
                          key={filter.id}
                          className="inline-flex min-h-[32px] items-center rounded-full px-2 py-1.5 text-xs font-medium chip-primary"
                        >
                          <span className="max-w-none truncate">{filter.label}</span>
                          <button
                            type="button"
                            onClick={() => onClusterFilterRemove(filter.id)}
                            className="ml-1 flex min-h-[20px] min-w-[20px] flex-shrink-0 items-center justify-center text-primary hover:text-primary"
                            aria-label="Remove filter"
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
                        type="button"
                        onClick={onClusterClearFilters}
                        className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700"
                      >
                        Clear All
                      </button>
                    </div>
                  )}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => onClusterSortDropdown("desktop")}
                      className={TOOLBAR_DESKTOP_ACTION_BUTTON_CLASS}
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
                          d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12"
                        />
                      </svg>
                      Sort {clusterSortOrder === "asc" ? "↑" : "↓"}
                    </button>
                    {clusterSortMenuAnchor === "desktop" && (
                      <ClusterSortDropdown
                        isOpen={showClusterSortDropdown}
                        onClose={onCloseClusterSortDropdown}
                        onSelectSort={onClusterSelectSort}
                        currentSortBy={clusterSortBy}
                        currentSortOrder={clusterSortOrder}
                        anchored
                      />
                    )}
                  </div>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => onClusterAddFilter("desktop")}
                      className={TOOLBAR_DESKTOP_ACTION_BUTTON_CLASS}
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
                    {clusterFilterMenuAnchor === "desktop" && (
                      <>
                        <ClusterFilterDropdown
                          isOpen={showClusterFilterDropdown}
                          onClose={onCloseClusterFilterDropdown}
                          onSelectField={onClusterSelectField}
                          anchored
                        />
                        {selectedClusterField && (
                          <ClusterFilterCard
                            field={selectedClusterField}
                            isOpen={showClusterFilterCard}
                            onClose={onCloseClusterFilterCard}
                            onApplyFilter={onClusterApplyFilter}
                            anchored
                          />
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Divider */}
            <div className="border-t border-gray-200"></div>

            {/* Clusters Grid */}
            {clustersLoading ? (
              <LoadingSpinner />
            ) : clusterTotalCount === 0 ? (
              <div className="text-center py-12">
                <svg
                  className="mx-auto h-12 w-12 text-gray-400"
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
                <h3 className="mt-2 text-sm font-medium text-gray-900">
                  No clusters found
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  {clusterSearchQuery || clusterActiveFilters.length > 0
                    ? "Try adjusting your search or filters to find clusters."
                    : hasClusterModuleWideAccess
                    ? "Get started by creating your first cluster."
                    : "Submit your weekly cluster report. If you need a new cluster created, contact your pastor or cluster leadership."}
                </p>
                {!clusterSearchQuery && clusterActiveFilters.length === 0 && (
                  <div className="mt-6 flex flex-col gap-2 items-center sm:flex-row sm:justify-center">
                    {hasClusterModuleWideAccess ? (
                      <Button onClick={onCreateCluster}>Create Cluster</Button>
                    ) : (
                      showGlobalSubmitReport && (
                        <Button onClick={() => onOpenReportForm()}>
                          Submit Report
                        </Button>
                      )
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div>
                {/* Select All Checkbox - Only show in selection mode */}
                {hasClusterModuleWideAccess &&
                  isSelectionMode &&
                  clusterPaginatedData.length > 0 && (
                  <div className="mb-4 flex items-center gap-2">
                    <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer min-h-[44px]">
                      <input
                        type="checkbox"
                        checked={
                          selectedClusters.size ===
                            clusterPaginatedData.length &&
                          clusterPaginatedData.length > 0
                        }
                        onChange={onSelectAllClusters}
                        className="w-5 h-5 text-primary border-gray-300 rounded focus:ring-ring"
                      />
                      Select All ({selectedClusters.size} selected)
                    </label>
                  </div>
                )}
                {clusterListViewMode === "table" ? (
                  <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
                    <table className="min-w-full divide-y divide-gray-200 text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          {hasClusterModuleWideAccess && isSelectionMode && (
                            <th className="px-4 py-3 text-left">
                              <input
                                type="checkbox"
                                checked={
                                  selectedClusters.size === clusterPaginatedData.length &&
                                  clusterPaginatedData.length > 0
                                }
                                onChange={onSelectAllClusters}
                                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-ring"
                              />
                            </th>
                          )}
                          <th className="px-4 py-3 text-left font-medium text-gray-600">
                            Cluster
                          </th>
                          <th className="px-4 py-3 text-left font-medium text-gray-600">
                            Branch
                          </th>
                          <th className="px-4 py-3 text-left font-medium text-gray-600">
                            Coordinator
                          </th>
                          <th className="px-4 py-3 text-left font-medium text-gray-600">
                            Members
                          </th>
                          <th className="px-4 py-3 text-left font-medium text-gray-600">
                            Visitors
                          </th>
                          <th className="px-4 py-3 text-left font-medium text-gray-600">
                            Families
                          </th>
                          <th className="px-4 py-3 text-left font-medium text-gray-600">
                            Location / Schedule
                          </th>
                          <th className="px-4 py-3 text-right font-medium text-gray-600">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {clusterPaginatedData.map((c) => {
                          const coordinatorName = c.coordinator
                            ? `${c.coordinator.first_name} ${c.coordinator.last_name}`.trim()
                            : null;
                          const { memberCount, visitorCount } =
                            countClusterMembersFromDetails(c, peopleUI);
                          const clusterBranch =
                            c.branch != null ?
                              branchById.get(Number(c.branch)) ?? null
                            : null;

                          return (
                            <tr key={c.id} className="hover:bg-gray-50">
                              {hasClusterModuleWideAccess && isSelectionMode && (
                                <td className="px-4 py-3">
                                  <input
                                    type="checkbox"
                                    checked={selectedClusters.has(c.id.toString())}
                                    onChange={() => onSelectCluster(c.id.toString())}
                                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-ring"
                                  />
                                </td>
                              )}
                              <td className="px-4 py-3">
                                <button
                                  type="button"
                                  onClick={() => onViewCluster(c)}
                                  className={TABLE_ENTITY_LINK_CLASS}
                                >
                                  {c.name || "Untitled Cluster"}
                                </button>
                                <div className="mt-1 text-xs text-gray-500">
                                  {c.code || "—"}
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                {clusterBranch ?
                                  <span
                                    className="font-medium"
                                    style={{
                                      color: getBranchChipStyle(
                                        clusterBranch.id,
                                        clusterBranch.is_headquarters,
                                      ).color,
                                    }}
                                  >
                                    {getBranchDisplayCode(clusterBranch)}
                                  </span>
                                : <span className="text-gray-700">—</span>}
                              </td>
                              <td className="px-4 py-3 text-gray-700">
                                {coordinatorName || "Unknown Coordinator"}
                              </td>
                              <td className="px-4 py-3 text-gray-700">{memberCount}</td>
                              <td className="px-4 py-3 text-gray-700">{visitorCount}</td>
                              <td className="px-4 py-3 text-gray-700">
                                {c.family_count ?? c.families?.length ?? 0}
                              </td>
                              <td className="px-4 py-3 text-gray-700">
                                <div className="space-y-1">
                                  <div>{c.location || "—"}</div>
                                  <div className="text-xs text-gray-500">
                                    {c.meeting_schedule || "No schedule"}
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center justify-end">
                                  <ActionMenu
                                    onView={() => onViewCluster(c)}
                                    onEdit={() => onEditCluster(c)}
                                    onDelete={() => onMarkInactiveCluster(c)}
                                    onHardDelete={
                                      onHardDeleteCluster
                                        ? () => onHardDeleteCluster(c)
                                        : undefined
                                    }
                                    showEditDelete={userCanManageCluster(
                                      c as Cluster,
                                      clusterAuthCtx,
                                    )}
                                    labels={{
                                      view: "View Cluster",
                                      edit: "Edit Cluster",
                                      delete: "Mark Inactive",
                                      hardDelete: "Delete Cluster",
                                      title: "Cluster Actions",
                                    }}
                                  />
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div
                    className={
                      panelOpen
                        ? "grid grid-cols-1 gap-4"
                        : "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
                    }
                  >
                    {clusterPaginatedData.map((c) => (
                      <ClusterCard
                        key={c.id}
                        cluster={c as any}
                        peopleUI={peopleUI}
                        isSelected={selectedClusters.has(c.id.toString())}
                        isSelectionMode={
                          hasClusterModuleWideAccess && isSelectionMode
                        }
                        canManageCluster={userCanManageCluster(
                          c as Cluster,
                          clusterAuthCtx,
                        )}
                        onSelect={() => onSelectCluster(c.id.toString())}
                        onView={() => onViewCluster(c)}
                        onEdit={() => onEditCluster(c)}
                        onDelete={() => onMarkInactiveCluster(c)}
                        onHardDelete={
                          onHardDeleteCluster
                            ? () => onHardDeleteCluster(c)
                            : undefined
                        }
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Pagination */}
            {clusterTotalCount > 0 && (
              <Pagination
                currentPage={clusterCurrentPage}
                totalPages={clusterTotalPages}
                onPageChange={onClusterPageChange}
                itemsPerPage={clusterItemsPerPage}
                totalItems={clusterTotalCount}
                onItemsPerPageChange={onClusterItemsPerPageChange}
                showItemsPerPage={true}
              />
            )}
            </div>

            {isDesktop && panelOpen && (
              <PersonDetailPanel
                isOpen={panelOpen}
                title={getPanelTitle()}
                onClose={onBackClusterPanel}
              >
                {panelEntity === "cluster" && renderClusterFlow(true)}
                {panelEntity === "person" && renderPersonFlow(true)}
                {panelEntity === "family" && renderFamilyFlow(true)}
              </PersonDetailPanel>
            )}
          </div>
        )}

        {activeTab === "compliance" && canAccessCompliance && (
          <ClusterComplianceTab />
        )}


        {canAccessClusterReports &&
          (activeTab === "reports" || isReportFormOpen) && (
          <div
            className={activeTab !== "reports" ? "hidden" : undefined}
            aria-hidden={activeTab !== "reports"}
          >
            {isOnlyNonSeniorClusterCoordinator && !isClusterReporterOnlyUser && (
              <p className="mb-4 text-sm text-gray-600">
                You can browse all clusters in your branch on the Clusters tab.
                Weekly reports here are limited to clusters you coordinate.
              </p>
            )}
            {isClusterReporterOnlyUser && (
              <p className="mb-4 text-sm text-gray-600">
                You can view and submit weekly reports only for your assigned
                cluster(s).
              </p>
            )}
            <ClusterReportsDashboard
              clusters={reportFormClusters as any}
              clustersForReportForm={reportFormClusters as any}
              externalShowForm={isReportFormOpen}
              externalSelectedCluster={reportSelectedCluster}
              externalEditingReport={editingReport}
              onFormClose={onCloseReportForm}
              onEditReport={onEditReport}
              onSetReportSelectedCluster={onSetReportSelectedCluster}
              onSubmitReport={async (data) => {
                const reportData: ClusterWeeklyReportInput = {
                  cluster: data.cluster,
                  year: data.year,
                  week_number: data.week_number,
                  meeting_date: data.meeting_date,
                  gathering_type: data.gathering_type,
                  members_attended: data.members_attended || [],
                  visitors_attended: data.visitors_attended || [],
                  prospects_invited: data.prospects_invited || [],
                  new_prospects: data.new_prospects || [],
                  new_visitors: data.new_visitors || [],
                  prospects_attended: data.prospects_attended || [],
                  activities_held: data.activities_held || "",
                  prayer_requests: data.prayer_requests || "",
                  testimonies: data.testimonies || "",
                  offerings: String(data.offerings || 0),
                  highlights: data.highlights || "",
                  lowlights: data.lowlights || "",
                  submitted_by: data.submitted_by ?? undefined,
                };

                if (editingReport) {
                  await onUpdateReport(editingReport.id, reportData);
                } else {
                  await onCreateReport(reportData);
                }
              }}
            />
          </div>
        )}

        {/* Cluster Modal */}
        <Modal
          isOpen={!isDesktop && isClusterModalOpen}
          onClose={onCloseClusterModal}
          title={
            clusterViewMode === "view"
              ? ""
              : editCluster
              ? "Edit Cluster"
              : "Create Cluster"
          }
          hideHeader={clusterViewMode === "view" && !!viewCluster}
          closeOnOutsideClick={clusterViewMode === "view" && !!viewCluster}
        >
          {renderClusterFlow(false)}
        </Modal>

        {/* Mark Inactive Confirmation */}
        <ConfirmationModal
          isOpen={markInactiveConfirmation.isOpen}
          onClose={onCloseMarkInactiveConfirmation}
          onConfirm={onConfirmMarkInactiveCluster}
          title="Mark Cluster Inactive"
          message={
            markInactiveConfirmation.cluster
              ? `Mark "${
                  markInactiveConfirmation.cluster.name ||
                  markInactiveConfirmation.cluster.code
                }" as inactive? It will be hidden from the default active list.`
              : "Mark this cluster as inactive?"
          }
          confirmText="Mark Inactive"
          cancelText="Cancel"
          variant="warning"
          loading={markInactiveConfirmation.loading}
        />

        {/* Delete Cluster Confirmation (admin only) */}
        <ConfirmationModal
          isOpen={clusterDeleteConfirmation.isOpen}
          onClose={onCloseDeleteConfirmation}
          onConfirm={onConfirmDeleteCluster}
          title="Delete Cluster Permanently"
          message={
            clusterDeleteConfirmation.cluster
              ? `Are you sure you want to delete "${
                  clusterDeleteConfirmation.cluster.name ||
                  clusterDeleteConfirmation.cluster.code
                }"? This will also delete all associated weekly reports. This action cannot be undone.`
              : "Are you sure you want to delete this cluster?"
          }
          confirmText="Delete Cluster"
          cancelText="Cancel"
          variant="danger"
          loading={clusterDeleteConfirmation.loading}
        />

        <ConfirmationModal
          isOpen={bulkMarkInactiveConfirmation.isOpen}
          onClose={onCloseBulkMarkInactiveConfirmation}
          onConfirm={onConfirmBulkMarkInactiveClusters}
          title="Mark Selected Clusters as Inactive"
          message={`Mark ${selectedClustersCount} selected cluster(s) as inactive? They will be hidden from the default active list.`}
          confirmText="Mark as Inactive"
          cancelText="Cancel"
          variant="warning"
          loading={bulkMarkInactiveConfirmation.loading}
        />

        {onBulkDelete && (
        <ConfirmationModal
          isOpen={bulkDeleteConfirmation.isOpen}
          onClose={onCloseBulkDeleteConfirmation}
          onConfirm={onConfirmBulkDeleteClusters}
          title="Delete Selected Clusters"
          message={`Are you sure you want to permanently delete ${selectedClustersCount} selected cluster(s)? This will also delete all associated weekly reports. This action cannot be undone.`}
          confirmText="Delete Clusters"
          cancelText="Cancel"
          variant="danger"
          loading={bulkDeleteConfirmation.loading}
        />
        )}

        {/* Assign Members Modal */}
        {assignMembersModal.cluster && (
          <AssignMembersModal
            cluster={assignMembersModal.cluster as any}
            peopleUI={peopleUI}
            isOpen={assignMembersModal.isOpen}
            onClose={onCloseAssignMembers}
            onAssignMembers={async (memberIds: string[]) => {
              await onAssignMembers(memberIds.map(Number));
            }}
          />
        )}

        {/* Cluster Over Person Modal */}
        {showClusterOverPerson && clusterOverPerson && (
          <Modal
            isOpen={showClusterOverPerson}
            onClose={onCloseClusterOverPerson}
            title=""
            hideHeader
            className="!mt-0 z-[50]"
          >
            <ClusterView
              cluster={clusterOverPerson as any}
              clusterMembers={resolveClusterRosterPeople(
                clusterOverPerson as Cluster,
                peopleUI
              )}
              clusterFamilies={resolveClusterRosterFamilies(
                clusterOverPerson as Cluster,
                families
              )}
              coordinator={peopleUI.find(
                (p) => p.id === clusterOverPerson.coordinator?.id?.toString()
              )}
              onEdit={() => {
                onOpenEditClusterOverlay(clusterOverPerson);
              }}
              onDelete={() => {}}
              onClose={onCloseClusterOverPerson}
              onAssignMembers={() => onOpenAssignMembers(clusterOverPerson)}
              onSubmitReport={() => {
                // Switch to reports tab and open form with cluster selected
                onTabChange("reports");
                onOpenReportForm(clusterOverPerson);
              }}
              onViewFamily={onViewFamily}
              onViewPerson={onViewPerson}
              showSubmitReportButton={
                !hasClusterModuleWideAccess &&
                userCanManageCluster(
                  clusterOverPerson as Cluster,
                  clusterAuthCtx,
                )
              }
              canManageCluster={userCanManageCluster(
                clusterOverPerson as Cluster,
                clusterAuthCtx,
              )}
            />
          </Modal>
        )}

        {/* Edit Cluster Overlay Modal */}
        {showEditClusterOverlay && editClusterOverlay && (
          <Modal
            isOpen={showEditClusterOverlay}
            onClose={onCloseEditClusterOverlay}
            title="Edit Cluster"
            className="!mt-0 z-[50]"
            closeOnOutsideClick={false}
          >
            <ClusterForm
              initialData={editClusterOverlay}
              onNeedCatalogs={() => {
                onNeedPeopleCatalog?.();
                onNeedFamiliesCatalog?.();
              }}
              onSubmit={async (data) => {
                await onUpdateClusterOverlay(data);
              }}
              onCancel={onCloseEditClusterOverlay}
              error={null}
              submitting={false}
            />
          </Modal>
        )}

        {/* Person Profile Modal (overlays View Cluster modal) */}
        {!isDesktop && showPersonOverCluster && personOverCluster && (
          <Modal
            isOpen={showPersonOverCluster}
            onClose={onClosePersonOverCluster}
            title=""
            hideHeader
            className="!mt-0 z-[50]"
          >
            {renderPersonFlow(false)}
          </Modal>
        )}

        {/* Family View Modal (overlays View Cluster modal) */}
        {!isDesktop && showFamilyOverCluster && familyOverCluster && (
          <Modal
            isOpen={showFamilyOverCluster}
            onClose={onCloseFamilyOverCluster}
            title=""
            hideHeader
            className="!mt-0 z-[50]"
          >
            {renderFamilyFlow(false)}
          </Modal>
        )}
      </div>
    </DashboardLayout>
  );
}
