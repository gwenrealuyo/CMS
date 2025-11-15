import { useState, useMemo, useEffect, useRef } from "react";
import Button from "@/src/components/ui/Button";
import { Family, Cluster, Person } from "@/src/types/person";

interface ClusterFormProps {
  onSubmit: (data: Partial<Cluster>) => Promise<void> | void;
  onClose: () => void;
  initialData?: Partial<Cluster>;
  availableFamilies?: Family[];
  availablePeople?: Person[];
}

export default function ClusterForm({
  onSubmit,
  onClose,
  initialData,
  availableFamilies = [],
  availablePeople = [],
}: ClusterFormProps) {
  const [formData, setFormData] = useState<Partial<Cluster>>({
    name: initialData?.name || "",
    code: initialData?.code || "",
    description: (initialData as any)?.description || "",
    families: (initialData?.families as any) || [],
    members: (initialData?.members as any) || [],
    location: (initialData as any)?.location || "",
    meeting_schedule: (initialData as any)?.meeting_schedule || "",
    coordinator:
      (initialData as any)?.coordinator?.id ||
      (initialData as any)?.coordinator ||
      undefined,
  } as any);
  const [loading, setLoading] = useState(false);
  const [memberSearch, setMemberSearch] = useState("");
  const [showMemberDropdown, setShowMemberDropdown] = useState(false);
  const [familySearch, setFamilySearch] = useState("");
  const [showFamilyDropdown, setShowFamilyDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const familyDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setShowMemberDropdown(false);
      }
      if (
        familyDropdownRef.current &&
        !familyDropdownRef.current.contains(event.target as Node)
      ) {
        setShowFamilyDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const filteredMembers = useMemo(() => {
    if (!memberSearch.trim())
      return availablePeople.filter(
        (p) => p.username !== "admin" && p.role !== "ADMIN"
      );
    return availablePeople
      .filter(
        (member) =>
          `${member.first_name} ${member.last_name}`
            .toLowerCase()
            .includes(memberSearch.toLowerCase()) ||
          member.role.toLowerCase().includes(memberSearch.toLowerCase()) ||
          member.status?.toLowerCase().includes(memberSearch.toLowerCase())
      )
      .filter((p) => p.username !== "admin" && p.role !== "ADMIN");
  }, [availablePeople, memberSearch]);

  const filteredFamilies = useMemo(() => {
    if (!familySearch.trim()) return availableFamilies;
    return availableFamilies.filter(
      (family) =>
        family.name.toLowerCase().includes(familySearch.toLowerCase()) ||
        family.address?.toLowerCase().includes(familySearch.toLowerCase())
    );
  }, [availableFamilies, familySearch]);

  const getInitials = (person: Person) => {
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

  const addMember = (member: Person) => {
    setFormData((prev: any) => {
      const cur: string[] = prev.members || [];
      if (!cur.includes(member.id)) {
        return { ...prev, members: [...cur, member.id] };
      }
      return prev;
    });
    setMemberSearch("");
    setShowMemberDropdown(false);
  };

  const removeMember = (memberId: string) => {
    setFormData((prev: any) => {
      const nextMembers = (prev.members || []).filter(
        (id: string) => id !== memberId
      );
      const next: any = { ...prev, members: nextMembers };
      // If removing the current coordinator, unset it
      if (prev.coordinator === memberId) {
        next.coordinator = undefined;
      }
      return next;
    });
  };

  const getSelectedMembers = () => {
    return availablePeople.filter((member) =>
      (formData as any).members?.includes(member.id)
    );
  };

  const addFamily = (family: Family) => {
    setFormData((prev: any) => {
      const cur: string[] = prev.families || [];
      if (!cur.includes(family.id)) {
        // Add family members to cluster members unless they're already in another cluster
        const familyMembers = family.members || [];
        const existingMembers = prev.members || [];
        const newMembers = familyMembers.filter(
          (memberId: string) => !existingMembers.includes(memberId)
        );

        return {
          ...prev,
          families: [...cur, family.id],
          members: [...existingMembers, ...newMembers],
        };
      }
      return prev;
    });
    setFamilySearch("");
    setShowFamilyDropdown(false);
  };

  const removeFamily = (familyId: string) => {
    setFormData((prev: any) => {
      const nextFamilies = (prev.families || []).filter(
        (id: string) => id !== familyId
      );

      // Remove family members from cluster members
      const family = availableFamilies.find((f) => f.id === familyId);
      const familyMembers = family?.members || [];
      const nextMembers = (prev.members || []).filter(
        (memberId: string) => !familyMembers.includes(memberId)
      );

      const next: any = {
        ...prev,
        families: nextFamilies,
        members: nextMembers,
      };

      // If removing the current coordinator, unset it
      if (familyMembers.includes(prev.coordinator)) {
        next.coordinator = undefined;
      }

      return next;
    });
  };

  const getSelectedFamilies = () => {
    return availableFamilies.filter((family) =>
      (formData as any).families?.includes(family.id)
    );
  };

  const getFamilyMemberCount = (family: Family) => {
    const familyMembers = family.members || [];
    const clusterMembers = (formData as any).members || [];
    return familyMembers.filter((memberId: string) =>
      clusterMembers.includes(memberId)
    ).length;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name?.trim()) return;

    // Ensure coordinator (if set) is included in members
    if (
      formData.coordinator &&
      !(formData.members || []).includes(formData.coordinator as string)
    ) {
      setFormData((prev: any) => ({
        ...prev,
        members: [...(prev.members || []), prev.coordinator],
      }));
    }

    try {
      setLoading(true);

      // Transform data for API - coordinator becomes coordinator_id
      const apiData = {
        ...formData,
        coordinator_id: formData.coordinator, // Transform coordinator to coordinator_id
        coordinator: undefined, // Remove coordinator field
      };

      await onSubmit(apiData);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Cluster Name *
          </label>
          <input
            type="text"
            value={formData.name || ""}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Code
          </label>
          <input
            type="text"
            value={(formData as any).code || ""}
            onChange={(e) => setFormData({ ...formData, code: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Description
        </label>
        <textarea
          value={(formData as any).description || ""}
          onChange={(e) =>
            setFormData({ ...formData, description: e.target.value as any })
          }
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Location
          </label>
          <input
            type="text"
            value={(formData as any).location || ""}
            onChange={(e) =>
              setFormData({ ...formData, location: e.target.value })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Meeting Schedule
          </label>
          <input
            type="text"
            placeholder="e.g., Every Sunday 2:00 PM"
            value={(formData as any).meeting_schedule || ""}
            onChange={(e) =>
              setFormData({ ...formData, meeting_schedule: e.target.value })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Coordinator (must be a selected member)
        </label>
        <select
          value={(formData as any).coordinator || ""}
          onChange={(e) =>
            setFormData({
              ...formData,
              coordinator: e.target.value || undefined,
            })
          }
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="">— None —</option>
          {(availablePeople || [])
            .filter((p) => (formData as any).members?.includes(p.id))
            .map((p) => (
              <option key={p.id} value={p.id}>
                {p.first_name} {p.last_name}
              </option>
            ))}
        </select>
      </div>

      {availableFamilies.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Add Families ({(formData as any).families?.length || 0} selected)
          </label>

          {/* Family Search Input */}
          <div className="relative" ref={familyDropdownRef}>
            <input
              type="text"
              value={familySearch}
              onChange={(e) => {
                setFamilySearch(e.target.value);
                setShowFamilyDropdown(true);
              }}
              onFocus={() => setShowFamilyDropdown(true)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Search families by name or address..."
            />

            {/* Dropdown with filtered families */}
            {showFamilyDropdown && familySearch && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                {filteredFamilies.length === 0 ? (
                  <div className="px-3 py-2 text-gray-500 text-sm">
                    No families found matching &ldquo;{familySearch}&rdquo;
                  </div>
                ) : (
                  filteredFamilies.map((family) => (
                    <button
                      key={family.id}
                      type="button"
                      onClick={() => addFamily(family)}
                      disabled={(formData as any).families?.includes(family.id)}
                      className={`w-full px-3 py-2 text-left hover:bg-gray-50 flex items-center space-x-3 ${
                        (formData as any).families?.includes(family.id)
                          ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                          : "text-gray-900"
                      }`}
                    >
                      <div className="w-8 h-8 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full flex items-center justify-center text-white text-xs font-semibold">
                        {family.name[0]?.toUpperCase() || "F"}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-sm">{family.name}</p>
                        <div className="flex items-center space-x-1 mt-0.5">
                          <span className="px-1.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            {family.members?.length || 0} members
                          </span>
                          {family.address && (
                            <span className="px-1.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                              {family.address}
                            </span>
                          )}
                        </div>
                      </div>
                      {(formData as any).families?.includes(family.id) && (
                        <span className="text-xs text-gray-400">Added</span>
                      )}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Selected Families Display */}
          {(formData as any).families?.length > 0 && (
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
                    <div className="w-6 h-6 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full flex items-center justify-center text-white text-xs font-semibold">
                      {family.name[0]?.toUpperCase() || "F"}
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-gray-900">
                        {family.name}
                      </span>
                      <span className="text-xs text-gray-600">
                        {getFamilyMemberCount(family)}/
                        {family.members?.length || 0} members
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeFamily(family.id)}
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
        </div>
      )}

      {availablePeople.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Add Members ({(formData as any).members?.length || 0} selected)
          </label>

          {/* Member Search Input */}
          <div className="relative" ref={dropdownRef}>
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
                    No members found matching &ldquo;{memberSearch}&rdquo;
                  </div>
                ) : (
                  filteredMembers.map((member) => (
                    <button
                      key={member.id}
                      type="button"
                      onClick={() => addMember(member)}
                      disabled={(formData as any).members?.includes(member.id)}
                      className={`w-full px-3 py-2 text-left hover:bg-gray-50 flex items-center space-x-3 ${
                        (formData as any).members?.includes(member.id)
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
                              member.status || "ACTIVE"
                            )}`}
                          >
                            {(member.status || "ACTIVE").toLowerCase()}
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
                      {(formData as any).members?.includes(member.id) && (
                        <span className="text-xs text-gray-400">Added</span>
                      )}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Selected Members Display */}
          {(formData as any).members?.length > 0 && (
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
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <Button
          variant="tertiary"
          className="flex-1"
          onClick={onClose}
          disabled={loading}
        >
          Cancel
        </Button>
        <Button className="flex-1" disabled={loading} type="submit">
          {loading
            ? "Saving…"
            : initialData?.id
            ? "Update Cluster"
            : "Create Cluster"}
        </Button>
      </div>
    </form>
  );
}
