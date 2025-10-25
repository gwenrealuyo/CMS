import React from "react";
import { Family, PersonUI } from "@/src/types/person";
import Button from "@/src/components/ui/Button";

interface FamilyViewProps {
  family: Family;
  familyMembers: PersonUI[];
  onEdit: () => void;
  onDelete: () => void;
  onCancel: () => void;
  onClose: () => void;
  onAddMember?: () => void;
}

export default function FamilyView({
  family,
  familyMembers,
  onEdit,
  onDelete,
  onCancel,
  onClose,
  onAddMember,
}: FamilyViewProps) {
  const getInitials = (person: PersonUI) => {
    return `${person.first_name?.[0] || ""}${
      person.last_name?.[0] || ""
    }`.toUpperCase();
  };

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

  const getLeader = () => {
    if (!family.leader) return null;
    return familyMembers.find((member) => member.id === family.leader);
  };

  const leader = getLeader();

  return (
    <div className="flex flex-col h-full space-y-0">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <div>
          <h2 className="text-base font-medium text-gray-900">
            Family Details
          </h2>
          <p className="text-xs text-gray-600 mt-0.5">
            The {family.name} Family
          </p>
        </div>
        <button
          onClick={onClose}
          className="text-red-600 hover:text-red-700 text-xl font-bold p-1 rounded-md hover:bg-red-50 transition-colors"
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
      <div className="p-6 overflow-y-auto flex-1">
        <div className="space-y-4">
          {/* Family Header Card */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 border border-blue-100">
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                The {family.name} Family
              </h2>
              <p className="text-sm text-gray-600 mt-0.5">
                {familyMembers.length} members • Since{" "}
                {familyMembers[0]?.dateFirstAttended
                  ? new Date(
                      familyMembers[0].dateFirstAttended
                    ).toLocaleDateString()
                  : "Unknown"}
              </p>
              {leader && (
                <p className="text-xs text-gray-500 mt-1">
                  Family Leader: {leader.first_name} {leader.last_name}
                </p>
              )}
            </div>
          </div>

          {/* Family Address */}
          {family.address && (
            <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
              <h3 className="text-sm font-semibold text-gray-900 mb-2">
                Address
              </h3>
              <p className="text-sm text-gray-700">{family.address}</p>
            </div>
          )}

          {/* Core Family */}
          {coreFamily.length > 0 && (
            <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">
                Core Family ({coreFamily.length})
              </h3>
              <div className="space-y-2">
                {coreFamily.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center space-x-3 p-2 bg-gray-50 rounded-md"
                  >
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-full flex items-center justify-center text-white text-sm font-semibold">
                      {getInitials(member)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-medium text-gray-900 truncate">
                        {member.first_name} {member.last_name}
                      </h4>
                      <div className="flex items-center space-x-1.5 mt-0.5 flex-wrap">
                        <span
                          className={`px-1.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(
                            member.status
                          )}`}
                        >
                          {member.status.toLowerCase()}
                        </span>
                        <span
                          className={`px-1.5 py-0.5 rounded-full text-xs font-medium ${getRoleColor(
                            member.role
                          )}`}
                        >
                          {member.role.toLowerCase()}
                        </span>
                        {member.id === family.leader && (
                          <span className="px-1.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                            Leader
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Connected Family */}
          {(connectedFamily.length > 0 || onAddMember) && (
            <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-900">
                  Connected Family ({connectedFamily.length})
                </h3>
                {onAddMember && (
                  <Button
                    onClick={onAddMember}
                    variant="secondary"
                    className="!text-green-600 py-1.5 px-3 text-xs font-normal bg-white border border-green-200 hover:bg-green-50 hover:border-green-300 flex items-center justify-center space-x-1.5"
                  >
                    <svg
                      className="w-3.5 h-3.5"
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
                    <span>Add Member</span>
                  </Button>
                )}
              </div>
              {connectedFamily.length > 0 ? (
                <div className="space-y-2">
                  {connectedFamily.map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center space-x-3 p-2 bg-gray-50 rounded-md"
                    >
                      <div className="w-10 h-10 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full flex items-center justify-center text-white text-sm font-semibold">
                        {getInitials(member)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-medium text-gray-900 truncate">
                          {member.first_name} {member.last_name}
                        </h4>
                        <div className="flex items-center space-x-1.5 mt-0.5 flex-wrap">
                          <span
                            className={`px-1.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(
                              member.status
                            )}`}
                          >
                            {member.status.toLowerCase()}
                          </span>
                          <span
                            className={`px-1.5 py-0.5 rounded-full text-xs font-medium ${getRoleColor(
                              member.role
                            )}`}
                          >
                            {member.role.toLowerCase()}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4 text-gray-500 text-sm">
                  No connected family members yet
                </div>
              )}
            </div>
          )}

          {/* Family Notes */}
          {family.notes && (
            <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
              <h3 className="text-sm font-semibold text-gray-900 mb-2">
                Notes
              </h3>
              <p className="text-sm text-gray-700">{family.notes}</p>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="flex justify-between items-center p-6 border-t border-gray-200 bg-gray-50">
        <Button
          onClick={onDelete}
          variant="secondary"
          className="!text-red-600 py-4 px-4 text-sm font-normal bg-white border border-red-200 hover:bg-red-50 hover:border-red-300 flex items-center justify-center"
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
        <div className="flex gap-3">
          <Button
            onClick={onCancel}
            variant="secondary"
            className="!text-black py-4 px-6 text-sm font-normal bg-white border border-gray-200 hover:bg-gray-50 hover:border-gray-300 flex items-center justify-center space-x-2"
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
          <Button
            onClick={onEdit}
            variant="secondary"
            className="!text-blue-600 py-4 px-6 text-sm font-normal bg-white border border-blue-200 hover:bg-blue-50 hover:border-blue-300 flex items-center justify-center space-x-2"
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
        </div>
      </div>
    </div>
  );
}
