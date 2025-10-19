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

  // Get unassigned members (people not in any family)
  const unassignedMembers = useMemo(() => {
    const assignedMemberIds = new Set(
      families.flatMap((family) => family.members)
    );
    return people.filter((person) => !assignedMemberIds.has(person.id));
  }, [families, people]);

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
      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <div className="mb-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Family Management
            </h1>
            <p className="text-gray-600 mt-1">
              Manage church families with core and connected members.
            </p>
          </div>
        </div>

        {/* Search and Filters */}
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
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                {filteredFamilies.length} Families
              </span>
              <span className="px-3 py-1 bg-orange-100 text-orange-800 rounded-full text-sm font-medium">
                {unassignedMembers.length} Unassigned Members
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Unassigned Members Section */}
      {unassignedMembers.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-gray-900">
            Unassigned Members ({unassignedMembers.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {unassignedMembers.map((member) => (
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
