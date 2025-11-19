import { useState, useEffect, useRef } from "react";
import { Person, PersonUI } from "@/src/types/person";
import { X } from "lucide-react";
import { Cluster } from "@/src/types/cluster";

interface AttendanceSelectorProps {
  label: string;
  selectedIds: string[];
  availablePeople: PersonUI[];
  filterRole: "MEMBER" | "VISITOR";
  onSelectionChange: (ids: string[]) => void;
  className?: string;
  selectedCluster?: Cluster | null;
  previouslyAttendedIds?: string[]; // All visitors who have attended this cluster (for list filtering)
  mostRecentAttendedIds?: string[]; // Visitors from most recent report only (for auto-selection)
}

export default function AttendanceSelector({
  label,
  selectedIds,
  availablePeople,
  filterRole,
  onSelectionChange,
  className = "",
  selectedCluster,
  previouslyAttendedIds = [],
  mostRecentAttendedIds = [],
}: AttendanceSelectorProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"search" | "list">("search");
  const [lastClickedButton, setLastClickedButton] = useState<string | null>(
    null
  );
  const dropdownRef = useRef<HTMLDivElement>(null);
  const hasAutoSelectedRef = useRef<string | null>(null);

  // Get cluster member IDs if cluster is selected
  const clusterMemberIds =
    selectedCluster?.members?.map((id) => id.toString()) || [];

  // Filter people by role
  const peopleByRole = availablePeople.filter(
    (person) => person.role === filterRole
  );

  // For visitors: separate previously attended visitors from others
  // For members: separate previously attended members from others
  let previouslyAttendedPeople: PersonUI[] = [];
  let otherPeople: PersonUI[] = [];

  if (filterRole === "VISITOR" && previouslyAttendedIds.length > 0) {
    previouslyAttendedPeople = peopleByRole.filter((person) =>
      previouslyAttendedIds.includes(person.id)
    );
    otherPeople = peopleByRole.filter(
      (person) => !previouslyAttendedIds.includes(person.id)
    );
  } else if (filterRole === "MEMBER" && previouslyAttendedIds.length > 0) {
    // For members: use previouslyAttendedIds (members from all previous reports)
    previouslyAttendedPeople = peopleByRole.filter((person) =>
      previouslyAttendedIds.includes(person.id)
    );
    otherPeople = peopleByRole.filter(
      (person) => !previouslyAttendedIds.includes(person.id)
    );
  } else {
    // Fallback: use cluster members if no previous attendance data
    const clusterMembers = peopleByRole.filter((person) =>
      clusterMemberIds.includes(person.id)
    );
    const otherMembers = peopleByRole.filter(
      (person) => !clusterMemberIds.includes(person.id)
    );
    previouslyAttendedPeople = clusterMembers;
    otherPeople = otherMembers;
  }

  // Filter by search term
  const filteredPeople = peopleByRole.filter((person) => {
    if (searchTerm.trim().length === 0) return false;
    return person.name.toLowerCase().includes(searchTerm.toLowerCase());
  });

  // Get selected people objects
  const selectedPeople = availablePeople.filter((p) =>
    selectedIds.includes(p.id)
  );

  // Get active members/visitors (for visitors, also include ATTENDED status)
  const activePeople = peopleByRole.filter((person) =>
    filterRole === "MEMBER"
      ? person.status === "ACTIVE"
      : person.status === "ACTIVE" || person.status === "ATTENDED"
  );

  const togglePerson = (personId: string) => {
    if (selectedIds.includes(personId)) {
      onSelectionChange(selectedIds.filter((id) => id !== personId));
    } else {
      onSelectionChange([...selectedIds, personId]);
    }
  };

  const removePerson = (personId: string) => {
    onSelectionChange(selectedIds.filter((id) => id !== personId));
  };

  const selectAll = () => {
    const allIds = peopleByRole.map((p) => p.id);
    // Replace selection instead of adding to it
    onSelectionChange(allIds);
    setLastClickedButton("selectAll");
  };

  const deselectAll = () => {
    onSelectionChange([]);
    setLastClickedButton("deselectAll");
  };

  const selectAllActive = () => {
    const activeIds = activePeople.map((p) => p.id);
    // Replace selection instead of adding to it
    onSelectionChange(activeIds);
    setLastClickedButton("selectAllActive");
  };

  const selectAllClusterMembers = () => {
    let idsToSelect: string[];
    if (filterRole === "MEMBER") {
      // For members: use most recent report's members only
      idsToSelect = mostRecentAttendedIds;
    } else {
      // For visitors: use all previously attended
      idsToSelect = previouslyAttendedPeople.map((p) => p.id);
    }
    // Replace selection instead of adding to it
    onSelectionChange(idsToSelect);
    setLastClickedButton("selectAllClusterMembers");
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

  // Auto-select active members/visitors when cluster is selected
  useEffect(() => {
    const clusterKey = `${selectedCluster?.id}-${filterRole}`;

    // Only auto-select if cluster changed and we haven't auto-selected for this cluster/role combo yet
    if (
      selectedCluster &&
      selectedIds.length === 0 &&
      availablePeople.length > 0 &&
      hasAutoSelectedRef.current !== clusterKey
    ) {
      const peopleByRole = availablePeople.filter(
        (person) => person.role === filterRole
      );

      if (filterRole === "MEMBER") {
        // For members: select all active members
        const active = peopleByRole.filter(
          (person) => person.status === "ACTIVE"
        );
        const activeIds = active.map((p) => p.id);
        if (activeIds.length > 0) {
          onSelectionChange(activeIds);
          setLastClickedButton("selectAllActive");
          hasAutoSelectedRef.current = clusterKey;
        }
      } else {
        // For visitors: only select visitors from the most recent report
        // Use mostRecentAttendedIds if available, otherwise fall back to previouslyAttendedIds
        const idsToSelect =
          mostRecentAttendedIds.length > 0
            ? mostRecentAttendedIds
            : previouslyAttendedIds;

        if (idsToSelect.length > 0) {
          onSelectionChange(idsToSelect);
          // Highlight "Select All Previously Attended" if using mostRecentAttendedIds
          setLastClickedButton(
            mostRecentAttendedIds.length > 0
              ? "selectAllClusterMembers"
              : "selectAllActive"
          );
          hasAutoSelectedRef.current = clusterKey;
        }
        // If no previous attendance, don't auto-select anything - let user choose manually
      }
    }

    // Reset ref if cluster is deselected
    if (!selectedCluster) {
      hasAutoSelectedRef.current = null;
    }
  }, [
    selectedCluster?.id,
    filterRole,
    availablePeople.length,
    previouslyAttendedIds.length,
    mostRecentAttendedIds.length,
    selectedIds.length,
  ]);

  // Detect which button matches the current selection when editing
  useEffect(() => {
    // Only run this check if we have selections, data is loaded, and we haven't just auto-selected
    // Skip if hasAutoSelectedRef is set (meaning we just auto-selected)
    if (
      selectedIds.length > 0 &&
      availablePeople.length > 0 &&
      !hasAutoSelectedRef.current
    ) {
      const peopleByRole = availablePeople.filter(
        (person) => person.role === filterRole
      );

      // Check if selection matches "Select All"
      const allIds = peopleByRole.map((p) => p.id);
      const allIdsSet = new Set(allIds);
      if (
        selectedIds.length === allIds.length &&
        selectedIds.every((id) => allIdsSet.has(id))
      ) {
        setLastClickedButton("selectAll");
        return;
      }

      // Check if selection matches "Select All Active"
      const activePeople = peopleByRole.filter((person) =>
        filterRole === "MEMBER"
          ? person.status === "ACTIVE"
          : person.status === "ACTIVE" || person.status === "ATTENDED"
      );
      const activeIds = activePeople.map((p) => p.id);
      const activeIdsSet = new Set(activeIds);
      if (
        selectedIds.length === activeIds.length &&
        selectedIds.every((id) => activeIdsSet.has(id))
      ) {
        setLastClickedButton("selectAllActive");
        return;
      }

      // Check if selection matches "Select All Previously Attended"
      if (filterRole === "MEMBER" && mostRecentAttendedIds.length > 0) {
        const mostRecentSet = new Set(mostRecentAttendedIds);
        if (
          selectedIds.length === mostRecentAttendedIds.length &&
          selectedIds.every((id) => mostRecentSet.has(id))
        ) {
          setLastClickedButton("selectAllClusterMembers");
          return;
        }
      } else if (
        filterRole === "VISITOR" &&
        previouslyAttendedPeople.length > 0
      ) {
        const previouslyAttendedIdsSet = new Set(
          previouslyAttendedPeople.map((p) => p.id)
        );
        if (
          selectedIds.length === previouslyAttendedPeople.length &&
          selectedIds.every((id) => previouslyAttendedIdsSet.has(id))
        ) {
          setLastClickedButton("selectAllClusterMembers");
          return;
        }
      }

      // If no match, clear the highlight
      setLastClickedButton(null);
    }
  }, [
    selectedIds.join(","),
    availablePeople.length,
    filterRole,
    mostRecentAttendedIds.join(","),
    previouslyAttendedPeople.length,
  ]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
        if (viewMode === "search") {
          setSearchTerm("");
        }
      }
    };

    if (isDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isDropdownOpen, viewMode]);

  return (
    <div className={`mb-6 ${className}`}>
      <div className="flex items-center justify-between mb-2">
        <label className="block text-sm font-medium text-gray-700">
          {label}
          <span className="text-gray-500 font-normal ml-2">
            ({selectedIds.length} selected)
          </span>
        </label>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() =>
              setViewMode(viewMode === "search" ? "list" : "search")
            }
            className="text-xs text-blue-600 hover:text-blue-700 font-medium"
          >
            {viewMode === "search" ? "Show List" : "Show Search"}
          </button>
        </div>
      </div>

      {/* Bulk Action Buttons */}
      <div className="flex flex-wrap gap-2 mb-2">
        {viewMode === "list" && (
          <>
            <button
              type="button"
              onClick={selectAll}
              className={`text-xs px-2 py-1 border rounded transition-colors ${
                lastClickedButton === "selectAll"
                  ? "bg-blue-600 text-white border-blue-600 font-semibold"
                  : "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100"
              }`}
            >
              Select All
            </button>
            <button
              type="button"
              onClick={deselectAll}
              className={`text-xs px-2 py-1 border rounded transition-colors ${
                lastClickedButton === "deselectAll"
                  ? "bg-gray-600 text-white border-gray-600 font-semibold"
                  : "bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100"
              }`}
            >
              Deselect All
            </button>
            <button
              type="button"
              onClick={selectAllActive}
              className={`text-xs px-2 py-1 border rounded transition-colors ${
                lastClickedButton === "selectAllActive"
                  ? "bg-green-600 text-white border-green-600 font-semibold"
                  : "bg-green-50 text-green-700 border-green-200 hover:bg-green-100"
              }`}
            >
              Select All Active
            </button>
            {selectedCluster &&
              ((filterRole === "VISITOR" &&
                previouslyAttendedPeople.length > 0) ||
                (filterRole === "MEMBER" &&
                  mostRecentAttendedIds.length > 0)) && (
                <button
                  type="button"
                  onClick={selectAllClusterMembers}
                  className={`text-xs px-2 py-1 border rounded transition-colors ${
                    lastClickedButton === "selectAllClusterMembers"
                      ? "bg-purple-600 text-white border-purple-600 font-semibold"
                      : "bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100"
                  }`}
                >
                  {filterRole === "VISITOR"
                    ? `Select All Previously Attended (${previouslyAttendedPeople.length})`
                    : `Select All Previously Attended (${
                        mostRecentAttendedIds.length > 0
                          ? mostRecentAttendedIds.length
                          : previouslyAttendedPeople.length
                      })`}
                </button>
              )}
          </>
        )}
      </div>

      {/* Selected People Chips */}
      {selectedPeople.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2 p-2 bg-gray-50 rounded-lg border border-gray-200 min-h-[60px]">
          {selectedPeople.map((person) => {
            const displayName =
              person.name ||
              `${person.first_name || ""} ${person.last_name || ""}`.trim() ||
              "Unknown";
            return (
              <span
                key={person.id}
                className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium"
              >
                {displayName}
                <button
                  type="button"
                  onClick={() => removePerson(person.id)}
                  className="hover:bg-blue-200 rounded-full p-0.5 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            );
          })}
        </div>
      )}

      {/* Search Input */}
      {viewMode === "search" && (
        <div className="relative" ref={dropdownRef}>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setIsDropdownOpen(e.target.value.trim().length >= 1);
            }}
            onFocus={() => {
              if (searchTerm.trim().length >= 1) setIsDropdownOpen(true);
            }}
            placeholder={`Search ${filterRole.toLowerCase()}s...`}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />

          {/* Dropdown */}
          {isDropdownOpen && searchTerm.trim().length >= 1 && (
            <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
              {filteredPeople.length > 0 ? (
                filteredPeople.map((person) => {
                  const isSelected = selectedIds.includes(person.id);
                  return (
                    <button
                      key={person.id}
                      type="button"
                      onClick={() => {
                        togglePerson(person.id);
                        setSearchTerm("");
                      }}
                      className={`w-full px-3 py-2 text-left hover:bg-gray-100 focus:bg-gray-100 focus:outline-none transition-colors ${
                        isSelected ? "bg-blue-50" : ""
                      }`}
                    >
                      <div className="font-medium text-gray-900">
                        {person.name}
                      </div>
                      {filterRole === "VISITOR" ? (
                        <div className="text-sm text-gray-500">
                          {(() => {
                            const inviter = person.inviter
                              ? availablePeople.find(
                                  (p) => p.id === person.inviter
                                )
                              : undefined;
                            const inviterName = inviter
                              ? inviter.name
                              : "Unknown";
                            const statusLabel = person.status
                              ? person.status.toLowerCase()
                              : "";
                            return `invited by ${inviterName} • ${statusLabel}`;
                          })()}
                        </div>
                      ) : (
                        person.status && (
                          <div className="text-sm">
                            <span
                              className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium ${getStatusColor(
                                person.status
                              )}`}
                            >
                              {person.status.toLowerCase()}
                            </span>
                          </div>
                        )
                      )}
                    </button>
                  );
                })
              ) : (
                <div className="px-3 py-2 text-gray-500 text-sm">
                  No {filterRole.toLowerCase()}s found
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* List View with Checkboxes */}
      {viewMode === "list" && (
        <div className="border border-gray-300 rounded-lg max-h-96 overflow-y-auto">
          {/* Previously Attended Visitors / Cluster Members Section */}
          {previouslyAttendedPeople.length > 0 && (
            <>
              <div
                className={`p-2 border-b sticky top-0 ${
                  filterRole === "VISITOR"
                    ? "bg-purple-50 border-purple-200"
                    : "bg-purple-50 border-purple-200"
                }`}
              >
                <div
                  className={`text-xs font-semibold ${
                    filterRole === "VISITOR"
                      ? "text-purple-900"
                      : "text-purple-900"
                  }`}
                >
                  {filterRole === "VISITOR"
                    ? `Previously Attended Visitors (${previouslyAttendedPeople.length})`
                    : `Previously Attended ${
                        filterRole === "MEMBER" ? "Members" : "Visitors"
                      } (${previouslyAttendedPeople.length})`}
                </div>
              </div>
              {previouslyAttendedPeople.map((person) => {
                const isSelected = selectedIds.includes(person.id);
                return (
                  <label
                    key={person.id}
                    className={`flex items-center gap-3 px-3 py-2 hover:bg-gray-50 cursor-pointer border-b border-gray-100 ${
                      isSelected ? "bg-blue-50" : ""
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => togglePerson(person.id)}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900 text-sm">
                        {person.name ||
                          `${person.first_name || ""} ${
                            person.last_name || ""
                          }`.trim() ||
                          "Unknown"}
                      </div>
                      {filterRole === "VISITOR" ? (
                        <div className="text-xs text-gray-500">
                          {(() => {
                            const inviter = person.inviter
                              ? availablePeople.find(
                                  (p) => p.id === person.inviter
                                )
                              : undefined;
                            const inviterName = inviter
                              ? inviter.name
                              : "Unknown";
                            const statusLabel = person.status
                              ? person.status.toLowerCase()
                              : "";
                            return `invited by ${inviterName} • ${statusLabel}`;
                          })()}
                        </div>
                      ) : (
                        person.status && (
                          <div className="text-xs mt-0.5">
                            <span
                              className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium ${getStatusColor(
                                person.status
                              )}`}
                            >
                              {person.status.toLowerCase()}
                            </span>
                          </div>
                        )
                      )}
                    </div>
                  </label>
                );
              })}
            </>
          )}

          {/* Other Visitors / Members Section */}
          {otherPeople.length > 0 && (
            <>
              {previouslyAttendedPeople.length > 0 && (
                <div className="p-2 bg-gray-50 border-b border-gray-200 sticky top-0">
                  <div className="text-xs font-semibold text-gray-700">
                    {filterRole === "VISITOR"
                      ? `Other Visitors (${otherPeople.length})`
                      : `Other ${
                          filterRole === "MEMBER" ? "Members" : "Visitors"
                        } (${otherPeople.length})`}
                  </div>
                </div>
              )}
              {otherPeople.map((person) => {
                const isSelected = selectedIds.includes(person.id);
                return (
                  <label
                    key={person.id}
                    className={`flex items-center gap-3 px-3 py-2 hover:bg-gray-50 cursor-pointer border-b border-gray-100 ${
                      isSelected ? "bg-blue-50" : ""
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => togglePerson(person.id)}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900 text-sm">
                        {person.name ||
                          `${person.first_name || ""} ${
                            person.last_name || ""
                          }`.trim() ||
                          "Unknown"}
                      </div>
                      {filterRole === "VISITOR" ? (
                        <div className="text-xs text-gray-500">
                          {(() => {
                            const inviter = person.inviter
                              ? availablePeople.find(
                                  (p) => p.id === person.inviter
                                )
                              : undefined;
                            const inviterName = inviter
                              ? inviter.name
                              : "Unknown";
                            const statusLabel = person.status
                              ? person.status.toLowerCase()
                              : "";
                            return `invited by ${inviterName} • ${statusLabel}`;
                          })()}
                        </div>
                      ) : (
                        person.status && (
                          <div className="text-xs mt-0.5">
                            <span
                              className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium ${getStatusColor(
                                person.status
                              )}`}
                            >
                              {person.status.toLowerCase()}
                            </span>
                          </div>
                        )
                      )}
                    </div>
                  </label>
                );
              })}
            </>
          )}

          {peopleByRole.length === 0 && (
            <div className="px-3 py-4 text-center text-gray-500 text-sm">
              No {filterRole.toLowerCase()}s available
            </div>
          )}
        </div>
      )}
    </div>
  );
}
