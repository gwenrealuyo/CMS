import { useState, useMemo } from "react";
import { Family, Person, PersonUI } from "@/src/types/person";
import Button from "../ui/Button";

interface FamilyFormProps {
  onSubmit: (family: Partial<Family>) => Promise<void>;
  onClose: () => void;
  onDelete?: (family: Family) => void;
  initialData?: Family;
  availableMembers: PersonUI[];
  showDeleteButton?: boolean;
}

export default function FamilyForm({
  onSubmit,
  onClose,
  onDelete,
  initialData,
  availableMembers,
  showDeleteButton = true,
}: FamilyFormProps) {
  const [formData, setFormData] = useState({
    name: initialData?.name || "",
    members: initialData?.members || [],
    address: initialData?.address || "",
    notes: initialData?.notes || "",
    leader: initialData?.leader || "",
  });
  const [loading, setLoading] = useState(false);
  const [memberSearch, setMemberSearch] = useState("");
  const [showMemberDropdown, setShowMemberDropdown] = useState(false);

  const filteredMembers = useMemo(() => {
    if (!memberSearch.trim()) return availableMembers;
    return availableMembers.filter(
      (member) =>
        `${member.first_name} ${member.last_name}`
          .toLowerCase()
          .includes(memberSearch.toLowerCase()) ||
        member.role.toLowerCase().includes(memberSearch.toLowerCase()) ||
        member.status.toLowerCase().includes(memberSearch.toLowerCase())
    );
  }, [availableMembers, memberSearch]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      alert("Please enter a family name");
      return;
    }

    try {
      setLoading(true);
      await onSubmit(formData);
    } catch (error) {
      console.error("Error submitting family:", error);
      alert("Failed to save family. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const addMember = (member: PersonUI) => {
    if (!formData.members.includes(member.id)) {
      setFormData({
        ...formData,
        members: [...formData.members, member.id],
      });
    }
    setMemberSearch("");
    setShowMemberDropdown(false);
  };

  const removeMember = (memberId: string) => {
    setFormData({
      ...formData,
      members: formData.members.filter((id) => id !== memberId),
    });
  };

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

  const getSelectedMembers = () => {
    return availableMembers.filter((member) =>
      formData.members.includes(member.id)
    );
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Family Name *
        </label>
        <input
          type="text"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="Enter family name (e.g., Johnson)"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Family Leader (Optional)
        </label>
        <select
          value={formData.leader}
          onChange={(e) => setFormData({ ...formData, leader: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="">Select a family leader (optional)</option>
          {getSelectedMembers().map((member) => (
            <option key={member.id} value={member.id}>
              {member.first_name} {member.last_name}
            </option>
          ))}
        </select>
        <p className="text-xs text-gray-500 mt-1">
          You can assign a leader after adding members to the family
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Family Address
        </label>
        <textarea
          value={formData.address}
          onChange={(e) =>
            setFormData({ ...formData, address: e.target.value })
          }
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="Enter family physical address..."
          rows={2}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Family Notes
        </label>
        <textarea
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="Enter family notes or description..."
          rows={3}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Add Members ({formData.members.length} selected)
        </label>

        {/* Member Search Input */}
        <div className="relative">
          <input
            type="text"
            value={memberSearch}
            onChange={(e) => {
              setMemberSearch(e.target.value);
              setShowMemberDropdown(true);
            }}
            onFocus={() => setShowMemberDropdown(true)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Search members by name, role, or status..."
          />

          {/* Dropdown with filtered members */}
          {showMemberDropdown && memberSearch && (
            <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
              {filteredMembers.length === 0 ? (
                <div className="px-3 py-2 text-gray-500 text-sm">
                  No members found matching "{memberSearch}"
                </div>
              ) : (
                filteredMembers.map((member) => (
                  <button
                    key={member.id}
                    type="button"
                    onClick={() => addMember(member)}
                    disabled={formData.members.includes(member.id)}
                    className={`w-full px-3 py-2 text-left hover:bg-gray-50 flex items-center space-x-3 ${
                      formData.members.includes(member.id)
                        ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                        : "text-gray-900"
                    }`}
                  >
                    <div className="w-8 h-8 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-full flex items-center justify-center text-white text-xs font-semibold">
                      {getInitials(member)}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-sm">
                        {member.first_name} {member.last_name}
                      </p>
                      <div className="flex items-center space-x-1 mt-0.5">
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
                    {formData.members.includes(member.id) && (
                      <span className="text-xs text-gray-400">Added</span>
                    )}
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {/* Selected Members Display */}
        {formData.members.length > 0 && (
          <div className="mt-3">
            <p className="text-sm font-medium text-gray-700 mb-2">
              Selected Members:
            </p>
            <div className="flex flex-wrap gap-2">
              {getSelectedMembers().map((member) => (
                <div
                  key={member.id}
                  className="flex items-center space-x-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2"
                >
                  <div className="w-6 h-6 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-full flex items-center justify-center text-white text-xs font-semibold">
                    {getInitials(member)}
                  </div>
                  <span className="text-sm font-medium text-gray-900">
                    {member.first_name} {member.last_name}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeMember(member.id)}
                    className="text-gray-400 hover:text-red-500 ml-1"
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
          </div>
        )}

        {/* Click outside to close dropdown */}
        {showMemberDropdown && (
          <div
            className="fixed inset-0 z-0"
            onClick={() => setShowMemberDropdown(false)}
          />
        )}
      </div>

      <div className="flex gap-4 pt-4">
        <Button
          variant="tertiary"
          className="flex-1"
          onClick={onClose}
          disabled={loading}
        >
          Cancel
        </Button>
        <Button className="flex-1" disabled={loading}>
          {loading
            ? "Saving..."
            : initialData
            ? "Update Family"
            : "Create Family"}
        </Button>

        {initialData && onDelete && showDeleteButton && (
          <Button
            variant="tertiary"
            className="px-4 py-2 text-red-600 hover:text-red-700 hover:bg-red-50 border border-red-200"
            onClick={() => onDelete(initialData)}
            disabled={loading}
          >
            <svg
              className="w-4 h-4 mr-2"
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
            Delete
          </Button>
        )}
      </div>
    </form>
  );
}
