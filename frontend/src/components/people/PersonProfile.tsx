import { Person, Journey, Family, JourneyType } from "@/src/types/person";
import { Cluster } from "@/src/types/cluster";
import { Branch } from "@/src/types/branch";
import Button from "@/src/components/ui/Button";
import { useEffect, useState, useMemo, useRef } from "react";
import { journeysApi, branchesApi } from "@/src/lib/api";
import { useVirtualizer } from "@tanstack/react-virtual";

interface PersonProfileProps {
  person: Person;
  clusters?: Cluster[];
  families?: Family[];
  onViewCluster?: (cluster: Cluster) => void;
  onViewFamily?: (family: Family) => void;
  onNoFamilyClick?: (person: Person) => void;
  onNoClusterClick?: (person: Person) => void;
  onEdit: () => void;
  onDelete: () => void;
  onCancel: () => void;
  onAddTimeline: () => void;
  onClose: () => void;
  hideEditButton?: boolean;
  hideDeleteButton?: boolean;
}

export default function PersonProfile({
  person,
  clusters,
  families,
  onViewCluster,
  onViewFamily,
  onNoFamilyClick,
  onNoClusterClick,
  onEdit,
  onDelete,
  onCancel,
  onAddTimeline,
  onClose,
  hideEditButton = false,
  hideDeleteButton = false,
}: PersonProfileProps) {
  const [activeTab, setActiveTab] = useState<"overview" | "timeline">(
    "overview"
  );
  const [journeys, setJourneys] = useState<Journey[]>(
    (person.journeys as Journey[]) || []
  );
  const [journeySearch, setJourneySearch] = useState("");
  const [journeyFilter, setJourneyFilter] = useState<JourneyType | "ALL">(
    "ALL"
  );
  const journeyListRef = useRef<HTMLDivElement>(null);
  const [branch, setBranch] = useState<Branch | null>(null);

  useEffect(() => {
    setJourneys(((person.journeys as Journey[]) || []).slice());
  }, [person.id]);

  // Fetch branch information if branch ID exists
  useEffect(() => {
    if (person.branch) {
      branchesApi
        .getById(person.branch)
        .then((response) => setBranch(response.data))
        .catch((err) => {
          console.error("Failed to fetch branch:", err);
          setBranch(null);
        });
    } else {
      setBranch(null);
    }
  }, [person.branch]);

  // Redirect to overview if user doesn't have permission to view timeline tab
  useEffect(() => {
    if (
      activeTab === "timeline" &&
      person.can_view_journey_timeline === false
    ) {
      setActiveTab("overview");
    }
  }, [activeTab, person.can_view_journey_timeline]);

  const formatJourneyType = (type: string) => {
    if (!type) return "";
    return type
      .split("_")
      .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
      .join(" ");
  };

  const getJourneyBadgeClasses = (type: string) => {
    switch (type) {
      case "BAPTISM":
        return "bg-blue-100 text-blue-800";
      case "SPIRIT":
        return "bg-orange-100 text-orange-800";
      case "CLUSTER":
        return "bg-purple-100 text-purple-800";
      case "LESSON":
        return "bg-green-100 text-green-800";
      case "EVENT_ATTENDANCE":
        return "bg-sky-100 text-sky-800";
      case "MINISTRY":
        return "bg-pink-100 text-pink-800";
      case "BRANCH_TRANSFER":
        return "bg-indigo-100 text-indigo-800";
      case "NOTE":
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  // Filter and sort journeys for virtualization
  const filteredAndSortedJourneys = useMemo(() => {
    let filtered = journeys || [];

    // Filter by search
    if (journeySearch.trim()) {
      const searchLower = journeySearch.toLowerCase();
      filtered = filtered.filter(
        (j) =>
          j.title?.toLowerCase().includes(searchLower) ||
          j.description?.toLowerCase().includes(searchLower) ||
          j.type?.toLowerCase().includes(searchLower)
      );
    }

    // Filter by type
    if (journeyFilter !== "ALL") {
      filtered = filtered.filter((j) => j.type === journeyFilter);
    }

    // Sort by date (newest first)
    return [...filtered].sort((a, b) => {
      const dateA = new Date(a.date || 0).getTime();
      const dateB = new Date(b.date || 0).getTime();
      return dateB - dateA;
    });
  }, [journeys, journeySearch, journeyFilter]);

  // Virtualizer for journey list
  const virtualizer = useVirtualizer({
    count: filteredAndSortedJourneys.length,
    getScrollElement: () => journeyListRef.current,
    estimateSize: () => 120, // Estimated height per journey item with spacing
    overscan: 5, // Render 5 extra items outside viewport for smooth scrolling
  });

  const renderTypeIcon = (type: string) => {
    // Small icons inspired by the header style, per event type
    switch (type) {
      case "BAPTISM":
        return (
          <div className="w-7 h-7 rounded-lg bg-blue-100 border border-blue-200 flex items-center justify-center">
            <svg
              className="w-4 h-4 text-blue-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 3.75s5.25 5.148 5.25 9.072A5.25 5.25 0 0112 18.75a5.25 5.25 0 01-5.25-5.928C6.75 8.898 12 3.75 12 3.75z"
              />
            </svg>
          </div>
        );
      case "SPIRIT":
        return (
          <div className="w-7 h-7 rounded-lg bg-orange-100 border border-orange-200 flex items-center justify-center">
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
                d="M12 3c2.4 2.1 4.2 4.4 4.2 6.9 0 3-2.2 5.4-4.2 7.2-2-1.8-4.2-4.2-4.2-7.2C7.8 7.4 9.6 5.1 12 3z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 7.5c1.3 1.2 2.3 2.5 2.3 4.1 0 1.9-1.29 3.3-2.3 4.2-1.01-.9-2.3-2.3-2.3-4.2 0-1.6 1-2.9 2.3-4.1z"
              />
            </svg>
          </div>
        );
      case "CLUSTER":
        return (
          <div className="w-7 h-7 rounded-lg bg-purple-100 border border-purple-200 flex items-center justify-center">
            <svg
              className="w-5 h-5 text-purple-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <circle cx="12" cy="8" r="2.3" strokeWidth={1.5} />
              <circle cx="9.1" cy="11.4" r="2.3" strokeWidth={1.5} />
              <circle cx="14.9" cy="11.4" r="2.3" strokeWidth={1.5} />
              <circle cx="12" cy="15" r="2.3" strokeWidth={1.5} />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M12 6.2V4.2m0 0c1.4-.6 2.6-.1 3.5 1"
              />
            </svg>
          </div>
        );
      case "LESSON":
        return (
          <div className="w-6 h-6 rounded-lg bg-green-100 border border-green-200 flex items-center justify-center">
            <svg
              className="w-4 h-4 text-green-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 6.75c-2.5-1.5-4.238-2.25-6-2.25v12c1.762 0 3.5.75 6 2.25m0-12c2.5-1.5 4.238-2.25 6-2.25v12c-1.762 0-3.5.75-6 2.25m0-12v12"
              />
            </svg>
          </div>
        );
      case "EVENT_ATTENDANCE":
        return (
          <div className="w-6 h-6 rounded-lg bg-sky-100 border border-sky-200 flex items-center justify-center">
            <svg
              className="w-4 h-4 text-sky-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 14h.01M14 14h.01M10 18h.01M14 18h.01"
              />
            </svg>
          </div>
        );
      case "MINISTRY":
        return (
          <div className="w-6 h-6 rounded-lg bg-pink-100 border border-pink-200 flex items-center justify-center">
            <svg
              className="w-4 h-4 text-pink-600"
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
        );
      case "BRANCH_TRANSFER":
        return (
          <div className="w-6 h-6 rounded-lg bg-indigo-100 border border-indigo-200 flex items-center justify-center">
            <svg
              className="w-4 h-4 text-indigo-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
              />
            </svg>
          </div>
        );
      case "NOTE":
      default:
        return (
          <div className="w-7 h-7 rounded-lg bg-gray-100 border border-gray-200 flex items-center justify-center">
            <svg
              className="w-5 h-5 text-gray-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 4h8a2 2 0 012 2v12a2 2 0 01-2 2H8a2 2 0 01-2-2V6a2 2 0 012-2z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 4.5h8M8 6.5h8"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9.5 10h5M9.5 13h5M9.5 16h5"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 6l-1 1.2v9.6L7 18"
              />
            </svg>
          </div>
        );
    }
  };

  // removed duplicate renderTypeIcon

  const getStatusColor = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return "bg-green-100 text-green-800";
      case "SEMIACTIVE":
        return "bg-yellow-100 text-yellow-800";
      case "INACTIVE":
        return "bg-gray-100 text-gray-800";
      case "VISITOR":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case "LEADER":
        return "bg-purple-100 text-purple-800";
      case "MEMBER":
        return "bg-blue-100 text-blue-800";
      case "VISITOR":
        return "bg-red-100 text-red-800";
      case "ADMIN":
        return "bg-green-100 text-green-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div className="flex flex-col h-full space-y-0">
      {/* Header */}
      <div className="flex items-center justify-between p-3 sm:p-4 border-b border-gray-200 flex-shrink-0 bg-white">
        <div className="flex-1 min-w-0 pr-2">
          <h2 className="text-sm sm:text-base font-medium text-gray-900 truncate">
            Person Details
          </h2>
          <p className="text-xs text-gray-600 mt-0.5 truncate">
            {person.first_name}
            {(person as any).nickname
              ? ` "${(person as any).nickname}"`
              : ""}{" "}
            {person.middle_name
              ? `${person.middle_name[0].toUpperCase()}. `
              : ""}
            {person.last_name}
            {person.suffix ? ` ${person.suffix}` : ""}
          </p>
        </div>
        <button
          onClick={onClose}
          className="text-red-600 hover:text-red-700 text-xl font-bold p-2 min-h-[44px] min-w-[44px] rounded-md hover:bg-red-50 transition-colors flex items-center justify-center flex-shrink-0"
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

      {/* Content */}
      <div className="p-4 sm:p-6 overflow-y-auto flex-1">
        <div className="space-y-4 sm:space-y-6">
          {/* Profile Header Card */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 sm:p-6 border border-blue-100">
            <div className="flex flex-col sm:flex-row items-center sm:items-start space-y-3 sm:space-y-0 sm:space-x-4">
              <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-full flex items-center justify-center text-white text-xl sm:text-2xl font-bold flex-shrink-0">
                {person.first_name?.[0]}
                {person.last_name?.[0]}
              </div>
              <div className="flex-1 w-full sm:w-auto text-center sm:text-left">
                <h2 className="text-xl sm:text-2xl font-bold text-gray-900 break-words">
                  {person.first_name}
                  {(person as any).nickname
                    ? ` "${(person as any).nickname}"`
                    : ""}{" "}
                  {person.middle_name
                    ? `${person.middle_name[0].toUpperCase()}. `
                    : ""}
                  {person.last_name}
                  {person.suffix ? ` ${person.suffix}` : ""}
                </h2>
                <p className="text-gray-600 text-sm sm:text-base">
                  @{person.username}
                </p>
                <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center justify-center sm:justify-start gap-1.5 sm:space-x-2 mt-2">
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-medium ${getRoleColor(
                      person.role
                    )}`}
                  >
                    {person.role}
                  </span>
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(
                      person.status
                    )}`}
                  >
                    {person.status}
                  </span>
                  {branch && (
                    <span className="px-2 py-1 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                      {branch.name}
                      {branch.is_headquarters && " (HQ)"}
                    </span>
                  )}
                  {families &&
                    (() => {
                      const f = families.find((ff) =>
                        ff.members.includes(person.id)
                      );
                      const label = f ? `Family: ${f.name}` : "No family";
                      const badgeClass = f
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-red-100 text-red-800";
                      return (
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${badgeClass} ${
                            f && onViewFamily
                              ? "cursor-pointer hover:bg-emerald-200 hover:text-emerald-900"
                              : onNoFamilyClick
                              ? "cursor-pointer hover:bg-red-200 hover:text-red-900"
                              : ""
                          }`}
                          title="Family membership"
                          onClick={() => {
                            if (f && onViewFamily) onViewFamily(f);
                            else if (!f && onNoFamilyClick)
                              onNoFamilyClick(person);
                          }}
                        >
                          {label}
                        </span>
                      );
                    })()}
                  {(() => {
                    if (!clusters || clusters.length === 0) {
                      return (
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 ${
                            onNoClusterClick
                              ? "cursor-pointer hover:bg-red-200 hover:text-red-900"
                              : ""
                          }`}
                          title="Cluster membership"
                          onClick={() => {
                            if (onNoClusterClick) onNoClusterClick(person);
                          }}
                        >
                          No cluster
                        </span>
                      );
                    }
                    const c = clusters.find((cc) =>
                      (cc as any).members?.includes(person.id)
                    );
                    const label = c
                      ? c.code
                        ? c.code
                        : c.name ?? "Cluster"
                      : "No cluster";
                    const badgeClass = c
                      ? "bg-blue-100 text-blue-800"
                      : "bg-red-100 text-red-800";
                    return (
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${badgeClass} ${
                          c && onViewCluster
                            ? "cursor-pointer hover:bg-blue-200 hover:text-blue-900"
                            : onNoClusterClick
                            ? "cursor-pointer hover:bg-red-200 hover:text-red-900"
                            : ""
                        }`}
                        title="Cluster membership"
                        onClick={() => {
                          if (c && onViewCluster) onViewCluster(c);
                          else if (!c && onNoClusterClick)
                            onNoClusterClick(person);
                        }}
                      >
                        {label}
                      </span>
                    );
                  })()}
                </div>
              </div>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="border-b border-gray-200">
            <nav className="flex space-x-4 sm:space-x-8 overflow-x-auto">
              <button
                onClick={() => setActiveTab("overview")}
                className={`py-3 sm:py-4 px-2 sm:px-1 border-b-2 font-medium text-sm min-h-[44px] sm:min-h-0 whitespace-nowrap ${
                  activeTab === "overview"
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                Overview
              </button>
              {person.can_view_journey_timeline !== false && (
                <button
                  onClick={() => setActiveTab("timeline")}
                  className={`py-3 sm:py-4 px-2 sm:px-1 border-b-2 font-medium text-sm min-h-[44px] sm:min-h-0 whitespace-nowrap ${
                    activeTab === "timeline"
                      ? "border-blue-500 text-blue-600"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  }`}
                >
                  Timeline
                </button>
              )}
            </nav>
          </div>

          {/* Tab Content */}
          <div>
            {activeTab === "overview" && (
              <div className="space-y-6">
                {/* Main Content Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Contact Information Card */}
                  <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6 shadow-sm">
                    <div className="flex items-center space-x-2 mb-4">
                      <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        <svg
                          className="w-4 h-4 text-blue-600"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                          />
                        </svg>
                      </div>
                      <h3 className="text-base sm:text-lg font-semibold text-gray-900">
                        Contact Information
                      </h3>
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center space-x-3">
                        <svg
                          className="w-4 h-4 text-gray-400"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                          />
                        </svg>
                        <span className="text-sm text-gray-600">
                          {person.email || "No email provided"}
                        </span>
                      </div>
                      <div className="flex items-center space-x-3">
                        <svg
                          className="w-4 h-4 text-gray-400"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                          />
                        </svg>
                        <span className="text-sm text-gray-600">
                          {person.phone || "No phone number provided"}
                        </span>
                      </div>
                      <div className="flex items-center space-x-3">
                        <svg
                          className="w-4 h-4 text-gray-400"
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
                        <span className="text-sm text-gray-600">
                          {person.address || "No address provided"}
                        </span>
                      </div>
                      <div className="flex items-center space-x-3">
                        <svg
                          className="w-4 h-4 text-gray-400"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                        <span className="text-sm text-gray-600">
                          {person.country || "No country specified"}
                        </span>
                      </div>
                      <div className="flex items-center space-x-3">
                        <svg
                          className="w-4 h-4 text-gray-400"
                          fill="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                        </svg>
                        <span className="text-sm text-gray-600">
                          {person.facebook_name || "No Facebook name provided"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Profile Details Card */}
                  <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6 shadow-sm">
                    <div className="flex items-center space-x-2 mb-4">
                      <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        <svg
                          className="w-4 h-4 text-green-600"
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
                      <h3 className="text-base sm:text-lg font-semibold text-gray-900">
                        Profile Details
                      </h3>
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center space-x-3">
                        <svg
                          className="w-4 h-4 text-gray-400"
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
                        <span className="text-sm text-gray-600">
                          Gender: {person.gender || "Not specified"}
                        </span>
                      </div>
                      <div className="flex items-center space-x-3">
                        <svg
                          className="w-4 h-4 text-gray-400"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                          />
                        </svg>
                        <span className="text-sm text-gray-600">
                          Born: {person.date_of_birth || "Not specified"}
                        </span>
                      </div>
                      <div className="flex items-center space-x-3">
                        <svg
                          className="w-4 h-4 text-gray-400"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                          />
                        </svg>
                        <span className="text-sm text-gray-600">
                          First attended:{" "}
                          {person.date_first_attended || "Not specified"}
                        </span>
                      </div>
                      <div className="flex items-center space-x-3">
                        <svg
                          className="w-4 h-4 text-gray-400"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M3 7h18M3 12h12M3 17h18"
                          />
                        </svg>
                        <span className="text-sm text-gray-600">
                          First activity attended:{" "}
                          {(() => {
                            const raw = (
                              (person as any).first_activity_attended ||
                              "Not specified"
                            ).toString();
                            const pretty = raw
                              .replace(/_/g, " ")
                              .toLowerCase()
                              .replace(/\b\w/g, (ch: string) =>
                                ch.toUpperCase()
                              );
                            return pretty;
                          })()}
                        </span>
                      </div>
                      <div className="flex items-center space-x-3">
                        <svg
                          className="w-4 h-4 text-gray-400"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                          />
                        </svg>
                        <span className="text-sm text-gray-600">
                          Water baptism:{" "}
                          {(person as any).water_baptism_date ||
                            "Not specified"}
                        </span>
                      </div>
                      <div className="flex items-center space-x-3">
                        <svg
                          className="w-4 h-4 text-gray-400"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                          />
                        </svg>
                        <span className="text-sm text-gray-600">
                          Spirit baptism:{" "}
                          {(person as any).spirit_baptism_date ||
                            "Not specified"}
                        </span>
                      </div>
                      {(person as any).nickname && (
                        <div className="flex items-center space-x-3">
                          <svg
                            className="w-4 h-4 text-gray-400"
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
                          <span className="text-sm text-gray-600">
                            Nickname: {(person as any).nickname}
                          </span>
                        </div>
                      )}
                      <div className="flex items-center space-x-3">
                        <svg
                          className="w-4 h-4 text-gray-400"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                          />
                        </svg>
                        <span className="text-sm text-gray-600">
                          Has Finished NC Lessons:{" "}
                          {(person as any).has_finished_lessons ? (
                            <span className="text-green-600 font-medium">
                              Yes
                            </span>
                          ) : (
                            <span className="text-red-500">Not yet</span>
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "timeline" && (
              <div className="space-y-6">
                {/* Timeline Events Card */}
                <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6 shadow-sm">
                  <div className="flex items-center space-x-2 mb-4">
                    <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <svg
                        className="w-4 h-4 text-purple-600"
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
                    <h3 className="text-base sm:text-lg font-semibold text-gray-900">
                      Journey Timeline
                    </h3>
                  </div>

                  {/* Search and Filter Controls */}
                  {journeys && journeys.length > 0 && (
                    <div className="space-y-3 mb-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {/* Search */}
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            Search Events
                          </label>
                          <input
                            type="text"
                            value={journeySearch}
                            onChange={(e) => setJourneySearch(e.target.value)}
                            placeholder="Search by title, description, or type..."
                            className="w-full px-3 py-2 min-h-[44px] text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        </div>
                        {/* Filter by Type */}
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            Filter by Type
                          </label>
                          <select
                            value={journeyFilter}
                            onChange={(e) =>
                              setJourneyFilter(
                                e.target.value as JourneyType | "ALL"
                              )
                            }
                            className="w-full px-3 py-2 min-h-[44px] text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          >
                            <option value="ALL">All Types</option>
                            {[
                              "BAPTISM",
                              "SPIRIT",
                              "CLUSTER",
                              "LESSON",
                              "NOTE",
                              "EVENT_ATTENDANCE",
                            ].map((type) => (
                              <option key={type} value={type}>
                                {type.charAt(0) + type.slice(1).toLowerCase()}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                      {/* Results count */}
                      {filteredAndSortedJourneys.length !== journeys.length && (
                        <div className="text-xs text-gray-500">
                          Showing {filteredAndSortedJourneys.length} of{" "}
                          {journeys.length} events
                        </div>
                      )}
                    </div>
                  )}

                  {filteredAndSortedJourneys.length > 0 ? (
                    <div
                      ref={journeyListRef}
                      className={`relative ${
                        filteredAndSortedJourneys.length <= 3
                          ? "overflow-visible"
                          : "h-[360px] overflow-auto"
                      }`}
                    >
                      <div className="relative pl-3 pt-4 pb-4">
                        <div className="absolute left-4 top-0 bottom-0 w-px bg-gray-200" />
                        <div
                          style={{
                            height: `${virtualizer.getTotalSize()}px`,
                            width: "100%",
                            position: "relative",
                          }}
                        >
                          {virtualizer.getVirtualItems().map((virtualRow) => {
                            const journey =
                              filteredAndSortedJourneys[virtualRow.index];

                            return (
                              <div
                                key={virtualRow.key}
                                style={{
                                  position: "absolute",
                                  top: 0,
                                  left: 0,
                                  width: "100%",
                                  height: `${virtualRow.size}px`,
                                  transform: `translateY(${virtualRow.start}px)`,
                                }}
                              >
                                <div className="relative group my-3">
                                  <div className="absolute left-1.5 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
                                    {renderTypeIcon(journey.type)}
                                  </div>
                                  <div className="ml-8 p-4 bg-gray-50 rounded-lg border border-gray-100 hover:border-gray-200 transition-colors">
                                    <div className="flex items-center justify-between">
                                      <div className="font-medium text-gray-900">
                                        {journey.title}
                                      </div>
                                      <span
                                        className={`px-2 py-0.5 rounded-full text-xs font-medium ${getJourneyBadgeClasses(
                                          journey.type
                                        )}`}
                                      >
                                        {journey.type_display ||
                                          formatJourneyType(journey.type)}
                                      </span>
                                    </div>
                                    <div className="text-xs text-gray-500 mt-1">
                                      {journey.date}
                                    </div>
                                    {journey.description && (
                                      <div className="text-sm text-gray-700 mt-2 line-clamp-3">
                                        {journey.description}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  ) : journeys &&
                    journeys.length > 0 &&
                    filteredAndSortedJourneys.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <p className="text-sm">
                        No journey events match your search or filter criteria.
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setJourneySearch("");
                          setJourneyFilter("ALL");
                        }}
                        className="mt-2 text-sm text-blue-600 hover:text-blue-700 underline"
                      >
                        Clear filters
                      </button>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <svg
                        className="w-12 h-12 mx-auto mb-4 text-gray-300"
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
                      <p>No journey timeline yet</p>
                      <p className="text-sm">
                        Add journeys in the Journey Timeline tab when editing
                        this person
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 sm:p-6 border-t border-gray-200 bg-gray-50">
        {activeTab === "overview" ? (
          <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-3">
            {/* Mobile buttons - full width with text */}
            <div className="flex flex-col md:hidden gap-3 w-full">
              {!hideEditButton && (
                <Button
                  onClick={onEdit}
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
              )}
              <Button
                onClick={onCancel}
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
              {!hideDeleteButton && (
                <>
                  <div className="border-t border-gray-200 my-1"></div>
                  <Button
                    onClick={onDelete}
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
                </>
              )}
            </div>

            {/* Desktop/Tablet buttons - old style with icons */}
            <div className="hidden md:flex md:items-center md:justify-between md:w-full">
              {!hideDeleteButton && (
                <Button
                  onClick={onDelete}
                  variant="secondary"
                  className="!text-red-600 px-4 md:py-4 text-sm font-normal bg-white border border-red-200 hover:bg-red-50 hover:border-red-300 flex items-center justify-center"
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
              )}
              {hideDeleteButton && <div />}
              <div className="flex items-center gap-3">
                <Button
                  onClick={onCancel}
                  variant="secondary"
                  className="!text-black px-6 md:py-4 text-sm font-normal bg-white border border-gray-200 hover:bg-gray-50 hover:border-gray-300 flex items-center justify-center space-x-2"
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
                {!hideEditButton && (
                  <Button
                    onClick={onEdit}
                    variant="secondary"
                    className="!text-blue-600 px-6 md:py-4 text-sm font-normal bg-white border border-blue-200 hover:bg-blue-50 hover:border-blue-300 flex items-center justify-center space-x-2"
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
                )}
              </div>
            </div>
          </div>
        ) : (
          <Button
            onClick={onAddTimeline}
            variant="secondary"
            className="!text-gray-700 w-full py-3 px-4 text-sm font-medium bg-white border border-gray-300 hover:bg-gray-50 hover:border-gray-400 flex items-center justify-center space-x-2 min-h-[44px]"
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
                d="M12 6v6m0 0v6m0-6h6m-6 0H6"
              />
            </svg>
            <span>Add Timeline</span>
          </Button>
        )}
      </div>
    </div>
  );
}
