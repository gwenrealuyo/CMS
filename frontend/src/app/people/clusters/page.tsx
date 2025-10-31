"use client";

import React, { useEffect, useState } from "react";
import { flushSync } from "react-dom";
import DashboardLayout from "@/src/components/layout/DashboardLayout";
import { clustersApi } from "@/src/lib/api";
import { Cluster } from "@/src/types/person";
import { usePeople } from "@/src/hooks/usePeople";
import ClusterCard from "@/src/components/clusters/ClusterCard";
import { useFamilies } from "@/src/hooks/useFamilies";
import Modal from "@/src/components/ui/Modal";
import Button from "@/src/components/ui/Button";
import ConfirmationModal from "@/src/components/ui/ConfirmationModal";
import ClusterForm from "@/src/components/clusters/ClusterForm";
import ClusterFilterDropdown from "@/src/components/clusters/ClusterFilterDropdown";
import ClusterFilterCard from "@/src/components/clusters/ClusterFilterCard";
import ClusterSortDropdown from "@/src/components/clusters/ClusterSortDropdown";
import { FilterCondition } from "@/src/components/people/FilterBar";
import ClusterView from "@/src/components/clusters/ClusterView";
import AssignMembersModal from "@/src/components/clusters/AssignMembersModal";
import FamilyView from "@/src/components/families/FamilyView";
import FamilyForm from "@/src/components/families/FamilyForm";
import AddFamilyMemberModal from "@/src/components/families/AddFamilyMemberModal";
import { useRouter } from "next/navigation";
import PersonProfile from "@/src/components/people/PersonProfile";
import PersonForm from "@/src/components/people/PersonForm";
import type { Person } from "@/src/types/person";
import ClusterWeeklyReportForm from "@/src/components/reports/ClusterWeeklyReportForm";
import { clusterWeeklyReportsApi, familiesApi, peopleApi } from "@/src/lib/api";

export default function ClustersPage() {
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const { peopleUI, people, refreshPeople } = usePeople() as any;
  const { families, refreshFamilies } = useFamilies() as any;
  const [showCreate, setShowCreate] = useState(false);
  const [showView, setShowView] = useState(false);
  const [viewCluster, setViewCluster] = useState<Cluster | null>(null);
  const [showEdit, setShowEdit] = useState(false);
  const [editCluster, setEditCluster] = useState<Cluster | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    isOpen: boolean;
    cluster: Cluster | null;
    loading: boolean;
  }>({ isOpen: false, cluster: null, loading: false });
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilters, setActiveFilters] = useState<FilterCondition[]>([]);
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [filterDropdownPosition, setFilterDropdownPosition] = useState({
    top: 0,
    left: 0,
  });
  const [showFilterCard, setShowFilterCard] = useState(false);
  const [filterCardPosition, setFilterCardPosition] = useState({
    top: 0,
    left: 0,
  });
  const [selectedField, setSelectedField] = useState<any>(null);
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [sortBy, setSortBy] = useState("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const sortButtonRef = React.useRef<HTMLButtonElement>(null);
  const [showAssign, setShowAssign] = useState(false);
  const [showFamily, setShowFamily] = useState(false);
  const [viewFamilyData, setViewFamilyData] = useState<any>(null);
  const [familyFromPerson, setFamilyFromPerson] = useState<boolean>(false);
  const [showPerson, setShowPerson] = useState(false);
  const [viewPersonData, setViewPersonData] = useState<any>(null);
  const [showEditPerson, setShowEditPerson] = useState(false);
  const [showReportForm, setShowReportForm] = useState(false);
  const [reportSelectedCluster, setReportSelectedCluster] =
    useState<Cluster | null>(null);
  const [showEditFamily, setShowEditFamily] = useState(false);
  const [editFamilyData, setEditFamilyData] = useState<any>(null);
  const [familyDelete, setFamilyDelete] = useState<{
    isOpen: boolean;
    family: any | null;
    loading: boolean;
  }>({ isOpen: false, family: null, loading: false });
  const [showAddFamilyMembers, setShowAddFamilyMembers] = useState(false);
  const router = useRouter();

  // Modal back-navigation: remember previous modal context
  type PrevModal =
    | { type: "cluster" }
    | { type: "person"; person: any }
    | { type: "family"; family: any }
    | { type: "none" };
  const [prevModal, setPrevModal] = useState<PrevModal>({ type: "none" });

  const goBackModal = () => {
    if (prevModal.type === "cluster" && viewCluster) {
      flushSync(() => {
        setShowPerson(false);
        setShowFamily(false);
        setShowAssign(false);
        setShowReportForm(false);
        setShowEditPerson(false);
        setShowEditFamily(false);
      });
      setShowView(true);
    } else if (prevModal.type === "person" && (prevModal as any).person) {
      const p = (prevModal as any).person;
      flushSync(() => {
        setShowFamily(false);
        setShowAssign(false);
        setShowReportForm(false);
        setShowEditFamily(false);
      });
      setViewPersonData(p);
      setShowPerson(true);
    } else if (prevModal.type === "family" && (prevModal as any).family) {
      const f = (prevModal as any).family;
      flushSync(() => {
        setShowPerson(false);
        setShowAssign(false);
        setShowReportForm(false);
        setShowEditPerson(false);
      });
      setViewFamilyData(f);
      setShowFamily(true);
    }
    setPrevModal({ type: "none" });
  };

  useEffect(() => {
    const fetchClusters = async () => {
      try {
        setLoading(true);
        const res = await clustersApi.getAll();
        setClusters(res.data);
      } finally {
        setLoading(false);
      }
    };
    fetchClusters();
  }, []);

  const filteredAndSortedClusters = React.useMemo(() => {
    let result = [...clusters];

    // Text search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((c: any) => {
        const name = (c.name || "").toLowerCase();
        const code = (c.code || "").toLowerCase();
        const desc = (c.description || "").toLowerCase();
        const loc = (c.location || "").toLowerCase();
        const schedule = (c.meeting_schedule || "").toLowerCase();
        return (
          name.includes(q) ||
          code.includes(q) ||
          desc.includes(q) ||
          loc.includes(q) ||
          schedule.includes(q)
        );
      });
    }

    // Structured filters
    for (const filter of activeFilters) {
      result = result.filter((cluster: any) => {
        switch (filter.field) {
          case "coordinator": {
            const coord = peopleUI.find(
              (p: any) => p.id === cluster.coordinator
            );
            const coordName = coord
              ? `${coord.first_name} ${coord.last_name}`.toLowerCase()
              : "";
            return coordName.includes(String(filter.value).toLowerCase());
          }
          case "location": {
            const location = (cluster.location || "").toLowerCase();
            return location.includes(String(filter.value).toLowerCase());
          }
          case "meeting_schedule": {
            const ms = (cluster.meeting_schedule || "").toLowerCase();
            return ms.includes(String(filter.value).toLowerCase());
          }
          case "member_count": {
            const count = (cluster.members || []).length;
            if (Array.isArray(filter.value)) {
              const [min, max] = filter.value as [string, string];
              const minNum = parseInt(min);
              const maxNum = parseInt(max);
              return count >= minNum && count <= maxNum;
            }
            const num = parseInt(String(filter.value));
            switch (filter.operator) {
              case "greater_than":
                return count > num;
              case "less_than":
                return count < num;
              case "is":
                return count === num;
              case "is_not":
                return count !== num;
              default:
                return true;
            }
          }
          case "family_count": {
            const count = (cluster.families || []).length;
            if (Array.isArray(filter.value)) {
              const [min, max] = filter.value as [string, string];
              const minNum = parseInt(min);
              const maxNum = parseInt(max);
              return count >= minNum && count <= maxNum;
            }
            const num = parseInt(String(filter.value));
            switch (filter.operator) {
              case "greater_than":
                return count > num;
              case "less_than":
                return count < num;
              case "is":
                return count === num;
              case "is_not":
                return count !== num;
              default:
                return true;
            }
          }
          case "name": {
            const name = (cluster.name || "").toLowerCase();
            const val = String(filter.value).toLowerCase();
            switch (filter.operator) {
              case "contains":
                return name.includes(val);
              case "is":
                return name === val;
              case "is_not":
                return name !== val;
              case "starts_with":
                return name.startsWith(val);
              case "ends_with":
                return name.endsWith(val);
              default:
                return true;
            }
          }
          case "code": {
            const code = (cluster.code || "").toLowerCase();
            const val = String(filter.value).toLowerCase();
            switch (filter.operator) {
              case "contains":
                return code.includes(val);
              case "is":
                return code === val;
              case "is_not":
                return code !== val;
              case "starts_with":
                return code.startsWith(val);
              case "ends_with":
                return code.endsWith(val);
              default:
                return true;
            }
          }
          default:
            return true;
        }
      });
    }

    // Sort
    result.sort((a: any, b: any) => {
      let av: any = 0;
      let bv: any = 0;
      switch (sortBy) {
        case "name":
          av = (a.name || "").toLowerCase();
          bv = (b.name || "").toLowerCase();
          break;
        case "member_count":
          av = (a.members || []).length;
          bv = (b.members || []).length;
          break;
        case "visitor_count": {
          const aVisitors = (a.members || [])
            .map((id: string) => peopleUI.find((p: any) => p.id === id))
            .filter((p: any) => p?.role === "VISITOR").length;
          const bVisitors = (b.members || [])
            .map((id: string) => peopleUI.find((p: any) => p.id === id))
            .filter((p: any) => p?.role === "VISITOR").length;
          av = aVisitors;
          bv = bVisitors;
          break;
        }
        case "family_count":
          av = (a.families || []).length;
          bv = (b.families || []).length;
          break;
        case "created_at":
          av = new Date(a.created_at || 0).getTime();
          bv = new Date(b.created_at || 0).getTime();
          break;
        default:
          av = (a.name || "").toLowerCase();
          bv = (b.name || "").toLowerCase();
      }
      if (av < bv) return sortOrder === "asc" ? -1 : 1;
      if (av > bv) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });

    return result;
  }, [clusters, searchQuery, activeFilters, sortBy, sortOrder, peopleUI]);

  const handleOpenFilterDropdown = (btn: HTMLButtonElement | null) => {
    if (showFilterDropdown) {
      setShowFilterDropdown(false);
      setShowFilterCard(false);
      return;
    }
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const dropdownWidth = 256;
    const viewportWidth = window.innerWidth;
    const rightEdge = rect.left + dropdownWidth;
    let left = rect.left;
    if (rightEdge > viewportWidth) left = viewportWidth - dropdownWidth - 16;
    setFilterDropdownPosition({ top: rect.bottom + 8, left });
    setShowFilterDropdown(true);
  };

  const sortDropdownPosition = React.useMemo(() => {
    if (!sortButtonRef.current) return { top: 0, left: 0 };
    const rect = sortButtonRef.current.getBoundingClientRect();
    const dropdownWidth = 256;
    const viewportWidth = window.innerWidth;
    const rightEdge = rect.left + dropdownWidth;
    let left = rect.left;
    if (rightEdge > viewportWidth) left = viewportWidth - dropdownWidth - 16;
    return { top: rect.bottom + 8, left };
  }, [showSortDropdown]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Title row with Add button */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-[#2D3748]">Clusters</h1>
          <Button onClick={() => setShowCreate(true)}>Add Cluster</Button>
        </div>

        {/* Statistics Cards to match Families pattern */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                      d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                    />
                  </svg>
                </div>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-500">
                  Total Clusters
                </p>
                <p className="text-2xl font-semibold text-gray-900">
                  {clusters.length}
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
                  {clusters.reduce(
                    (acc: number, c: any) => acc + (c.members?.length || 0),
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
                      (p: any) =>
                        p.username !== "admin" &&
                        p.role !== "ADMIN" &&
                        !clusters.some((c: any) =>
                          (c.members || []).includes(p.id)
                        )
                    ).length
                  }
                </p>
              </div>
            </div>
          </div>
        </div>
        {/* Toolbar row wrapped like Families: search (left), sort + filter (right) */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div className="relative w-full max-w-md">
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
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              />
            </div>
            <div className="flex items-center gap-2">
              <button
                ref={sortButtonRef}
                onClick={() => setShowSortDropdown((v) => !v)}
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
                    d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12"
                  />
                </svg>
                Sort
              </button>
              <button
                onClick={(e) =>
                  handleOpenFilterDropdown(e.currentTarget as HTMLButtonElement)
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
        {loading ? (
          <p className="text-sm text-gray-500">Loading clusters…</p>
        ) : clusters.length === 0 ? (
          <p className="text-sm text-gray-500">No clusters found.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredAndSortedClusters.map((cluster) => (
              <ClusterCard
                key={cluster.id}
                cluster={cluster}
                peopleUI={peopleUI}
                onView={() => {
                  setViewCluster(cluster);
                  setShowView(true);
                }}
                onEdit={() => {
                  setEditCluster(cluster);
                  setShowEdit(true);
                }}
                onDelete={() => {
                  setDeleteConfirmation({
                    isOpen: true,
                    cluster,
                    loading: false,
                  });
                }}
              />
            ))}
          </div>
        )}

        {/* Active Filters */}
        {activeFilters.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            {activeFilters.map((filter, index) => (
              <span
                key={filter.id}
                className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200"
              >
                {filter.label}
                <button
                  onClick={() =>
                    setActiveFilters(
                      activeFilters.filter((_, i) => i !== index)
                    )
                  }
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
              onClick={() => setActiveFilters([])}
              className="text-xs text-gray-500 hover:text-gray-700"
            >
              Clear All
            </button>
          </div>
        )}

        {/* Dropdowns/Cards */}
        <ClusterSortDropdown
          isOpen={showSortDropdown}
          onClose={() => setShowSortDropdown(false)}
          onSelectSort={(by, order) => {
            setSortBy(by);
            setSortOrder(order);
            setShowSortDropdown(false);
          }}
          position={sortDropdownPosition}
          currentSortBy={sortBy}
          currentSortOrder={sortOrder}
        />
        <ClusterFilterDropdown
          isOpen={showFilterDropdown}
          onClose={() => setShowFilterDropdown(false)}
          onSelectField={(field) => {
            setSelectedField(field);
            setShowFilterDropdown(false);
            // Position filter card near dropdown
            const cardWidth = 320; // w-80
            const cardHeight = 380; // approximate height
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;
            const desiredLeft = filterDropdownPosition.left;
            const desiredTop = filterDropdownPosition.top;
            const clampedLeft = Math.max(
              8,
              Math.min(desiredLeft, viewportWidth - cardWidth - 16)
            );
            const clampedTop = Math.max(
              8,
              Math.min(desiredTop, viewportHeight - cardHeight - 16)
            );
            setFilterCardPosition({
              top: clampedTop,
              left: clampedLeft,
            });
            setShowFilterCard(true);
          }}
          position={filterDropdownPosition}
        />
        {showFilterCard && selectedField && (
          <ClusterFilterCard
            field={selectedField}
            isOpen={showFilterCard}
            onClose={() => setShowFilterCard(false)}
            onApplyFilter={(filter) => {
              setActiveFilters([...activeFilters, filter]);
              setShowFilterCard(false);
            }}
            position={filterCardPosition}
          />
        )}

        <Modal
          isOpen={showCreate}
          onClose={() => setShowCreate(false)}
          title="Add New Cluster"
          className="!mt-0"
        >
          <ClusterForm
            onSubmit={async (data) => {
              await clustersApi.create(data);
              const res = await clustersApi.getAll();
              setClusters(res.data);
              setShowCreate(false);
            }}
            onClose={() => setShowCreate(false)}
            availableFamilies={families}
            availablePeople={people}
          />
        </Modal>

        {/* View Cluster Modal */}
        <Modal
          isOpen={showView && !!viewCluster}
          onClose={() => {
            setShowView(false);
            setViewCluster(null);
          }}
          title=""
          className="!mt-0"
          hideHeader={true}
        >
          {viewCluster && (
            <ClusterView
              cluster={viewCluster as any}
              clusterMembers={
                (viewCluster as any).members
                  ?.map((id: string) => people.find((p: any) => p.id === id))
                  .filter(Boolean) as any
              }
              clusterFamilies={
                (viewCluster as any).families
                  ?.map((id: string) => families.find((f: any) => f.id === id))
                  .filter(Boolean) as any
              }
              coordinator={
                people.find(
                  (p: any) => p.id === (viewCluster as any).coordinator
                ) as any
              }
              onViewPerson={(person: any) => {
                setPrevModal({ type: "cluster" });
                flushSync(() => setShowView(false));
                setViewPersonData(person);
                setShowPerson(true);
              }}
              onViewFamily={(family: any) => {
                setPrevModal({ type: "cluster" });
                flushSync(() => setShowView(false));
                setViewFamilyData(family);
                setShowFamily(true);
                setFamilyFromPerson(false);
              }}
              onEdit={() => {
                setEditCluster(viewCluster);
                setShowEdit(true);
                setShowView(false);
              }}
              onDelete={() => {
                setDeleteConfirmation({
                  isOpen: true,
                  cluster: viewCluster,
                  loading: false,
                });
              }}
              onCancel={() => {
                setShowView(false);
                setViewCluster(null);
              }}
              onClose={() => {
                setShowView(false);
                setViewCluster(null);
              }}
              onAssignMembers={() => {
                setPrevModal({ type: "cluster" });
                flushSync(() => setShowView(false));
                setShowAssign(true);
              }}
              onSubmitReport={() => {
                setPrevModal({ type: "cluster" });
                flushSync(() => setShowView(false));
                setReportSelectedCluster(viewCluster);
                setShowReportForm(true);
              }}
            />
          )}
        </Modal>

        {/* Assign Members Modal */}
        {showAssign && viewCluster && (
          <AssignMembersModal
            cluster={viewCluster as any}
            peopleUI={peopleUI}
            isOpen={showAssign}
            onClose={() => setShowAssign(false)}
            onAssignMembers={async (memberIds: string[]) => {
              await clustersApi.patch((viewCluster as any).id, {
                members: memberIds,
              });
              const res = await clustersApi.getAll();
              setClusters(res.data);
              const updated = res.data.find(
                (c: any) => c.id === (viewCluster as any).id
              );
              if (updated) setViewCluster(updated);
            }}
          />
        )}

        {/* View Person Modal (lightweight) */}
        {showPerson && viewPersonData && (
          <Modal
            isOpen={showPerson}
            onClose={() => {
              setShowPerson(false);
              setViewPersonData(null);
              goBackModal();
            }}
            title=""
            className="!mt-0"
            hideHeader={true}
          >
            <PersonProfile
              person={viewPersonData}
              clusters={clusters as any}
              families={families as any}
              onViewCluster={(cluster: any) => {
                setViewCluster(cluster);
                setShowView(true);
              }}
              onViewFamily={(family: any) => {
                setPrevModal({ type: "person", person: viewPersonData });
                flushSync(() => setShowPerson(false));
                setViewFamilyData(family);
                setShowFamily(true);
                setFamilyFromPerson(true);
              }}
              onNoFamilyClick={() => {}}
              onEdit={() => {
                setPrevModal({ type: "person", person: viewPersonData });
                flushSync(() => setShowPerson(false));
                setShowEditPerson(true);
              }}
              onDelete={() => {}}
              onCancel={() => {
                setShowPerson(false);
                setViewPersonData(null);
                goBackModal();
              }}
              onAddTimeline={() => {}}
              onClose={() => {
                setShowPerson(false);
                setViewPersonData(null);
                goBackModal();
              }}
            />
          </Modal>
        )}

        {/* Edit Person Modal */}
        {showEditPerson && viewPersonData && (
          <Modal
            isOpen={showEditPerson}
            onClose={() => {
              setShowEditPerson(false);
              goBackModal();
            }}
            title={`Edit ${viewPersonData.first_name || ""} ${
              viewPersonData.last_name || ""
            }`}
            className="!mt-0"
          >
            <PersonForm
              onSubmit={async (data: Partial<Person>) => {
                const res = await peopleApi.update(viewPersonData.id, data);
                setViewPersonData(res.data);
                await refreshPeople();
                setShowEditPerson(false);
                setShowPerson(true);
                return res.data;
              }}
              onClose={() => {
                setShowEditPerson(false);
                setShowPerson(true);
              }}
              onBackToProfile={() => {
                setShowEditPerson(false);
                setShowPerson(true);
              }}
              initialData={viewPersonData}
              isEditingFromProfile={true}
              startOnTimelineTab={false}
              peopleOptions={people as any}
            />
          </Modal>
        )}

        {/* View Family Modal */}
        {showFamily && viewFamilyData && (
          <Modal
            isOpen={showFamily}
            onClose={() => {
              setShowFamily(false);
              setViewFamilyData(null);
              setFamilyFromPerson(false);
              goBackModal();
            }}
            title=""
            className="!mt-0"
            hideHeader={true}
          >
            <FamilyView
              family={viewFamilyData}
              familyMembers={peopleUI.filter((p: any) =>
                viewFamilyData.members?.includes(p.id)
              )}
              clusters={clusters as any}
              onEdit={() => {
                setPrevModal({ type: "family", family: viewFamilyData });
                setEditFamilyData(viewFamilyData);
                setShowEditFamily(true);
              }}
              onDelete={() => {
                setFamilyDelete({
                  isOpen: true,
                  family: viewFamilyData,
                  loading: false,
                });
              }}
              onCancel={() => {
                setShowFamily(false);
                setViewFamilyData(null);
                setFamilyFromPerson(false);
                goBackModal();
              }}
              onClose={() => {
                setShowFamily(false);
                setViewFamilyData(null);
                setFamilyFromPerson(false);
              }}
              onAddMember={() => {
                setPrevModal({ type: "family", family: viewFamilyData });
                flushSync(() => setShowFamily(false));
                setShowAddFamilyMembers(true);
              }}
              onViewPerson={
                !familyFromPerson
                  ? (person: any) => {
                      setPrevModal({ type: "family", family: viewFamilyData });
                      flushSync(() => setShowFamily(false));
                      setViewPersonData(person);
                      setShowPerson(true);
                    }
                  : undefined
              }
            />
          </Modal>
        )}

        {/* Edit Family Modal */}
        {showEditFamily && editFamilyData && (
          <Modal
            isOpen={showEditFamily}
            onClose={() => {
              setShowEditFamily(false);
              setEditFamilyData(null);
              goBackModal();
            }}
            title={`Edit ${editFamilyData.name} Family`}
            className="!mt-0"
          >
            <FamilyForm
              onSubmit={async (data) => {
                const updateRes = await familiesApi.update(
                  editFamilyData.id,
                  data
                );
                // Immediately update the open Family details with fresh server response
                const updatedFamily = updateRes.data as any;
                setViewFamilyData(updatedFamily);
                await refreshFamilies();
                // Close edit modal and reopen family details modal with updated data
                setShowEditFamily(false);
                setEditFamilyData(null);
                setShowFamily(true);
              }}
              onClose={() => {
                setShowEditFamily(false);
                setEditFamilyData(null);
                goBackModal();
              }}
              onDelete={(family) => {
                setFamilyDelete({ isOpen: true, family, loading: false });
              }}
              initialData={editFamilyData}
              availableMembers={peopleUI}
              showDeleteButton={false}
            />
          </Modal>
        )}

        {/* Delete Family Confirmation */}
        {familyDelete.isOpen && (
          <Modal
            isOpen={familyDelete.isOpen}
            onClose={() =>
              setFamilyDelete({ isOpen: false, family: null, loading: false })
            }
            title="Delete Family"
            className="!mt-0"
          >
            <div className="space-y-4">
              <p className="text-sm text-gray-700">
                Are you sure you want to delete "{familyDelete.family?.name}"
                family? This action cannot be undone.
              </p>
              <div className="flex justify-end gap-2">
                <Button
                  variant="tertiary"
                  onClick={() =>
                    setFamilyDelete({
                      isOpen: false,
                      family: null,
                      loading: false,
                    })
                  }
                  disabled={familyDelete.loading}
                >
                  Cancel
                </Button>
                <Button
                  className="!text-red-600 bg-white border border-red-200 hover:bg-red-50 hover:border-red-300"
                  onClick={async () => {
                    if (!familyDelete.family) return;
                    try {
                      setFamilyDelete((prev) => ({ ...prev, loading: true }));
                      await familiesApi.delete(familyDelete.family.id);
                      await refreshFamilies();
                      setFamilyDelete({
                        isOpen: false,
                        family: null,
                        loading: false,
                      });
                      setShowFamily(false);
                      setViewFamilyData(null);
                    } catch {
                      setFamilyDelete((prev) => ({ ...prev, loading: false }));
                    }
                  }}
                >
                  Delete
                </Button>
              </div>
            </div>
          </Modal>
        )}

        {/* Add Family Members Modal */}
        {showAddFamilyMembers && viewFamilyData && (
          <AddFamilyMemberModal
            family={viewFamilyData}
            peopleUI={peopleUI}
            isOpen={showAddFamilyMembers}
            onClose={() => {
              setShowAddFamilyMembers(false);
              goBackModal();
            }}
            onAddMembers={async (memberIds: string[]) => {
              await familiesApi.patch(viewFamilyData.id, {
                members: memberIds,
              });
              await refreshFamilies();
              setShowAddFamilyMembers(false);
              // Keep the family modal open and update data
              const updated = (families as any).find(
                (f: any) => f.id === viewFamilyData.id
              );
              if (updated) setViewFamilyData(updated);
            }}
          />
        )}

        {/* Submit Weekly Report Modal */}
        {showReportForm && reportSelectedCluster && (
          <Modal
            isOpen={showReportForm}
            onClose={() => {
              setShowReportForm(false);
              setReportSelectedCluster(null);
              goBackModal();
            }}
            title={"Submit Weekly Report"}
            className="!mt-0"
          >
            <ClusterWeeklyReportForm
              cluster={reportSelectedCluster as any}
              clusters={clusters as any}
              isOpen={showReportForm}
              onClose={() => {
                setShowReportForm(false);
                setReportSelectedCluster(null);
                goBackModal();
              }}
              onSubmit={async (data) => {
                await clusterWeeklyReportsApi.create(data);
                setShowReportForm(false);
                setReportSelectedCluster(null);
              }}
            />
          </Modal>
        )}

        {/* Edit Cluster Modal */}
        <Modal
          isOpen={showEdit && !!editCluster}
          onClose={() => {
            setShowEdit(false);
            setEditCluster(null);
          }}
          title={
            editCluster
              ? `Edit ${editCluster.name || "Cluster"}`
              : "Edit Cluster"
          }
          className="!mt-0"
        >
          {editCluster && (
            <ClusterForm
              onSubmit={async (data) => {
                await clustersApi.update((editCluster as any).id, data);
                const res = await clustersApi.getAll();
                setClusters(res.data);
                // If we had a cluster selected previously, reopen/refresh details
                const updated = res.data.find(
                  (c: any) => c.id === (editCluster as any).id
                );
                setShowEdit(false);
                setEditCluster(null);
                if (updated) {
                  setViewCluster(updated);
                  setShowView(true);
                }
              }}
              onClose={() => {
                setShowEdit(false);
                setEditCluster(null);
              }}
              initialData={editCluster as any}
              availableFamilies={families}
              availablePeople={people}
            />
          )}
        </Modal>

        {/* Delete Confirmation */}
        <ConfirmationModal
          isOpen={deleteConfirmation.isOpen}
          onClose={() =>
            setDeleteConfirmation({
              isOpen: false,
              cluster: null,
              loading: false,
            })
          }
          onConfirm={async () => {
            if (!deleteConfirmation.cluster) return;
            try {
              setDeleteConfirmation((prev) => ({ ...prev, loading: true }));
              await clustersApi.delete((deleteConfirmation.cluster as any).id);
              const res = await clustersApi.getAll();
              setClusters(res.data);
              setDeleteConfirmation({
                isOpen: false,
                cluster: null,
                loading: false,
              });
              setShowView(false);
              setViewCluster(null);
            } catch {
              setDeleteConfirmation((prev) => ({ ...prev, loading: false }));
            }
          }}
          title="Delete Cluster"
          message={`Are you sure you want to delete the "${
            deleteConfirmation.cluster?.name || "Cluster"
          }" cluster? This action cannot be undone.`}
          confirmText="Delete Cluster"
          cancelText="Cancel"
          variant="danger"
          loading={deleteConfirmation.loading}
        />
      </div>
    </DashboardLayout>
  );
}
