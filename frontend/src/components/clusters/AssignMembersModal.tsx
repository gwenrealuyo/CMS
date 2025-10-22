import React, { useState, useEffect, useMemo, useRef } from "react";
import { Cluster, Person, PersonUI } from "@/src/types/person";
import Button from "@/src/components/ui/Button";

interface AssignMembersModalProps {
  cluster: Cluster;
  peopleUI: PersonUI[];
  isOpen: boolean;
  onClose: () => void;
  onAssignMembers: (memberIds: string[]) => void;
}

export default function AssignMembersModal({
  cluster,
  peopleUI,
  isOpen,
  onClose,
  onAssignMembers,
}: AssignMembersModalProps) {
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [memberSearch, setMemberSearch] = useState("");
  const [showMemberDropdown, setShowMemberDropdown] = useState(false);
  const [loading, setLoading] = useState(false);
  const memberDropdownRef = useRef<HTMLDivElement>(null);

  // Initialize selected members from cluster
  useEffect(() => {
    if (isOpen && cluster) {
      setSelectedMembers((cluster as any).members || []);
    }
  }, [isOpen, cluster]);

  // Filter members based on search
  const filteredMembers = useMemo(() => {
    if (!memberSearch.trim()) return peopleUI;

    const searchLower = memberSearch.toLowerCase();
    return peopleUI.filter((person) => {
      const fullName = `${person.first_name} ${person.last_name}`.toLowerCase();
      const email = person.email?.toLowerCase() || "";
      const memberId = person.member_id?.toLowerCase() || "";

      return (
        fullName.includes(searchLower) ||
        email.includes(searchLower) ||
        memberId.includes(searchLower)
      );
    });
  }, [peopleUI, memberSearch]);

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        memberDropdownRef.current &&
        !memberDropdownRef.current.contains(event.target as Node)
      ) {
        setShowMemberDropdown(false);
      }
    };

    if (showMemberDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showMemberDropdown]);

  const addMember = (memberId: string) => {
    if (!selectedMembers.includes(memberId)) {
      setSelectedMembers([...selectedMembers, memberId]);
    }
    setMemberSearch("");
    setShowMemberDropdown(false);
  };

  const removeMember = (memberId: string) => {
    setSelectedMembers(selectedMembers.filter((id) => id !== memberId));
  };

  const getSelectedMembers = () => {
    return peopleUI.filter((person) => selectedMembers.includes(person.id));
  };

  const handleSubmit = async () => {
    try {
      setLoading(true);
      await onAssignMembers(selectedMembers);
      onClose();
    } catch (error) {
      console.error("Error assigning members:", error);
    } finally {
      setLoading(false);
    }
  };

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName?.[0] || ""}${lastName?.[0] || ""}`.toUpperCase();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return "bg-green-100 text-green-800";
      case "INACTIVE":
        return "bg-red-100 text-red-800";
      case "DECEASED":
        return "bg-gray-100 text-gray-800";
      case "INVITED":
        return "bg-yellow-100 text-yellow-800";
      case "ATTENDED":
        return "bg-green-100 text-green-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case "MEMBER":
        return "bg-blue-100 text-blue-800";
      case "VISITOR":
        return "bg-purple-100 text-purple-800";
      case "COORDINATOR":
        return "bg-purple-100 text-purple-800";
      case "PASTOR":
        return "bg-red-100 text-red-800";
      case "ADMIN":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              Assign Members to {cluster.name}
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Select members to assign to this cluster
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl font-bold p-1 rounded-md hover:bg-red-50 transition-colors"
          >
            <svg
              className="w-6 h-6"
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
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          {/* Member Search */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Search Members
            </label>
            <div className="relative" ref={memberDropdownRef}>
              <input
                type="text"
                value={memberSearch}
                onChange={(e) => {
                  setMemberSearch(e.target.value);
                  setShowMemberDropdown(true);
                }}
                onFocus={() => setShowMemberDropdown(true)}
                placeholder="Search by name, email, or member ID..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />

              {/* Search Dropdown */}
              {showMemberDropdown && filteredMembers.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                  {filteredMembers.map((person) => (
                    <button
                      key={person.id}
                      onClick={() => addMember(person.id)}
                      disabled={selectedMembers.includes(person.id)}
                      className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center space-x-3 ${
                        selectedMembers.includes(person.id)
                          ? "bg-gray-100 cursor-not-allowed opacity-50"
                          : ""
                      }`}
                    >
                      <div className="w-8 h-8 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center text-white text-xs font-semibold">
                        {getInitials(person.first_name, person.last_name)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate">
                          {person.first_name} {person.last_name}
                        </p>
                        <p className="text-xs text-gray-600 truncate">
                          {person.email}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(
                            person.status
                          )}`}
                        >
                          {person.status}
                        </span>
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getRoleColor(
                            person.role
                          )}`}
                        >
                          {person.role}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Selected Members */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Selected Members ({selectedMembers.length})
            </label>
            {selectedMembers.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
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
                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                  />
                </svg>
                <p className="mt-2 text-sm">No members selected</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {getSelectedMembers().map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center space-x-3 p-3 bg-white border border-gray-200 rounded-lg"
                  >
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center text-white text-sm font-semibold">
                      {getInitials(member.first_name, member.last_name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">
                        {member.first_name} {member.last_name}
                      </p>
                      <p className="text-sm text-gray-600 truncate">
                        {member.email}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(
                          member.status
                        )}`}
                      >
                        {member.status}
                      </span>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getRoleColor(
                          member.role
                        )}`}
                      >
                        {member.role}
                      </span>
                    </div>
                    <button
                      onClick={() => removeMember(member.id)}
                      className="text-red-500 hover:text-red-700 p-1 rounded-md hover:bg-red-50 transition-colors"
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
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50">
          <Button
            onClick={onClose}
            variant="secondary"
            className="!text-black py-2 px-4 text-sm font-normal bg-white border border-gray-200 hover:bg-gray-50 hover:border-gray-300"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={loading || selectedMembers.length === 0}
            className="!text-white py-2 px-4 text-sm font-normal bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
          >
            {loading ? (
              <>
                <svg
                  className="animate-spin h-4 w-4"
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
                <span>Assigning...</span>
              </>
            ) : (
              <>
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
                <span>Assign Members</span>
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
