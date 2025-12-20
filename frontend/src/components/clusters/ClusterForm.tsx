import { useState, useEffect, useMemo } from "react";
import { Cluster } from "@/src/types/cluster";
import { Person, PersonUI } from "@/src/types/person";
import { Branch } from "@/src/types/branch";
import { usePeople } from "@/src/hooks/usePeople";
import { useFamilies } from "@/src/hooks/useFamilies";
import { useBranches } from "@/src/hooks/useBranches";
import { useAuth } from "@/src/contexts/AuthContext";
import Button from "@/src/components/ui/Button";
import ErrorMessage from "@/src/components/ui/ErrorMessage";
import SearchableSelect from "@/src/components/ui/SearchableSelect";

interface ClusterFormProps {
  initialData?: Cluster;
  onSubmit: (data: Partial<Cluster>) => void;
  onCancel: () => void;
  error?: string | null;
  submitting?: boolean;
}

export default function ClusterForm({
  initialData,
  onSubmit,
  onCancel,
  error,
  submitting,
}: ClusterFormProps) {
  const [code, setCode] = useState(initialData?.code || "");
  const [name, setName] = useState(initialData?.name || "");
  const [coordinatorId, setCoordinatorId] = useState(
    initialData?.coordinator_id?.toString() ||
      initialData?.coordinator?.id?.toString() ||
      ""
  );
  const [familyIds, setFamilyIds] = useState<string[]>(
    (initialData?.families || []).map((id) => id.toString())
  );
  const [memberIds, setMemberIds] = useState<string[]>(
    (initialData?.members || []).map((id) => id.toString())
  );
  const [location, setLocation] = useState(initialData?.location || "");
  const [meetingSchedule, setMeetingSchedule] = useState(
    initialData?.meeting_schedule || ""
  );
  const [description, setDescription] = useState(
    initialData?.description || ""
  );
  const [branchId, setBranchId] = useState<string>(
    initialData?.branch?.toString() || ""
  );
  const [memberSearch, setMemberSearch] = useState("");
  const [showMemberDropdown, setShowMemberDropdown] = useState(false);
  const [familySearch, setFamilySearch] = useState("");
  const [showFamilyDropdown, setShowFamilyDropdown] = useState(false);

  const { people, loading: peopleLoading } = usePeople();
  const { families, loading: familiesLoading } = useFamilies();
  const { branches } = useBranches();
  const { user } = useAuth();
  const canEditBranch = user?.role === "ADMIN" || user?.role === "PASTOR";

  // Update memberIds when initialData changes
  useEffect(() => {
    if (initialData?.members) {
      setMemberIds(initialData.members.map((id) => id.toString()));
    }
  }, [initialData?.members]);

  // Update familyIds when initialData changes
  useEffect(() => {
    if (initialData?.families) {
      setFamilyIds(initialData.families.map((id) => id.toString()));
    }
  }, [initialData?.families]);

  // Update branchId when initialData changes
  useEffect(() => {
    if (initialData?.branch) {
      setBranchId(initialData.branch.toString());
    }
  }, [initialData?.branch]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      code: code || undefined,
      name: name || undefined,
      coordinator_id: coordinatorId ? Number(coordinatorId) : undefined,
      families: familyIds.map(Number),
      members: memberIds.map(Number),
      branch: branchId ? Number(branchId) : undefined,
      location: location || undefined,
      meeting_schedule: meetingSchedule || undefined,
      description: description || undefined,
    });
  };

  // Coordinator options: only show cluster members
  // SearchableSelect expects options with id, first_name, last_name, username structure
  const coordinatorOptions = useMemo(() => {
    const memberIdsSet = new Set(memberIds);
    return people.filter((p) => memberIdsSet.has(p.id.toString()));
  }, [people, memberIds]);

  const filteredFamilies = useMemo(() => {
    if (!familySearch.trim()) return families;
    return families.filter((family) =>
      family.name.toLowerCase().includes(familySearch.toLowerCase())
    );
  }, [families, familySearch]);

  const addFamily = (family: { id: string; name: string }) => {
    const familyIdStr = family.id.toString();
    if (!familyIds.includes(familyIdStr)) {
      setFamilyIds([...familyIds, familyIdStr]);

      // Automatically add all family members to the members list
      const selectedFamily = families.find(
        (f) => f.id.toString() === familyIdStr
      );
      if (selectedFamily && selectedFamily.members) {
        const familyMemberIds = selectedFamily.members.map((id) =>
          id.toString()
        );
        const newMemberIds = [...memberIds];

        // Add family members that aren't already in the list
        familyMemberIds.forEach((memberId) => {
          if (!newMemberIds.includes(memberId)) {
            newMemberIds.push(memberId);
          }
        });

        setMemberIds(newMemberIds);
      }
    }
    setFamilySearch("");
    setShowFamilyDropdown(false);
  };

  const removeFamily = (familyId: string) => {
    setFamilyIds(familyIds.filter((id) => id !== familyId));

    // Remove family members when family is removed
    const removedFamily = families.find((f) => f.id.toString() === familyId);
    if (removedFamily && removedFamily.members) {
      const familyMemberIds = removedFamily.members.map((id) => id.toString());
      setMemberIds(memberIds.filter((id) => !familyMemberIds.includes(id)));
    }
  };

  const getSelectedFamilies = () => {
    return families.filter((family) =>
      familyIds.includes(family.id.toString())
    );
  };

  const memberOptions = people.map((p) => ({
    value: p.id,
    label: `${p.first_name} ${p.last_name}`,
  }));

  const filteredMembers = useMemo(() => {
    if (!memberSearch.trim()) return people;
    return people.filter(
      (member) =>
        `${member.first_name} ${member.last_name}`
          .toLowerCase()
          .includes(memberSearch.toLowerCase()) ||
        member.role.toLowerCase().includes(memberSearch.toLowerCase()) ||
        member.status.toLowerCase().includes(memberSearch.toLowerCase())
    );
  }, [people, memberSearch]);

  const addMember = (member: Person | PersonUI) => {
    const memberIdStr = member.id.toString();
    if (!memberIds.includes(memberIdStr)) {
      setMemberIds([...memberIds, memberIdStr]);
    }
    setMemberSearch("");
    setShowMemberDropdown(false);
  };

  const removeMember = (memberId: string) => {
    setMemberIds(memberIds.filter((id) => id !== memberId));
  };

  const getInitials = (person: Person | PersonUI) => {
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
    return people.filter((member) => memberIds.includes(member.id.toString()));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <ErrorMessage message={error} />}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Code
          </label>
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="w-full px-3 py-2.5 md:py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base md:text-sm min-h-[44px] md:min-h-0"
            placeholder="CLU-001"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Name *
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2.5 md:py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base md:text-sm min-h-[44px] md:min-h-0"
            required
          />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Coordinator
        </label>
        <SearchableSelect
          options={coordinatorOptions as any}
          value={coordinatorId}
          onChange={setCoordinatorId}
          placeholder="Select coordinator"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Add Families ({familyIds.length} selected)
        </label>

        {/* Family Search Input */}
        <div className="relative">
          <input
            type="text"
            value={familySearch}
            onChange={(e) => {
              setFamilySearch(e.target.value);
              setShowFamilyDropdown(true);
            }}
            onFocus={() => setShowFamilyDropdown(true)}
            className="w-full px-3 py-2.5 md:py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base md:text-sm min-h-[44px] md:min-h-0"
            placeholder="Search families by name..."
            disabled={familiesLoading}
          />

          {/* Dropdown with filtered families */}
          {showFamilyDropdown && familySearch && !familiesLoading && (
            <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
              {filteredFamilies.length === 0 ? (
                <div className="px-3 py-2 text-gray-500 text-sm">
                  No families found matching &ldquo;{familySearch}&rdquo;
                </div>
              ) : (
                filteredFamilies.map((family) => {
                  const familyIdStr = family.id.toString();
                  const isSelected = familyIds.includes(familyIdStr);
                  return (
                    <button
                      key={family.id}
                      type="button"
                      onClick={() => addFamily(family)}
                      disabled={isSelected}
                      className={`w-full px-3 py-2.5 md:py-2 text-left hover:bg-gray-50 flex items-center justify-between min-h-[44px] md:min-h-0 ${
                        isSelected
                          ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                          : "text-gray-900"
                      }`}
                    >
                      <span className="font-medium text-sm">{family.name}</span>
                      {isSelected && (
                        <span className="text-xs text-gray-400">Added</span>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* Selected Families Display */}
        {familyIds.length > 0 && (
          <div className="mt-3">
            <p className="text-sm font-medium text-gray-700 mb-2">
              Selected Families:
            </p>
            <div className="flex flex-wrap gap-2">
              {getSelectedFamilies().map((family) => (
                <div
                  key={family.id}
                  className="flex items-center space-x-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2"
                >
                  <span className="text-sm font-medium text-gray-900">
                    {family.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeFamily(family.id.toString())}
                    className="text-gray-400 hover:text-red-500 ml-1 min-w-[32px] min-h-[32px] flex items-center justify-center"
                    aria-label="Remove family"
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
        {showFamilyDropdown && (
          <div
            className="fixed inset-0 z-0"
            onClick={() => setShowFamilyDropdown(false)}
          />
        )}
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Add Members ({memberIds.length} selected)
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
            className="w-full px-3 py-2.5 md:py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base md:text-sm min-h-[44px] md:min-h-0"
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
                filteredMembers.map((member) => {
                  const memberIdStr = member.id.toString();
                  const isSelected = memberIds.includes(memberIdStr);
                  return (
                    <button
                      key={member.id}
                      type="button"
                      onClick={() => addMember(member)}
                      disabled={isSelected}
                      className={`w-full px-3 py-2.5 md:py-2 text-left hover:bg-gray-50 flex items-center space-x-3 min-h-[44px] md:min-h-0 ${
                        isSelected
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
                      {isSelected && (
                        <span className="text-xs text-gray-400">Added</span>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* Selected Members Display */}
        {memberIds.length > 0 && (
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
                    onClick={() => removeMember(member.id.toString())}
                    className="text-gray-400 hover:text-red-500 ml-1 min-w-[32px] min-h-[32px] flex items-center justify-center"
                    aria-label="Remove member"
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
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Branch
        </label>
        <select
          value={branchId}
          onChange={(e) => setBranchId(e.target.value)}
          disabled={!canEditBranch}
          className={`w-full px-3 py-2.5 md:py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base md:text-sm min-h-[44px] md:min-h-0 ${
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
            Only ADMIN and PASTOR can edit branch
          </p>
        )}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Location
          </label>
          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="w-full px-3 py-2.5 md:py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base md:text-sm min-h-[44px] md:min-h-0"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Meeting Schedule
          </label>
          <input
            type="text"
            value={meetingSchedule}
            onChange={(e) => setMeetingSchedule(e.target.value)}
            className="w-full px-3 py-2.5 md:py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base md:text-sm min-h-[44px] md:min-h-0"
            placeholder="Sunday 2:00 PM"
          />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Description
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full px-3 py-2.5 md:py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base md:text-sm min-h-[100px] md:min-h-0"
          rows={3}
        />
      </div>
      <div className="flex flex-col-reverse sm:flex-row gap-3 pt-4">
        <Button
          variant="tertiary"
          className="w-full sm:flex-1 min-h-[44px]"
          onClick={onCancel}
          disabled={submitting}
        >
          Cancel
        </Button>
        <Button
          className="w-full sm:flex-1 min-h-[44px]"
          disabled={submitting}
          type="submit"
        >
          {submitting
            ? "Saving..."
            : initialData
            ? "Update Cluster"
            : "Create Cluster"}
        </Button>
      </div>
    </form>
  );
}
