import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Cluster } from "@/src/types/cluster";
import { Person, PersonUI, Family } from "@/src/types/person";
// import { Branch } from "@/src/types/branch";
import { usePeople } from "@/src/hooks/usePeople";
import { useFamilies } from "@/src/hooks/useFamilies";
import { useBranches } from "@/src/hooks/useBranches";
import { clustersApi } from "@/src/lib/api";
import { useAuth } from "@/src/contexts/AuthContext";
import Button from "@/src/components/ui/Button";
import ErrorMessage from "@/src/components/ui/ErrorMessage";
import SearchableSelect from "@/src/components/ui/SearchableSelect";
import ConfirmationModal from "@/src/components/ui/ConfirmationModal";
import toast from "react-hot-toast";
import {
  CLUSTER_MEETING_DAY_OPTIONS,
  composeMeetingSchedule,
  parseMeetingSchedule,
  type MeetingDayKey,
} from "@/src/lib/clusterMeetingSchedule";
import { getPersonRoleColor } from "@/src/lib/personRole";
import { formatPersonName } from "@/src/lib/name";
import PersonAvatar from "@/src/components/people/PersonAvatar";
import {
  describeDuplicateCluster,
  findClusterCodeConflict,
  findPossibleClusterNameDuplicates,
} from "@/src/lib/clusterDuplicates";

interface ClusterFormProps {
  initialData?: Cluster;
  onSubmit: (data: Partial<Cluster>) => void;
  onCancel: () => void;
  error?: string | null;
  submitting?: boolean;
  panelLayout?: boolean;
  /** When provided by the parent (directory page), avoids mounting catalog hooks. */
  people?: Person[];
  families?: Family[];
  onNeedCatalogs?: () => void;
}

export default function ClusterForm({
  initialData,
  onSubmit,
  onCancel,
  error,
  submitting,
  panelLayout = false,
  people: peopleProp,
  families: familiesProp,
  onNeedCatalogs,
}: ClusterFormProps) {
  const getInitialFormData = useCallback(() => {
    const parsedSchedule = parseMeetingSchedule(
      initialData?.meeting_schedule ?? "",
    );
    return {
      code: initialData?.code || "",
      name: initialData?.name || "",
      coordinatorId:
        initialData?.coordinator_id?.toString() ||
        initialData?.coordinator?.id?.toString() ||
        "",
      familyIds: (initialData?.families || []).map((id) => id.toString()),
      memberIds: (initialData?.members || []).map((id) => id.toString()),
      reporterIds: (initialData?.reporter_ids || []).map((id) => id.toString()),
      location: initialData?.location || "",
      meetingDay: parsedSchedule.dayKey,
      meetingTime: parsedSchedule.timeHHmm,
      description: initialData?.description || "",
      branchId: initialData?.branch?.toString() || "",
    };
  }, [initialData]);

  const [code, setCode] = useState(getInitialFormData().code);
  const [name, setName] = useState(getInitialFormData().name);
  const [coordinatorId, setCoordinatorId] = useState(
    getInitialFormData().coordinatorId,
  );
  const [familyIds, setFamilyIds] = useState<string[]>(
    getInitialFormData().familyIds,
  );
  const [memberIds, setMemberIds] = useState<string[]>(
    getInitialFormData().memberIds,
  );
  const [reporterIds, setReporterIds] = useState<string[]>(
    getInitialFormData().reporterIds,
  );
  const [location, setLocation] = useState(getInitialFormData().location);
  const [meetingDay, setMeetingDay] = useState<MeetingDayKey>(
    getInitialFormData().meetingDay,
  );
  const [meetingTime, setMeetingTime] = useState(
    getInitialFormData().meetingTime,
  );
  const [description, setDescription] = useState(
    getInitialFormData().description,
  );
  const [branchId, setBranchId] = useState<string>(
    getInitialFormData().branchId,
  );
  const [memberSearch, setMemberSearch] = useState("");
  const [showMemberDropdown, setShowMemberDropdown] = useState(false);
  const [reporterSearch, setReporterSearch] = useState("");
  const [showReporterDropdown, setShowReporterDropdown] = useState(false);
  const [familySearch, setFamilySearch] = useState("");
  const [showFamilyDropdown, setShowFamilyDropdown] = useState(false);
  const initializedForClusterRef = useRef<number | null>(null);

  const loadCatalogsFromHooks = peopleProp === undefined;

  useEffect(() => {
    onNeedCatalogs?.();
  }, [onNeedCatalogs]);

  const { people: hookedPeople, loading: peopleLoadingHook } = usePeople(
    loadCatalogsFromHooks
  );
  const { families: hookedFamilies, loading: familiesLoadingHook } =
    useFamilies(familiesProp === undefined);
  const people = peopleProp ?? hookedPeople;
  const families = familiesProp ?? hookedFamilies;
  const peopleLoading = peopleProp !== undefined ? peopleProp.length === 0 : peopleLoadingHook;
  const familiesLoading =
    familiesProp !== undefined ? familiesProp.length === 0 : familiesLoadingHook;
  const { branches } = useBranches();
  const { user, isSeniorCoordinator } = useAuth();
  const canEditBranch =
    user?.role === "ADMIN" ||
    user?.role === "PASTOR" ||
    isSeniorCoordinator("CLUSTER");
  const [duplicateNameConfirm, setDuplicateNameConfirm] = useState<{
    isOpen: boolean;
    matches: Cluster[];
  }>({ isOpen: false, matches: [] });
  const [duplicateCheckLoading, setDuplicateCheckLoading] = useState(false);

  useEffect(() => {
    const clusterId = initialData?.id ?? null;

    if (clusterId == null) {
      if (initializedForClusterRef.current === null) {
        return;
      }
      initializedForClusterRef.current = null;
      const next = getInitialFormData();
      setCode(next.code);
      setName(next.name);
      setCoordinatorId(next.coordinatorId);
      setFamilyIds(next.familyIds);
      setMemberIds(next.memberIds);
      setReporterIds(next.reporterIds);
      setLocation(next.location);
      setMeetingDay(next.meetingDay);
      setMeetingTime(next.meetingTime);
      setDescription(next.description);
      setBranchId(next.branchId);
      setMemberSearch("");
      setShowMemberDropdown(false);
      setReporterSearch("");
      setShowReporterDropdown(false);
      setFamilySearch("");
      setShowFamilyDropdown(false);
      return;
    }

    if (initializedForClusterRef.current === clusterId) {
      return;
    }

    initializedForClusterRef.current = clusterId;
    const next = getInitialFormData();
    setCode(next.code);
    setName(next.name);
    setCoordinatorId(next.coordinatorId);
    setFamilyIds(next.familyIds);
    setMemberIds(next.memberIds);
    setReporterIds(next.reporterIds);
    setLocation(next.location);
    setMeetingDay(next.meetingDay);
    setMeetingTime(next.meetingTime);
    setDescription(next.description);
    setBranchId(next.branchId);
    setMemberSearch("");
    setShowMemberDropdown(false);
    setReporterSearch("");
    setShowReporterDropdown(false);
    setFamilySearch("");
    setShowFamilyDropdown(false);
  }, [initialData?.id, getInitialFormData]);

  // Clear coordinator if they're removed from members
  useEffect(() => {
    if (coordinatorId && !memberIds.includes(coordinatorId)) {
      setCoordinatorId("");
    }
  }, [coordinatorId, memberIds]);

  // Drop reporters who are no longer members or who became coordinator
  useEffect(() => {
    setReporterIds((prev) =>
      prev.filter(
        (id) => memberIds.includes(id) && id !== coordinatorId,
      ),
    );
  }, [memberIds, coordinatorId]);

  const buildSubmitPayload = useCallback(
    (): Partial<Cluster> => ({
      code: code || undefined,
      name: name || undefined,
      coordinator_id: coordinatorId ? Number(coordinatorId) : undefined,
      families: familyIds.map(Number),
      members: memberIds.map(Number),
      reporter_ids: reporterIds
        .filter((id) => id !== coordinatorId)
        .map(Number),
      branch: branchId ? Number(branchId) : undefined,
      location: location || undefined,
      meeting_schedule: composeMeetingSchedule(meetingDay, meetingTime),
      description: description || undefined,
    }),
    [
      code,
      name,
      coordinatorId,
      familyIds,
      memberIds,
      reporterIds,
      branchId,
      location,
      meetingDay,
      meetingTime,
      description,
    ],
  );

  const performSubmit = useCallback(() => {
    onSubmit(buildSubmitPayload());
  }, [onSubmit, buildSubmitPayload]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setDuplicateCheckLoading(true);
    try {
      const searchTerm = (code || name || "").trim();
      let candidateClusters: Cluster[] = [];
      if (searchTerm) {
        const [byCode, byName] = await Promise.all([
          code.trim()
            ? clustersApi.list({
                search: code.trim(),
                page_size: 10,
              })
            : Promise.resolve(null),
          name.trim()
            ? clustersApi.list({
                search: name.trim(),
                page_size: 10,
              })
            : Promise.resolve(null),
        ]);
        const byId = new Map<number, Cluster>();
        for (const row of [
          ...(byCode?.data.results ?? []),
          ...(byName?.data.results ?? []),
        ]) {
          byId.set(row.id, row);
        }
        candidateClusters = Array.from(byId.values());
      }

      const codeConflict = findClusterCodeConflict(candidateClusters, {
        code,
        excludeId: initialData?.id,
      });
      if (codeConflict) {
        toast.error(
          `Cluster code "${code.trim()}" is already used by ${describeDuplicateCluster(codeConflict)}.`,
        );
        return;
      }

      if (candidateClusters.length > 0) {
        const nameMatches = findPossibleClusterNameDuplicates(candidateClusters, {
          name,
          branch: branchId ? Number(branchId) : null,
          excludeId: initialData?.id,
        });
        if (nameMatches.length > 0) {
          setDuplicateNameConfirm({ isOpen: true, matches: nameMatches });
          return;
        }
      }

      performSubmit();
    } finally {
      setDuplicateCheckLoading(false);
    }
  };

  // Coordinator options: only show cluster members
  // SearchableSelect expects options with id, first_name, last_name, username structure
  const coordinatorOptions = useMemo(() => {
    const memberIdsSet = new Set(memberIds);
    return people.filter((p) => memberIdsSet.has(p.id.toString()));
  }, [people, memberIds]);

  const reporterCandidateOptions = useMemo(() => {
    const memberIdsSet = new Set(memberIds);
    return people.filter(
      (p) =>
        memberIdsSet.has(p.id.toString()) &&
        p.id.toString() !== coordinatorId,
    );
  }, [people, memberIds, coordinatorId]);

  const filteredReporterCandidates = useMemo(() => {
    if (!reporterSearch.trim()) return reporterCandidateOptions;
    const searchLower = reporterSearch.toLowerCase();
    return reporterCandidateOptions.filter(
      (person) =>
        formatPersonName(person).toLowerCase().includes(searchLower) ||
        person.role.toLowerCase().includes(searchLower),
    );
  }, [reporterCandidateOptions, reporterSearch]);

  const addReporter = (person: Person | PersonUI) => {
    const id = person.id.toString();
    if (id === coordinatorId) {
      toast.error("The cluster coordinator cannot also be a reporter.");
      return;
    }
    if (!memberIds.includes(id)) {
      toast.error("Reporters must be cluster members.");
      return;
    }
    if (!reporterIds.includes(id)) {
      setReporterIds([...reporterIds, id]);
    }
    setReporterSearch("");
    setShowReporterDropdown(false);
  };

  const removeReporter = (personId: string) => {
    setReporterIds(reporterIds.filter((id) => id !== personId));
  };

  const getSelectedReporters = () => {
    return people.filter((person) =>
      reporterIds.includes(person.id.toString()),
    );
  };

  const handleCoordinatorChange = (value: string) => {
    setCoordinatorId(value);
    if (value) {
      setReporterIds((prev) => prev.filter((id) => id !== value));
    }
  };

  const filteredFamilies = useMemo(() => {
    if (!familySearch.trim()) return families;
    return families.filter((family) =>
      family.name.toLowerCase().includes(familySearch.toLowerCase()),
    );
  }, [families, familySearch]);

  const addFamily = (family: { id: string; name: string }) => {
    const familyIdStr = family.id.toString();
    if (!familyIds.includes(familyIdStr)) {
      setFamilyIds([...familyIds, familyIdStr]);

      // Automatically add all family members to the members list
      const selectedFamily = families.find(
        (f) => f.id.toString() === familyIdStr,
      );
      if (selectedFamily && selectedFamily.members) {
        const familyMemberIds = selectedFamily.members.map((id) =>
          id.toString(),
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
      familyIds.includes(family.id.toString()),
    );
  };

  const memberOptions = people.map((p) => ({
    value: p.id,
    label: formatPersonName(p),
  }));

  const filteredMembers = useMemo(() => {
    if (!memberSearch.trim()) return people;
    const searchLower = memberSearch.toLowerCase();
    return people.filter(
      (member) =>
        formatPersonName(member).toLowerCase().includes(searchLower) ||
        member.role.toLowerCase().includes(searchLower) ||
        member.status.toLowerCase().includes(searchLower),
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
    return people.filter((member) => memberIds.includes(member.id.toString()));
  };

  return (
    <>
    <form
      onSubmit={handleSubmit}
      className={panelLayout ? "p-4 sm:p-5 space-y-4" : "space-y-4"}
    >
      {error && <ErrorMessage message={error} />}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Branch
        </label>
        <select
          value={branchId}
          onChange={(e) => setBranchId(e.target.value)}
          disabled={!canEditBranch}
          className={`w-full px-3 py-2.5 md:py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent text-base md:text-sm min-h-[44px] md:min-h-0 ${
            !canEditBranch ? "bg-gray-100 cursor-not-allowed" : ""
          }`}
        >
          <option value="" disabled hidden>No branch</option>
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
      <div
        className={
          panelLayout ? "space-y-4" : "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 gap-4"
        }
      >
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Code *
          </label>
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="w-full px-3 py-2.5 md:py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent text-base md:text-sm min-h-[44px] md:min-h-0"
            placeholder="CLU-001"
            required
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
            className="w-full px-3 py-2.5 md:py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent text-base md:text-sm min-h-[44px] md:min-h-0"
            required
          />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Coordinator
          {memberIds.length === 0 && (
            <span className="ml-2 text-xs font-normal text-gray-500">
              (Add members first)
            </span>
          )}
        </label>
        <SearchableSelect
          options={coordinatorOptions as any}
          value={coordinatorId}
          onChange={handleCoordinatorChange}
          placeholder={
            memberIds.length === 0
              ? "Add members first to select coordinator"
              : "Select coordinator from members"
          }
          disabled={memberIds.length === 0}
          emptyMessage={
            memberIds.length === 0 ? "No members added yet" : "No members found"
          }
        />
        {memberIds.length === 0 && (
          <p className="text-xs text-gray-500 mt-1.5 flex items-center gap-1">
            <svg
              className="w-4 h-4 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            Coordinator must be selected from cluster members. Add members
            first.
          </p>
        )}
        {memberIds.length > 0 && coordinatorOptions.length === 0 && (
          <p className="text-xs text-amber-600 mt-1.5 flex items-center gap-1">
            <svg
              className="w-4 h-4 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            Selected members not found in system. Please refresh or re-add
            members.
          </p>
        )}
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Reporters ({reporterIds.length} selected)
          {memberIds.length === 0 && (
            <span className="ml-2 text-xs font-normal text-gray-500">
              (Add members first)
            </span>
          )}
        </label>
        <p className="text-xs text-gray-500 mb-2">
          Optional helpers who can submit weekly reports. Cannot be the same
          person as the coordinator.
        </p>
        <div className="relative">
          <input
            type="text"
            value={reporterSearch}
            onChange={(e) => {
              setReporterSearch(e.target.value);
              setShowReporterDropdown(true);
            }}
            onFocus={() => setShowReporterDropdown(true)}
            className="w-full px-3 py-2.5 md:py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent text-base md:text-sm min-h-[44px] md:min-h-0"
            placeholder={
              memberIds.length === 0
                ? "Add members first to select reporters"
                : "Search members to add as reporters..."
            }
            disabled={memberIds.length === 0 || peopleLoading}
          />
          {showReporterDropdown &&
            reporterSearch &&
            !peopleLoading &&
            memberIds.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                {filteredReporterCandidates.length === 0 ? (
                  <div className="px-3 py-2 text-gray-500 text-sm">
                    No members found matching &ldquo;{reporterSearch}&rdquo;
                  </div>
                ) : (
                  filteredReporterCandidates.map((person) => {
                    const personIdStr = person.id.toString();
                    const isSelected = reporterIds.includes(personIdStr);
                    return (
                      <button
                        key={person.id}
                        type="button"
                        onClick={() => addReporter(person)}
                        disabled={isSelected}
                        className={`w-full px-3 py-2.5 md:py-2 text-left hover:bg-gray-50 flex items-center space-x-3 min-h-[44px] md:min-h-0 ${
                          isSelected
                            ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                            : "text-gray-900"
                        }`}
                      >
                        <PersonAvatar person={person} size="sm" />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">
                            {formatPersonName(person)}
                          </p>
                          <span
                            className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium ${getPersonRoleColor(
                              person.role,
                            )}`}
                          >
                            {person.role.toLowerCase()}
                          </span>
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
        {reporterIds.length > 0 && (
          <div className="mt-3">
            <p className="text-sm font-medium text-gray-700 mb-2">
              Selected Reporters:
            </p>
            <div
              className={
                panelLayout ? "flex flex-col gap-2" : "flex flex-wrap gap-2"
              }
            >
              {getSelectedReporters().map((person) => (
                <div
                  key={person.id}
                  className="flex items-center space-x-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2"
                >
                  <PersonAvatar person={person} size="xs" />
                  <span className="text-sm font-medium text-gray-900">
                    {formatPersonName(person)}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeReporter(person.id.toString())}
                    className="text-gray-400 hover:text-red-500 ml-1 min-w-[32px] min-h-[32px] flex items-center justify-center"
                    aria-label="Remove reporter"
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
        {showReporterDropdown && (
          <div
            className="fixed inset-0 z-0"
            onClick={() => setShowReporterDropdown(false)}
          />
        )}
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Add Families ({familyIds.length} selected)
        </label>
        {familyIds.length > 0 && (
          <p className="text-xs text-gray-500 mb-2">
            Saving adds all family members to this cluster. People already in
            another cluster are left in that cluster.
          </p>
        )}

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
            className="w-full px-3 py-2.5 md:py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent text-base md:text-sm min-h-[44px] md:min-h-0"
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
            <div
              className={
                panelLayout ? "flex flex-col gap-2" : "flex flex-wrap gap-2"
              }
            >
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
        {branchId && (
          <p className="text-xs text-gray-500 mb-2">
            Members without a branch can be added; they will inherit this
            cluster&apos;s branch on save.
          </p>
        )}

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
            className="w-full px-3 py-2.5 md:py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent text-base md:text-sm min-h-[44px] md:min-h-0"
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
                      <PersonAvatar person={member} size="sm" />
                      <div className="flex-1">
                        <p className="font-medium text-sm">
                          {formatPersonName(member)}
                        </p>
                        <div className="flex items-center space-x-1 mt-0.5">
                          <span
                            className={`px-1.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(
                              member.status,
                            )}`}
                          >
                            {member.status.toLowerCase()}
                          </span>
                          <span
                            className={`px-1.5 py-0.5 rounded-full text-xs font-medium ${getPersonRoleColor(
                              member.role,
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
            <div
              className={
                panelLayout ? "flex flex-col gap-2" : "flex flex-wrap gap-2"
              }
            >
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
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Location
          </label>
          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="w-full px-3 py-2.5 md:py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent text-base md:text-sm min-h-[44px] md:min-h-0"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Meeting Day
            </label>
            <select
              value={meetingDay}
              onChange={(e) =>
                setMeetingDay(e.target.value as MeetingDayKey)
              }
              className="w-full px-3 py-2.5 md:py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent text-base md:text-sm min-h-[44px] md:min-h-0"
            >
              {CLUSTER_MEETING_DAY_OPTIONS.map((option) => (
                <option key={option.value || "none"} value={option.value} disabled={option.value === ""} hidden={option.value === ""}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Meeting Time
            </label>
            <input
              type="time"
              value={meetingTime || ""}
              onChange={(e) => setMeetingTime(e.target.value)}
              className="w-full px-3 py-2.5 md:py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent text-base md:text-sm min-h-[44px] md:min-h-0"
            />
          </div>
        </div>
      </div>
      <p className="text-xs text-gray-500">
        Leave meeting time empty if the cluster does not have a fixed time.
      </p>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Description
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full px-3 py-2.5 md:py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent text-base md:text-sm min-h-[100px] md:min-h-0"
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
          {panelLayout ? "Back" : "Cancel"}
        </Button>
        <Button
          className="w-full sm:flex-1 min-h-[44px]"
          disabled={submitting || duplicateCheckLoading}
          type="submit"
        >
          {submitting || duplicateCheckLoading
            ? submitting
              ? "Saving..."
              : "Checking..."
            : initialData
              ? "Update Cluster"
              : "Create Cluster"}
        </Button>
      </div>
    </form>

    <ConfirmationModal
      isOpen={duplicateNameConfirm.isOpen}
      onClose={() => setDuplicateNameConfirm({ isOpen: false, matches: [] })}
      onConfirm={() => {
        setDuplicateNameConfirm({ isOpen: false, matches: [] });
        performSubmit();
      }}
      title="Possible duplicate"
      message={
        <div className="space-y-2">
          <p>
            A cluster with the same name already exists. Continue anyway only if
            this is a different cluster.
          </p>
          <ul className="list-disc pl-5 space-y-1 text-sm text-gray-700 max-h-40 overflow-y-auto">
            {duplicateNameConfirm.matches.slice(0, 8).map((cluster) => (
              <li key={cluster.id}>{describeDuplicateCluster(cluster)}</li>
            ))}
            {duplicateNameConfirm.matches.length > 8 && (
              <li>…and {duplicateNameConfirm.matches.length - 8} more</li>
            )}
          </ul>
        </div>
      }
      confirmText={initialData ? "Update anyway" : "Create anyway"}
      cancelText="Go back"
      variant="warning"
      zIndex={80}
    />
    </>
  );
}
