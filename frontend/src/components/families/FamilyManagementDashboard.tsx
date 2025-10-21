import { useState, useMemo } from "react";
import { Family, Person, PersonUI } from "@/src/types/person";
import Button from "@/src/components/ui/Button";
import ActionMenu from "./ActionMenu";

interface FamilyManagementDashboardProps {
  families: Family[];
  people: PersonUI[];
  onCreateFamily: () => void;
  onViewFamily: (family: Family) => void;
  onEditFamily: (family: Family) => void;
  onDeleteFamily: (family: Family) => void;
  onAssignMember: (personId: string, familyId: string) => void;
  onRemoveMember: (personId: string, familyId: string) => void;
}

export default function FamilyManagementDashboard({
  families,
  people,
  onCreateFamily,
  onViewFamily,
  onEditFamily,
  onDeleteFamily,
  onAssignMember,
  onRemoveMember,
}: FamilyManagementDashboardProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [unassignedSearch, setUnassignedSearch] = useState("");
  const [unassignedPage, setUnassignedPage] = useState(1);
  const UNASSIGNED_PAGE_SIZE = 24; // 3 cols * 8 rows fits most screens

  // Get unassigned members (people not in any family)
  const unassignedMembers = useMemo(() => {
    const assignedMemberIds = new Set(
      families.flatMap((family) => family.members)
    );
    return people.filter((person) => !assignedMemberIds.has(person.id));
  }, [families, people]);

  // Scalable: filter + paginate unassigned members
  const filteredUnassignedMembers = useMemo(() => {
    if (!unassignedSearch.trim()) return unassignedMembers;
    const q = unassignedSearch.toLowerCase();
    return unassignedMembers.filter((p) =>
      `${p.first_name ?? ""} ${p.last_name ?? ""}`.toLowerCase().includes(q)
    );
  }, [unassignedMembers, unassignedSearch]);

  const totalUnassignedPages = Math.max(
    1,
    Math.ceil(filteredUnassignedMembers.length / UNASSIGNED_PAGE_SIZE)
  );

  const visibleUnassignedMembers = useMemo(() => {
    const start = (unassignedPage - 1) * UNASSIGNED_PAGE_SIZE;
    return filteredUnassignedMembers.slice(start, start + UNASSIGNED_PAGE_SIZE);
  }, [filteredUnassignedMembers, unassignedPage]);

  // Filter families based on search query
  const filteredFamilies = useMemo(() => {
    if (!searchQuery) return families;
    return families.filter((family) =>
      family.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [families, searchQuery]);

  // Get person details for a given ID
  const getPersonById = (id: string) => {
    return people.find((person) => person.id === id);
  };

  // Get initials for avatar
  const getInitials = (person: PersonUI) => {
    return `${person.first_name?.[0] || ""}${
      person.last_name?.[0] || ""
    }`.toUpperCase();
  };

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return "bg-green-100 text-green-800";
      case "SEMIACTIVE":
        return "bg-yellow-100 text-yellow-800";
      case "INACTIVE":
        return "bg-gray-100 text-gray-800";
      case "DECEASED":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  // Get role color
  const getRoleColor = (role: string) => {
    switch (role) {
      case "PASTOR":
        return "bg-purple-100 text-purple-800";
      case "COORDINATOR":
        return "bg-blue-100 text-blue-800";
      case "MEMBER":
        return "bg-green-100 text-green-800";
      case "VISITOR":
        return "bg-orange-100 text-orange-800";
      case "ADMIN":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div className="space-y-6">
      {/* Statistics Cards */}
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
                    d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                  />
                </svg>
              </div>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">
                Total Families
              </p>
              <p className="text-2xl font-semibold text-gray-900">
                {families.length}
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
              <p className="text-sm font-medium text-gray-500">Total Members</p>
              <p className="text-2xl font-semibold text-gray-900">
                {families.reduce(
                  (acc, family) => acc + family.members.length,
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
                {unassignedMembers.length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        {/* Search */}
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
                placeholder="Search families…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`w-full pl-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm ${
                  searchQuery ? "pr-10" : "pr-4"
                }`}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
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

      {/* Unassigned Members Section */}
      {unassignedMembers.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-gray-900">
            Unassigned Members ({filteredUnassignedMembers.length})
          </h2>
          {/* Unassigned Controls */}
          <div className="flex items-center justify-between gap-4">
            <div className="relative w-full max-w-xs">
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
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
                placeholder="Search unassigned…"
                value={unassignedSearch}
                onChange={(e) => {
                  setUnassignedSearch(e.target.value);
                  setUnassignedPage(1);
                }}
                className={`w-full pl-9 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm ${
                  unassignedSearch ? "pr-10" : "pr-3"
                }`}
              />
              {unassignedSearch && (
                <button
                  type="button"
                  onClick={() => {
                    setUnassignedSearch("");
                    setUnassignedPage(1);
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
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span>
                Page {unassignedPage} of {totalUnassignedPages}
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setUnassignedPage((p) => Math.max(1, p - 1))}
                  disabled={unassignedPage === 1}
                  className="px-2 py-1 border border-gray-300 rounded-lg disabled:opacity-50"
                  title="Previous"
                >
                  ‹
                </button>
                <button
                  onClick={() =>
                    setUnassignedPage((p) =>
                      Math.min(totalUnassignedPages, p + 1)
                    )
                  }
                  disabled={unassignedPage === totalUnassignedPages}
                  className="px-2 py-1 border border-gray-300 rounded-lg disabled:opacity-50"
                  title="Next"
                >
                  ›
                </button>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {visibleUnassignedMembers.map((member) => (
              <div
                key={member.id}
                className="bg-white rounded-lg shadow-md p-4"
              >
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-full flex items-center justify-center text-white font-semibold">
                    {getInitials(member)}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-900">
                      {member.first_name} {member.last_name}
                    </h3>
                    <p className="text-sm text-gray-500">
                      Joined{" "}
                      {member.dateFirstAttended
                        ? new Date(
                            member.dateFirstAttended
                          ).toLocaleDateString()
                        : "Unknown"}
                    </p>
                    <div className="flex items-center space-x-2 mt-1">
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(
                          member.status
                        )}`}
                      >
                        {member.status.toLowerCase()}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-medium ${getRoleColor(
                          member.role
                        )}`}
                      >
                        {member.role.toLowerCase()}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Family Cards Section */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-gray-900">
          Families ({filteredFamilies.length})
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredFamilies.map((family) => {
            const familyMembers = family.members
              .map((id) => getPersonById(id))
              .filter(Boolean) as PersonUI[];

            // Separate core family (parents/adults) and connected family (children)
            const coreFamily = familyMembers.filter(
              (member) =>
                member.role === "PASTOR" ||
                member.role === "COORDINATOR" ||
                member.role === "MEMBER"
            );
            const connectedFamily = familyMembers.filter(
              (member) => member.role === "VISITOR"
            );

            return (
              <div
                key={family.id}
                className="bg-white rounded-lg shadow-md p-6"
              >
                <div className="space-y-4">
                  {/* Family Header */}
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-xl font-semibold text-gray-900">
                        The {family.name} Family
                      </h3>
                      <p className="text-sm text-gray-600">
                        {familyMembers.length} members • Since{" "}
                        {familyMembers[0]?.dateFirstAttended
                          ? new Date(
                              familyMembers[0].dateFirstAttended
                            ).toLocaleDateString()
                          : "Unknown"}
                      </p>
                    </div>
                    <ActionMenu
                      onView={() => onViewFamily(family)}
                      onEdit={() => onEditFamily(family)}
                      onDelete={() => onDeleteFamily(family)}
                    />
                  </div>

                  {/* Core Family */}
                  {coreFamily.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 mb-3">
                        Core Family ({coreFamily.length})
                      </h4>
                      <div className="space-y-2">
                        {coreFamily.map((member) => (
                          <div
                            key={member.id}
                            className="flex items-center space-x-3"
                          >
                            <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-full flex items-center justify-center text-white text-sm font-semibold">
                              {getInitials(member)}
                            </div>
                            <div className="flex-1">
                              <p className="font-medium text-gray-900">
                                {member.first_name} {member.last_name}
                              </p>
                              <p className="text-sm text-gray-500">
                                {member.role}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Connected Family */}
                  {connectedFamily.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 mb-3">
                        Connected Family ({connectedFamily.length})
                      </h4>
                      <div className="space-y-2">
                        {connectedFamily.map((member) => (
                          <div
                            key={member.id}
                            className="flex items-center space-x-3"
                          >
                            <div className="w-10 h-10 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full flex items-center justify-center text-white text-sm font-semibold">
                              {getInitials(member)}
                            </div>
                            <div className="flex-1">
                              <p className="font-medium text-gray-900">
                                {member.first_name} {member.last_name}
                              </p>
                              <p className="text-sm text-gray-500">
                                {member.role}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Notes */}
                  <div className="pt-2 border-t border-gray-100">
                    <p className="text-sm text-gray-500 italic">
                      {family.notes || "No notes available for this family."}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
