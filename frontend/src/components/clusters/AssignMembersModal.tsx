import React, { useState, useEffect, useMemo, useRef } from "react";
import { Cluster } from "@/src/types/cluster";
import { Person, PersonUI } from "@/src/types/person";
import { formatPersonName } from "@/src/lib/name";
import { isSelectablePerson } from "@/src/lib/peopleSelectors";
import { personMatchesClusterBranch } from "@/src/lib/clusterMembership";
import Button from "@/src/components/ui/Button";
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
  useEffect(() => {
    if (!isOpen) {
      initializedForClusterRef.current = null;
      setSelectedPersonById({});
      return;
    }
    if (!cluster) return;
    if (initializedForClusterRef.current === cluster.id) return;

    initializedForClusterRef.current = cluster.id;
    const initialMembers = (cluster.members || []).map(normalizeMemberId);
    const initialPeople: Record<string, PersonUI> = {};
    for (const id of initialMembers) {
      const person = peopleUI.find((p) => memberIdsMatch(p.id, id));
      if (person) {
        initialPeople[id] = person;
      }
    }
    setSelectedMemberIds(initialMembers);
    setSelectedPersonById(initialPeople);
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

  const removeMember = (memberId: string | number) => {
    const normalizedId = normalizeMemberId(memberId);
    setSelectedMemberIds((prev) =>
      prev.filter((id) => !memberIdsMatch(id, normalizedId))
    );
    setSelectedPersonById((prev) => {
      const next = { ...prev };
      delete next[normalizedId];
      return next;
    });
  };

  const handleSubmit = async () => {
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


  if (!isOpen || !cluster) return null;

  return (
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
            disabled={loading || selectedMemberIds.length === 0}
            className="w-full sm:flex-1 min-h-[44px] !text-white py-2 px-4 text-sm font-normal bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
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
    </ModalOverlay>
  );
}
