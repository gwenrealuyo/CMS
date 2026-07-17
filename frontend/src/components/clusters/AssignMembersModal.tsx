import React, { useState, useEffect, useMemo, useRef } from "react";
import { Cluster } from "@/src/types/cluster";
import { Person, PersonUI } from "@/src/types/person";
import { formatPersonName } from "@/src/lib/name";
import { isSelectablePerson } from "@/src/lib/peopleSelectors";
import { personMatchesClusterBranch } from "@/src/lib/clusterMembership";
import { clustersApi } from "@/src/lib/api";
import Button from "@/src/components/ui/Button";
import ConfirmationModal from "@/src/components/ui/ConfirmationModal";
import ModalOverlay from "@/src/components/ui/ModalOverlay";
import { getPersonRoleColor } from "@/src/lib/personRole";
import PersonAvatar from "@/src/components/people/PersonAvatar";

interface AssignMembersModalProps {
  cluster: Cluster | null;
  peopleUI: PersonUI[];
  isOpen: boolean;
  onClose: () => void;
  onAssignMembers: (memberIds: string[]) => void;
}

const normalizeMemberId = (id: string | number): string => String(id);

const memberIdsMatch = (
  a: string | number,
  b: string | number
): boolean => normalizeMemberId(a) === normalizeMemberId(b);

const includesMemberId = (
  ids: Array<string | number>,
  target: string | number
): boolean => ids.some((id) => memberIdsMatch(id, target));

export default function AssignMembersModal({
  cluster,
  peopleUI,
  isOpen,
  onClose,
  onAssignMembers,
}: AssignMembersModalProps) {
  const clusterBranch = cluster?.branch ?? null;
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [selectedPersonById, setSelectedPersonById] = useState<
    Record<string, PersonUI>
  >({});
  const [memberSearch, setMemberSearch] = useState("");
  const [showMemberDropdown, setShowMemberDropdown] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hydratingMembers, setHydratingMembers] = useState(false);
  const [removeMemberConfirmation, setRemoveMemberConfirmation] = useState<{
    isOpen: boolean;
    memberId: string | null;
    memberName: string | null;
  }>({ isOpen: false, memberId: null, memberName: null });
  const memberDropdownRef = useRef<HTMLDivElement>(null);
  const initializedForClusterRef = useRef<number | null>(null);

  const selectedMemberPeople = useMemo(
    () =>
      selectedMemberIds
        .map((id) => {
          const normalizedId = normalizeMemberId(id);
          return (
            peopleUI.find((person) => memberIdsMatch(person.id, normalizedId)) ||
            selectedPersonById[normalizedId]
          );
        })
        .filter((person): person is PersonUI => !!person),
    [selectedMemberIds, peopleUI, selectedPersonById]
  );

  // Initialize selected members once when the modal opens for a cluster.
  // Slim list rows omit `members`; hydrate from detail so we never start from [].
  useEffect(() => {
    if (!isOpen) {
      initializedForClusterRef.current = null;
      setHydratingMembers(false);
      setSelectedPersonById({});
      setRemoveMemberConfirmation({
        isOpen: false,
        memberId: null,
        memberName: null,
      });
      return;
    }
    if (!cluster) return;
    if (initializedForClusterRef.current === cluster.id) return;

    const clusterId = cluster.id;
    initializedForClusterRef.current = clusterId;
    let cancelled = false;

    const applyMembers = (memberIds: Array<string | number>) => {
      if (cancelled || initializedForClusterRef.current !== clusterId) return;
      const initialMembers = memberIds.map(normalizeMemberId);
      const initialPeople: Record<string, PersonUI> = {};
      for (const id of initialMembers) {
        const person = peopleUI.find((p) => memberIdsMatch(p.id, id));
        if (person) {
          initialPeople[id] = person;
        }
      }
      setSelectedMemberIds(initialMembers);
      setSelectedPersonById(initialPeople);
      setHydratingMembers(false);
    };

    const hydrate = async () => {
      if (cluster.members != null) {
        applyMembers(cluster.members);
        return;
      }
      if (cluster.members_details != null) {
        applyMembers(cluster.members_details.map((d) => d.id));
        return;
      }
      setHydratingMembers(true);
      try {
        const { data } = await clustersApi.getById(clusterId);
        applyMembers(data.members ?? []);
      } catch (e) {
        console.error("Failed to load cluster members for assign modal", e);
        applyMembers([]);
      }
    };

    void hydrate();

    return () => {
      cancelled = true;
    };
  }, [isOpen, cluster, peopleUI.length]);

  // Filter members based on search
  const selectablePeople = useMemo(
    () =>
      peopleUI.filter(
        (person) =>
          isSelectablePerson(person) &&
          personMatchesClusterBranch(person, clusterBranch)
      ),
    [peopleUI, clusterBranch]
  );

  const filteredMembers = useMemo(() => {
    if (!memberSearch.trim()) return [];

    const searchLower = memberSearch.toLowerCase();
    return selectablePeople.filter((person) => {
      if (includesMemberId(selectedMemberIds, person.id)) {
        return false;
      }

      const fullName = formatPersonName(person).toLowerCase();
      const username = person.username?.toLowerCase() ?? "";
      const memberId = person.member_id?.toLowerCase() ?? "";

      return (
        fullName.includes(searchLower) ||
        username.includes(searchLower) ||
        memberId.includes(searchLower)
      );
    });
  }, [memberSearch, selectablePeople, selectedMemberIds]);

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

  const addMember = (person: PersonUI) => {
    const normalizedId = normalizeMemberId(person.id);
    const alreadyIncluded = includesMemberId(selectedMemberIds, normalizedId);
    const branchOk = personMatchesClusterBranch(person, clusterBranch);
    if (!branchOk || alreadyIncluded) {
      return;
    }
    setSelectedMemberIds((prev) => [...prev, normalizedId]);
    setSelectedPersonById((prev) => ({ ...prev, [normalizedId]: person }));
    setMemberSearch("");
    setShowMemberDropdown(false);
  };

  const closeRemoveMemberConfirmation = () => {
    setRemoveMemberConfirmation({
      isOpen: false,
      memberId: null,
      memberName: null,
    });
  };

  const requestRemoveMember = (member: PersonUI) => {
    setRemoveMemberConfirmation({
      isOpen: true,
      memberId: normalizeMemberId(member.id),
      memberName: formatPersonName(member),
    });
  };

  const confirmRemoveMember = () => {
    const memberId = removeMemberConfirmation.memberId;
    if (!memberId) return;
    setSelectedMemberIds((prev) =>
      prev.filter((id) => !memberIdsMatch(id, memberId))
    );
    setSelectedPersonById((prev) => {
      const next = { ...prev };
      delete next[memberId];
      return next;
    });
    closeRemoveMemberConfirmation();
  };

  const handleSubmit = async () => {
    if (hydratingMembers) return;
    try {
      setLoading(true);
      await onAssignMembers(selectedMemberIds);
      onClose();
    } catch (error) {
      console.error("Error assigning members:", error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return "bg-green-100 text-green-800";
      case "INACTIVE":
        return "bg-red-100 text-red-800";
      case "DORMANT":
        return "bg-orange-100 text-orange-800";
      case "FALLAWAY":
        return "bg-violet-100 text-violet-800";
      case "DECEASED":
        return "bg-gray-100 text-gray-800";
      case "ONGOING":
        return "bg-green-100 text-green-800";
      case "NO_RESPONSE":
        return "bg-yellow-100 text-yellow-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };


  if (!isOpen || !cluster) return null;

  return (
    <>
    <ModalOverlay
      isOpen={isOpen}
      onClose={onClose}
      panelClassName="relative w-full max-w-2xl"
    >
      <div className="max-h-[90vh] overflow-hidden rounded-lg bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 py-4 pl-4 md:pl-6 pr-2">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              Assign Members to {cluster.name}
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              {clusterBranch != null
                ? "Search shows members in this cluster's branch only."
                : "Select members to assign to this cluster"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-red-500 hover:text-red-700 p-2 rounded-md hover:bg-red-50 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center shrink-0"
            aria-label="Close modal"
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
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
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
                placeholder="Search by name, username, or LAMP ID..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-ring focus:border-transparent"
              />

              {showMemberDropdown && memberSearch.trim() && filteredMembers.length === 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg px-3 py-2 text-sm text-gray-500">
                  No matching members in this cluster&apos;s branch.
                </div>
              )}

              {showMemberDropdown && filteredMembers.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                  {filteredMembers.map((person) => (
                    <button
                      key={person.id}
                      onClick={() => addMember(person)}
                      className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center space-x-3"
                    >
                      <PersonAvatar person={person} size="sm" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate">
                          {formatPersonName(person)}
                        </p>
                        <p className="text-xs text-gray-600 truncate">
                          {[
                            person.branch_code ||
                              (person.branch == null
                                ? "No branch"
                                : `Branch ${person.branch}`),
                            person.email,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
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
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getPersonRoleColor(
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
              Selected Members ({selectedMemberIds.length})
            </label>
            {selectedMemberIds.length === 0 ? (
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
                {selectedMemberPeople.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center space-x-3 p-3 bg-white border border-gray-200 rounded-lg"
                  >
                    <PersonAvatar person={member} size="md" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">
                        {formatPersonName(member)}
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
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getPersonRoleColor(
                          member.role
                        )}`}
                      >
                        {member.role}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => requestRemoveMember(member)}
                      className="text-red-500 hover:text-red-700 p-1 rounded-md hover:bg-red-50 transition-colors"
                      aria-label={`Remove ${formatPersonName(member)}`}
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
        <div className="flex flex-col-reverse sm:flex-row gap-4 p-6 border-t border-gray-200 bg-gray-50">
          <Button
            onClick={onClose}
            variant="secondary"
            className="w-full sm:flex-1 min-h-[44px] !text-black py-2 px-4 text-sm font-normal bg-white border border-gray-200 hover:bg-gray-50 hover:border-gray-300"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={loading || hydratingMembers || selectedMemberIds.length === 0}
            className="w-full sm:flex-1 min-h-[44px] !text-white py-2 px-4 text-sm font-normal bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
          >
            {loading || hydratingMembers ? (
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
                <span>{hydratingMembers ? "Loading..." : "Saving..."}</span>
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
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                <span>Save Changes</span>
              </>
            )}
          </Button>
        </div>
      </div>
    </ModalOverlay>

    <ConfirmationModal
      isOpen={removeMemberConfirmation.isOpen}
      onClose={closeRemoveMemberConfirmation}
      onConfirm={confirmRemoveMember}
      title="Remove Member"
      message={
        <>
          Are you sure you want to remove{" "}
          <strong className="font-semibold text-gray-900">
            &quot;{removeMemberConfirmation.memberName ?? ""}&quot;
          </strong>{" "}
          from this cluster? They will be removed when you save.
        </>
      }
      confirmText="Remove"
      cancelText="Cancel"
      variant="warning"
      zIndex={80}
    />
    </>
  );
}
