"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import DashboardLayout from "@/src/components/layout/DashboardLayout";
import PersonForm from "@/src/components/people/PersonForm";
import PersonProfile from "@/src/components/people/PersonProfile";
import FamilyCard from "@/src/components/families/FamilyCard";
import FamilyForm from "@/src/components/families/FamilyForm";
import FamilyManagementDashboard from "@/src/components/families/FamilyManagementDashboard";
import Button from "@/src/components/ui/Button";
import Modal from "@/src/components/ui/Modal";
import ConfirmationModal from "@/src/components/ui/ConfirmationModal";
import FamilyView from "@/src/components/families/FamilyView";
import FilterBar, { FilterCondition } from "@/src/components/people/FilterBar";
import FilterDropdown from "@/src/components/people/FilterDropdown";
import FilterCard from "@/src/components/people/FilterCard";
import ClusterFilterDropdown from "@/src/components/clusters/ClusterFilterDropdown";
import ClusterFilterCard from "@/src/components/clusters/ClusterFilterCard";
import ClusterSortDropdown from "@/src/components/clusters/ClusterSortDropdown";
import ClusterCard from "@/src/components/clusters/ClusterCard";
import Pagination from "@/src/components/ui/Pagination";
import DataTable from "@/src/components/people/DataTable";
import { Person, PersonUI, Family, Cluster } from "@/src/types/person";
import { usePeople } from "@/src/hooks/usePeople";
import { useFamilies } from "@/src/hooks/useFamilies";
import { clustersApi, peopleApi } from "@/src/lib/api";
import ClusterForm from "@/src/components/clusters/ClusterForm";
import ClusterView from "@/src/components/clusters/ClusterView";
import AssignMembersModal from "@/src/components/clusters/AssignMembersModal";
import AddFamilyMemberModal from "@/src/components/families/AddFamilyMemberModal";
import ClusterReportsDashboard from "@/src/components/reports/ClusterReportsDashboard";
import ActionMenu from "@/src/components/families/ActionMenu";

export default function PeoplePage() {
  const [activeTab, setActiveTab] = useState<
    "people" | "families" | "clusters" | "reports"
  >("people");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState<"person" | "family" | "cluster">(
    "person"
  );
  const [viewEditPerson, setViewEditPerson] = useState<Person | null>(null);
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
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [activeFilters, setActiveFilters] = useState<FilterCondition[]>([]);
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [showFilterCard, setShowFilterCard] = useState(false);
  const [selectedField, setSelectedField] = useState<any>(null);
  const [filterDropdownPosition, setFilterDropdownPosition] = useState({
    top: 0,
    left: 0,
  });
  const [filterCardPosition, setFilterCardPosition] = useState({
    top: 0,
    left: 0,
  });

  const {
    people,
    peopleUI,
    createPerson,
    deletePerson,
    updatePerson,
    refreshPeople,
  } = usePeople();

  const {
    families,
    createFamily,
    updateFamily,
    deleteFamily,
    refreshFamilies,
  } = useFamilies();

  // Clusters
  const [allClusters, setAllClusters] = useState<Cluster[]>([]);
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [clustersLoading, setClustersLoading] = useState<boolean>(false);
  const [clusterSearchQuery, setClusterSearchQuery] = useState<string>("");
  const [clusterActiveFilters, setClusterActiveFilters] = useState<
    FilterCondition[]
  >([]);
  const [clusterSortBy, setClusterSortBy] = useState<string>("name");
  const [clusterSortOrder, setClusterSortOrder] = useState<"asc" | "desc">(
    "asc"
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
    "view"
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

  // Debounced search for better performance
  const handleSearchChange = useCallback((query: string) => {
    setSearchQuery(query);
    setIsSearching(true);

    // Clear existing timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // Set new timeout for debounced search
    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedSearchQuery(query);
      setIsSearching(false);
    }, 300); // 300ms delay
  }, []);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
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
                (person) => person.id === (cluster as any).coordinator
              );
              const coordinatorName = coordinator
                ? `${coordinator.first_name} ${coordinator.last_name}`.toLowerCase()
                : "";
              return coordinatorName.includes(
                (filter.value as string).toLowerCase()
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
    clusterEndIndex
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
    sortOrder: "asc" | "desc"
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
    sortOrder: "asc" | "desc"
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
      await clustersApi.create(data as any);
      await fetchClusters();
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
        const updatedCluster = await clustersApi.update(
          editCluster.id,
          data as any
        );
        await fetchClusters();

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
        await clustersApi.update(assignMembersModal.cluster.id, {
          members: memberIds,
        } as any);
        await fetchClusters();

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
            (f: Family) => f.id === viewFamily.id
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
        await peopleApi.delete(personDeleteConfirmation.person.id);
        await refreshPeople();
        setPersonDeleteConfirmation({
          isOpen: false,
          person: null,
          loading: false,
        });
        setIsModalOpen(false);
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

  // Memoized search function for better performance
  const searchPeople = useCallback((people: PersonUI[], query: string) => {
    if (!query.trim()) return people;

    const lowerQuery = query.toLowerCase();
    const searchTerms = lowerQuery.split(" ").filter((term) => term.length > 0);

    return people.filter((person) => {
      // Create searchable text from all relevant fields
      const searchableText = [
        person.name || "",
        person.email || "",
        person.phone || "",
        person.first_name || "",
        person.last_name || "",
        person.member_id || "",
        person.facebook_name || "",
      ]
        .join(" ")
        .toLowerCase();

      // Check if all search terms are present (AND logic)
      return searchTerms.every((term) => searchableText.includes(term));
    });
  }, []);

  const filteredPeopleUI = useMemo(() => {
    let filtered = peopleUI;

    // Apply active filters first (more selective)
    if (activeFilters.length > 0) {
      filtered = filtered.filter((person) => {
        return activeFilters.every((filter) => {
          const fieldValue = person[filter.field as keyof PersonUI];

          switch (filter.operator) {
            case "is":
              return fieldValue === filter.value;
            case "is_not":
              return fieldValue !== filter.value;
            case "contains":
              return fieldValue
                ?.toString()
                .toLowerCase()
                .includes(filter.value.toString().toLowerCase());
            case "starts_with":
              return fieldValue
                ?.toString()
                .toLowerCase()
                .startsWith(filter.value.toString().toLowerCase());
            case "ends_with":
              return fieldValue
                ?.toString()
                .toLowerCase()
                .endsWith(filter.value.toString().toLowerCase());
            case "before":
              if (
                filter.field === "date_first_attended" ||
                filter.field === "birth_date"
              ) {
                return (
                  new Date(fieldValue as string) <
                  new Date(filter.value as string)
                );
              }
              return false;
            case "after":
              if (
                filter.field === "date_first_attended" ||
                filter.field === "birth_date"
              ) {
                return (
                  new Date(fieldValue as string) >
                  new Date(filter.value as string)
                );
              }
              return false;
            case "between":
              if (Array.isArray(filter.value)) {
                const [start, end] = filter.value;
                if (
                  filter.field === "date_first_attended" ||
                  filter.field === "birth_date"
                ) {
                  const date = new Date(fieldValue as string);
                  return date >= new Date(start) && date <= new Date(end);
                }
              }
              return false;
            case "greater_than":
              return Number(fieldValue) > Number(filter.value);
            case "less_than":
              return Number(fieldValue) < Number(filter.value);
            default:
              return true;
          }
        });
      });
    }

    // Apply search query filter (using optimized search function)
    if (debouncedSearchQuery) {
      filtered = searchPeople(filtered, debouncedSearchQuery);
    }

    // Filter out admin users and users without a name (always last)
    filtered = filtered.filter(
      (person) =>
        person.username !== "admin" && (person.first_name || person.last_name)
    );

    return filtered;
  }, [peopleUI, debouncedSearchQuery, activeFilters, searchPeople]);

  // const handleCreatePerson = (personData: Partial<Person>) => {
  //   const newPerson = {
  //     ...personData,
  //     id: Date.now().toString(),
  //     dateFirstAttended: new Date(),
  //     milestones: [],
  //   } as Person;
  //   setPeople([...people, newPerson]);
  //   setIsModalOpen(false);
  // };

  const handleCreatePerson = async (personData: Partial<Person>) => {
    try {
      const result = await createPerson(personData);
      setIsModalOpen(false);
      return result; // Return the created person for milestone handling
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
    try {
      await updateFamily(editFamily.id, familyData);
      setIsModalOpen(false);
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
    return people.filter((person) => family.members.includes(person.id));
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
        bulkDeleteConfirmation.people.map((person) => deletePerson(person.id))
      );
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
    format: "excel" | "pdf" | "csv"
  ) => {
    // The export functionality is handled within DataTable component
    console.log(`Exporting ${people.length} people to ${format}`);
  };

  // Filter handlers
  const handleAddFilter = (anchorRect?: DOMRect) => {
    if (anchorRect) {
      const dropdownWidth = 256; // w-64 in FilterDropdown
      const viewportWidth = window.innerWidth + window.scrollX;
      const desiredLeft = Math.round(anchorRect.left + window.scrollX);
      const clampedLeft = Math.max(
        8,
        Math.min(desiredLeft, viewportWidth - dropdownWidth - 8)
      );
      setFilterDropdownPosition({
        top: Math.round(anchorRect.bottom + window.scrollY + 8),
        left: clampedLeft,
      });
    } else {
      setFilterDropdownPosition({ top: 200, left: 100 });
    }
    setShowFilterDropdown(true);
  };

  const handleSelectField = (field: any) => {
    setSelectedField(field);
    setShowFilterDropdown(false);

    // Position filter card
    const cardWidth = 320; // w-80 in FilterCard
    const viewportWidth = window.innerWidth + window.scrollX;
    const desiredLeft = filterDropdownPosition.left;
    const clampedLeft = Math.max(
      8,
      Math.min(desiredLeft, viewportWidth - cardWidth - 8)
    );
    setFilterCardPosition({
      top: filterDropdownPosition.top + 8,
      left: clampedLeft,
    });
    setShowFilterCard(true);
  };

  const handleApplyFilter = (filter: FilterCondition) => {
    setActiveFilters([...activeFilters, filter]);
    setShowFilterCard(false);
    setSelectedField(null);
  };

  const handleRemoveFilter = (filterId: string) => {
    setActiveFilters(activeFilters.filter((f) => f.id !== filterId));
  };

  const handleClearAllFilters = () => {
    setActiveFilters([]);
  };

  return (
    <DashboardLayout>
      <div className="fixed top-16 left-64 right-0 z-20 bg-white py-4 px-6 flex justify-between items-center border-b border-gray-200">
        <div className="flex space-x-4">
          <button
            className={`px-4 py-2 font-medium rounded-md ${
              activeTab === "people"
                ? "bg-[#2563EB] text-white"
                : "text-gray-600 hover:text-gray-900"
            }`}
            onClick={() => setActiveTab("people")}
          >
            People
          </button>
          <button
            className={`px-4 py-2 font-medium rounded-md ${
              activeTab === "families"
                ? "bg-[#2563EB] text-white"
                : "text-gray-600 hover:text-gray-900"
            }`}
            onClick={() => setActiveTab("families")}
          >
            Families
          </button>
          <button
            className={`px-4 py-2 font-medium rounded-md ${
              activeTab === "clusters"
                ? "bg-[#2563EB] text-white"
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
                ? "bg-[#2563EB] text-white"
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
              setModalType(
                activeTab === "people"
                  ? "person"
                  : activeTab === "families"
                  ? "family"
                  : "cluster"
              );
              setIsModalOpen(true);
            }}
          >
            Add{" "}
            {activeTab === "people"
              ? "Person"
              : activeTab === "families"
              ? "Family"
              : "Cluster"}
          </Button>
        )}
      </div>

      <div className="pt-20">
        {activeTab === "people" && (
          <div className="space-y-6">
            <FilterBar
              searchQuery={searchQuery}
              onSearchChange={handleSearchChange}
              activeFilters={activeFilters}
              onRemoveFilter={handleRemoveFilter}
              onClearAllFilters={handleClearAllFilters}
              onAddFilter={handleAddFilter}
              isSearching={isSearching}
            />

            {/* Search Results Count */}
            {(searchQuery || activeFilters.length > 0) && (
              <div className="flex items-center justify-between text-sm text-gray-600">
                <div className="flex items-center gap-2">
                  <span>
                    {isSearching
                      ? "Searching..."
                      : `${filteredPeopleUI.length} result${
                          filteredPeopleUI.length !== 1 ? "s" : ""
                        } found`}
                  </span>
                  {filteredPeopleUI.length !== peopleUI.length && (
                    <span className="text-gray-400">
                      (of {peopleUI.length} total)
                    </span>
                  )}
                </div>
                {(searchQuery || activeFilters.length > 0) && (
                  <button
                    onClick={() => {
                      setSearchQuery("");
                      setDebouncedSearchQuery("");
                      setActiveFilters([]);
                    }}
                    className="text-blue-600 hover:text-blue-800 font-medium"
                  >
                    Clear all filters
                  </button>
                )}
              </div>
            )}

            <DataTable
              people={filteredPeopleUI as unknown as Person[]}
              onView={(p) => {
                setViewEditPerson(p);
                setViewMode("view");
                setIsModalOpen(true);
                setModalType("person");
              }}
              onEdit={(p) => {
                setViewEditPerson(p);
                setViewMode("edit");
                setIsModalOpen(true);
                setModalType("person");
              }}
              onDelete={async (p) => {
                if (confirm(`Delete ${p.username}?`)) {
                  await deletePerson(p.id);
                }
              }}
              onBulkDelete={handleBulkDelete}
              onBulkExport={handleBulkExport}
            />
          </div>
        )}

        {activeTab === "families" && (
          <FamilyManagementDashboard
            families={families}
            people={peopleUI}
            onCreateFamily={() => {
              setModalType("family");
              setIsModalOpen(true);
            }}
            onViewFamily={(family) => {
              setViewFamily(family);
              setFamilyViewMode("view");
              setModalType("family");
              setIsModalOpen(true);
            }}
            onEditFamily={(family) => {
              setEditFamily(family);
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
            onAssignMember={(personId, familyId) => {
              // TODO: Implement assign member functionality
              console.log("Assign member:", personId, "to family:", familyId);
            }}
            onRemoveMember={(personId, familyId) => {
              // TODO: Implement remove member functionality
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
                        <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                          <svg
                            className="w-4 h-4 text-blue-600"
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
                        <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
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
                            0
                          )}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center">
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
                                  (c as any).members?.includes(p.id)
                                )
                            ).length
                          }
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Search Bar for Clusters */}
                <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm mb-6">
                  <div className="flex items-center justify-between">
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
                          className={`w-full pl-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm ${
                            clusterSearchQuery ? "pr-10" : "pr-4"
                          }`}
                        />
                        {clusterSearchQuery && (
                          <button
                            type="button"
                            onClick={() => setClusterSearchQuery("")}
                            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
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
                    <div className="flex items-center gap-3 ml-4">
                      {/* Active Filters Display */}
                      {clusterActiveFilters.length > 0 && (
                        <div className="flex items-center gap-2">
                          {clusterActiveFilters.map((filter) => (
                            <span
                              key={filter.id}
                              className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200"
                            >
                              {filter.label}
                              <button
                                onClick={() => {
                                  const newFilters =
                                    clusterActiveFilters.filter(
                                      (f) => f.id !== filter.id
                                    );
                                  setClusterActiveFilters(newFilters);
                                }}
                                className="ml-1 text-blue-600 hover:text-blue-800"
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
                            className="text-xs text-gray-500 hover:text-gray-700"
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
                            ).getBoundingClientRect()
                          )
                        }
                        className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
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
                            ).getBoundingClientRect()
                          )
                        }
                        className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
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
          <ClusterReportsDashboard clusters={clusters} />
        )}
      </div>
      <Modal
        isOpen={isModalOpen}
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
          viewEditPerson
            ? viewMode === "view"
              ? ""
              : `Edit Profile`
            : viewFamily
            ? familyViewMode === "view"
              ? ""
              : "Edit Family"
            : editFamily
            ? `Edit Family`
            : viewCluster
            ? clusterViewMode === "view"
              ? ""
              : "Edit Cluster"
            : editCluster
            ? `Edit Cluster`
            : `Add New ${
                modalType === "person"
                  ? "Person"
                  : modalType === "family"
                  ? "Family"
                  : "Cluster"
              }`
        }
        hideHeader={
          !!(viewEditPerson && viewMode === "view") ||
          (!!viewFamily && familyViewMode === "view") ||
          (!!viewCluster && clusterViewMode === "view")
        }
      >
        {modalType === "person" ? (
          <>
            {viewEditPerson ? (
              viewMode === "view" ? (
                <PersonProfile
                  person={viewEditPerson}
                  onEdit={() => {
                    setViewMode("edit");
                  }}
                  onDelete={() => {
                    setPersonDeleteConfirmation({
                      isOpen: true,
                      person: viewEditPerson,
                      loading: false,
                    });
                  }}
                  onCancel={() => {
                    setIsModalOpen(false);
                    setViewEditPerson(null);
                  }}
                  onAddTimeline={() => {
                    setViewMode("edit");
                    setStartOnTimelineTab(true);
                  }}
                  onClose={() => {
                    setIsModalOpen(false);
                    setViewEditPerson(null);
                  }}
                />
              ) : (
                <PersonForm
                  initialData={viewEditPerson}
                  isEditingFromProfile={true}
                  startOnTimelineTab={startOnTimelineTab}
                  onSubmit={async (data) => {
                    const result = await updatePerson(viewEditPerson.id, data);
                    setIsModalOpen(false);
                    setViewEditPerson(null);
                    setStartOnTimelineTab(false);
                    return result; // Return for milestone handling
                  }}
                  onClose={() => {
                    setIsModalOpen(false);
                    setViewEditPerson(null);
                    setStartOnTimelineTab(false);
                  }}
                  onBackToProfile={() => {
                    setViewMode("view");
                    setStartOnTimelineTab(false);
                  }}
                />
              )
            ) : (
              <PersonForm
                onSubmit={handleCreatePerson}
                onClose={() => setIsModalOpen(false)}
              />
            )}
          </>
        ) : modalType === "family" ? (
          <>
            {viewFamily ? (
              familyViewMode === "view" ? (
                <FamilyView
                  family={viewFamily}
                  familyMembers={peopleUI.filter((person) =>
                    viewFamily.members.includes(person.id)
                  )}
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
                  onCancel={() => {
                    setIsModalOpen(false);
                    setViewFamily(null);
                    setFamilyViewMode("view");
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
                  (viewCluster as any).members?.includes(person.id)
                )}
                clusterFamilies={families.filter((family) =>
                  (viewCluster as any).families?.includes(family.id)
                )}
                coordinator={peopleUI.find(
                  (person) => person.id === (viewCluster as any).coordinator
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
                onCancel={() => {
                  setIsModalOpen(false);
                  setViewCluster(null);
                  setClusterViewMode("view");
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
                  // Switch to reports tab and open the form for this cluster
                  setActiveTab("reports");
                  setIsModalOpen(false);
                  setViewCluster(null);
                  setClusterViewMode("view");
                }}
              />
            ) : editCluster ? (
              <ClusterForm
                onSubmit={handleUpdateCluster}
                onClose={() => {
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
                availableFamilies={families}
                availablePeople={people}
              />
            ) : (
              <ClusterForm
                onSubmit={handleCreateCluster}
                onClose={() => setIsModalOpen(false)}
                initialData={undefined}
                availableFamilies={families}
                availablePeople={people}
              />
            )}
          </>
        ) : (
          <ClusterForm
            onSubmit={handleCreateCluster}
            onClose={() => setIsModalOpen(false)}
            availableFamilies={families}
            availablePeople={people}
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

      <AssignMembersModal
        cluster={assignMembersModal.cluster!}
        peopleUI={peopleUI}
        isOpen={assignMembersModal.isOpen}
        onClose={() => setAssignMembersModal({ isOpen: false, cluster: null })}
        onAssignMembers={handleAssignMembers}
      />

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

      {/* Filter Dropdown */}
      <FilterDropdown
        isOpen={showFilterDropdown}
        onClose={() => setShowFilterDropdown(false)}
        onSelectField={handleSelectField}
        position={filterDropdownPosition}
      />

      {/* Filter Card */}
      {selectedField && (
        <FilterCard
          field={selectedField}
          isOpen={showFilterCard}
          onClose={() => {
            setShowFilterCard(false);
            setSelectedField(null);
          }}
          onApplyFilter={handleApplyFilter}
          position={filterCardPosition}
        />
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
    </DashboardLayout>
  );
}
