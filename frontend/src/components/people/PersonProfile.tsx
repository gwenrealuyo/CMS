import { Person, Journey, Family, JourneyType } from "@/src/types/person";
import { Cluster } from "@/src/types/cluster";
import { Branch } from "@/src/types/branch";
import Button from "@/src/components/ui/Button";
import { useEffect, useState, useMemo } from "react";
import { journeysApi, branchesApi } from "@/src/lib/api";
import { compareJourneysNewestFirst } from "@/src/lib/journeySort";

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
  showTopHeader?: boolean;
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
  showTopHeader = true,
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
  const [branch, setBranch] = useState<Branch | null>(null);

  useEffect(() => {
    setJourneys(((person.journeys as Journey[]) || []).slice());
  }, [person.id, person.journeys]);

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

  const ProfileFieldRow = ({
    label,
    value,
    fallback = "Not specified",
    renderAsBadge = false,
    badgeClassName = "",
    valueNode,
  }: {
    label: string;
    value?: string | number | null;
    fallback?: string;
    renderAsBadge?: boolean;
    badgeClassName?: string;
    valueNode?: React.ReactNode;
  }) => {
    const isMissing =
      value === null ||
      value === undefined ||
      (typeof value === "string" && value.trim() === "");
    const displayValue = isMissing ? fallback : value;

    return (
      <div className="flex items-start justify-between gap-3 py-2">
        <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">
          {label}
        </dt>
        <dd className="text-right break-words max-w-[65%]">
          {valueNode ? (
            valueNode
          ) : renderAsBadge && !isMissing ? (
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${badgeClassName}`}
            >
              {displayValue}
            </span>
          ) : (
            <span
              className={`text-sm ${
                isMissing ? "text-red-600 font-medium" : "text-gray-800"
              }`}
            >
              {displayValue}
            </span>
          )}
        </dd>
      </div>
    );
  };

  const prettifyFirstActivity = (rawValue?: string) => {
    if (!rawValue) return "Not specified";
    return rawValue
      .replace(/_/g, " ")
      .toLowerCase()
      .replace(/\b\w/g, (ch: string) => ch.toUpperCase());
  };

  const formatDisplayDate = (rawValue?: string | null) => {
    if (!rawValue) return rawValue;
    const value = rawValue.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return rawValue;
    const parsed = new Date(`${value}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) return rawValue;
    return parsed.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
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

    // Newest first: date, then created_at, then id (same-day tie-break)
    return [...filtered].sort(compareJourneysNewestFirst);
  }, [journeys, journeySearch, journeyFilter]);

  const personCluster = useMemo(() => {
    if (!clusters?.length) return null;
    return (
      clusters.find((cc) =>
        cc.members?.some((memberId) => String(memberId) === String(person.id)),
      ) ?? null
    );
  }, [clusters, person.id]);

  const personFamilies = useMemo(() => {
    if (!families?.length) return [];
    return families.filter((f) =>
      f.members?.some((memberId) => String(memberId) === String(person.id)),
    );
  }, [families, person.id]);

  const clusterQuickFactLabel = (c: Cluster) => {
    const name = (c.name || "").trim() || "Unnamed cluster";
    const code = (c.code || "").trim();
    return code ? `${name} (${code})` : name;
  };

  const handleQuickFactsViewFamily = () => {
    const primary = personFamilies[0];
    if (primary && onViewFamily) {
      onViewFamily(primary);
    } else if (onNoFamilyClick) {
      onNoFamilyClick(person);
    }
  };

  const handleQuickFactsViewCluster = () => {
    if (!clusters || clusters.length === 0) {
      if (onNoClusterClick) onNoClusterClick(person);
      return;
    }
    if (personCluster && onViewCluster) {
      onViewCluster(personCluster);
    } else if (onNoClusterClick) {
      onNoClusterClick(person);
    }
  };

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
  const isPanelMode = !showTopHeader;

  return (
    <div className="flex flex-col h-full space-y-0">
      {/* Header */}
      {showTopHeader && (
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
      )}

      {/* Content */}
      <div className="p-4 sm:p-6 overflow-y-auto flex-1">
        <div className="space-y-4">
          {/* Profile Header Card */}
          <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
            <div className="flex flex-col sm:flex-row items-center sm:items-start space-y-2 sm:space-y-0 sm:space-x-3">
              <div className="w-14 h-14 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-full flex items-center justify-center text-white text-lg font-bold flex-shrink-0">
                {person.first_name?.[0]}
                {person.last_name?.[0]}
              </div>
              <div className="flex-1 w-full sm:w-auto text-center sm:text-left">
                <h2 className="text-lg font-semibold text-gray-900 break-words">
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
                <p className="text-gray-500 text-sm">@{person.username}</p>
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-1.5 mt-2">
                  <span
                    className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${getRoleColor(
                      person.role
                    )}`}
                  >
                    {person.role}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${getStatusColor(
                      person.status
                    )}`}
                  >
                    {person.status}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="border-b border-gray-200">
            <nav className="flex space-x-4 sm:space-x-6 overflow-x-auto">
              <button
                onClick={() => setActiveTab("overview")}
                className={`py-2.5 px-1.5 border-b-2 font-medium text-sm min-h-[40px] whitespace-nowrap ${
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
                  className={`py-2.5 px-1.5 border-b-2 font-medium text-sm min-h-[40px] whitespace-nowrap ${
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
                <div className="space-y-4">
                  <section className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                    <h3 className="text-sm font-semibold text-gray-900 mb-2">
                      Quick Facts
                    </h3>
                    <dl className="divide-y divide-gray-100">
                      <ProfileFieldRow
                        label="Status"
                        value={person.status}
                        renderAsBadge
                        badgeClassName={getStatusColor(person.status)}
                      />
                      <ProfileFieldRow
                        label="Role"
                        value={person.role}
                        renderAsBadge
                        badgeClassName={getRoleColor(person.role)}
                      />
                      <ProfileFieldRow
                        label="Branch"
                        value={
                          branch
                            ? `${branch.name}${
                                branch.is_headquarters ? " (HQ)" : ""
                              }`
                            : null
                        }
                        renderAsBadge
                        badgeClassName="bg-indigo-100 text-indigo-800"
                      />
                      <ProfileFieldRow
                        label="Family"
                        value={
                          personFamilies.length > 0
                            ? personFamilies.map((f) => f.name).join(", ")
                            : person.family_names?.length
                              ? person.family_names.join(", ")
                              : null
                        }
                        valueNode={
                          personFamilies.length > 0 ? (
                            <span className="inline-flex flex-wrap items-center justify-end gap-x-0 text-sm text-right">
                              {personFamilies.map((fam, idx) => (
                                <span
                                  key={fam.id}
                                  className="inline-flex items-center max-w-full"
                                >
                                  {idx > 0 && (
                                    <span
                                      className="text-gray-500 mx-1 shrink-0"
                                      aria-hidden
                                    >
                                      ,
                                    </span>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() =>
                                      onViewFamily && onViewFamily(fam)
                                    }
                                    className="font-medium text-blue-600 hover:text-blue-700 underline underline-offset-2 text-right break-words"
                                  >
                                    {fam.name}
                                  </button>
                                </span>
                              ))}
                            </span>
                          ) : person.family_names?.length ? (
                            <span className="text-sm text-gray-800">
                              {person.family_names.join(", ")}
                            </span>
                          ) : (
                            <div className="inline-flex items-center gap-2 text-sm flex-wrap justify-end">
                              <button
                                type="button"
                                onClick={handleQuickFactsViewFamily}
                                className="text-red-600 font-medium hover:underline text-right"
                              >
                                None
                              </button>
                              {onNoFamilyClick && (
                                <button
                                  type="button"
                                  onClick={handleQuickFactsViewFamily}
                                  className="text-xs font-medium text-blue-600 hover:text-blue-700 underline underline-offset-2"
                                >
                                  Assign family
                                </button>
                              )}
                            </div>
                          )
                        }
                      />
                      <ProfileFieldRow
                        label="Cluster"
                        value={
                          personCluster
                            ? clusterQuickFactLabel(personCluster)
                            : null
                        }
                        valueNode={
                          personCluster ? (
                            <button
                              type="button"
                              onClick={handleQuickFactsViewCluster}
                              className="text-sm font-medium text-blue-600 hover:text-blue-700 underline underline-offset-2 text-right"
                            >
                              {clusterQuickFactLabel(personCluster)}
                            </button>
                          ) : (
                            <div className="inline-flex items-center gap-2 text-sm flex-wrap justify-end">
                              <button
                                type="button"
                                onClick={handleQuickFactsViewCluster}
                                className="text-red-600 font-medium hover:underline text-right"
                              >
                                None
                              </button>
                              {onNoClusterClick && (
                                <button
                                  type="button"
                                  onClick={handleQuickFactsViewCluster}
                                  className="text-xs font-medium text-blue-600 hover:text-blue-700 underline underline-offset-2"
                                >
                                  Assign cluster
                                </button>
                              )}
                            </div>
                          )
                        }
                      />
                    </dl>
                  </section>

                  <section className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                    <h3 className="text-sm font-semibold text-gray-900 mb-2">
                      Contact
                    </h3>
                    <dl className="divide-y divide-gray-100">
                      <ProfileFieldRow
                        label="Email"
                        value={person.email}
                        fallback="No email provided"
                      />
                      <ProfileFieldRow
                        label="Phone"
                        value={person.phone}
                        fallback="No phone number provided"
                      />
                      <ProfileFieldRow
                        label="Address"
                        value={person.address}
                        fallback="No address provided"
                      />
                      <ProfileFieldRow
                        label="Country"
                        value={person.country}
                        fallback="No country specified"
                      />
                      <ProfileFieldRow
                        label="Facebook"
                        value={person.facebook_name}
                        fallback="No Facebook name provided"
                      />
                    </dl>
                  </section>

                  <section className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                    <h3 className="text-sm font-semibold text-gray-900 mb-2">
                      Personal
                    </h3>
                    <dl className="divide-y divide-gray-100">
                      <ProfileFieldRow label="Gender" value={person.gender} />
                      <ProfileFieldRow
                        label="Birthday"
                        value={formatDisplayDate(person.date_of_birth)}
                      />
                      <ProfileFieldRow
                        label="First attended"
                        value={formatDisplayDate(person.date_first_attended)}
                      />
                      <ProfileFieldRow
                        label="First activity"
                        value={prettifyFirstActivity(
                          (person as any).first_activity_attended
                        )}
                      />
                      <ProfileFieldRow
                        label="Water baptism"
                        value={formatDisplayDate((person as any).water_baptism_date)}
                      />
                      <ProfileFieldRow
                        label="Spirit baptism"
                        value={formatDisplayDate((person as any).spirit_baptism_date)}
                      />
                      <ProfileFieldRow
                        label="Nickname"
                        value={(person as any).nickname}
                      />
                      <ProfileFieldRow
                        label="Lessons finished"
                        value={
                          (person as any).has_finished_lessons
                            ? "Yes"
                            : "Not yet"
                        }
                      />
                    </dl>
                  </section>

                  <section className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                    <h3 className="text-sm font-semibold text-gray-900 mb-3">
                      Relationships
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <Button
                        type="button"
                        onClick={handleQuickFactsViewFamily}
                        className="w-full text-sm"
                      >
                        {personFamilies.length > 0
                          ? "View Family"
                          : "Assign Family"}
                      </Button>
                      <Button
                        type="button"
                        onClick={handleQuickFactsViewCluster}
                        className="w-full text-sm"
                      >
                        {clusters?.some((cc) =>
                          cc.members?.some(
                            (memberId) => String(memberId) === String(person.id)
                          )
                        )
                          ? "View Cluster"
                          : "Assign Cluster"}
                      </Button>
                    </div>
                  </section>
                </div>
              </div>
            )}

            {activeTab === "timeline" && (
              <div className="space-y-4">
                {/* Timeline Events Card */}
                <div className="bg-white rounded-xl border border-gray-200 p-3 sm:p-4 shadow-sm">
                  <div className="flex items-center space-x-2 mb-3">
                    <div className="w-7 h-7 bg-purple-100 rounded-md flex items-center justify-center flex-shrink-0">
                      <svg
                        className="w-3.5 h-3.5 text-purple-600"
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
                    <h3 className="text-sm sm:text-base font-semibold text-gray-900">
                      Journey Timeline
                    </h3>
                  </div>

                  {/* Search and Filter Controls */}
                  {journeys && journeys.length > 0 && (
                    <div className="space-y-2 mb-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
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
                            className="w-full px-3 py-2 min-h-[38px] text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                            className="w-full px-3 py-2 min-h-[38px] text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                      className={`relative ${
                        isPanelMode || filteredAndSortedJourneys.length <= 3
                          ? "overflow-visible"
                          : "h-[300px] overflow-auto"
                      }`}
                    >
                      <div className="relative pl-3 pt-2 pb-2">
                        <div className="absolute left-4 top-0 bottom-0 w-px bg-gray-200" />
                        {filteredAndSortedJourneys.map((journey, index) => (
                          <div
                            key={journey.id || `${journey.date}-${journey.title}-${index}`}
                            className="relative group py-2"
                          >
                            <div className="absolute left-1.5 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
                              {renderTypeIcon(journey.type)}
                            </div>
                            <div className="ml-8 p-3 bg-gray-50 rounded-md border border-gray-100 hover:border-gray-200 transition-colors">
                              <div className="flex items-center justify-between">
                                <div className="font-medium text-sm text-gray-900">
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
                                {formatDisplayDate(journey.date) || journey.date}
                              </div>
                              {journey.description && (
                                <div className="text-sm text-gray-700 mt-1.5 line-clamp-2">
                                  {journey.description}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : journeys &&
                    journeys.length > 0 &&
                    filteredAndSortedJourneys.length === 0 ? (
                    <div className="text-center py-6 text-gray-500">
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
                    <div className="text-center py-6 text-gray-500">
                      <svg
                        className="w-10 h-10 mx-auto mb-3 text-gray-300"
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
      <div
        className={`border-t border-gray-200 ${
          isPanelMode ? "bg-white p-3" : `bg-gray-50 ${activeTab === "timeline" ? "p-3 sm:p-4" : "p-4 sm:p-6"}`
        }`}
      >
        {activeTab === "overview" ? (
          isPanelMode ? (
            <div className="flex items-center justify-between gap-2">
              <div>
                {!hideDeleteButton && (
                  <Button
                    onClick={onDelete}
                    variant="secondary"
                    className="!text-red-600 h-10 px-4 text-sm font-medium bg-white border border-red-200 hover:bg-red-50 hover:border-red-300 flex items-center justify-center space-x-2"
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
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  onClick={onCancel}
                  variant="secondary"
                  className="!text-black h-10 px-4 text-sm font-medium bg-white border border-gray-200 hover:bg-gray-50 hover:border-gray-300 flex items-center justify-center space-x-2"
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
                  <span>Back</span>
                </Button>
                {!hideEditButton && (
                  <Button
                    onClick={onEdit}
                    variant="secondary"
                    className="!text-blue-600 h-10 px-4 text-sm font-medium bg-white border border-blue-200 hover:bg-blue-50 hover:border-blue-300 flex items-center justify-center space-x-2"
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
          ) : (
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
          )
        ) : (
          <Button
            onClick={onAddTimeline}
            variant="secondary"
            className={`!text-gray-700 w-full bg-white border border-gray-300 hover:bg-gray-50 hover:border-gray-400 flex items-center justify-center space-x-2 ${
              isPanelMode ? "h-10 px-4 text-sm font-medium" : "py-3 px-4 text-sm font-medium min-h-[44px]"
            }`}
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
            <span>Add/Edit Timeline</span>
          </Button>
        )}
      </div>
    </div>
  );
}
