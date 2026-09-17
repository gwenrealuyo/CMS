"use client";

import {
  ChangeEvent,
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Button from "@/src/components/ui/Button";
import ConfirmationModal from "@/src/components/ui/ConfirmationModal";
import ErrorMessage from "@/src/components/ui/ErrorMessage";
import ScalableSelect from "@/src/components/ui/ScalableSelect";
import {
  EvangelismGroup,
  EvangelismGroupFormValues,
} from "@/src/types/evangelism";
import { Person } from "@/src/types/person";
import { Cluster } from "@/src/types/cluster";
import { formatPersonName } from "@/src/lib/name";
import {
  isSelectablePerson,
  personDropdownChips,
} from "@/src/lib/peopleSelectors";
import { useBranches } from "@/src/hooks/useBranches";
import {
  evangelismApi,
  ministriesApi,
  ministryMembersApi,
} from "@/src/lib/api";
import {
  describeDuplicateEvangelismGroup,
  findPossibleEvangelismGroupNameDuplicates,
} from "@/src/lib/evangelismGroupDuplicates";
import {
  BIBLE_SHARERS_MINISTRY_CODE,
  BIBLE_SHARERS_ROSTER_EMPTY_MESSAGE,
} from "@/src/lib/ministries/systemMinistries";

interface EvangelismGroupFormProps {
  coordinators?: Person[];
  people?: Person[];
  clusters?: Cluster[];
  onSubmit: (values: EvangelismGroupFormValues) => Promise<void>;
  onCancel: () => void;
  isSubmitting: boolean;
  error?: string | null;
  submitLabel?: string;
  initialData?: EvangelismGroup;
  panelLayout?: boolean;
  defaultBranchId?: string;
  canChangeBranch?: boolean;
}

const MEETING_FREQUENCY_OPTIONS: {
  value: EvangelismGroupFormValues["meeting_frequency"];
  label: string;
}[] = [
  { value: "WEEKLY", label: "Weekly" },
  { value: "BIWEEKLY", label: "Biweekly" },
  { value: "MONTHLY", label: "Monthly" },
  { value: "IRREGULAR", label: "Irregular" },
];

const DEFAULT_VALUES: EvangelismGroupFormValues = {
  name: "",
  description: "",
  coordinator_id: "",
  cluster_id: "",
  branch_id: "",
  location: "",
  meeting_time: "",
  meeting_day: "",
  meeting_frequency: "WEEKLY",
  is_active: true,
  initial_member_ids: [],
  reporter_ids: [],
  bible_sharer_ids: [],
};

/** HTML time input expects HH:mm; API may return HH:MM:SS — strip seconds for the input. */
function toTimeInputValue(apiTime: string | null | undefined): string {
  if (!apiTime) return "";
  return apiTime.length >= 5 ? apiTime.slice(0, 5) : "";
}

function clusterBibleStudyName(cluster: Cluster | undefined): string {
  const code = cluster?.code?.trim();
  return code ? `${code} BS` : "";
}

function clusterBranchId(cluster: Cluster | undefined): string {
  const id = cluster?.branch;
  return id != null && String(id).trim() !== "" ? String(id) : "";
}

function groupBranchIdFromRecord(group: EvangelismGroup): string {
  if (group.branch != null && String(group.branch).trim() !== "") {
    return String(group.branch);
  }
  if (group.branch_id != null && String(group.branch_id).trim() !== "") {
    return String(group.branch_id);
  }
  return clusterBranchId(group.cluster);
}

function personRecordId(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (typeof value === "object") {
    const id = (value as { id?: unknown }).id;
    if (id == null || id === "") return null;
    return String(id);
  }
  return String(value);
}

function groupMemberIds(group: EvangelismGroup): string[] {
  return (group.members || [])
    .map((member) => personRecordId(member))
    .filter((id): id is string => Boolean(id));
}

function formValuesFromGroup(
  group: EvangelismGroup,
): EvangelismGroupFormValues {
  return {
    name: group.name,
    description: group.description || "",
    coordinator_id: group.coordinator?.id ? String(group.coordinator.id) : "",
    cluster_id: group.cluster?.id ? String(group.cluster.id) : "",
    branch_id: groupBranchIdFromRecord(group),
    location: group.location || "",
    meeting_time: toTimeInputValue(group.meeting_time),
    meeting_day: group.meeting_day || "",
    meeting_frequency: group.cluster?.id
      ? "WEEKLY"
      : group.meeting_frequency || "WEEKLY",
    is_active: group.is_active,
    initial_member_ids: groupMemberIds(group),
    reporter_ids: (group.reporter_ids || []).map(String),
    bible_sharer_ids: (group.bible_sharer_ids || []).map(String),
  };
}

export default function EvangelismGroupForm({
  coordinators = [],
  people = [],
  clusters = [],
  onSubmit,
  onCancel,
  isSubmitting,
  error,
  submitLabel = "Create Group",
  initialData,
  panelLayout = false,
  defaultBranchId = "",
  canChangeBranch = true,
}: EvangelismGroupFormProps) {
  const isCreate = !initialData;
  const [values, setValues] = useState<EvangelismGroupFormValues>(
    initialData
      ? formValuesFromGroup(initialData)
      : { ...DEFAULT_VALUES, branch_id: defaultBranchId },
  );
  const syncedGroupIdRef = useRef<string | null>(null);
  const syncedRosterRef = useRef(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [duplicateNameConfirm, setDuplicateNameConfirm] = useState<{
    isOpen: boolean;
    matches: EvangelismGroup[];
  }>({ isOpen: false, matches: [] });
  const [duplicateCheckLoading, setDuplicateCheckLoading] = useState(false);

  const { branches } = useBranches();
  const [bibleSharerRosterIds, setBibleSharerRosterIds] = useState<Set<string>>(
    new Set(),
  );
  const memberPool = useMemo(
    () => (people.length ? people : coordinators).filter(isSelectablePerson),
    [people, coordinators],
  );

  useEffect(() => {
    if (!initialData) {
      syncedGroupIdRef.current = null;
      syncedRosterRef.current = false;
      return;
    }
    const groupId = String(initialData.id);
    const hasRoster = Array.isArray(initialData.members);
    if (syncedGroupIdRef.current !== groupId) {
      syncedGroupIdRef.current = groupId;
      syncedRosterRef.current = hasRoster;
      setValues(formValuesFromGroup(initialData));
      return;
    }
    if (!syncedRosterRef.current && hasRoster) {
      syncedRosterRef.current = true;
      setValues((prev) => ({
        ...prev,
        initial_member_ids: groupMemberIds(initialData),
        reporter_ids: (initialData.reporter_ids || []).map(String),
        bible_sharer_ids: (initialData.bible_sharer_ids || []).map(String),
        coordinator_id: initialData.coordinator?.id
          ? String(initialData.coordinator.id)
          : prev.coordinator_id,
      }));
    }
  }, [initialData]);

  const handleChange =
    (field: keyof EvangelismGroupFormValues) =>
    (
      event: ChangeEvent<
        HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
      >,
    ) => {
      const value =
        event.target.type === "checkbox"
          ? (event.target as HTMLInputElement).checked
          : event.target.value;
      setValues((prev) => ({
        ...prev,
        [field]: value,
      }));
    };

  const performSubmit = useCallback(() => {
    setLocalError(null);
    void onSubmit(values);
  }, [onSubmit, values]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!values.branch_id) {
      setLocalError("Branch is required.");
      return;
    }
    const searchTerm = values.name.trim();
    setLocalError(null);
    setDuplicateCheckLoading(true);
    try {
      let candidateGroups: EvangelismGroup[] = [];
      if (searchTerm) {
        const response = await evangelismApi.listGroups({
          name: searchTerm,
          page_size: 10,
        });
        candidateGroups = response.data.results ?? [];
      }
      const nameMatches = findPossibleEvangelismGroupNameDuplicates(
        candidateGroups,
        {
          name: searchTerm,
          branch: values.branch_id ? Number(values.branch_id) : null,
          excludeId: initialData?.id,
        },
      );
      if (nameMatches.length > 0) {
        setDuplicateNameConfirm({ isOpen: true, matches: nameMatches });
        return;
      }
      performSubmit();
    } finally {
      setDuplicateCheckLoading(false);
    }
  };

  const initialMemberOptions = useMemo(
    () =>
      memberPool
        .filter(
          (person) =>
            person.role !== "VISITOR" &&
            !(values.initial_member_ids || []).includes(String(person.id)),
        )
        .map((person) => {
          const { statusLabel, statusClassName, clusterCode, clusterBranchId } =
            personDropdownChips(person);
          return {
            label: formatPersonName(person),
            value: String(person.id),
            statusLabel,
            statusClassName,
            clusterCode,
            clusterBranchId,
          };
        })
        .sort((a, b) => a.label.localeCompare(b.label)),
    [memberPool, values.initial_member_ids],
  );

  const addInitialMember = (value: string) => {
    if (!value) return;
    if ((values.initial_member_ids || []).includes(value)) return;
    setValues((prev) => ({
      ...prev,
      initial_member_ids: [...(prev.initial_member_ids || []), value],
    }));
  };

  const removeInitialMember = (id: string) => {
    setValues((prev) => ({
      ...prev,
      initial_member_ids: (prev.initial_member_ids || []).filter(
        (x) => x !== id,
      ),
      reporter_ids: (prev.reporter_ids || []).filter((x) => x !== id),
      bible_sharer_ids: (prev.bible_sharer_ids || []).filter((x) => x !== id),
    }));
  };

  const dayOptions = [
    { value: "", label: "Select day" },
    { value: "MONDAY", label: "Monday" },
    { value: "TUESDAY", label: "Tuesday" },
    { value: "WEDNESDAY", label: "Wednesday" },
    { value: "THURSDAY", label: "Thursday" },
    { value: "FRIDAY", label: "Friday" },
    { value: "SATURDAY", label: "Saturday" },
    { value: "SUNDAY", label: "Sunday" },
  ];

  const clusterOptions = useMemo(
    () => [
      { label: "No cluster", value: "" },
      ...clusters
        .filter((cluster) => {
          if (!values.branch_id) return true;
          const clusterBranch = clusterBranchId(cluster);
          return !clusterBranch || clusterBranch === String(values.branch_id);
        })
        .map((cluster) => {
          const name = cluster.name?.trim();
          const code = cluster.code?.trim();
          const label =
            name && code ? `${name} (${code})` : name || code || "Cluster";
          return {
            label,
            value: String(cluster.id),
          };
        })
        .sort((a, b) => a.label.localeCompare(b.label)),
    ],
    [clusters, values.branch_id],
  );

  const selectedCluster = useMemo(
    () => clusters.find((cluster) => String(cluster.id) === values.cluster_id),
    [clusters, values.cluster_id],
  );
  const suggestedClusterName = clusterBibleStudyName(selectedCluster);
  const showClusterNameSuggestion =
    Boolean(suggestedClusterName) &&
    values.name.trim() !== suggestedClusterName;

  const branchOptions = useMemo(
    () =>
      branches
        .filter(
          (branch) =>
            branch.is_active || String(branch.id) === values.branch_id,
        )
        .map((branch) => ({
          label: branch.code?.trim()
            ? `${branch.name} (${branch.code})`
            : branch.name,
          value: String(branch.id),
        }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [branches, values.branch_id],
  );
  const branchLocked = Boolean(values.cluster_id) || !canChangeBranch;

  const coordinatorOptions = useMemo(() => {
    const base = people.length > 0 ? people : coordinators;
    const memberIds = new Set(
      (values.initial_member_ids || [])
        .map((id) => personRecordId(id))
        .filter((id): id is string => Boolean(id)),
    );
    if (values.coordinator_id) {
      memberIds.add(String(values.coordinator_id));
    }
    const fromMembers = base.filter(
      (person) =>
        isSelectablePerson(person) && memberIds.has(String(person.id)),
    );
    const filtered =
      !isCreate && memberIds.size > 0
        ? fromMembers
        : base.filter(isSelectablePerson);
    const ensureIds = [values.coordinator_id].filter(Boolean);
    let options = filtered;
    for (const id of ensureIds) {
      if (options.some((person) => String(person.id) === String(id))) {
        continue;
      }
      const extra = base.find((person) => String(person.id) === String(id));
      if (extra && isSelectablePerson(extra)) {
        options = [extra, ...options];
      }
    }
    return options
      .map((person) => ({
        label: formatPersonName(person),
        value: String(person.id),
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [
    people,
    coordinators,
    values.coordinator_id,
    values.initial_member_ids,
    isCreate,
  ]);
  const isHqGroup = useMemo(() => {
    const branchId = selectedCluster?.branch ?? values.branch_id;
    if (branchId == null || branchId === "") return false;
    const branch = branches.find((b) => Number(b.id) === Number(branchId));
    return Boolean(branch?.is_headquarters);
  }, [selectedCluster, values.branch_id, branches]);

  useEffect(() => {
    if (!isHqGroup) {
      setBibleSharerRosterIds(new Set());
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const listRes = await ministriesApi.list({
          code: BIBLE_SHARERS_MINISTRY_CODE,
          is_system: true,
        });
        const data = listRes.data as unknown;
        const rows = Array.isArray(data)
          ? data
          : ((data as { results?: { id: number }[] })?.results ?? []);
        const ministry = rows[0];
        if (!ministry) {
          if (!cancelled) setBibleSharerRosterIds(new Set());
          return;
        }
        const membersRes = await ministryMembersApi.list({
          ministry: ministry.id,
        });
        const membersData = membersRes.data as unknown;
        const members = Array.isArray(membersData)
          ? membersData
          : ((
              membersData as {
                results?: { member?: { id: number }; member_id?: number }[];
              }
            )?.results ?? []);
        if (!cancelled) {
          setBibleSharerRosterIds(
            new Set(
              members.map((m) =>
                String(
                  (m as { member?: { id: number }; member_id?: number }).member
                    ?.id ?? (m as { member_id?: number }).member_id,
                ),
              ),
            ),
          );
        }
      } catch {
        if (!cancelled) setBibleSharerRosterIds(new Set());
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isHqGroup]);

  const groupMembersKnown = isCreate || Array.isArray(initialData?.members);

  const roleCandidateIds = useMemo(() => {
    return new Set(
      (values.initial_member_ids || [])
        .map((id) => personRecordId(id))
        .filter((id): id is string => Boolean(id)),
    );
  }, [values.initial_member_ids]);

  const peopleById = useMemo(() => {
    const map = new Map<string, Person>();
    for (const person of memberPool) {
      map.set(String(person.id), person);
    }
    if (!isCreate) {
      for (const member of initialData?.members || []) {
        const id = personRecordId(member);
        if (!id || typeof member !== "object") continue;
        if (!map.has(id)) {
          map.set(id, member as Person);
        }
      }
    }
    return map;
  }, [memberPool, isCreate, initialData?.members]);

  const roleCandidateOptions = useMemo(() => {
    return Array.from(roleCandidateIds)
      .filter((id) => id !== values.coordinator_id)
      .map((id) => {
        const person = peopleById.get(id);
        return {
          label: person ? formatPersonName(person) : id,
          value: id,
        };
      })
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [roleCandidateIds, peopleById, values.coordinator_id]);

  useEffect(() => {
    if (!groupMembersKnown) return;
    setValues((prev) => {
      const nextReporters = (prev.reporter_ids || []).filter(
        (id) => roleCandidateIds.has(id) && id !== prev.coordinator_id,
      );
      const nextSharers = (prev.bible_sharer_ids || []).filter(
        (id) => roleCandidateIds.has(id) && id !== prev.coordinator_id,
      );
      if (
        nextReporters.length === (prev.reporter_ids || []).length &&
        nextSharers.length === (prev.bible_sharer_ids || []).length &&
        nextReporters.every((id, i) => id === (prev.reporter_ids || [])[i]) &&
        nextSharers.every((id, i) => id === (prev.bible_sharer_ids || [])[i])
      ) {
        return prev;
      }
      return {
        ...prev,
        reporter_ids: nextReporters,
        bible_sharer_ids: nextSharers,
      };
    });
  }, [groupMembersKnown, roleCandidateIds]);

  const addRoleId = (
    field: "reporter_ids" | "bible_sharer_ids",
    id: string,
  ) => {
    if (!id || !roleCandidateIds.has(id)) return;
    setValues((prev) => {
      const current = prev[field] || [];
      if (current.includes(id) || id === prev.coordinator_id) return prev;
      const next = { ...prev, [field]: [...current, id] };
      if (field === "bible_sharer_ids") {
        next.reporter_ids = (prev.reporter_ids || []).filter((x) => x !== id);
      }
      if (
        field === "reporter_ids" &&
        (prev.bible_sharer_ids || []).includes(id)
      ) {
        return prev;
      }
      return next;
    });
  };

  const removeRoleId = (
    field: "reporter_ids" | "bible_sharer_ids",
    id: string,
  ) => {
    setValues((prev) => ({
      ...prev,
      [field]: (prev[field] || []).filter((x) => x !== id),
    }));
  };

  const personLabel = (id: string) => {
    const personObj = peopleById.get(id);
    return personObj ? formatPersonName(personObj) : id;
  };

  return (
    <>
      <form
        className={panelLayout ? "p-4 sm:p-5 space-y-4" : "space-y-4"}
        onSubmit={handleSubmit}
      >
        {error && <ErrorMessage message={error} />}
        {!error && localError && <ErrorMessage message={localError} />}

        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700">
            Group Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={values.name}
            onChange={handleChange("name")}
            required
            placeholder="e.g., North Bible Study"
            className="w-full rounded-md border border-gray-200 px-3 py-2 min-h-[44px] text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-ring"
          />
          {showClusterNameSuggestion ? (
            <p className="text-xs text-gray-500">
              You can use{" "}
              <button
                type="button"
                className="font-medium text-primary hover:underline"
                onClick={() =>
                  setValues((prev) => ({
                    ...prev,
                    name: suggestedClusterName,
                  }))
                }
              >
                {suggestedClusterName}
              </button>
            </p>
          ) : null}
        </div>

        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700">
            Description
          </label>
          <textarea
            value={values.description}
            onChange={handleChange("description")}
            placeholder="Group description..."
            rows={3}
            className="w-full rounded-md border border-gray-200 px-3 py-2 min-h-[44px] text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>

        <div
          className={
            panelLayout ? "space-y-4" : "grid grid-cols-1 md:grid-cols-2 gap-4"
          }
        >
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">
              Branch <span className="text-red-500">*</span>
            </label>
            <ScalableSelect
              options={[
                { label: "Select branch", value: "" },
                ...branchOptions,
              ]}
              value={values.branch_id || ""}
              onChange={(value) =>
                setValues((prev) => {
                  const currentCluster = clusters.find(
                    (cluster) => String(cluster.id) === String(prev.cluster_id),
                  );
                  const clusterStillValid =
                    Boolean(prev.cluster_id) &&
                    (!clusterBranchId(currentCluster) ||
                      clusterBranchId(currentCluster) === String(value));
                  return {
                    ...prev,
                    branch_id: value,
                    cluster_id: clusterStillValid ? prev.cluster_id : "",
                  };
                })
              }
              placeholder="Select branch"
              className="w-full"
              showSearch
              disabled={branchLocked}
            />
            {values.cluster_id ? (
              <p className="text-xs text-gray-500">
                Branch is set from the selected cluster.
              </p>
            ) : !canChangeBranch ? (
              <p className="text-xs text-gray-500">
                Branch is limited to your assignment.
              </p>
            ) : (
              <p className="text-xs text-gray-500">
                Required even when the group has no cluster.
              </p>
            )}
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">
              Cluster (Optional)
            </label>
            <ScalableSelect
              options={clusterOptions}
              value={values.cluster_id || ""}
              onChange={(value) =>
                setValues((prev) => {
                  const nextCluster = clusters.find(
                    (cluster) => String(cluster.id) === String(value),
                  );
                  const prevCluster = clusters.find(
                    (cluster) => String(cluster.id) === String(prev.cluster_id),
                  );
                  const suggested = clusterBibleStudyName(nextCluster);
                  const previousSuggested = clusterBibleStudyName(prevCluster);
                  const currentName = prev.name.trim();
                  const shouldPrefillName =
                    Boolean(suggested) &&
                    (!currentName || currentName === previousSuggested);

                  const nextBranchId = value
                    ? clusterBranchId(nextCluster) || prev.branch_id
                    : prev.branch_id;

                  return {
                    ...prev,
                    cluster_id: value,
                    branch_id: nextBranchId,
                    meeting_frequency: value
                      ? "WEEKLY"
                      : prev.meeting_frequency,
                    name: shouldPrefillName ? suggested : prev.name,
                    coordinator_id: prev.coordinator_id,
                    reporter_ids: prev.coordinator_id
                      ? (prev.reporter_ids || []).filter(
                          (id) => id !== prev.coordinator_id,
                        )
                      : prev.reporter_ids,
                    bible_sharer_ids: prev.coordinator_id
                      ? (prev.bible_sharer_ids || []).filter(
                          (id) => id !== prev.coordinator_id,
                        )
                      : prev.bible_sharer_ids,
                  };
                })
              }
              placeholder="Select cluster"
              className="w-full"
              showSearch
            />
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">
              Coordinator
            </label>
            <ScalableSelect
              options={[{ label: "Not set", value: "" }, ...coordinatorOptions]}
              value={values.coordinator_id || ""}
              onChange={(value) =>
                setValues((prev) => ({
                  ...prev,
                  coordinator_id: value,
                  reporter_ids: (prev.reporter_ids || []).filter(
                    (id) => id !== value,
                  ),
                  bible_sharer_ids: (prev.bible_sharer_ids || []).filter(
                    (id) => id !== value,
                  ),
                }))
              }
              placeholder="Select coordinator"
              className="w-full"
              showSearch
            />
            {!isCreate ? (
              <p className="text-xs text-gray-500">
                Choose from members of this evangelism group.
              </p>
            ) : null}
          </div>
        </div>

        <div
          className={
            panelLayout
              ? "space-y-4"
              : "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"
          }
        >
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">
              Location
            </label>
            <input
              type="text"
              value={values.location}
              onChange={handleChange("location")}
              placeholder="Meeting location"
              className="w-full rounded-md border border-gray-200 px-3 py-2 min-h-[44px] text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">
              Meeting Day
            </label>
            <select
              value={values.meeting_day}
              onChange={handleChange("meeting_day")}
              className="w-full rounded-md border border-gray-200 px-3 py-2 min-h-[44px] text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-ring"
            >
              {dayOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">
              Meeting Time
            </label>
            <input
              type="time"
              value={values.meeting_time || ""}
              onChange={handleChange("meeting_time")}
              className="w-full rounded-md border border-gray-200 px-3 py-2 min-h-[44px] text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">
              Meeting Frequency
            </label>
            <select
              value={values.meeting_frequency}
              onChange={handleChange("meeting_frequency")}
              disabled={Boolean(values.cluster_id)}
              className="w-full rounded-md border border-gray-200 px-3 py-2 min-h-[44px] text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500"
            >
              {MEETING_FREQUENCY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {values.cluster_id ? (
              <p className="text-xs text-gray-500">
                Cluster Bible Studies report weekly.
              </p>
            ) : null}
          </div>
        </div>
        <p className="text-xs text-gray-500">
          Leave meeting time empty if the group does not have a fixed time.
        </p>

        <div className="space-y-2 rounded-lg border border-gray-100 bg-gray-50/80 p-3">
          <p className="text-sm font-medium text-gray-800">
            {isCreate ? "Initial members (optional)" : "Members"}
          </p>
          <ScalableSelect
            options={initialMemberOptions}
            value=""
            onChange={addInitialMember}
            onConfirm={addInitialMember}
            placeholder="Search and pick member to add"
            className="w-full"
            showSearch
          />
          {(values.initial_member_ids?.length ?? 0) > 0 ? (
            <ul className="flex flex-wrap gap-2 mt-2">
              {(values.initial_member_ids ?? []).map((id) => {
                const personObj = peopleById.get(id);
                const label = personObj ? formatPersonName(personObj) : id;
                return (
                  <li key={id}>
                    <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-sm text-primary border border-primary/20">
                      {label}
                      <button
                        type="button"
                        className="text-primary hover:text-primary"
                        onClick={() => removeInitialMember(id)}
                        aria-label={`Remove ${label}`}
                      >
                        ×
                      </button>
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-xs text-gray-500">
              You can add people now or enroll them later from the group view.
            </p>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex items-start">
            <input
              type="checkbox"
              id="is_active"
              checked={values.is_active}
              onChange={handleChange("is_active")}
              className="h-4 w-4 text-primary focus:ring-ring border-gray-300 rounded mt-0.5"
            />
            <label
              htmlFor="is_active"
              className="ml-2 block text-sm text-gray-700 cursor-pointer"
            >
              Active
            </label>
          </div>
        </div>

        <div className="space-y-3 rounded-lg border border-gray-100 bg-gray-50/80 p-3">
          <p className="text-sm font-medium text-gray-800">Group roles</p>
          <p className="text-xs text-gray-500">
            Bible Sharers and reporters must already be members of this
            evangelism group (add them above first). The coordinator cannot hold
            either role on this group.
            {isHqGroup
              ? " HQ groups can only assign Bible Sharers from the headquarters Bible Sharers ministry roster."
              : ""}
          </p>
          {(
            [
              {
                field: "bible_sharer_ids" as const,
                label: "Bible Sharers",
                hint: isHqGroup
                  ? "Must be on the HQ Bible Sharers roster"
                  : "Can facilitate and submit reports",
                chipClass: "bg-rose-50 text-rose-800 border-rose-200",
              },
              {
                field: "reporter_ids" as const,
                label: "Reporters",
                hint: "Can submit reports only; limited to group members",
                chipClass: "bg-amber-50 text-amber-800 border-amber-200",
              },
            ] as const
          ).map((role) => {
            const selected = values[role.field] || [];
            const options = roleCandidateOptions.filter((opt) => {
              if (selected.includes(opt.value)) return false;
              if (
                role.field === "reporter_ids" &&
                (values.bible_sharer_ids || []).includes(opt.value)
              ) {
                return false;
              }
              if (
                role.field === "bible_sharer_ids" &&
                isHqGroup &&
                !bibleSharerRosterIds.has(opt.value)
              ) {
                return false;
              }
              return true;
            });
            const hqRosterEmpty =
              role.field === "bible_sharer_ids" &&
              isHqGroup &&
              roleCandidateIds.size > 0 &&
              options.length === 0;
            return (
              <div key={role.field} className="space-y-2">
                <p className="text-sm text-gray-700">
                  {role.label}{" "}
                  <span className="text-xs font-normal text-gray-500">
                    ({selected.length} selected) — {role.hint}
                  </span>
                </p>
                <ScalableSelect
                  options={[
                    { label: `Add ${role.label.toLowerCase()}`, value: "" },
                    ...options,
                  ]}
                  value=""
                  onChange={(value) => addRoleId(role.field, value)}
                  placeholder={
                    !groupMembersKnown
                      ? "Loading members..."
                      : roleCandidateIds.size === 0
                        ? "Add members first"
                        : hqRosterEmpty
                          ? BIBLE_SHARERS_ROSTER_EMPTY_MESSAGE
                          : `Add ${role.label.toLowerCase()}`
                  }
                  className="w-full"
                  showSearch
                  disabled={!groupMembersKnown || roleCandidateIds.size === 0}
                />
                {hqRosterEmpty && (
                  <p className="text-xs text-gray-500">
                    {BIBLE_SHARERS_ROSTER_EMPTY_MESSAGE}
                  </p>
                )}
                {selected.length > 0 && (
                  <ul className="flex flex-wrap gap-2">
                    {selected.map((id) => (
                      <li key={id}>
                        <span
                          className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm border ${role.chipClass}`}
                        >
                          {personLabel(id)}
                          <button
                            type="button"
                            onClick={() => removeRoleId(role.field, id)}
                            aria-label={`Remove ${personLabel(id)}`}
                          >
                            ×
                          </button>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex flex-col-reverse sm:flex-row gap-4 pt-4">
          <Button
            variant="tertiary"
            className="w-full sm:flex-1 min-h-[44px]"
            onClick={onCancel}
            disabled={isSubmitting || duplicateCheckLoading}
          >
            {panelLayout ? "Back" : "Cancel"}
          </Button>
          <Button
            className="w-full sm:flex-1 min-h-[44px]"
            disabled={isSubmitting || duplicateCheckLoading}
            type="submit"
          >
            {isSubmitting || duplicateCheckLoading
              ? isSubmitting
                ? "Saving..."
                : "Checking..."
              : submitLabel}
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
              An evangelism group with the same name already exists. Continue
              anyway only if this is a different group.
            </p>
            <ul className="list-disc pl-5 space-y-1 text-sm text-gray-700 max-h-40 overflow-y-auto">
              {duplicateNameConfirm.matches.slice(0, 8).map((group) => (
                <li key={group.id}>
                  {describeDuplicateEvangelismGroup(group)}
                </li>
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
