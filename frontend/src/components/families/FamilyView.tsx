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
}

export default function FamilyView({
  family,
  familyMembers,
  onEdit,
  onDelete,
  onCancel,
  onClose,
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
    <div className="space-y-6">
      {/* Family Header */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-100">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              The {family.name} Family
            </h2>
            <p className="text-gray-600 mt-1">
              {familyMembers.length} members • Since{" "}
              {familyMembers[0]?.dateFirstAttended
                ? new Date(
                    familyMembers[0].dateFirstAttended
                  ).toLocaleDateString()
                : "Unknown"}
            </p>
            {leader && (
              <p className="text-sm text-gray-500 mt-1">
                Family Leader: {leader.first_name} {leader.last_name}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Family Address */}
      {family.address && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">Address</h3>
          <p className="text-gray-700">{family.address}</p>
        </div>
      )}

      {/* Core Family */}
      {coreFamily.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Core Family ({coreFamily.length})
          </h3>
          <div className="space-y-3">
            {coreFamily.map((member) => (
              <div
                key={member.id}
                className="flex items-center space-x-4 p-3 bg-gray-50 rounded-lg"
              >
                <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-full flex items-center justify-center text-white font-semibold">
                  {getInitials(member)}
                </div>
                <div className="flex-1">
                  <h4 className="font-medium text-gray-900">
                    {member.first_name} {member.last_name}
                  </h4>
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
                    {member.id === family.leader && (
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
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
      {connectedFamily.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Connected Family ({connectedFamily.length})
          </h3>
          <div className="space-y-3">
            {connectedFamily.map((member) => (
              <div
                key={member.id}
                className="flex items-center space-x-4 p-3 bg-gray-50 rounded-lg"
              >
                <div className="w-12 h-12 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full flex items-center justify-center text-white font-semibold">
                  {getInitials(member)}
                </div>
                <div className="flex-1">
                  <h4 className="font-medium text-gray-900">
                    {member.first_name} {member.last_name}
                  </h4>
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
            ))}
          </div>
        </div>
      )}

      {/* Family Notes */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-gray-900 mb-3">Notes</h3>
        <p className="text-gray-700">
          {family.notes || "No notes available for this family."}
        </p>
      </div>

      {/* Action Buttons */}
      <div className="pt-6">
        <div className="flex justify-between items-center">
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
    </div>
  );
}
