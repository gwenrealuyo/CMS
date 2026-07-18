import { useState, useMemo, useEffect, useCallback } from "react";
import { Family, PersonUI } from "@/src/types/person";
import Button from "../ui/Button";
import { getPersonRoleColor } from "@/src/lib/personRole";
import { formatPersonName } from "@/src/lib/name";
import PersonAvatar from "@/src/components/people/PersonAvatar";
import { useBranches } from "@/src/hooks/useBranches";
import { useAuth } from "@/src/contexts/AuthContext";

interface FamilyFormProps {
  onSubmit: (family: Partial<Family>) => Promise<void>;
  onClose: () => void;
  onDelete?: (family: Family) => void;
  initialData?: Family;
  availableMembers: PersonUI[];
  showDeleteButton?: boolean;
  compactLayout?: boolean;
}

export default function FamilyForm({
  onSubmit,
  onClose,
  onDelete,
  initialData,
  availableMembers,
  showDeleteButton = true,
  compactLayout = false,
}: FamilyFormProps) {
  const { branches } = useBranches();
  const { user, isSeniorCoordinator } = useAuth();
  const canEditBranch =
    user?.role === "ADMIN" ||
    user?.role === "PASTOR" ||
    isSeniorCoordinator("CLUSTER");

  const getInitialFormData = useCallback(
    () => ({
      name: initialData?.name || "",
      members: initialData?.members || [],
      address: initialData?.address || "",
      notes: initialData?.notes || "",
      leader: initialData?.leader || "",
      branch:
        initialData?.branch != null && initialData.branch !== undefined
          ? String(initialData.branch)
          : "",
    }),
    [initialData]
  );

  const [formData, setFormData] = useState({
    ...getInitialFormData(),
  });
  const [loading, setLoading] = useState(false);
  const [memberSearch, setMemberSearch] = useState("");
  const [showMemberDropdown, setShowMemberDropdown] = useState(false);

  useEffect(() => {
    // Keep form state in sync when switching between edit/create targets.
    setFormData(getInitialFormData());
    setMemberSearch("");
    setShowMemberDropdown(false);
  }, [getInitialFormData]);

  const filteredMembers = useMemo(() => {
    if (!memberSearch.trim()) return availableMembers;
    const searchLower = memberSearch.toLowerCase();
    return availableMembers.filter(
      (member) =>
        formatPersonName(member).toLowerCase().includes(searchLower) ||
        member.role.toLowerCase().includes(searchLower) ||
        member.status.toLowerCase().includes(searchLower)
    );
  }, [availableMembers, memberSearch]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      alert("Please enter a family name");
      return;
    }
    if (!formData.leader) {
      alert(
        formData.members.length === 0
          ? "Please add members and select a family leader"
          : "Please select a family leader"
      );
      return;
    }

    try {
      setLoading(true);
      await onSubmit({
        ...formData,
        branch: formData.branch ? Number(formData.branch) : null,
      });
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
      leader: formData.leader === memberId ? "" : formData.leader,
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return "bg-green-100 text-green-800";
      case "SEMIACTIVE":
        return "bg-yellow-100 text-yellow-800";
      case "INACTIVE":
        return "bg-gray-100 text-gray-800";
      case "DORMANT":
        return "bg-orange-100 text-orange-800";
      case "FALLAWAY":
        return "bg-violet-100 text-violet-800";
      case "DECEASED":
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
    <form
      onSubmit={handleSubmit}
      className={compactLayout ? "p-4 sm:p-5 space-y-4" : "space-y-4"}
    >
      <div className="space-y-4">
        <div>
          <label
            className={`block text-sm font-medium text-gray-700 ${
              compactLayout ? "mb-2" : "mb-2"
            }`}
          >
            Family Name *
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent"
            placeholder="Enter family name (e.g., Johnson)"
            required
          />
        </div>

        <div>
          <label
            className={`block text-sm font-medium text-gray-700 ${
              compactLayout ? "mb-2" : "mb-2"
            }`}
          >
            Branch
          </label>
          <select
            value={formData.branch}
            onChange={(e) =>
              setFormData({ ...formData, branch: e.target.value })
            }
            disabled={!canEditBranch}
            className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent ${
              !canEditBranch ? "bg-gray-100 cursor-not-allowed" : ""
            }`}
          >
            <option value="">No branch</option>
            {branches
              .filter((b) => b.is_active)
              .map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                  {branch.is_headquarters ? " (HQ)" : ""}
                </option>
              ))}
          </select>
          {!canEditBranch && (
            <p className="text-xs text-gray-500 mt-1">
              Only ADMIN, PASTOR, or CLUSTER Senior Coordinator can edit branch
            </p>
          )}
        </div>

        <div>
          <label
            className={`block text-sm font-medium text-gray-700 ${
              compactLayout ? "mb-2" : "mb-2"
            }`}
          >
            Family Leader *
          </label>
          <select
            value={formData.leader}
            onChange={(e) =>
              setFormData({ ...formData, leader: e.target.value })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent"
            required
          >
            <option value="" disabled hidden>Select a family leader</option>
            {getSelectedMembers().map((member) => (
              <option key={member.id} value={member.id}>
                {formatPersonName(member)}
              </option>
            ))}
          </select>
          <p className="text-xs text-gray-500 mt-1">
            Add members first, then choose a leader from the family
          </p>
        </div>
      </div>

      <div>
        <label
          className={`block text-sm font-medium text-gray-700 ${
            compactLayout ? "mb-2" : "mb-2"
          }`}
        >
          Family Address
        </label>
        <textarea
          value={formData.address}
          onChange={(e) =>
            setFormData({ ...formData, address: e.target.value })
          }
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent"
          placeholder="Enter family physical address..."
          rows={compactLayout ? 2 : 2}
        />
      </div>

      <div>
        <label
          className={`block text-sm font-medium text-gray-700 ${
            compactLayout ? "mb-2" : "mb-2"
          }`}
        >
          Family Notes
        </label>
        <textarea
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent"
          placeholder="Enter family notes or description..."
          rows={compactLayout ? 3 : 3}
        />
      </div>

      <div>
        <label
          className={`block text-sm font-medium text-gray-700 ${
            compactLayout ? "mb-2" : "mb-2"
          }`}
        >
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
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent"
            placeholder="Search members by name, role, or status..."
          />

          {/* Dropdown with filtered members */}
          {showMemberDropdown && memberSearch && (
            <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
              {filteredMembers.length === 0 ? (
                <div className="px-3 py-2 text-gray-500 text-sm">
                  No members found matching &ldquo;{memberSearch}&rdquo;
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
                    <PersonAvatar person={member} size="sm" />
                    <div className="flex-1">
                      <p className="font-medium text-sm">
                        {formatPersonName(member)}
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
                          className={`px-1.5 py-0.5 rounded-full text-xs font-medium ${getPersonRoleColor(
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
                  className="flex items-center space-x-2 bg-primary/10 border border-primary/20 rounded-lg px-3 py-2"
                >
                  <PersonAvatar person={member} size="xs" />
                  <span className="text-sm font-medium text-gray-900">
                    {formatPersonName(member)}
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

      <div
        className={`flex flex-col-reverse sm:flex-row ${
          compactLayout ? "gap-3 sm:gap-4 pt-4" : "gap-3 sm:gap-4 pt-3"
        }`}
      >
        <Button
          variant="tertiary"
          className="w-full sm:flex-1 min-h-[44px]"
          onClick={onClose}
          disabled={loading}
        >
          {compactLayout ? "Back" : "Cancel"}
        </Button>
        <Button
          className="w-full sm:flex-1 min-h-[44px]"
          disabled={loading}
          type="submit"
        >
          {loading
            ? "Saving..."
            : initialData
            ? "Update Family"
            : "Create Family"}
        </Button>
        {initialData && onDelete && showDeleteButton && (
          <>
            <div className="border-t border-gray-200 my-1 sm:hidden"></div>
            <Button
              variant="tertiary"
              className="w-full sm:w-auto sm:px-4 sm:py-2 min-h-[44px] text-red-600 hover:text-red-700 hover:bg-red-50 border border-red-200"
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
          </>
        )}
      </div>
    </form>
  );
}
