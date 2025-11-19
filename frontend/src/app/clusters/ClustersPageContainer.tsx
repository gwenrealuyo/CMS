"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useClusters, useClusterReports } from "@/src/hooks/useClusters";
import { usePeople } from "@/src/hooks/usePeople";
import { useFamilies } from "@/src/hooks/useFamilies";
import { ClusterContentTab } from "@/src/components/clusters/ClusterContentTabs";
import ClustersPageView from "./ClustersPageView";
import { Cluster, ClusterInput } from "@/src/types/cluster";
import { ClusterWeeklyReport, ClusterWeeklyReportInput } from "@/src/types/cluster";
import { Person, PersonUI, Family } from "@/src/types/person";
import { clustersApi } from "@/src/lib/api";
import { FilterCondition } from "@/src/components/people/FilterBar";

export default function ClustersPageContainer() {
  const [activeTab, setActiveTab] = useState<ClusterContentTab>("clusters");
  
  // Cluster state
  const [allClusters, setAllClusters] = useState<Cluster[]>([]);
  const [clustersLoading, setClustersLoading] = useState(true);
  const [clusterSearchQuery, setClusterSearchQuery] = useState("");
  const [clusterActiveFilters, setClusterActiveFilters] = useState<FilterCondition[]>([]);
  const [clusterSortBy, setClusterSortBy] = useState<string>("name");
  const [clusterSortOrder, setClusterSortOrder] = useState<"asc" | "desc">("asc");
  const [clusterCurrentPage, setClusterCurrentPage] = useState(1);
  const [clusterItemsPerPage, setClusterItemsPerPage] = useState(12);
  const [selectedClusters, setSelectedClusters] = useState<Set<string>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  
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
  const [clusterFilterDropdownPosition, setClusterFilterDropdownPosition] = useState({
    top: 0,
    left: 0,
  });
  const [clusterFilterCardPosition, setClusterFilterCardPosition] = useState({
    top: 0,
    left: 0,
  });
  const [clusterSortDropdownPosition, setClusterSortDropdownPosition] = useState({
    top: 0,
    left: 0,
  });
  
  // Overlay modals
  const [showClusterOverPerson, setShowClusterOverPerson] = useState(false);
  const [clusterOverPerson, setClusterOverPerson] = useState<Cluster | null>(null);
  const [showFamilyOverCluster, setShowFamilyOverCluster] = useState(false);
  const [familyOverCluster, setFamilyOverCluster] = useState<Family | null>(null);
  const [showPersonOverCluster, setShowPersonOverCluster] = useState(false);
  const [personOverCluster, setPersonOverCluster] = useState<Person | null>(null);
  const [showEditClusterOverlay, setShowEditClusterOverlay] = useState(false);
  const [editClusterOverlay, setEditClusterOverlay] = useState<Cluster | null>(null);
  
  // Reports state
  const {
    reports,
    loading: reportsLoading,
    error: reportsError,
    createReport,
    updateReport,
    deleteReport,
    refetch: refetchReports,
  } = useClusterReports();
  
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
  
  const { people, peopleUI } = usePeople();
  const { families } = useFamilies();
  
  // Fetch clusters
  const fetchClusters = useCallback(async () => {
    try {
      setClustersLoading(true);
      const res = await clustersApi.getAll();
      const clusterData = res.data;
      setAllClusters(clusterData);
    } catch (e) {
      console.error("Failed to load clusters", e);
    } finally {
      setClustersLoading(false);
    }
  }, []);
  
  useEffect(() => {
    fetchClusters();
  }, [fetchClusters]);
  
  // Apply cluster filters using useMemo for better performance
  const clusters = useMemo(() => {
    let filtered = [...allClusters];
    
    // Apply search filter
    if (clusterSearchQuery) {
      const q = clusterSearchQuery.toLowerCase();
      filtered = filtered.filter((c) => {
        const name = (c.name || "").toLowerCase();
        const code = (c.code || "").toLowerCase();
        const desc = (c.description || "").toLowerCase();
        const loc = c.location?.toLowerCase() || "";
        const schedule = c.meeting_schedule?.toLowerCase() || "";
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
        const filterValue = (filter.value as string).toLowerCase();
        
        switch (filter.field) {
          case "name": {
            const clusterName = (cluster.name || "").toLowerCase();
            switch (filter.operator) {
              case "contains":
                return clusterName.includes(filterValue);
              case "is":
                return clusterName === filterValue;
              case "is_not":
                return clusterName !== filterValue;
              case "starts_with":
                return clusterName.startsWith(filterValue);
              case "ends_with":
                return clusterName.endsWith(filterValue);
              default:
                return clusterName.includes(filterValue);
            }
          }
          case "code": {
            const clusterCode = (cluster.code || "").toLowerCase();
            switch (filter.operator) {
              case "contains":
                return clusterCode.includes(filterValue);
              case "is":
                return clusterCode === filterValue;
              case "is_not":
                return clusterCode !== filterValue;
              case "starts_with":
                return clusterCode.startsWith(filterValue);
              case "ends_with":
                return clusterCode.endsWith(filterValue);
              default:
                return clusterCode.includes(filterValue);
            }
          }
          case "coordinator": {
            const coordinator = peopleUI.find(
              (person) => person.id === cluster.coordinator?.id?.toString()
            );
            const coordinatorName = coordinator
              ? `${coordinator.first_name} ${coordinator.last_name}`.toLowerCase()
              : "";
            switch (filter.operator) {
              case "contains":
                return coordinatorName.includes(filterValue);
              case "is":
                return coordinatorName === filterValue;
              case "is_not":
                return coordinatorName !== filterValue;
              case "starts_with":
                return coordinatorName.startsWith(filterValue);
              case "ends_with":
                return coordinatorName.endsWith(filterValue);
              default:
                return coordinatorName.includes(filterValue);
            }
          }
          case "location": {
            const location = cluster.location?.toLowerCase() || "";
            switch (filter.operator) {
              case "contains":
                return location.includes(filterValue);
              case "is":
                return location === filterValue;
              case "is_not":
                return location !== filterValue;
              case "starts_with":
                return location.startsWith(filterValue);
              case "ends_with":
                return location.endsWith(filterValue);
              default:
                return location.includes(filterValue);
            }
          }
          case "meeting_schedule": {
            const schedule = cluster.meeting_schedule?.toLowerCase() || "";
            switch (filter.operator) {
              case "contains":
                return schedule.includes(filterValue);
              case "is":
                return schedule === filterValue;
              case "is_not":
                return schedule !== filterValue;
              case "starts_with":
                return schedule.startsWith(filterValue);
              case "ends_with":
                return schedule.endsWith(filterValue);
              default:
                return schedule.includes(filterValue);
            }
          }
          case "member_count": {
            const memberCount = cluster.members?.length || 0;
            if (filter.operator === "between" && Array.isArray(filter.value)) {
              const [min, max] = filter.value;
              return (
                memberCount >= parseInt(min.toString()) &&
                memberCount <= parseInt(max.toString())
              );
            } else if (filter.operator === "greater_than") {
              return memberCount > parseInt(filter.value.toString());
            } else if (filter.operator === "less_than") {
              return memberCount < parseInt(filter.value.toString());
            } else {
              // is or is_not
              const filterCount = parseInt(filter.value.toString());
              return filter.operator === "is_not"
                ? memberCount !== filterCount
                : memberCount === filterCount;
            }
          }
          case "family_count": {
            const familyCount = cluster.families?.length || 0;
            if (filter.operator === "between" && Array.isArray(filter.value)) {
              const [minFam, maxFam] = filter.value;
              return (
                familyCount >= parseInt(minFam.toString()) &&
                familyCount <= parseInt(maxFam.toString())
              );
            } else if (filter.operator === "greater_than") {
              return familyCount > parseInt(filter.value.toString());
            } else if (filter.operator === "less_than") {
              return familyCount < parseInt(filter.value.toString());
            } else {
              // is or is_not
              const filterCount = parseInt(filter.value.toString());
              return filter.operator === "is_not"
                ? familyCount !== filterCount
                : familyCount === filterCount;
            }
          }
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
          aValue = a.members?.length || 0;
          bValue = b.members?.length || 0;
          break;
        case "visitor_count":
          const aVisitors = (a.members || []).filter((memberId: number) => {
            const person = peopleUI.find((p) => p.id === memberId.toString());
            return person?.role === "VISITOR";
          }).length;
          const bVisitors = (b.members || []).filter((memberId: number) => {
            const person = peopleUI.find((p) => p.id === memberId.toString());
            return person?.role === "VISITOR";
          }).length;
          aValue = aVisitors;
          bValue = bVisitors;
          break;
        case "family_count":
          aValue = a.families?.length || 0;
          bValue = b.families?.length || 0;
          break;
        case "created_at":
          aValue = new Date(a.created_at || 0);
          bValue = new Date(b.created_at || 0);
          break;
        default:
          aValue = (a.name || "").toLowerCase();
          bValue = (b.name || "").toLowerCase();
      }
      
      if (aValue < bValue) return clusterSortOrder === "asc" ? -1 : 1;
      if (aValue > bValue) return clusterSortOrder === "asc" ? 1 : -1;
      return 0;
    });
    
    return filtered;
  }, [allClusters, clusterSearchQuery, clusterActiveFilters, clusterSortBy, clusterSortOrder, peopleUI]);
  
  // Pagination
  const clusterTotalPages = Math.ceil(clusters.length / clusterItemsPerPage);
  const clusterStartIndex = (clusterCurrentPage - 1) * clusterItemsPerPage;
  const clusterEndIndex = clusterStartIndex + clusterItemsPerPage;
  const clusterPaginatedData = clusters.slice(clusterStartIndex, clusterEndIndex);
  
  useEffect(() => {
    setClusterCurrentPage(1);
  }, [clusterSearchQuery, clusterActiveFilters, clusterSortBy, clusterSortOrder]);
  
  // Cluster handlers
  const handleCreateCluster = async (data: ClusterInput) => {
    try {
      await clustersApi.create(data);
      await fetchClusters();
      setIsClusterModalOpen(false);
    } catch (error) {
      console.error("Error creating cluster:", error);
      throw error;
    }
  };
  
  const handleUpdateCluster = async (data: Partial<ClusterInput>) => {
    if (editCluster) {
      try {
        const updatedCluster = await clustersApi.update(editCluster.id, data);
        
        // Optimistically update the cluster in the list instead of refetching all
        setAllClusters((prev) =>
          prev.map((c) => (c.id === editCluster.id ? updatedCluster.data : c))
        );
        
        if (viewCluster) {
          setViewCluster(updatedCluster.data);
          setEditCluster(null);
          setClusterViewMode("view");
        } else {
          setIsClusterModalOpen(false);
          setEditCluster(null);
          setViewCluster(null);
          setClusterViewMode("view");
        }
      } catch (error) {
        console.error("Error updating cluster:", error);
        // On error, refetch to ensure consistency
        await fetchClusters();
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
        setIsClusterModalOpen(false);
        setViewCluster(null);
      } catch (error) {
        console.error("Error deleting cluster:", error);
        setClusterDeleteConfirmation((prev) => ({ ...prev, loading: false }));
      }
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

  // Bulk delete handler
  const handleBulkDelete = async () => {
    if (selectedClusters.size === 0) return;
    
    const confirmMessage = `Are you sure you want to delete ${selectedClusters.size} cluster(s)? This action cannot be undone.`;
    if (!window.confirm(confirmMessage)) return;

    try {
      const deletePromises = Array.from(selectedClusters).map((clusterId) =>
        clustersApi.delete(Number(clusterId))
      );
      await Promise.all(deletePromises);
      await fetchClusters();
      setSelectedClusters(new Set());
    } catch (error) {
      console.error("Error deleting clusters:", error);
      alert("Failed to delete some clusters. Please try again.");
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
        : "N/A";

      const members = peopleUI.filter((person) =>
        (cluster as any).members?.includes(Number(person.id))
      );
      const memberCount = members.filter((m) => m.role === "MEMBER").length;
      const visitorCount = members.filter((m) => m.role === "VISITOR").length;

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
  
  const confirmClusterDelete = (cluster: Cluster) => {
    setClusterDeleteConfirmation({
      isOpen: true,
      cluster,
      loading: false,
    });
  };
  
  const handleAssignMembers = async (memberIds: number[]) => {
    if (assignMembersModal.cluster) {
      try {
        const updatedCluster = await clustersApi.update(assignMembersModal.cluster.id, {
          members: memberIds,
          families: assignMembersModal.cluster.families || [],
        } as Partial<ClusterInput>);
        
        // Optimistically update the cluster in the list instead of refetching all
        setAllClusters((prev) =>
          prev.map((c) => (c.id === assignMembersModal.cluster!.id ? updatedCluster.data : c))
        );
        
        // Update viewCluster if it's the same cluster
        if (viewCluster && viewCluster.id === assignMembersModal.cluster.id) {
          setViewCluster(updatedCluster.data);
        }
        
        // Update clusterOverPerson if it's the same cluster
        if (clusterOverPerson && clusterOverPerson.id === assignMembersModal.cluster.id) {
          setClusterOverPerson(updatedCluster.data);
        }
        
        setAssignMembersModal({ isOpen: false, cluster: null });
      } catch (error) {
        console.error("Error assigning members:", error);
        // On error, refetch to ensure consistency
        await fetchClusters();
        throw error;
      }
    }
  };
  
  // Filter handlers
  const handleClusterAddFilter = (anchorRect: DOMRect) => {
    const dropdownWidth = 256;
    const viewportWidth = window.innerWidth;
    const rightEdge = anchorRect.left + dropdownWidth;
    
    let left = anchorRect.left;
    if (rightEdge > viewportWidth) {
      left = viewportWidth - dropdownWidth - 16;
    }
    
    setClusterFilterDropdownPosition({
      top: anchorRect.bottom + 8,
      left: Math.max(16, left),
    });
    setShowClusterFilterDropdown(true);
  };
  
  const handleClusterSelectField = (field: any) => {
    setSelectedClusterField(field);
    setShowClusterFilterDropdown(false);
    
    const cardWidth = 320;
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
  
  const handleClusterSortDropdown = (anchorRect: DOMRect) => {
    const dropdownWidth = 256;
    const viewportWidth = window.innerWidth;
    const rightEdge = anchorRect.left + dropdownWidth;
    
    let left = anchorRect.left;
    if (rightEdge > viewportWidth) {
      left = viewportWidth - dropdownWidth - 16;
    }
    
    setClusterSortDropdownPosition({
      top: anchorRect.bottom + 8,
      left: Math.max(16, left),
    });
    setShowClusterSortDropdown(true);
  };
  
  const handleClusterSelectSort = (sortBy: string, sortOrder: "asc" | "desc") => {
    setClusterSortBy(sortBy);
    setClusterSortOrder(sortOrder);
    setShowClusterSortDropdown(false);
  };
  
  // Report handlers
  const handleCreateReport = async (data: ClusterWeeklyReportInput) => {
    try {
      await createReport(data);
      setReportFormOpen(false);
      setReportSelectedCluster(null);
      refetchReports();
    } catch (error: any) {
      throw error;
    }
  };
  
  const handleUpdateReport = async (id: number, data: Partial<ClusterWeeklyReportInput>) => {
    try {
      await updateReport(id, data);
      setEditingReport(null);
      setReportFormOpen(false);
      refetchReports();
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
      // Clusters tab
      allClusters={allClusters}
      clusters={clusters}
      clustersLoading={clustersLoading}
      clusterSearchQuery={clusterSearchQuery}
      onClusterSearchChange={setClusterSearchQuery}
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
      clusterFilterDropdownPosition={clusterFilterDropdownPosition}
      clusterFilterCardPosition={clusterFilterCardPosition}
      clusterSortDropdownPosition={clusterSortDropdownPosition}
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
        setViewCluster(cluster);
        setClusterViewMode("view");
        setIsClusterModalOpen(true);
      }}
      onEditCluster={(cluster) => {
        setEditCluster(cluster);
        setClusterViewMode("edit");
        setIsClusterModalOpen(true);
      }}
      onDeleteCluster={confirmClusterDelete}
      onCreateCluster={() => {
        setEditCluster(null);
        setViewCluster(null);
        setClusterViewMode("edit");
        setIsClusterModalOpen(true);
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
      }}
      clusterDeleteConfirmation={clusterDeleteConfirmation}
      onConfirmDeleteCluster={handleDeleteCluster}
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
      onOpenAssignMembers={(cluster) => setAssignMembersModal({ isOpen: true, cluster })}
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
      onOpenEditClusterOverlay={(cluster) => {
        setEditClusterOverlay(cluster);
        setShowEditClusterOverlay(true);
      }}
      onUpdateClusterOverlay={async (data) => {
        if (editClusterOverlay) {
          try {
            const updated = await clustersApi.update(editClusterOverlay.id, data);
            
            // Optimistically update the cluster in the list
            setAllClusters((prev) =>
              prev.map((c) => (c.id === editClusterOverlay.id ? updated.data : c))
            );
            
            // Update clusterOverPerson if it's the same cluster
            if (clusterOverPerson && clusterOverPerson.id === editClusterOverlay.id) {
              setClusterOverPerson(updated.data);
            }
            
            // Update viewCluster if it's the same cluster
            if (viewCluster && viewCluster.id === editClusterOverlay.id) {
              setViewCluster(updated.data);
            }
            
            setShowEditClusterOverlay(false);
            setEditClusterOverlay(null);
          } catch (error) {
            console.error("Error updating cluster overlay:", error);
            // On error, refetch to ensure consistency
            await fetchClusters();
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
        setReportSelectedCluster(cluster || null);
        setReportFormOpen(true);
      }}
      onCloseReportForm={() => {
        setReportFormOpen(false);
        setEditingReport(null);
        setReportSelectedCluster(null);
      }}
      editingReport={editingReport}
      onEditReport={(report) => {
        const cluster = allClusters.find((c) => c.id === report.cluster);
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
        setFamilyOverCluster(f);
        setShowFamilyOverCluster(true);
      }}
      onViewPerson={(p) => {
        setPersonOverCluster(p);
        setShowPersonOverCluster(true);
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
      onBulkDelete={handleBulkDelete}
      onBulkExport={handleBulkExport}
    />
  );
}
