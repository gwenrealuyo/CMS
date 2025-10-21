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
import DataTable from "@/src/components/people/DataTable";
import { Person, PersonUI, Family, Cluster } from "@/src/types/person";
import { usePeople } from "@/src/hooks/usePeople";
import { useFamilies } from "@/src/hooks/useFamilies";
import { clustersApi } from "@/src/lib/api";
import ClusterForm from "@/src/components/clusters/ClusterForm";
import ClusterView from "@/src/components/clusters/ClusterView";
import ActionMenu from "@/src/components/families/ActionMenu";

export default function PeoplePage() {
  const [activeTab, setActiveTab] = useState<
    "people" | "families" | "clusters"
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

  const handleCreateCluster = async (data: Partial<Cluster>) => {
    await clustersApi.create(data as any);
    await fetchClusters();
    setIsModalOpen(false);
  };

  const handleUpdateCluster = async (data: Partial<Cluster>) => {
    if (editCluster) {
      await clustersApi.update(editCluster.id, data as any);
      await fetchClusters();
      setIsModalOpen(false);
      setEditCluster(null);
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
        console.error("Failed to delete cluster:", error);
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
      <div className="space-y-6">
        <div className="flex justify-between items-center">
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
          </div>
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
        </div>

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
                          onChange={(e) => {
                            const q = e.target.value.toLowerCase();
                            setClusterSearchQuery(e.target.value);
                            if (q === "") {
                              // If search is empty, show all clusters
                              setClusters(allClusters);
                            } else {
                              const filtered = allClusters.filter((c) => {
                                const name = (c.name || "").toLowerCase();
                                const code = (c.code || "").toLowerCase();
                                const desc = (
                                  c.description || ""
                                ).toLowerCase();
                                const loc =
                                  (c as any).location?.toLowerCase() || "";
                                const schedule =
                                  (c as any).meeting_schedule?.toLowerCase() ||
                                  "";
                                return (
                                  name.includes(q) ||
                                  code.includes(q) ||
                                  desc.includes(q) ||
                                  loc.includes(q) ||
                                  schedule.includes(q)
                                );
                              });
                              setClusters(filtered);
                            }
                          }}
                          className={`w-full pl-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm ${
                            clusterSearchQuery ? "pr-10" : "pr-4"
                          }`}
                        />
                        {clusterSearchQuery && (
                          <button
                            type="button"
                            onClick={() => {
                              setClusterSearchQuery("");
                              setClusters(allClusters);
                            }}
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
                  </div>
                </div>

                {/* Divider */}
                <div className="border-t border-gray-200 my-6"></div>

                {clusters.length === 0 ? (
                  <p className="text-sm text-gray-500">No clusters found.</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {clusters.map((c) => (
                      <div
                        key={c.id}
                        className="p-4 bg-white rounded-lg border border-gray-200 shadow-sm"
                      >
                        <div className="flex items-center justify-between">
                          <div className="min-w-0 flex-1">
                            <h4 className="font-semibold text-gray-900 truncate">
                              {c.name || "Untitled Cluster"}
                            </h4>
                            <div className="mt-1 flex items-center gap-2 flex-wrap text-xs">
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
                                {c.code || "—"}
                              </span>
                              {(c as any).location && (
                                <span className="inline-flex items-center gap-1 text-gray-600">
                                  <svg
                                    className="w-3.5 h-3.5 text-gray-500"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                    strokeWidth={2}
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      d="M12 11a3 3 0 100-6 3 3 0 000 6z"
                                    />
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      d="M19.5 10.5c0 7.5-7.5 11.25-7.5 11.25S4.5 18 4.5 10.5a7.5 7.5 0 1115 0z"
                                    />
                                  </svg>
                                  <span className="truncate max-w-[12rem]">
                                    {(c as any).location}
                                  </span>
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="ml-3 flex items-center gap-2">
                            <div className="flex items-center gap-1 text-gray-600">
                              <svg
                                className="w-4 h-4 text-gray-500"
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
                              <span className="text-xs font-medium">
                                {(c as any).members?.length ?? 0}
                              </span>
                            </div>
                            <ActionMenu
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
                          </div>
                        </div>
                        <div className="mt-2 text-sm text-gray-700">
                          {c.description || "No description"}
                        </div>
                        {(c as any).meeting_schedule && (
                          <div className="mt-2 flex items-center gap-2 text-sm text-gray-600">
                            <svg
                              className="w-4 h-4 text-gray-500"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={2}
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                              />
                            </svg>
                            <span>{(c as any).meeting_schedule}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
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
        }}
        title={
          viewEditPerson
            ? `${viewMode === "view" ? "View Profile" : "Edit Profile"} (${
                viewEditPerson.first_name
              } ${viewEditPerson.last_name})`
            : viewFamily
            ? `View Family (${viewFamily.name})`
            : editFamily
            ? `Edit Family (${editFamily.name})`
            : viewCluster
            ? `View Cluster (${viewCluster.name})`
            : editCluster
            ? `Edit Cluster (${editCluster.name})`
            : `Add New ${
                modalType === "person"
                  ? "Person"
                  : modalType === "family"
                  ? "Family"
                  : "Cluster"
              }`
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
                  onClose={() => {
                    setIsModalOpen(false);
                    setViewFamily(null);
                    setFamilyViewMode("view");
                  }}
                />
              ) : (
                <FamilyForm
                  onSubmit={handleUpdateFamily}
                  onClose={() => {
                    setIsModalOpen(false);
                    setEditFamily(null);
                    setViewFamily(null);
                    setFamilyViewMode("view");
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
            {viewCluster ? (
              clusterViewMode === "view" ? (
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
                  onClose={() => {
                    setIsModalOpen(false);
                    setViewCluster(null);
                  }}
                />
              ) : null
            ) : editCluster ? (
              <ClusterForm
                onSubmit={handleUpdateCluster}
                onClose={() => {
                  setIsModalOpen(false);
                  setEditCluster(null);
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
    </DashboardLayout>
  );
}
