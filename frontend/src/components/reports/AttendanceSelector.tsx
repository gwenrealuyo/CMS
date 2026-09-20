import { useState, useEffect, useRef } from "react";
import { Person, PersonUI } from "@/src/types/person";
import { X } from "lucide-react";
import { Cluster } from "@/src/types/cluster";
import { formatPersonName } from "@/src/lib/name";
import {
  isPendingNewVisitorId,
  isProspectAttendanceId,
} from "@/src/lib/clusterWeeklyReportSubmit";

const normalizePersonId = (id: string | number): string => String(id);

const personIdsMatch = (
  a: string | number,
  b: string | number
): boolean => normalizePersonId(a) === normalizePersonId(b);

type VisitorKind = "returning" | "firstVisit" | "new" | "other";

function visitorKindForPerson(
  person: PersonUI,
  previouslyAttendedIds: string[]
): VisitorKind {
  const id = String(person.id);
  if (isProspectAttendanceId(id)) return "firstVisit";
  if (isPendingNewVisitorId(id)) return "new";
  if (previouslyAttendedIds.some((prev) => personIdsMatch(prev, id))) {
    return "returning";
  }
  return "other";
}

function visitorKindLabel(kind: VisitorKind): string | null {
  switch (kind) {
    case "returning":
      return "Returning";
    case "firstVisit":
      return "First visit";
    case "new":
      return "New";
    default:
      return null;
  }
}

function attendancePersonLabel(person: PersonUI): string {
  const formatted = formatPersonName(person);
  if (formatted && formatted !== "Unknown person") {
    return formatted;
  }
  return person.name || "Unknown";
}

function personMatchesSearch(person: PersonUI, searchTerm: string): boolean {
  const query = searchTerm.toLowerCase();
  const nickname = person.nickname?.toLowerCase() ?? "";
  return (
    attendancePersonLabel(person).toLowerCase().includes(query) ||
    nickname.includes(query) ||
    (person.name?.toLowerCase().includes(query) ?? false)
  );
}

interface AttendanceSelectorProps {
  label: string;
  selectedIds: string[];
  availablePeople: PersonUI[];
  filterRole: "MEMBER" | "VISITOR";
  onSelectionChange: (ids: string[]) => void;
  className?: string;
  selectedCluster?: Cluster | null;
  allowedIds?: string[];
  previouslyAttendedIds?: string[]; // All visitors who have attended this cluster (for list filtering)
  mostRecentAttendedIds?: string[]; // Visitors from most recent report only (for auto-selection)
  /** Scope key for visitor auto-select (evangelism group). Empty = do not auto-select. */
  autoSelectScopeId?: string | number | null;
  /** True while the selected cluster roster is being fetched. */
  isLoadingRoster?: boolean;
  /** Cluster Visitors Attended: group returning / first-visit prospects / new walk-ins. */
  groupByVisitorKind?: boolean;
  /** Empty-search copy when groupByVisitorKind is on. */
  noMatchHint?: string;
}

export default function AttendanceSelector({
  label,
  selectedIds,
  availablePeople,
  filterRole,
  onSelectionChange,
  className = "",
  selectedCluster,
  allowedIds = [],
  previouslyAttendedIds = [],
  mostRecentAttendedIds = [],
  autoSelectScopeId,
  isLoadingRoster = false,
  groupByVisitorKind = false,
  noMatchHint = "No match. If they came, use Add New Visitor. If they were invited and did not come, use Prospects Invited.",
}: AttendanceSelectorProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"search" | "list">("search");
  const [lastClickedButton, setLastClickedButton] = useState<string | null>(
    null
  );
  const dropdownRef = useRef<HTMLDivElement>(null);
  const hasAutoSelectedRef = useRef<string | null>(null);

  // Get cluster member IDs if cluster is selected (members PK list or privacy-safe details)
  const clusterMemberIds =
    selectedCluster?.members?.map((id) => normalizePersonId(id)) ||
    selectedCluster?.members_details?.map((d) => normalizePersonId(d.id)) ||
    [];
  const allowedIdSet = new Set(allowedIds.map(normalizePersonId));

  // Filter people by role and cluster membership (for MEMBER role)
  const hasMemberSource =
    Boolean(selectedCluster) || allowedIds.length > 0 || isLoadingRoster;

  const peopleByRole = availablePeople.filter((person) => {
    if (filterRole === "MEMBER" && allowedIds.length > 0) {
      return person.role !== "VISITOR" && allowedIdSet.has(normalizePersonId(person.id));
    }
    if (filterRole === "MEMBER") {
      // For members: must be in selected cluster's members list, exclude VISITOR role
      if (!selectedCluster) return false; // No cluster selected = no members shown
      if (person.role === "VISITOR") return false; // Exclude visitors
      return clusterMemberIds.includes(normalizePersonId(person.id)); // Must be in cluster members list
    } else if (filterRole === "VISITOR" && allowedIds.length > 0) {
      // Prospects Invited (and similar): restrict to the provided id set
      return (
        person.role === "VISITOR" &&
        allowedIdSet.has(normalizePersonId(person.id))
      );
    } else if (filterRole === "VISITOR") {
      // For visitors: only show VISITOR role, no cluster filtering
      return person.role === "VISITOR";
    }
    return false;
  });

  // For visitors: separate previously attended visitors from others
  // For members: separate previously attended members from others
  // Note: peopleByRole is already filtered by cluster membership for MEMBER role
  let previouslyAttendedPeople: PersonUI[] = [];
  let otherPeople: PersonUI[] = [];

  if (filterRole === "VISITOR" && previouslyAttendedIds.length > 0) {
    previouslyAttendedPeople = peopleByRole.filter((person) =>
      previouslyAttendedIds.some((id) => personIdsMatch(id, person.id))
    );
    otherPeople = peopleByRole.filter(
      (person) =>
        !previouslyAttendedIds.some((id) => personIdsMatch(id, person.id))
    );
  } else if (filterRole === "MEMBER" && previouslyAttendedIds.length > 0) {
    // For members: use previouslyAttendedIds (members from all previous reports)
    // peopleByRole is already filtered by cluster membership
    previouslyAttendedPeople = peopleByRole.filter((person) =>
      previouslyAttendedIds.some((id) => personIdsMatch(id, person.id))
    );
    otherPeople = peopleByRole.filter(
      (person) =>
        !previouslyAttendedIds.some((id) => personIdsMatch(id, person.id))
    );
  } else {
    // Fallback: if no previous attendance data, show all peopleByRole in "other" section
    // For MEMBER role, peopleByRole is already filtered by cluster membership
    // For VISITOR role, peopleByRole contains all visitors
    previouslyAttendedPeople = [];
    otherPeople = peopleByRole;
  }

  // For VISITOR list view: prioritize visitors who are in selected cluster.members
  const selectedClusterMemberIdSet = new Set(clusterMemberIds);
  const clusterVisitors =
    filterRole === "VISITOR" && selectedCluster
      ? peopleByRole.filter((person) =>
          selectedClusterMemberIdSet.has(normalizePersonId(person.id))
        )
      : [];
  const otherVisitors =
    filterRole === "VISITOR" && selectedCluster
      ? peopleByRole.filter(
          (person) =>
            !selectedClusterMemberIdSet.has(normalizePersonId(person.id))
        )
      : peopleByRole;

  const useVisitorKindGroups = groupByVisitorKind && filterRole === "VISITOR";
  const returningVisitors = useVisitorKindGroups
    ? peopleByRole.filter(
        (person) => visitorKindForPerson(person, previouslyAttendedIds) === "returning"
      )
    : [];
  const firstVisitProspects = useVisitorKindGroups
    ? peopleByRole.filter(
        (person) =>
          visitorKindForPerson(person, previouslyAttendedIds) === "firstVisit"
      )
    : [];
  const newWalkInVisitors = useVisitorKindGroups
    ? peopleByRole.filter(
        (person) => visitorKindForPerson(person, previouslyAttendedIds) === "new"
      )
    : [];
  const otherKindVisitors = useVisitorKindGroups
    ? peopleByRole.filter(
        (person) => visitorKindForPerson(person, previouslyAttendedIds) === "other"
      )
    : [];

  // Filter by search term (already filtered by role and cluster membership in peopleByRole)
  const filteredPeople = peopleByRole.filter((person) => {
    if (searchTerm.trim().length === 0) return false;
    return personMatchesSearch(person, searchTerm);
  });

  // Get selected people objects (normalize IDs so number/string mismatches don't break UI)
  const selectedPeople = availablePeople.filter((p) =>
    selectedIds.some((id) => personIdsMatch(id, p.id))
  );

  const isPersonSelected = (personId: string | number) =>
    selectedIds.some((id) => personIdsMatch(id, personId));

  const visitorKindBadge = (person: PersonUI) => {
    if (!useVisitorKindGroups) return null;
    const label = visitorKindLabel(
      visitorKindForPerson(person, previouslyAttendedIds)
    );
    if (!label) return null;
    return (
      <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 shrink-0">
        {label}
      </span>
    );
  };

  const visitorInviterLine = (person: PersonUI) => {
    const fromField = person.inviter_display_name?.trim();
    const inviter =
      !fromField && person.inviter
        ? availablePeople.find((p) => personIdsMatch(p.id, person.inviter!))
        : undefined;
    const inviterName =
      fromField ||
      (inviter ? attendancePersonLabel(inviter) : "") ||
      "Unknown";
    const statusLabel = person.status ? person.status.toLowerCase() : "";
    return `invited by ${inviterName} • ${statusLabel}`;
  };

  const renderVisitorListRow = (person: PersonUI) => (
    <label
      key={person.id}
      className={`flex items-center gap-3 px-3 py-2 hover:bg-gray-50 cursor-pointer border-b border-gray-100 ${
        isPersonSelected(person.id) ? "bg-primary/10" : ""
      }`}
    >
      <input
        type="checkbox"
        checked={isPersonSelected(person.id)}
        onChange={() => togglePerson(person.id)}
        className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-ring"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="font-medium text-gray-900 text-sm truncate">
            {attendancePersonLabel(person)}
          </div>
          {visitorKindBadge(person)}
        </div>
        <div className="text-xs text-gray-500">{visitorInviterLine(person)}</div>
      </div>
    </label>
  );

  const activePeople = peopleByRole.filter(
    (person) => person.status === "ACTIVE"
  );

  const togglePerson = (personId: string | number) => {
    const normalizedId = normalizePersonId(personId);
    if (isPersonSelected(normalizedId)) {
      onSelectionChange(
        selectedIds.filter((id) => !personIdsMatch(id, normalizedId))
      );
    } else {
      onSelectionChange([...selectedIds, normalizedId]);
    }
  };

  const removePerson = (personId: string | number) => {
    onSelectionChange(
      selectedIds.filter((id) => !personIdsMatch(id, personId))
    );
  };

  const selectAll = () => {
    const allIds = peopleByRole.map((p) => normalizePersonId(p.id));
    // Replace selection instead of adding to it
    onSelectionChange(allIds);
    setLastClickedButton("selectAll");
  };

  const deselectAll = () => {
    onSelectionChange([]);
    setLastClickedButton("deselectAll");
  };

  const selectAllActive = () => {
    const activeIds = activePeople.map((p) => normalizePersonId(p.id));
    // Replace selection instead of adding to it
    onSelectionChange(activeIds);
    setLastClickedButton("selectAllActive");
  };

  const selectCameBefore = () => {
    const ids = returningVisitors.map((p) => normalizePersonId(p.id));
    onSelectionChange(ids);
    setLastClickedButton("selectCameBefore");
  };

  const selectClusterVisitors = () => {
    if (filterRole !== "VISITOR") return;
    const clusterVisitorIds = clusterVisitors.map((p) => normalizePersonId(p.id));
    onSelectionChange(clusterVisitorIds);
    setLastClickedButton("selectClusterVisitors");
  };

  const selectAllClusterMembers = () => {
    let idsToSelect: string[];
    if (filterRole === "MEMBER") {
      // For members: use most recent report's members if available, otherwise use all previously attended
      idsToSelect =
        mostRecentAttendedIds.length > 0
          ? mostRecentAttendedIds.map(normalizePersonId)
          : previouslyAttendedPeople.map((p) => normalizePersonId(p.id));
    } else {
      // For visitors: use all previously attended
      idsToSelect = previouslyAttendedPeople.map((p) => normalizePersonId(p.id));
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

  // Auto-select active members/visitors when cluster/group is selected
  useEffect(() => {
    const hasAutoSelectScope =
      (autoSelectScopeId != null && String(autoSelectScopeId) !== "") ||
      selectedCluster?.id != null;
    const clusterKey = `${autoSelectScopeId ?? selectedCluster?.id}-${filterRole}`;

    // Only auto-select if cluster/group changed and we haven't auto-selected for this scope/role combo yet
    // For MEMBER role, also require selectedCluster to be present
    if (
      selectedIds.length === 0 &&
      availablePeople.length > 0 &&
      hasAutoSelectedRef.current !== clusterKey &&
      (filterRole === "VISITOR" || hasMemberSource)
    ) {
      if (filterRole === "VISITOR" && !hasAutoSelectScope) {
        hasAutoSelectedRef.current = null;
      } else if (filterRole === "MEMBER") {
        // Evangelism (autoSelectScopeId): form applies previously-attended
        // default after prior-attendance loads — skip here so we don't lock
        // in ACTIVE before those ids arrive.
        if (autoSelectScopeId) {
          // no-op
        } else {
          // Cluster: prefer previously attended (most recent report), then all
          // prior, then all ACTIVE roster members.
          const available = new Set(
            peopleByRole.map((p) => normalizePersonId(p.id))
          );
          const mostRecentIds = mostRecentAttendedIds
            .map(normalizePersonId)
            .filter((id) => available.has(id));
          if (mostRecentIds.length > 0) {
            onSelectionChange(mostRecentIds);
            setLastClickedButton("selectAllClusterMembers");
            hasAutoSelectedRef.current = clusterKey;
          } else if (previouslyAttendedPeople.length > 0) {
            const priorIds = previouslyAttendedPeople.map((p) =>
              normalizePersonId(p.id)
            );
            onSelectionChange(priorIds);
            setLastClickedButton("selectAllClusterMembers");
            hasAutoSelectedRef.current = clusterKey;
          } else {
            const active = peopleByRole.filter(
              (person) => person.status === "ACTIVE"
            );
            const activeIds = active.map((p) => normalizePersonId(p.id));
            if (activeIds.length > 0) {
              onSelectionChange(activeIds);
              setLastClickedButton("selectAllActive");
              hasAutoSelectedRef.current = clusterKey;
            }
          }
        }
      } else {
        // Visitors: when grouped by kind, default to "Came before" (returning).
        // Otherwise prefer the most recent report; cluster falls back to all
        // previously attended, evangelism does not.
        if (useVisitorKindGroups && previouslyAttendedIds.length > 0) {
          const available = new Set(
            peopleByRole.map((p) => normalizePersonId(p.id))
          );
          const idsToSelect = previouslyAttendedIds
            .map(normalizePersonId)
            .filter((id) => available.has(id));
          if (idsToSelect.length > 0) {
            onSelectionChange(idsToSelect);
            setLastClickedButton("selectCameBefore");
            hasAutoSelectedRef.current = clusterKey;
          }
        } else {
          const idsToSelect = (
            mostRecentAttendedIds.length > 0
              ? mostRecentAttendedIds
              : autoSelectScopeId
                ? []
                : previouslyAttendedIds
          ).map(normalizePersonId);

          if (idsToSelect.length > 0) {
            onSelectionChange(idsToSelect);
            setLastClickedButton("selectAllClusterMembers");
            hasAutoSelectedRef.current = clusterKey;
          }
        }
        // If no previous attendance, don't auto-select anything - let user choose manually
      }
    }

    // Reset ref if cluster is deselected (for MEMBER role)
    if (filterRole === "MEMBER" && !hasMemberSource) {
      hasAutoSelectedRef.current = null;
    }
    if (filterRole === "VISITOR" && !hasAutoSelectScope) {
      hasAutoSelectedRef.current = null;
    }
  }, [
    autoSelectScopeId,
    selectedCluster?.id,
    filterRole,
    availablePeople.length,
    previouslyAttendedIds.length,
    mostRecentAttendedIds.length,
    selectedIds.length,
    peopleByRole.length,
    useVisitorKindGroups,
  ]);

  // Detect which button matches the current selection when editing
  useEffect(() => {
    // Only run this check if we have selections, data is loaded, and we haven't just auto-selected
    // Skip if hasAutoSelectedRef is set (meaning we just auto-selected)
    // For MEMBER role, also require selectedCluster
    if (
      selectedIds.length > 0 &&
      availablePeople.length > 0 &&
      !hasAutoSelectedRef.current &&
      (filterRole === "VISITOR" || hasMemberSource)
    ) {
      // peopleByRole is already filtered by role and cluster membership

      // Check if selection matches "Select All"
      const allIds = peopleByRole.map((p) => normalizePersonId(p.id));
      const allIdsSet = new Set(allIds);
      if (
        selectedIds.length === allIds.length &&
        selectedIds.every((id) => allIdsSet.has(normalizePersonId(id)))
      ) {
        setLastClickedButton("selectAll");
        return;
      }

      // Check if selection matches "Select All Active" (members only)
      if (filterRole === "MEMBER") {
        const activePeople = peopleByRole.filter(
          (person) => person.status === "ACTIVE"
        );
        const activeIds = activePeople.map((p) => normalizePersonId(p.id));
        const activeIdsSet = new Set(activeIds);
        if (
          selectedIds.length === activeIds.length &&
          selectedIds.every((id) => activeIdsSet.has(normalizePersonId(id)))
        ) {
          setLastClickedButton("selectAllActive");
          return;
        }
      }

      // Check if selection matches "Select All Previously Attended"
      if (filterRole === "MEMBER") {
        // First check if it matches most recent attended members
        if (mostRecentAttendedIds.length > 0) {
          const mostRecentSet = new Set(
            mostRecentAttendedIds.map(normalizePersonId)
          );
          if (
            selectedIds.length === mostRecentAttendedIds.length &&
            selectedIds.every((id) => mostRecentSet.has(normalizePersonId(id)))
          ) {
            setLastClickedButton("selectAllClusterMembers");
            return;
          }
        }
        // If not, check if it matches all previously attended members
        if (previouslyAttendedPeople.length > 0) {
          const previouslyAttendedIdsSet = new Set(
            previouslyAttendedPeople.map((p) => normalizePersonId(p.id))
          );
          if (
            selectedIds.length === previouslyAttendedPeople.length &&
            selectedIds.every((id) =>
              previouslyAttendedIdsSet.has(normalizePersonId(id))
            )
          ) {
            setLastClickedButton("selectAllClusterMembers");
            return;
          }
        }
      } else if (filterRole === "VISITOR") {
        if (useVisitorKindGroups && returningVisitors.length > 0) {
          const cameBeforeIds = returningVisitors.map((p) =>
            normalizePersonId(p.id)
          );
          const cameBeforeSet = new Set(cameBeforeIds);
          if (
            selectedIds.length === cameBeforeIds.length &&
            selectedIds.every((id) =>
              cameBeforeSet.has(normalizePersonId(id))
            )
          ) {
            setLastClickedButton("selectCameBefore");
            return;
          }
        }

        const clusterVisitorIds = clusterVisitors.map((p) =>
          normalizePersonId(p.id)
        );
        const clusterVisitorSet = new Set(clusterVisitorIds);
        if (
          selectedCluster &&
          clusterVisitorIds.length > 0 &&
          selectedIds.length === clusterVisitorIds.length &&
          selectedIds.every((id) => clusterVisitorSet.has(normalizePersonId(id)))
        ) {
          setLastClickedButton("selectClusterVisitors");
          return;
        }

        if (previouslyAttendedPeople.length > 0) {
          const previouslyAttendedIdsSet = new Set(
            previouslyAttendedPeople.map((p) => normalizePersonId(p.id))
          );
          if (
            selectedIds.length === previouslyAttendedPeople.length &&
            selectedIds.every((id) =>
              previouslyAttendedIdsSet.has(normalizePersonId(id))
            )
          ) {
            setLastClickedButton("selectAllClusterMembers");
            return;
          }
        }
      }

      // If no match, clear the highlight
      setLastClickedButton(null);
    }
  }, [
    selectedIds.join(","),
    availablePeople.length,
    filterRole,
    selectedCluster?.id,
    mostRecentAttendedIds.join(","),
    previouslyAttendedPeople.length,
    previouslyAttendedPeople.map((p) => p.id).join(","),
    clusterVisitors.length,
    clusterVisitors.map((p) => p.id).join(","),
    returningVisitors.length,
    returningVisitors.map((p) => p.id).join(","),
    useVisitorKindGroups,
    peopleByRole.length,
  ]);

  // Drop selected IDs that aren't in the loaded people list (stale report IDs, etc.)
  useEffect(() => {
    if (availablePeople.length === 0 || selectedIds.length === 0) return;
    const validIds = new Set(
      availablePeople.map((p) => normalizePersonId(p.id))
    );
    const pruned = selectedIds.filter((id) => validIds.has(normalizePersonId(id)));
    if (pruned.length !== selectedIds.length) {
      onSelectionChange(pruned);
    }
  }, [availablePeople, selectedIds.join(",")]);

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
            ({selectedPeople.length} selected)
          </span>
        </label>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() =>
              setViewMode(viewMode === "search" ? "list" : "search")
            }
            className="text-xs text-primary hover:text-primary font-medium"
          >
            {viewMode === "search" ? "Show List" : "Show Search"}
          </button>
        </div>
      </div>

      {/* Bulk Action Buttons */}
      <div className="flex flex-wrap gap-2 mb-2">
      {viewMode === "list" &&
        !(filterRole === "MEMBER" && !hasMemberSource) &&
        !(filterRole === "MEMBER" && isLoadingRoster) && (
            <>
              <button
                type="button"
                onClick={selectAll}
                className={`text-xs px-2 py-1 border rounded transition-colors ${
                  lastClickedButton === "selectAll"
                    ? "bg-primary text-white border-primary font-semibold"
                    : "bg-primary/10 text-primary border-primary/20 hover:bg-primary/15"
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
              {filterRole === "MEMBER" && (
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
              )}
              {useVisitorKindGroups && returningVisitors.length > 0 && (
                <button
                  type="button"
                  onClick={selectCameBefore}
                  className={`text-xs px-2 py-1 border rounded transition-colors ${
                    lastClickedButton === "selectCameBefore"
                      ? "bg-purple-600 text-white border-purple-600 font-semibold"
                      : "bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100"
                  }`}
                >
                  {`Came before (${returningVisitors.length})`}
                </button>
              )}
              {filterRole === "VISITOR" &&
                !useVisitorKindGroups &&
                selectedCluster &&
                clusterVisitors.length > 0 && (
                  <button
                    type="button"
                    onClick={selectClusterVisitors}
                    className={`text-xs px-2 py-1 border rounded transition-colors ${
                      lastClickedButton === "selectClusterVisitors"
                        ? "bg-indigo-600 text-white border-indigo-600 font-semibold"
                        : "bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100"
                    }`}
                  >
                    {`Select Cluster Visitors (${clusterVisitors.length})`}
                  </button>
                )}
              {filterRole === "MEMBER" &&
                (mostRecentAttendedIds.length > 0 ||
                  previouslyAttendedPeople.length > 0) && (
                  <button
                    type="button"
                    onClick={selectAllClusterMembers}
                    className={`text-xs px-2 py-1 border rounded transition-colors ${
                      lastClickedButton === "selectAllClusterMembers"
                        ? "bg-purple-600 text-white border-purple-600 font-semibold"
                        : "bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100"
                    }`}
                  >
                    {`Select All Previously Attended (${
                      mostRecentAttendedIds.length > 0
                        ? mostRecentAttendedIds.length
                        : previouslyAttendedPeople.length
                    })`}
                  </button>
                )}
              {selectedCluster &&
                filterRole === "VISITOR" &&
                previouslyAttendedPeople.length > 0 && (
                  <button
                    type="button"
                    onClick={selectAllClusterMembers}
                    className={`text-xs px-2 py-1 border rounded transition-colors ${
                      lastClickedButton === "selectAllClusterMembers"
                        ? "bg-purple-600 text-white border-purple-600 font-semibold"
                        : "bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100"
                    }`}
                  >
                    {`Select All Previously Attended (${previouslyAttendedPeople.length})`}
                  </button>
                )}
            </>
          )}
      </div>

      {/* Selected People Chips */}
      {selectedPeople.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2 p-3 bg-slate-50 rounded-lg border border-slate-200 min-h-[60px]">
          {selectedPeople.map((person) => {
            const displayName = attendancePersonLabel(person);
            return (
              <span
                key={person.id}
                className="chip-primary inline-flex items-center gap-1.5 max-w-full shadow-sm text-sm"
              >
                <span className="truncate">{displayName}</span>
                {visitorKindBadge(person)}
                <button
                  type="button"
                  onClick={() => removePerson(person.id)}
                  aria-label={`Remove ${displayName}`}
                  className="flex-shrink-0 rounded-full p-0.5 text-primary hover:bg-primary/20 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
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
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent"
          />

          {/* Dropdown */}
          {isDropdownOpen && searchTerm.trim().length >= 1 && (
            <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
              {filterRole === "MEMBER" && isLoadingRoster ? (
                <div className="px-3 py-2 text-gray-500 text-sm">
                  Loading members…
                </div>
              ) : filterRole === "MEMBER" && !hasMemberSource ? (
                <div className="px-3 py-2 text-gray-500 text-sm">
                  Please select a cluster first to view members
                </div>
              ) : filteredPeople.length > 0 ? (
                filteredPeople.map((person) => {
                  const personSelected = isPersonSelected(person.id);
                  return (
                    <button
                      key={person.id}
                      type="button"
                      onClick={() => {
                        togglePerson(person.id);
                        setSearchTerm("");
                      }}
                      className={`w-full px-3 py-2 text-left hover:bg-gray-100 focus:bg-gray-100 focus:outline-none transition-colors ${
                        personSelected ? "bg-primary/10" : ""
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-medium text-gray-900 truncate">
                          {attendancePersonLabel(person)}
                        </div>
                        {visitorKindBadge(person)}
                      </div>
                      {filterRole === "VISITOR" ? (
                        <div className="text-sm text-gray-500">
                          {visitorInviterLine(person)}
                        </div>
                      ) : (
                        <div className="text-sm text-gray-500">
                          {(person.status || "active").toLowerCase()}
                        </div>
                      )}
                    </button>
                  );
                })
              ) : (
                <div className="px-3 py-2 text-gray-500 text-sm">
                  {useVisitorKindGroups
                    ? noMatchHint
                    : filterRole === "MEMBER" && hasMemberSource
                      ? "No members found"
                      : `No ${filterRole.toLowerCase()}s found`}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* List View with Checkboxes */}
      {viewMode === "list" && (
        <div className="border border-gray-300 rounded-lg max-h-96 overflow-y-auto">
          {/* Empty state for MEMBER role when no cluster selected */}
          {filterRole === "MEMBER" && !hasMemberSource && !isLoadingRoster && (
            <div className="px-3 py-8 text-center text-gray-500 text-sm">
              Please select a cluster first to view members
            </div>
          )}

          {filterRole === "MEMBER" && isLoadingRoster && (
            <div className="px-3 py-8 text-center text-gray-500 text-sm">
              Loading members…
            </div>
          )}

          {/* Previously Attended Members Section */}
          {filterRole === "MEMBER" &&
            hasMemberSource &&
            !isLoadingRoster &&
            previouslyAttendedPeople.length > 0 && (
            <>
              <div className="p-2 border-b sticky top-0 z-10 bg-purple-50 border-purple-200 shadow-sm">
                <div className="text-xs font-semibold text-purple-900">
                  {`Previously Attended Members (${previouslyAttendedPeople.length})`}
                </div>
              </div>
              {previouslyAttendedPeople.map((person) => (
                  <label
                    key={person.id}
                    className={`flex items-center gap-3 px-3 py-2 hover:bg-gray-50 cursor-pointer border-b border-gray-100 ${
                      isPersonSelected(person.id) ? "bg-primary/10" : ""
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isPersonSelected(person.id)}
                      onChange={() => togglePerson(person.id)}
                      className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-ring"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900 text-sm">
                        {attendancePersonLabel(person)}
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {(person.status || "active").toLowerCase()}
                      </div>
                    </div>
                  </label>
                ))}
            </>
          )}

          {/* Other Members Section */}
          {filterRole === "MEMBER" &&
            hasMemberSource &&
            !isLoadingRoster &&
            otherPeople.length > 0 && (
            <>
              {(previouslyAttendedPeople.length > 0 ||
                otherPeople.length > 0) && (
                <div className="p-2 bg-gray-50 border-b border-gray-200 sticky top-0 z-10 shadow-sm">
                  <div className="text-xs font-semibold text-gray-700">
                    {previouslyAttendedPeople.length > 0
                      ? `Other Members (${otherPeople.length})`
                      : `Members (${otherPeople.length})`}
                  </div>
                </div>
              )}
              {otherPeople.map((person) => (
                  <label
                    key={person.id}
                    className={`flex items-center gap-3 px-3 py-2 hover:bg-gray-50 cursor-pointer border-b border-gray-100 ${
                      isPersonSelected(person.id) ? "bg-primary/10" : ""
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isPersonSelected(person.id)}
                      onChange={() => togglePerson(person.id)}
                      className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-ring"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900 text-sm">
                        {attendancePersonLabel(person)}
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {(person.status || "active").toLowerCase()}
                      </div>
                    </div>
                  </label>
                ))}
            </>
          )}

          {/* Visitors grouped by kind (cluster weekly report) */}
          {useVisitorKindGroups && (
            <>
              {returningVisitors.length > 0 && (
                <>
                  <div className="p-2 border-b sticky top-0 z-10 bg-purple-50 border-purple-200 shadow-sm">
                    <div className="text-xs font-semibold text-purple-900">
                      {`Came before (${returningVisitors.length})`}
                    </div>
                  </div>
                  {returningVisitors.map(renderVisitorListRow)}
                </>
              )}
              {firstVisitProspects.length > 0 && (
                <>
                  <div className="p-2 border-b sticky top-0 z-10 bg-orange-50 border-orange-200 shadow-sm">
                    <div className="text-xs font-semibold text-orange-900">
                      {`Invited prospects (${firstVisitProspects.length})`}
                    </div>
                  </div>
                  {firstVisitProspects.map(renderVisitorListRow)}
                </>
              )}
              {newWalkInVisitors.length > 0 && (
                <>
                  <div className="p-2 border-b sticky top-0 z-10 bg-green-50 border-green-200 shadow-sm">
                    <div className="text-xs font-semibold text-green-900">
                      {`Added this report (${newWalkInVisitors.length})`}
                    </div>
                  </div>
                  {newWalkInVisitors.map(renderVisitorListRow)}
                </>
              )}
              {otherKindVisitors.length > 0 && (
                <>
                  <div className="p-2 bg-gray-50 border-b border-gray-200 sticky top-0 z-10 shadow-sm">
                    <div className="text-xs font-semibold text-gray-700">
                      {`Other visitors (${otherKindVisitors.length})`}
                    </div>
                  </div>
                  {otherKindVisitors.map(renderVisitorListRow)}
                </>
              )}
            </>
          )}

          {/* Visitors in selected cluster */}
          {!useVisitorKindGroups &&
            filterRole === "VISITOR" &&
            selectedCluster &&
            clusterVisitors.length > 0 && (
            <>
              <div className="p-2 border-b sticky top-0 z-10 bg-blue-50 border-blue-200 shadow-sm">
                <div className="text-xs font-semibold text-blue-900">
                  {`Visitors in this cluster (${clusterVisitors.length})`}
                </div>
              </div>
              {clusterVisitors.map((person) => (
                  <label
                    key={person.id}
                    className={`flex items-center gap-3 px-3 py-2 hover:bg-gray-50 cursor-pointer border-b border-gray-100 ${
                      isPersonSelected(person.id) ? "bg-primary/10" : ""
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isPersonSelected(person.id)}
                      onChange={() => togglePerson(person.id)}
                      className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-ring"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900 text-sm">
                        {attendancePersonLabel(person)}
                      </div>
                      <div className="text-xs text-gray-500">
                        {visitorInviterLine(person)}
                      </div>
                    </div>
                  </label>
                ))}
            </>
          )}

          {/* Other visitors */}
          {!useVisitorKindGroups &&
            filterRole === "VISITOR" &&
            ((selectedCluster && otherVisitors.length > 0) ||
              (!selectedCluster && otherVisitors.length > 0)) && (
              <>
                <div className="p-2 bg-gray-50 border-b border-gray-200 sticky top-0 z-10 shadow-sm">
                  <div className="text-xs font-semibold text-gray-700">
                    {selectedCluster
                      ? `Other visitors (${otherVisitors.length})`
                      : `Visitors (${otherVisitors.length})`}
                  </div>
                </div>
                {otherVisitors.map((person) => (
                    <label
                      key={person.id}
                      className={`flex items-center gap-3 px-3 py-2 hover:bg-gray-50 cursor-pointer border-b border-gray-100 ${
                        isPersonSelected(person.id) ? "bg-primary/10" : ""
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isPersonSelected(person.id)}
                        onChange={() => togglePerson(person.id)}
                        className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-ring"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-gray-900 text-sm">
                          {attendancePersonLabel(person)}
                        </div>
                        <div className="text-xs text-gray-500">
                          {visitorInviterLine(person)}
                        </div>
                      </div>
                    </label>
                  ))}
              </>
            )}

          {filterRole === "MEMBER" &&
            hasMemberSource &&
            !isLoadingRoster &&
            peopleByRole.length === 0 && (
              <div className="px-3 py-4 text-center text-gray-500 text-sm">
                {selectedCluster
                  ? "No members found in this cluster"
                  : "No members found"}
              </div>
            )}
          {filterRole === "VISITOR" && peopleByRole.length === 0 && (
            <div className="px-3 py-4 text-center text-gray-500 text-sm">
              No visitors available
            </div>
          )}
        </div>
      )}
    </div>
  );
}
