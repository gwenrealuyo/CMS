"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import Button from "@/src/components/ui/Button";
import Modal from "@/src/components/ui/Modal";
import ScalableSelect from "@/src/components/ui/ScalableSelect";
import AttendanceSelector from "@/src/components/reports/AttendanceSelector";
import AddVisitorModal from "@/src/components/reports/AddVisitorModal";
import ProspectForm, {
  type ProspectFormValues,
} from "@/src/components/evangelism/ProspectForm";
import {
  EvangelismGroup,
  EvangelismReportNewInvitedProspectInput,
  EvangelismWeeklyReport,
  Prospect,
} from "@/src/types/evangelism";
import { Person, PersonUI } from "@/src/types/person";
import { Cluster } from "@/src/types/cluster";
import { evangelismApi, peopleApi } from "@/src/lib/api";
import { isSelectablePerson } from "@/src/lib/peopleSelectors";
import {
  getIsoWeekParts,
  getIsoWeekPartsFromDateString,
} from "@/src/lib/isoWeek";
import { formatPersonName } from "@/src/lib/name";
import {
  isProspectAttendanceId,
  prospectIdFromAttendanceId,
  toPendingNewProspectId,
  toProspectAttendanceId,
} from "@/src/lib/clusterWeeklyReportSubmit";
import { isDuplicateMeetingReportError } from "@/src/lib/apiErrors";
import ConfirmationModal from "@/src/components/ui/ConfirmationModal";

/** Label for invites without a linked Person. */
function prospectInviteDisplayName(prospect: Prospect): string {
  if (prospect.display_name?.trim()) return prospect.display_name.trim();
  const parts = [
    prospect.first_name,
    prospect.middle_name,
    prospect.last_name,
  ].filter(Boolean) as string[];
  let base = parts.join(" ");
  if (prospect.suffix?.trim())
    base = base ? `${base}, ${prospect.suffix}` : prospect.suffix!;
  return base || "Unknown";
}

function inviterDisplayNameFromPeople(
  inviterId: string | number | null | undefined,
  people: PersonUI[],
): string {
  if (inviterId == null || String(inviterId).trim() === "") return "";
  const found = people.find((p) => String(p.id) === String(inviterId));
  if (!found) return "";
  const formatted = formatPersonName(found);
  if (formatted && formatted !== "Unknown person") return formatted;
  return found.name?.trim() || "";
}

function prospectToPersonUI(
  prospect: Prospect,
  people: PersonUI[] = [],
): PersonUI {
  let invitedBy = "";
  if (
    prospect.invited_by &&
    typeof prospect.invited_by === "object" &&
    "first_name" in prospect.invited_by
  ) {
    invitedBy =
      prospect.invited_by.full_name?.trim() ||
      `${prospect.invited_by.first_name ?? ""} ${
        prospect.invited_by.last_name ?? ""
      }`.trim();
  }
  if (!invitedBy) {
    invitedBy = inviterDisplayNameFromPeople(
      prospect.invited_by_id || prospect.invited_by?.id,
      people,
    );
  }
  const stageLabel =
    prospect.pipeline_stage_display || prospect.pipeline_stage || "INVITED";
  return {
    id: toProspectAttendanceId(prospect.id),
    name: `${prospectInviteDisplayName(prospect)} (${stageLabel.toLowerCase()})`,
    role: "VISITOR",
    status: "NO_RESPONSE",
    inviter: prospect.invited_by?.id || prospect.invited_by_id,
    inviter_display_name: invitedBy || null,
    username: "",
    email: "",
    first_name: prospect.first_name || "",
    last_name: prospect.last_name || "",
  } as unknown as PersonUI;
}

function isInvitableProspect(prospect: Prospect, groupId: string): boolean {
  if (prospect.person) return false;
  if (prospect.is_dropped_off) return false;
  if (prospect.pipeline_stage && prospect.pipeline_stage !== "INVITED") {
    return false;
  }
  const gid = prospect.evangelism_group_id ?? prospect.evangelism_group?.id;
  if (gid != null && String(gid) !== String(groupId)) return false;
  return true;
}

/** True when members is a (possibly empty) person roster, not omitted or PK-only. */
function groupHasPersonRoster(g?: EvangelismGroup | null): boolean {
  if (!g || !Array.isArray(g.members)) return false;
  if (g.members.length === 0) return true;
  const first = g.members[0] as Person | number | string;
  return typeof first === "object" && first != null && "id" in first;
}

function groupClusterChip(
  group: EvangelismGroup,
  clusters: Cluster[] = [],
): { clusterCode: string; clusterBranchId: number | null } {
  const nested = group.cluster;
  const clusterId = nested?.id ?? group.cluster_id ?? null;
  if (clusterId == null || String(clusterId).trim() === "") {
    return { clusterCode: "NO CLUSTER", clusterBranchId: null };
  }
  const fromList = clusters.find(
    (cluster) => String(cluster.id) === String(clusterId),
  );
  const code = (
    nested?.code ||
    fromList?.code ||
    nested?.name ||
    fromList?.name ||
    ""
  ).trim();
  const branchRaw = fromList?.branch ?? nested?.branch ?? clusterId;
  const branchId = Number(branchRaw);
  return {
    clusterCode: code || String(clusterId),
    clusterBranchId: Number.isFinite(branchId) ? branchId : null,
  };
}

export interface EvangelismWeeklyReportFormValues {
  evangelism_group_id: string;
  year: number;
  week_number: number;
  meeting_date: string;
  members_attended: string[];
  visitors_attended: string[];
  prospects_invited: string[];
  pending_new_prospects?: Record<
    string,
    EvangelismReportNewInvitedProspectInput
  >;
  gathering_type: "PHYSICAL" | "ONLINE" | "HYBRID";
  topic?: string;
  activities_held?: string;
  prayer_requests?: string;
  testimonies?: string;
  notes?: string;
}

interface EvangelismWeeklyReportFormProps {
  /** Known group (group detail modal, or preselected from a deep link). */
  group?: EvangelismGroup | null;
  /** When set, group is chosen in the form (cluster weekly report pattern). */
  availableGroups?: EvangelismGroup[];
  /** Used to color cluster chips on the group picker. */
  clusters?: Cluster[];
  /** Group id to select before the matching object is available. */
  initialGroupId?: string | null;
  initialData?: EvangelismWeeklyReport | null;
  prospects?: Prospect[];
  onSubmit: (values: EvangelismWeeklyReportFormValues) => Promise<void>;
  onCancel: () => void;
  isSubmitting: boolean;
  error?: string | null;
}

/** Display list for members attended; includes coordinator alongside enrolled members. */
function personToMemberOption(person: Person): PersonUI {
  const middleInitial = person.middle_name
    ? ` ${person.middle_name.trim().charAt(0)}.`
    : "";
  const suffixPart =
    person.suffix && person.suffix.trim().length > 0
      ? ` ${person.suffix.trim()}`
      : "";
  const name = `${person.first_name ?? ""}${middleInitial} ${
    person.last_name ?? ""
  }${suffixPart}`.trim();
  return {
    ...person,
    name,
    dateFirstAttended: person.date_first_attended,
    id: person.id?.toString() || "",
  };
}

export default function EvangelismWeeklyReportForm({
  group = null,
  availableGroups,
  clusters = [],
  initialGroupId = null,
  initialData,
  prospects = [],
  onSubmit,
  onCancel,
  isSubmitting,
  error,
}: EvangelismWeeklyReportFormProps) {
  const [people, setPeople] = useState<PersonUI[]>([]);
  const [loadingPeople, setLoadingPeople] = useState(false);
  const [showAddVisitorModal, setShowAddVisitorModal] = useState(false);
  const [showAddProspectModal, setShowAddProspectModal] = useState(false);
  const [prospectSubmitting, setProspectSubmitting] = useState(false);
  const [prospectFormError, setProspectFormError] = useState<string | null>(
    null,
  );
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false);
  const [pendingNewVisitors, setPendingNewVisitors] = useState<
    Record<string, Partial<Person> & { note?: string }>
  >({});
  const [pendingNewProspects, setPendingNewProspects] = useState<
    Record<string, EvangelismReportNewInvitedProspectInput>
  >({});
  const [selectedGroupId, setSelectedGroupId] = useState(() =>
    group?.id != null
      ? String(group.id)
      : initialGroupId
        ? String(initialGroupId)
        : "",
  );
  const [rosterGroup, setRosterGroup] = useState<EvangelismGroup | null>(
    group ?? null,
  );
  const [loadingRoster, setLoadingRoster] = useState(false);
  const [groupProspects, setGroupProspects] = useState<Prospect[]>(prospects);
  const [groupFieldError, setGroupFieldError] = useState<string | null>(null);
  const [previouslyAttendedVisitorIds, setPreviouslyAttendedVisitorIds] =
    useState<string[]>([]);
  const [mostRecentAttendedVisitorIds, setMostRecentAttendedVisitorIds] =
    useState<string[]>([]);
  const rosterCacheRef = useRef<Record<string, EvangelismGroup>>({});
  const skipAttendanceResetRef = useRef(true);

  const showGroupPicker = Array.isArray(availableGroups);
  const groupPickerLocked = Boolean(initialData);

  const groupSelectOptions = useMemo(
    () => [
      { value: "", label: "Select group..." },
      ...(availableGroups ?? []).map((g) => ({
        value: String(g.id),
        label: g.name || `Group ${g.id}`,
        ...groupClusterChip(g, clusters),
      })),
    ],
    [availableGroups, clusters],
  );

  const selectedGroup = useMemo(() => {
    if (!selectedGroupId) return null;
    const fromAvailable = availableGroups?.find(
      (g) => String(g.id) === selectedGroupId,
    );
    if (fromAvailable) return fromAvailable;
    if (group && String(group.id) === selectedGroupId) return group;
    return null;
  }, [selectedGroupId, availableGroups, group]);

  const todayIsoParts = getIsoWeekParts(new Date());
  const defaultDate = new Date().toISOString().split("T")[0];
  const [formData, setFormData] = useState<EvangelismWeeklyReportFormValues>({
    evangelism_group_id: group?.id != null ? String(group.id) : "",
    year: todayIsoParts.year,
    week_number: todayIsoParts.week,
    meeting_date: defaultDate,
    members_attended: [],
    visitors_attended: [],
    prospects_invited: [],
    gathering_type: "PHYSICAL",
    topic: "",
    activities_held: "",
    prayer_requests: "",
    testimonies: "",
    notes: "",
  });

  useEffect(() => {
    if (group?.id != null) {
      setSelectedGroupId(String(group.id));
    } else if (initialGroupId) {
      setSelectedGroupId(String(initialGroupId));
    }
  }, [group?.id, initialGroupId]);

  useEffect(() => {
    if (!initialData) return;
    const groupId =
      group?.id != null
        ? String(group.id)
        : String(initialData.evangelism_group?.id ?? "");
    if (groupId) setSelectedGroupId(groupId);
    setFormData({
      evangelism_group_id: groupId,
      year: initialData.year,
      week_number: initialData.week_number,
      meeting_date: initialData.meeting_date,
      members_attended: (initialData.members_attended || []).map(String),
      visitors_attended: (initialData.visitors_attended || []).map(String),
      prospects_invited: (initialData.prospects_invited || []).map(String),
      gathering_type: initialData.gathering_type,
      topic: initialData.topic || "",
      activities_held: initialData.activities_held || "",
      prayer_requests: initialData.prayer_requests || "",
      testimonies: initialData.testimonies || "",
      notes: initialData.notes || "",
    });
  }, [group?.id, initialData]);

  useEffect(() => {
    if (skipAttendanceResetRef.current) {
      skipAttendanceResetRef.current = false;
      return;
    }
    if (initialData) return;
    setFormData((prev) => ({
      ...prev,
      evangelism_group_id: selectedGroupId,
      members_attended: [],
      visitors_attended: [],
      prospects_invited: [],
    }));
    setPendingNewVisitors({});
    setPendingNewProspects({});
    setGroupFieldError(null);
  }, [selectedGroupId, initialData]);

  // Lazy-load full member roster when the selected group lacks person members.
  useEffect(() => {
    setFormData((prev) =>
      prev.evangelism_group_id === selectedGroupId
        ? prev
        : { ...prev, evangelism_group_id: selectedGroupId },
    );

    if (!selectedGroupId) {
      setRosterGroup(null);
      setLoadingRoster(false);
      return;
    }

    const cached = rosterCacheRef.current[selectedGroupId];
    if (cached && groupHasPersonRoster(cached)) {
      setRosterGroup(cached);
      setLoadingRoster(false);
      return;
    }

    if (selectedGroup && groupHasPersonRoster(selectedGroup)) {
      rosterCacheRef.current[selectedGroupId] = selectedGroup;
      setRosterGroup(selectedGroup);
      setLoadingRoster(false);
      return;
    }

    let cancelled = false;
    setLoadingRoster(true);
    if (selectedGroup) setRosterGroup(selectedGroup);

    (async () => {
      try {
        const { data } = await evangelismApi.getGroup(selectedGroupId);
        if (cancelled) return;
        rosterCacheRef.current[String(data.id)] = data;
        setRosterGroup(data);
      } catch (err) {
        console.error("Error loading evangelism group roster:", err);
      } finally {
        if (!cancelled) setLoadingRoster(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedGroupId, selectedGroup]);

  useEffect(() => {
    if (!selectedGroupId) {
      setGroupProspects([]);
      return;
    }
    let cancelled = false;
    evangelismApi
      .getAllProspects({ evangelism_group: selectedGroupId })
      .then((res) => {
        const raw = res.data;
        const arr = Array.isArray(raw)
          ? raw
          : ((raw as { results?: Prospect[] }).results ?? []);
        if (!cancelled) setGroupProspects(arr);
      })
      .catch(() => {
        if (!cancelled) setGroupProspects([]);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedGroupId]);

  useEffect(() => {
    if (!selectedGroupId) {
      setPreviouslyAttendedVisitorIds([]);
      setMostRecentAttendedVisitorIds([]);
      return;
    }
    let cancelled = false;
    const params: {
      year: number;
      week_number: number;
      exclude_report?: string;
    } = {
      year: formData.year,
      week_number: formData.week_number,
    };
    if (initialData?.id != null) {
      params.exclude_report = String(initialData.id);
    }
    evangelismApi
      .getGroupPreviousVisitors(selectedGroupId, params)
      .then((res) => {
        if (cancelled) return;
        setPreviouslyAttendedVisitorIds(
          (res.data.previously_attended_visitor_ids || []).map(String),
        );
        setMostRecentAttendedVisitorIds(
          (res.data.most_recent_visitor_ids || []).map(String),
        );
      })
      .catch(() => {
        if (!cancelled) {
          setPreviouslyAttendedVisitorIds([]);
          setMostRecentAttendedVisitorIds([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [selectedGroupId, formData.year, formData.week_number, initialData?.id]);

  useEffect(() => {
    const fetchPeople = async () => {
      try {
        setLoadingPeople(true);
        const response = await peopleApi.getAll({ for_report: true });
        const peopleUI: PersonUI[] = response.data
          .filter(isSelectablePerson)
          .map((p) => {
            const middleInitial = p.middle_name
              ? ` ${p.middle_name.trim().charAt(0)}.`
              : "";
            const suffixPart =
              p.suffix && p.suffix.trim().length > 0
                ? ` ${p.suffix.trim()}`
                : "";
            const name = `${p.first_name ?? ""}${middleInitial} ${
              p.last_name ?? ""
            }${suffixPart}`.trim();
            return {
              ...p,
              name,
              dateFirstAttended: p.date_first_attended,
              id: p.id?.toString() || "",
            };
          });
        setPeople(peopleUI);
      } catch (err) {
        console.error("Error loading people:", err);
      } finally {
        setLoadingPeople(false);
      }
    };
    fetchPeople();
  }, []);

  const allowedMemberIds = useMemo(() => {
    const inlineIds =
      rosterGroup?.members?.map((member) => String(member.id)) || [];
    const coordinatorIds = rosterGroup?.coordinator?.id
      ? [String(rosterGroup.coordinator.id)]
      : [];
    return Array.from(new Set([...inlineIds, ...coordinatorIds]));
  }, [rosterGroup?.members, rosterGroup?.coordinator?.id]);

  const coordinatorOption = useMemo(
    () =>
      rosterGroup?.coordinator
        ? personToMemberOption(rosterGroup.coordinator as Person)
        : null,
    [rosterGroup?.coordinator],
  );

  const memberOptions = useMemo(() => {
    const inlineMembers =
      rosterGroup?.members?.map((member) => personToMemberOption(member)) || [];

    const combined = [...people, ...inlineMembers];
    if (coordinatorOption) {
      const hasCoordinator = combined.some(
        (p) => p.id === coordinatorOption.id,
      );
      if (!hasCoordinator) {
        combined.unshift(coordinatorOption);
      }
    }
    const seen = new Set<string>();
    return combined.filter((person) => {
      if (!person.id || seen.has(person.id)) return false;
      seen.add(person.id);
      return true;
    });
  }, [coordinatorOption, rosterGroup?.members, people]);

  const invitedProspectIdsSelected = useMemo(
    () => new Set((formData.prospects_invited || []).map(String)),
    [formData.prospects_invited],
  );

  const groupInvitedProspects = useMemo(
    () =>
      selectedGroupId
        ? groupProspects.filter((prospect) =>
            isInvitableProspect(prospect, selectedGroupId),
          )
        : [],
    [groupProspects, selectedGroupId],
  );

  const visitorOptions = useMemo(() => {
    const attendedById = new Map<string, PersonUI>();
    const stampInviter = (person: PersonUI): PersonUI => {
      if (person.inviter_display_name?.trim()) return person;
      const name = inviterDisplayNameFromPeople(person.inviter, people);
      return name ? { ...person, inviter_display_name: name } : person;
    };

    const addAttendedPerson = (person: Person | PersonUI) => {
      if (person.role !== "VISITOR") return;
      const id = person.id?.toString() || "";
      if (!id || attendedById.has(id)) return;
      const firstAttended =
        person.date_first_attended ??
        ("dateFirstAttended" in person ? person.dateFirstAttended : null);
      attendedById.set(
        id,
        stampInviter({
          ...person,
          name: formatPersonName(person),
          dateFirstAttended: firstAttended,
          id,
        } as PersonUI),
      );
    };

    for (const person of people) {
      addAttendedPerson(person);
    }
    for (const prospect of groupProspects) {
      if (prospect.person) addAttendedPerson(prospect.person as Person);
    }
    for (const detail of initialData?.visitors_attended_details || []) {
      addAttendedPerson(detail as Person);
    }

    const prospectOptions = groupInvitedProspects
      .filter((p) => !invitedProspectIdsSelected.has(String(p.id)))
      .map((p) => prospectToPersonUI(p, people));

    const pendingVisitorOptions: PersonUI[] = Object.entries(
      pendingNewVisitors,
    ).map(([tempId, payload]) => {
      const middleInitial = payload.middle_name
        ? ` ${payload.middle_name.trim().charAt(0)}.`
        : "";
      const suffixPart =
        payload.suffix && payload.suffix.trim().length > 0
          ? ` ${payload.suffix.trim()}`
          : "";
      const name = `${payload.first_name ?? ""}${middleInitial} ${
        payload.last_name ?? ""
      }${suffixPart} (new)`.trim();
      return {
        id: `newvisitor:${tempId}`,
        name,
        role: "VISITOR" as const,
        status: "ONGOING" as const,
        first_name: payload.first_name || "",
        last_name: payload.last_name || "",
        middle_name: payload.middle_name || "",
        suffix: payload.suffix || "",
        inviter: payload.inviter,
        inviter_display_name:
          inviterDisplayNameFromPeople(payload.inviter, people) || null,
        username: "",
        email: "",
      } as PersonUI;
    });

    return [
      ...Array.from(attendedById.values()),
      ...prospectOptions,
      ...pendingVisitorOptions,
    ];
  }, [
    people,
    groupProspects,
    groupInvitedProspects,
    invitedProspectIdsSelected,
    pendingNewVisitors,
    initialData?.visitors_attended_details,
  ]);

  const prospectInviteOptions = useMemo(() => {
    const attendedProspectIds = new Set(
      (formData.visitors_attended || [])
        .filter((id) => isProspectAttendanceId(String(id)))
        .map((id) => prospectIdFromAttendanceId(String(id))),
    );
    const byId = new Map<string, PersonUI>();

    for (const p of groupInvitedProspects) {
      if (attendedProspectIds.has(String(p.id))) continue;
      const ui = prospectToPersonUI(p, people);
      byId.set(String(ui.id), ui);
    }

    for (const detail of initialData?.prospects_invited_details || []) {
      const attendanceId = toProspectAttendanceId(detail.id);
      if (attendedProspectIds.has(String(detail.id))) continue;
      if (byId.has(attendanceId)) continue;
      const nestedInviterName =
        detail.invited_by != null
          ? `${detail.invited_by.first_name ?? ""} ${
              detail.invited_by.last_name ?? ""
            }`.trim()
          : "";
      const invitedBy =
        nestedInviterName ||
        inviterDisplayNameFromPeople(detail.invited_by?.id, people);
      const stageLabel =
        detail.pipeline_stage_display || detail.pipeline_stage || "INVITED";
      let displayName = detail.display_name?.trim() || "";
      if (!displayName) {
        displayName = formatPersonName(detail);
      }
      byId.set(attendanceId, {
        id: attendanceId,
        name: `${displayName || "Unknown"} (${stageLabel.toLowerCase()})`,
        role: "VISITOR",
        status: "NO_RESPONSE",
        inviter: detail.invited_by?.id,
        inviter_display_name: invitedBy || null,
        username: "",
        email: "",
        first_name: detail.first_name || "",
        last_name: detail.last_name || "",
      } as unknown as PersonUI);
    }

    const pendingOptions: PersonUI[] = Object.entries(pendingNewProspects).map(
      ([tempId, payload]) =>
        ({
          id: toPendingNewProspectId(tempId),
          name: `${payload.first_name} ${payload.last_name} (new invite)`.trim(),
          role: "VISITOR",
          status: "NO_RESPONSE",
          inviter: payload.invited_by_id,
          inviter_display_name:
            inviterDisplayNameFromPeople(payload.invited_by_id, people) || null,
          username: "",
          email: "",
          first_name: payload.first_name,
          last_name: payload.last_name,
        }) as unknown as PersonUI,
    );
    for (const opt of pendingOptions) {
      byId.set(String(opt.id), opt);
    }
    return Array.from(byId.values());
  }, [
    groupInvitedProspects,
    formData.visitors_attended,
    pendingNewProspects,
    initialData?.prospects_invited_details,
    people,
  ]);

  const prospectAllowedIds = useMemo(
    () => prospectInviteOptions.map((p) => String(p.id)),
    [prospectInviteOptions],
  );

  const invitersForProspectForm = useMemo(
    () =>
      memberOptions.filter((p) => p.role !== "VISITOR" && p.role !== "ADMIN"),
    [memberOptions],
  );

  const prospectOptionsForForm = useMemo(() => {
    const fromPending: Prospect[] = Object.entries(pendingNewProspects).map(
      ([tempId, payload]) =>
        ({
          id: `pending:${tempId}`,
          first_name: payload.first_name,
          last_name: payload.last_name,
          middle_name: payload.middle_name || "",
          contact_info: payload.contact_info || "",
          facebook_name: payload.facebook_name || "",
          pipeline_stage: "INVITED",
          pipeline_stage_display: "Invited",
          is_dropped_off: false,
          is_attending_cluster: false,
          has_finished_lessons: false,
          commitment_form_signed: false,
          invited_by: {} as Person,
          invited_by_id: String(payload.invited_by_id || ""),
          created_at: "",
          updated_at: "",
          display_name: `${payload.first_name} ${payload.last_name}`.trim(),
        }) as Prospect,
    );
    return [...groupInvitedProspects, ...fromPending];
  }, [groupInvitedProspects, pendingNewProspects]);

  const handleVisitorsChange = (ids: string[]) => {
    const prospectIdsSelected = ids
      .filter((id) => isProspectAttendanceId(id))
      .map((id) => prospectIdFromAttendanceId(id));
    setFormData((prev) => ({
      ...prev,
      visitors_attended: ids,
      prospects_invited: (prev.prospects_invited || []).filter(
        (id) => !prospectIdsSelected.includes(String(id)),
      ),
    }));
  };

  const handleProspectsInvitedChange = (ids: string[]) => {
    const numericOrPending = ids.map((id) =>
      isProspectAttendanceId(id) ? prospectIdFromAttendanceId(id) : id,
    );
    const blockedFromVisitors = new Set(
      numericOrPending
        .filter((id) => !String(id).startsWith("new:"))
        .map((id) => toProspectAttendanceId(id)),
    );
    setFormData((prev) => ({
      ...prev,
      prospects_invited: numericOrPending,
      visitors_attended: (prev.visitors_attended || []).filter(
        (id) => !blockedFromVisitors.has(String(id)),
      ),
    }));
  };

  const handleAddProspect = async (values: ProspectFormValues) => {
    setProspectSubmitting(true);
    setProspectFormError(null);
    try {
      const tempId =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `tmp-${Date.now()}`;
      const payload: EvangelismReportNewInvitedProspectInput = {
        first_name: values.first_name,
        last_name: values.last_name,
        middle_name: values.middle_name || "",
        suffix: values.suffix || "",
        gender: values.gender || "",
        contact_info: values.contact_info || "",
        facebook_name: values.facebook_name || "",
        notes: values.notes || "",
        invited_by_id: values.invited_by_id,
        date_first_invited:
          values.date_first_invited || formData.meeting_date || null,
      };
      setPendingNewProspects((prev) => ({ ...prev, [tempId]: payload }));
      setFormData((prev) => ({
        ...prev,
        prospects_invited: [
          ...(prev.prospects_invited || []),
          toPendingNewProspectId(tempId),
        ],
      }));
      setShowAddProspectModal(false);
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : "Failed to add prospect to this report";
      setProspectFormError(message);
    } finally {
      setProspectSubmitting(false);
    }
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (showAddVisitorModal || showAddProspectModal || duplicateDialogOpen) {
      return;
    }
    if (!formData.evangelism_group_id) {
      setGroupFieldError("Please select an evangelism group.");
      return;
    }
    setGroupFieldError(null);
    const pendingEntries = Object.entries(pendingNewVisitors);
    let visitorsAttended = [...formData.visitors_attended];

    if (pendingEntries.length > 0) {
      const idMap = new Map<string, string>();
      for (const [tempId, payload] of pendingEntries) {
        const created = await peopleApi.create(payload);
        const realId = String(created.data.id);
        idMap.set(`newvisitor:${tempId}`, realId);
        const middleInitial = created.data.middle_name
          ? ` ${created.data.middle_name.trim().charAt(0)}.`
          : "";
        const suffixPart =
          created.data.suffix && created.data.suffix.trim().length > 0
            ? ` ${created.data.suffix.trim()}`
            : "";
        const name = `${created.data.first_name ?? ""}${middleInitial} ${
          created.data.last_name ?? ""
        }${suffixPart}`.trim();
        setPeople((prev) => [
          ...prev,
          {
            ...created.data,
            name,
            dateFirstAttended: created.data.date_first_attended,
            id: realId,
          },
        ]);
      }
      visitorsAttended = visitorsAttended.map((id) => idMap.get(id) || id);
      setPendingNewVisitors({});
    }

    try {
      await onSubmit({
        ...formData,
        visitors_attended: visitorsAttended,
        pending_new_prospects: pendingNewProspects,
      });
    } catch (err: unknown) {
      if (isDuplicateMeetingReportError(err)) {
        setDuplicateDialogOpen(true);
        return;
      }
      throw err;
    }
  };

  const handleAddVisitor = async (
    visitorData: Partial<Person> & { note?: string },
  ) => {
    const tempId =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `tmp-${Date.now()}`;
    const pendingId = `newvisitor:${tempId}`;
    setPendingNewVisitors((prev) => ({ ...prev, [tempId]: visitorData }));
    setFormData((prev) => ({
      ...prev,
      visitors_attended: [...prev.visitors_attended, pendingId],
    }));
    return {
      id: pendingId,
      first_name: visitorData.first_name || "",
      last_name: visitorData.last_name || "",
      middle_name: visitorData.middle_name,
      suffix: visitorData.suffix,
      role: "VISITOR" as const,
      status: "ONGOING" as const,
    } as Person;
  };

  return (
    <>
      <form
        className="space-y-6"
        onSubmit={handleSubmit}
        onKeyDown={(e) => {
          if (
            e.key === "Enter" &&
            (showAddVisitorModal || showAddProspectModal || duplicateDialogOpen)
          ) {
            e.preventDefault();
            e.stopPropagation();
          }
        }}
      >
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        {showGroupPicker && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Evangelism group *
            </label>
            <ScalableSelect
              value={selectedGroupId}
              options={groupSelectOptions}
              onChange={(value) => {
                setSelectedGroupId(value);
                setGroupFieldError(null);
              }}
              disabled={groupPickerLocked}
              placeholder="Select group..."
              searchPlaceholder="Search groups…"
              emptyMessage="No groups found"
              className="w-full min-w-0 text-sm"
            />
            {groupFieldError && (
              <p className="mt-1 text-sm text-red-600">{groupFieldError}</p>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Year
            </label>
            <input
              type="number"
              value={formData.year}
              readOnly
              tabIndex={-1}
              className="w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 min-h-[44px] text-sm text-gray-600"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Week Number
            </label>
            <input
              type="number"
              value={formData.week_number}
              readOnly
              tabIndex={-1}
              className="w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 min-h-[44px] text-sm text-gray-600"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Meeting Date
            </label>
            <input
              type="date"
              value={formData.meeting_date}
              onChange={(e) => {
                const value = e.target.value;
                setFormData((prev) => {
                  const next = { ...prev, meeting_date: value };
                  const parts = getIsoWeekPartsFromDateString(value);
                  if (parts) {
                    next.year = parts.year;
                    next.week_number = parts.week;
                  }
                  return next;
                });
              }}
              className="w-full rounded-md border border-gray-200 px-3 py-2 min-h-[44px] text-sm"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Gathering Type
            </label>
            <select
              value={formData.gathering_type}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  gathering_type: e.target
                    .value as EvangelismWeeklyReportFormValues["gathering_type"],
                }))
              }
              className="w-full rounded-md border border-gray-200 px-3 py-2 min-h-[44px] text-sm"
            >
              <option value="PHYSICAL">Physical</option>
              <option value="ONLINE">Online</option>
              <option value="HYBRID">Hybrid</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Topic
            </label>
            <input
              type="text"
              value={formData.topic || ""}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, topic: e.target.value }))
              }
              className="w-full rounded-md border border-gray-200 px-3 py-2 min-h-[44px] text-sm"
              placeholder="Topic or lesson..."
            />
          </div>
        </div>

        <div className="space-y-4">
          <AttendanceSelector
            label="Members Attended"
            selectedIds={formData.members_attended}
            availablePeople={memberOptions}
            filterRole="MEMBER"
            onSelectionChange={(ids) =>
              setFormData((prev) => ({ ...prev, members_attended: ids }))
            }
            allowedIds={allowedMemberIds}
            isLoadingRoster={
              loadingRoster || (showGroupPicker && !selectedGroupId)
            }
          />
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">
                Visitors Attended
              </label>
              <Button
                type="button"
                variant="primary"
                className="text-sm py-1.5 px-3"
                onClick={() => setShowAddVisitorModal(true)}
                disabled={!selectedGroupId}
              >
                + Add New Visitor
              </Button>
            </div>
            <p className="text-xs text-gray-500 mb-2">
              People who came this week. Search returning visitors or invited
              prospects first. Use Add New Visitor only if they came and are not
              in the list.
            </p>
            <AttendanceSelector
              label=""
              selectedIds={formData.visitors_attended}
              availablePeople={visitorOptions}
              filterRole="VISITOR"
              onSelectionChange={handleVisitorsChange}
              className="mt-0"
              previouslyAttendedIds={previouslyAttendedVisitorIds}
              mostRecentAttendedIds={mostRecentAttendedVisitorIds}
              autoSelectScopeId={selectedGroupId || undefined}
              groupByVisitorKind
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">
                Prospects Invited
              </label>
              <Button
                type="button"
                variant="secondary"
                className="!text-white !bg-orange-600 hover:!bg-orange-700 disabled:!bg-gray-300 disabled:!text-gray-500 disabled:hover:!bg-gray-300 text-sm py-1.5 px-3"
                disabled={!selectedGroupId}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowAddProspectModal(true);
                }}
              >
                + Add Prospect
              </Button>
            </div>
            <p className="text-xs text-gray-500 mb-2">
              Invited visitors only — not yet attended. They are not added to
              People until they attend.
            </p>
            <AttendanceSelector
              label=""
              selectedIds={(formData.prospects_invited || []).map((id) => {
                const sid = String(id);
                if (sid.startsWith("new:")) return sid;
                return toProspectAttendanceId(sid);
              })}
              availablePeople={prospectInviteOptions}
              filterRole="VISITOR"
              onSelectionChange={handleProspectsInvitedChange}
              className="mt-0"
              allowedIds={prospectAllowedIds}
            />
          </div>
          {(loadingPeople || loadingRoster) && (
            <div className="text-xs text-gray-500">
              {loadingRoster ? "Loading members…" : "Loading people..."}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Activities Held
            </label>
            <textarea
              value={formData.activities_held || ""}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  activities_held: e.target.value,
                }))
              }
              rows={2}
              placeholder="Describe activities or events held during the evangelism meeting..."
              className="w-full rounded-md border border-gray-200 px-3 py-2 min-h-[44px] text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Prayer Requests
            </label>
            <textarea
              value={formData.prayer_requests || ""}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  prayer_requests: e.target.value,
                }))
              }
              rows={2}
              placeholder="List prayer requests shared during the meeting..."
              className="w-full rounded-md border border-gray-200 px-3 py-2 min-h-[44px] text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Testimonies
            </label>
            <textarea
              value={formData.testimonies || ""}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  testimonies: e.target.value,
                }))
              }
              rows={2}
              placeholder="Share testimonies or encouraging stories..."
              className="w-full rounded-md border border-gray-200 px-3 py-2 min-h-[44px] text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes
            </label>
            <textarea
              value={formData.notes || ""}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, notes: e.target.value }))
              }
              rows={3}
              placeholder="Additional notes, highlights, or concerns..."
              className="w-full rounded-md border border-gray-200 px-3 py-2 min-h-[44px] text-sm"
            />
          </div>
        </div>

        <div className="mt-8 flex w-full flex-col-reverse sm:flex-row gap-3 border-t border-gray-200 pt-4">
          <Button
            variant="tertiary"
            className="flex-1 min-h-[44px] rounded-md border border-[#d9d9d9] bg-white px-4 py-2.5 text-sm font-medium text-[#262626] shadow-none hover:bg-gray-50 md:min-h-0"
            onClick={onCancel}
            disabled={isSubmitting}
            type="button"
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            className="flex-1 min-h-[44px] rounded-md bg-[#2f68e6] px-4 py-2.5 text-sm font-medium text-white shadow-none hover:bg-[#255adb] md:min-h-0"
            disabled={isSubmitting || !formData.evangelism_group_id}
            type="submit"
          >
            {isSubmitting ? "Saving..." : "Submit Report"}
          </Button>
        </div>

        <AddVisitorModal
          isOpen={showAddVisitorModal}
          onClose={() => setShowAddVisitorModal(false)}
          onAdd={handleAddVisitor}
          defaultDateFirstAttended={formData.meeting_date}
          defaultFirstActivityAttended="BS/CLUSTER_EVANGELISM"
          forReport
        />

        <Modal
          isOpen={showAddProspectModal}
          onClose={() => {
            setShowAddProspectModal(false);
            setProspectFormError(null);
          }}
          title="Add Prospect"
          closeOnOutsideClick={false}
        >
          <p className="text-sm text-gray-600 mb-4">
            Invited visitors only — not yet attended. They are not added to
            People until they attend.
          </p>
          <ProspectForm
            inviters={invitersForProspectForm as unknown as Person[]}
            groups={selectedGroup ? [selectedGroup] : []}
            prospectOptions={prospectOptionsForForm}
            selectedBibleStudyGroup={selectedGroup ?? undefined}
            defaultGroupId={selectedGroupId}
            onSubmit={handleAddProspect}
            onCancel={() => {
              setShowAddProspectModal(false);
              setProspectFormError(null);
            }}
            isSubmitting={prospectSubmitting}
            error={prospectFormError}
            submitLabel="Add Prospect"
          />
        </Modal>
      </form>
      <ConfirmationModal
        isOpen={duplicateDialogOpen}
        onClose={() => setDuplicateDialogOpen(false)}
        onConfirm={() => setDuplicateDialogOpen(false)}
        title="Report already submitted"
        message={`A report for ${
          selectedGroup?.name?.trim() || "this evangelism group"
        } on ${formData.meeting_date || "this date"} already exists. Choose a different date.`}
        confirmText="OK"
        cancelText="Go back"
        variant="warning"
        zIndex={80}
      />
    </>
  );
}
