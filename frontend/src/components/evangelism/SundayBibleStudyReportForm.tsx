"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import {
  branchesApi,
  evangelismApi,
  eventTypesApi,
  peopleApi,
} from "@/src/lib/api";
import { Branch } from "@/src/types/branch";
import { Prospect } from "@/src/types/evangelism";
import { EventTypeOption } from "@/src/types/event";
import { Person, PersonUI } from "@/src/types/person";
import { activityEventTypes } from "@/src/lib/events/activityTypes";
import {
  SUNDAY_PROGRESS_OPTIONS,
  SundayBibleStudyNewVisitorInput,
  SundayBibleStudyProgress,
  SundayBibleStudyReport,
  SundayBibleStudyReportWrite,
  SundaySessionType,
  SundayVisitorKind,
} from "@/src/types/sundayBibleStudy";
import { formatPersonName } from "@/src/lib/name";
import {
  isSelectablePerson,
  personDropdownChips,
} from "@/src/lib/peopleSelectors";
import {
  CLUSTER_CODE_BADGE_CLASSNAME,
  getClusterCodeBadgeStyle,
} from "@/src/lib/branchChipColor";
import {
  formatPersonStatusLabel,
  getPersonStatusColor,
} from "@/src/lib/personStatus";
import {
  formatPipelineStageLabel,
  prospectClusterLabel,
} from "@/src/lib/prospectDisplay";
import {
  isoWeekLabel,
  mostRecentSunday,
} from "@/src/components/evangelism/sundayBibleStudyDates";
import AddVisitorModal from "@/src/components/reports/AddVisitorModal";
import AttendanceSelector from "@/src/components/reports/AttendanceSelector";
import Button from "@/src/components/ui/Button";
import ConfirmationModal from "@/src/components/ui/ConfirmationModal";
import ScalableSelect from "@/src/components/ui/ScalableSelect";
import SearchableSelect from "@/src/components/ui/SearchableSelect";
import { useAuth } from "@/src/contexts/AuthContext";

interface FacilitatorRow {
  personId: number;
  name: string;
  isLead: boolean;
}

interface VisitorMatch {
  key: string;
  kind: "person" | "prospect";
  personId?: number;
  prospectId?: number;
  name: string;
  inviterId: number | null;
  dateFirstAttended?: string | null;
  firstActivityAttended?: string | null;
  status?: string | null;
  statusLabel?: string | null;
  statusClassName?: string | null;
  clusterCode?: string | null;
  clusterBranchId?: number | null;
  evangelismGroupCode?: string | null;
}

interface VisitorRow {
  key: string;
  personId?: number;
  name: string;
  kind: SundayVisitorKind;
  progress: SundayBibleStudyProgress;
  note: string;
  inviterId: number | null;
  dateFirstAttended?: string | null;
  firstActivityAttended?: string | null;
  /** True when this person/prospect still needs first-attendance details. */
  captureFirstAttendance?: boolean;
  pending?: SundayBibleStudyNewVisitorInput;
}

interface SundayBibleStudyReportFormProps {
  report?: SundayBibleStudyReport | null;
  onSaved: (report: SundayBibleStudyReport) => void;
  onCancel: () => void;
}

const inputClass =
  "mt-1 min-h-[44px] w-full rounded-md border border-gray-300 px-3";
const labelClass = "block text-sm font-medium text-gray-700";
const textAreaClass =
  "mt-1 min-h-[88px] w-full rounded-md border border-gray-300 px-3 py-2";

function toPersonUI(person: Person): PersonUI {
  return { ...person, name: formatPersonName(person) || person.username };
}

type VisitorCardTone = "prospect" | "new" | "returning" | "first";

function visitorCardTone(row: VisitorRow): VisitorCardTone {
  if (row.pending?.prospect_id) return "prospect";
  if (row.pending) return "new";
  if (row.kind === "RETURNING") return "returning";
  return "first";
}

const VISITOR_CARD_STYLES: Record<
  VisitorCardTone,
  { card: string; badge: string; label: string }
> = {
  prospect: {
    card: "border-orange-200 bg-orange-50/70",
    badge: "bg-orange-100 text-orange-800",
    label: "Prospect",
  },
  new: {
    card: "border-green-200 bg-green-50/70",
    badge: "bg-green-100 text-green-800",
    label: "New visitor",
  },
  returning: {
    card: "border-purple-200 bg-purple-50/70",
    badge: "bg-purple-100 text-purple-800",
    label: "Returning",
  },
  first: {
    card: "border-sky-200 bg-sky-50/70",
    badge: "bg-sky-100 text-sky-800",
    label: "First time",
  },
};

function missingFirstAttendance(
  dateFirstAttended?: string | null,
  firstActivityAttended?: string | null,
): boolean {
  return (
    !String(dateFirstAttended || "").trim() ||
    !String(firstActivityAttended || "").trim()
  );
}

function shouldShowFirstAttendanceFields(row: VisitorRow): boolean {
  if (row.kind !== "RETURNING") return false;
  if (row.pending?.prospect_id) return true;
  if (row.captureFirstAttendance) return true;
  return missingFirstAttendance(
    row.pending?.date_first_attended ?? row.dateFirstAttended,
    row.pending?.first_activity_attended ?? row.firstActivityAttended,
  );
}

function prospectName(prospect: Prospect): string {
  if (prospect.display_name?.trim()) return prospect.display_name.trim();
  return (
    [prospect.first_name, prospect.middle_name, prospect.last_name]
      .filter(Boolean)
      .join(" ")
      .trim() || `Prospect ${prospect.id}`
  );
}

function apiError(error: unknown): string {
  const data = (
    error as {
      response?: {
        data?: { details?: Record<string, unknown>; message?: string };
      };
    }
  )?.response?.data;
  if (!data) return "Could not save the report.";
  if (data.details && typeof data.details === "object") {
    return Object.entries(data.details)
      .map(([key, value]) => {
        const text = Array.isArray(value) ? value.join(" ") : String(value);
        return `${key}: ${text}`;
      })
      .join(" ");
  }
  return data.message || "Could not save the report.";
}

export default function SundayBibleStudyReportForm({
  report,
  onSaved,
  onCancel,
}: SundayBibleStudyReportFormProps) {
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchId, setBranchId] = useState(
    report?.branch
      ? String(report.branch)
      : user?.branch != null
        ? String(user.branch)
        : "",
  );
  const [sessionDate, setSessionDate] = useState(
    report?.session_date || mostRecentSunday(),
  );
  const [sessionType, setSessionType] = useState<SundaySessionType>(
    report?.session_type ?? "BEFORE_SERVICE",
  );
  const [gatheringType, setGatheringType] = useState(
    report?.gathering_type ?? "PHYSICAL",
  );
  const [cancelled, setCancelled] = useState(Boolean(report?.cancelled));
  const [cancellationReason, setCancellationReason] = useState(
    report?.cancellation_reason ?? "",
  );
  const [topic, setTopic] = useState(report?.topic ?? "");
  const [scripture, setScripture] = useState(report?.scripture_reference ?? "");
  const [flow, setFlow] = useState(report?.study_summary ?? "");
  const [observation, setObservation] = useState(report?.observation ?? "");
  const [testimonies, setTestimonies] = useState(report?.testimonies ?? "");
  const [prayerRequests, setPrayerRequests] = useState(
    report?.prayer_requests ?? "",
  );
  const [notes, setNotes] = useState(report?.notes ?? "");
  const [facilitators, setFacilitators] = useState<FacilitatorRow[]>(
    (report?.facilitator_details ?? []).map((row) => ({
      personId: row.person_id,
      name: row.name,
      isLead: row.is_lead,
    })),
  );
  const [memberIds, setMemberIds] = useState<string[]>(
    (report?.members_attended ?? []).map(String),
  );
  const [visitors, setVisitors] = useState<VisitorRow[]>(
    (report?.visitor_details ?? []).map((row) => ({
      key: `person-${row.person_id}`,
      personId: row.person_id,
      name: row.name,
      kind: row.attendance_kind,
      progress: row.progress || "",
      note: row.note,
      inviterId: row.inviter_id,
    })),
  );
  const [roster, setRoster] = useState<
    {
      id: number;
      name: string;
      status?: string | null;
      branch?: number | null;
      cluster_codes?: string[] | null;
    }[]
  >([]);
  const [members, setMembers] = useState<PersonUI[]>([]);
  const [membersLoading, setMembersLoading] = useState(true);
  const [visitorQuery, setVisitorQuery] = useState("");
  const [visitorMatches, setVisitorMatches] = useState<VisitorMatch[]>([]);
  const [visitorDropdownOpen, setVisitorDropdownOpen] = useState(false);
  const [visitorSearching, setVisitorSearching] = useState(false);
  const visitorSearchRef = useRef<HTMLDivElement>(null);
  const [showAddVisitor, setShowAddVisitor] = useState(false);
  const [visitorPendingRemove, setVisitorPendingRemove] = useState<{
    key: string;
    name: string;
    isProspect: boolean;
  } | null>(null);
  const [eventTypes, setEventTypes] = useState<EventTypeOption[]>([]);
  const activityTypes = useMemo(
    () => activityEventTypes(eventTypes),
    [eventTypes],
  );
  const [warnings, setWarnings] = useState<string[]>(
    report?.facilitator_warnings ?? [],
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [facilitatorPick, setFacilitatorPick] = useState("");

  useEffect(() => {
    if (!isAdmin) return;
    let cancelledLoad = false;
    const loadBranches = async () => {
      try {
        const response = await branchesApi.getAll({ is_active: true });
        if (cancelledLoad) return;
        setBranches(Array.isArray(response.data) ? response.data : []);
      } catch (err) {
        console.error(err);
      }
    };
    void loadBranches();
    return () => {
      cancelledLoad = true;
    };
  }, [isAdmin]);

  useEffect(() => {
    let cancelled = false;
    const loadEventTypes = async () => {
      try {
        const response = await eventTypesApi.list();
        if (!cancelled) setEventTypes(response.data);
      } catch (err) {
        console.error(err);
      }
    };
    void loadEventTypes();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelledLoad = false;
    const load = async () => {
      setMembersLoading(true);
      try {
        const facilitatorResponse =
          await evangelismApi.sundayBibleStudyFacilitators();
        if (cancelledLoad) return;
        setRoster(facilitatorResponse.data);

        // Admins must pick a branch before the attendee roster is meaningful.
        if (isAdmin && !branchId) {
          setMembers([]);
          if (!report) setMemberIds([]);
          return;
        }

        const peopleParams: {
          for_report: boolean;
          branch?: number | string;
        } = { for_report: true };
        if (isAdmin && branchId) {
          peopleParams.branch = branchId;
        }
        const peopleResponse = await peopleApi.getAll(peopleParams);
        if (cancelledLoad) return;
        const nextMembers = peopleResponse.data
          .filter(
            (person) =>
              isSelectablePerson(person) &&
              (person.role || "").toUpperCase() !== "VISITOR",
          )
          .map(toPersonUI);
        setMembers(nextMembers);
        if (isAdmin && !report) {
          const allowed = new Set(
            nextMembers.map((person) => String(person.id)),
          );
          setMemberIds((current) => current.filter((id) => allowed.has(id)));
        }
      } catch (err) {
        console.error(err);
      } finally {
        if (!cancelledLoad) setMembersLoading(false);
      }
    };
    void load();
    return () => {
      cancelledLoad = true;
    };
  }, [isAdmin, branchId, report]);

  const branchOptions = useMemo(
    () =>
      branches.map((branch) => ({
        value: String(branch.id),
        label: branch.name,
      })),
    [branches],
  );

  const canEditBranch = isAdmin && !report;

  const branchDisplayName = useMemo(() => {
    if (report?.branch_name?.trim()) return report.branch_name.trim();
    const fromList = branches.find((branch) => String(branch.id) === branchId);
    if (fromList?.name?.trim()) return fromList.name.trim();
    if (user?.branch_name?.trim()) return user.branch_name.trim();
    if (branchId) return `Branch #${branchId}`;
    return "—";
  }, [report?.branch_name, branches, branchId, user?.branch_name]);

  const facilitatorOptions = roster
    .filter((row) => !facilitators.some((item) => item.personId === row.id))
    .map((row) => {
      const { statusLabel, statusClassName, clusterCode, clusterBranchId } =
        personDropdownChips(row);
      return {
        value: String(row.id),
        label: row.name,
        statusLabel,
        statusClassName,
        clusterCode,
        clusterBranchId,
      };
    });

  const inviterOptions = useMemo(
    () =>
      members.map((person) => ({
        ...person,
        id: person.id,
        username: person.username || person.email || String(person.id),
      })),
    [members],
  );

  const addFacilitator = (value: string) => {
    const row = roster.find((item) => String(item.id) === value);
    if (!row) return;
    setFacilitators((current) => [
      ...current,
      {
        personId: row.id,
        name: row.name,
        isLead: current.length === 0,
      },
    ]);
    setFacilitatorPick("");
  };

  useEffect(() => {
    const query = visitorQuery.trim();
    if (query.length < 1) {
      setVisitorMatches([]);
      setVisitorSearching(false);
      setVisitorDropdownOpen(false);
      return;
    }

    let cancelled = false;
    setVisitorSearching(true);
    setVisitorDropdownOpen(true);
    const timer = window.setTimeout(async () => {
      try {
        const effectiveBranch =
          (isAdmin && branchId ? Number(branchId) : undefined) ??
          report?.branch ??
          user?.branch ??
          undefined;
        const [peopleResponse, prospectsResponse] = await Promise.all([
          peopleApi.list({
            role: "VISITOR",
            search: query,
            page_size: 8,
            for_report: true,
            ...(isAdmin && branchId ? { branch: branchId } : {}),
          }),
          evangelismApi.getAllProspects({
            search: query,
            for_branch_report: effectiveBranch,
            page_size: 8,
          }),
        ]);
        if (cancelled) return;
        const people = Array.isArray(peopleResponse.data)
          ? peopleResponse.data
          : (peopleResponse.data.results ?? []);
        const prospects = Array.isArray(prospectsResponse.data)
          ? prospectsResponse.data
          : [];
        const matches: VisitorMatch[] = [
          ...people.map((person) => {
            const status = person.status ?? null;
            const codes = (person.cluster_codes ?? []).filter(Boolean);
            return {
              key: `person-${person.id}`,
              kind: "person" as const,
              personId: Number(person.id),
              name: formatPersonName(person),
              inviterId: person.inviter ? Number(person.inviter) : null,
              dateFirstAttended: person.date_first_attended || null,
              firstActivityAttended: person.first_activity_attended || null,
              status,
              statusLabel: formatPersonStatusLabel(status),
              statusClassName: getPersonStatusColor(status),
              clusterCode: codes.length > 0 ? codes.join(", ") : "NO CLUSTER",
              clusterBranchId: person.branch ?? null,
              evangelismGroupCode: null,
            };
          }),
          ...prospects
            .filter((prospect) => !prospect.person)
            .map((prospect) => {
              const stage =
                prospect.pipeline_stage_display ||
                prospect.pipeline_stage ||
                "INVITED";
              const clusterLabel = prospectClusterLabel(prospect);
              const group = prospect.evangelism_group;
              const groupCode =
                group?.cluster?.code?.trim() || group?.name?.trim() || null;
              const clusterBranchId =
                prospect.inviter_cluster?.branch ??
                prospect.endorsed_cluster?.branch ??
                group?.branch ??
                group?.branch_id ??
                null;
              return {
                key: `prospect-${prospect.id}`,
                kind: "prospect" as const,
                prospectId: Number(prospect.id),
                name: prospectName(prospect),
                inviterId: prospect.invited_by_id
                  ? Number(prospect.invited_by_id)
                  : prospect.invited_by?.id
                    ? Number(prospect.invited_by.id)
                    : null,
                dateFirstAttended: prospect.date_first_attended || null,
                status: stage,
                statusLabel: formatPipelineStageLabel(
                  prospect.pipeline_stage || stage,
                ),
                statusClassName: "bg-purple-100 text-purple-800",
                clusterCode:
                  clusterLabel && clusterLabel !== "—" ? clusterLabel : null,
                clusterBranchId:
                  typeof clusterBranchId === "number"
                    ? clusterBranchId
                    : clusterBranchId
                      ? Number(clusterBranchId)
                      : null,
                evangelismGroupCode: groupCode,
              };
            }),
        ];
        setVisitorMatches(matches);
      } catch (err) {
        console.error(err);
        if (!cancelled) setVisitorMatches([]);
      } finally {
        if (!cancelled) setVisitorSearching(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [visitorQuery, isAdmin, branchId, report?.branch, user?.branch]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        visitorSearchRef.current &&
        !visitorSearchRef.current.contains(event.target as Node)
      ) {
        setVisitorDropdownOpen(false);
      }
    };
    if (visitorDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [visitorDropdownOpen]);

  const addVisitorMatch = (match: VisitorMatch) => {
    if (match.personId && memberIds.includes(String(match.personId))) return;
    if (
      match.personId &&
      visitors.some((row) => row.personId === match.personId)
    ) {
      return;
    }
    if (
      match.prospectId &&
      visitors.some((row) => row.pending?.prospect_id === match.prospectId)
    ) {
      return;
    }
    if (match.kind === "person" && match.personId) {
      setVisitors((current) => [
        ...current,
        {
          key: match.key,
          personId: match.personId,
          name: match.name,
          kind: "RETURNING",
          progress: "",
          note: "",
          inviterId: match.inviterId,
          dateFirstAttended: match.dateFirstAttended || null,
          firstActivityAttended: match.firstActivityAttended || null,
          captureFirstAttendance: missingFirstAttendance(
            match.dateFirstAttended,
            match.firstActivityAttended,
          ),
        },
      ]);
    } else if (match.prospectId) {
      setVisitors((current) => [
        ...current,
        {
          key: match.key,
          name: match.name,
          kind: "FIRST_TIME",
          progress: "",
          note: "",
          inviterId: match.inviterId,
          pending: {
            prospect_id: match.prospectId,
            attendance_kind: "FIRST_TIME",
            inviter_id: match.inviterId,
            date_first_attended: match.dateFirstAttended || null,
            first_activity_attended: "",
          },
        },
      ]);
    }
    setVisitorMatches([]);
    setVisitorQuery("");
    setVisitorDropdownOpen(false);
  };

  const visibleVisitorMatches = visitorMatches.filter((match) => {
    if (
      match.personId &&
      visitors.some((row) => row.personId === match.personId)
    ) {
      return false;
    }
    if (
      match.prospectId &&
      visitors.some((row) => row.pending?.prospect_id === match.prospectId)
    ) {
      return false;
    }
    return true;
  });

  const updateVisitor = (key: string, patch: Partial<VisitorRow>) => {
    setVisitors((current) =>
      current.map((item) => (item.key === key ? { ...item, ...patch } : item)),
    );
  };

  const updateVisitorPending = (
    key: string,
    patch: Partial<SundayBibleStudyNewVisitorInput>,
  ) => {
    setVisitors((current) =>
      current.map((item) =>
        item.key === key && item.pending
          ? { ...item, pending: { ...item.pending, ...patch } }
          : item,
      ),
    );
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (isAdmin && !report && !branchId) {
      setError("Select a branch for this report.");
      return;
    }
    const missingFirstAttended = visitors.find((row) => {
      if (!shouldShowFirstAttendanceFields(row)) return false;
      const dateValue =
        row.pending?.date_first_attended ?? row.dateFirstAttended;
      return !String(dateValue || "").trim();
    });
    if (missingFirstAttended) {
      setError(
        `Enter date first attended for returning ${
          missingFirstAttended.pending?.prospect_id ? "prospect" : "visitor"
        } ${missingFirstAttended.name}.`,
      );
      return;
    }
    const payload: SundayBibleStudyReportWrite = {
      session_date: sessionDate,
      session_type: sessionType,
      cancelled,
      cancellation_reason: cancelled ? cancellationReason : "",
    };
    if (isAdmin && !report && branchId) {
      payload.branch_id = Number(branchId);
    }
    if (!cancelled) {
      payload.gathering_type =
        gatheringType as SundayBibleStudyReportWrite["gathering_type"];
      payload.topic = topic;
      payload.scripture_reference = scripture;
      payload.study_summary = flow;
      payload.observation = observation;
      payload.testimonies = testimonies;
      if (!report || report.prayer_requests !== undefined) {
        payload.prayer_requests = prayerRequests;
      }
      if (!report || report.notes !== undefined) {
        payload.notes = notes;
      }
      payload.facilitators = facilitators.map((row) => ({
        person_id: row.personId,
        is_lead: row.isLead,
      }));
      payload.members_attended = memberIds.map(Number);
      payload.visitors = visitors
        .filter((row) => row.personId)
        .map((row) => ({
          person_id: row.personId as number,
          attendance_kind: row.kind,
          progress: row.progress,
          note: row.note,
          inviter_id: row.inviterId,
          ...(row.kind === "RETURNING" && row.captureFirstAttendance
            ? {
                date_first_attended: row.dateFirstAttended || null,
                first_activity_attended: row.firstActivityAttended || null,
              }
            : {}),
        }));
      payload.new_visitors = visitors
        .filter((row) => row.pending)
        .map((row) => {
          const captureReturning =
            row.kind === "RETURNING" &&
            (Boolean(row.pending?.prospect_id) ||
              missingFirstAttendance(
                row.pending?.date_first_attended,
                row.pending?.first_activity_attended,
              ));
          return {
            ...row.pending,
            attendance_kind: row.kind,
            progress: row.progress,
            note: row.note,
            inviter_id: row.inviterId,
            date_first_attended: captureReturning
              ? row.pending?.date_first_attended || null
              : row.pending?.date_first_attended || sessionDate || null,
            first_activity_attended: captureReturning
              ? row.pending?.first_activity_attended || null
              : row.pending?.first_activity_attended || "SUNDAY_SERVICE",
          };
        }) as SundayBibleStudyNewVisitorInput[];
    }
    setSaving(true);
    try {
      const response = report
        ? await evangelismApi.updateSundayBibleStudy(report.id, payload)
        : await evangelismApi.createSundayBibleStudy(payload);
      const nextWarnings = response.data.facilitator_warnings ?? [];
      setWarnings(nextWarnings);
      toast.success("Report saved");
      if (nextWarnings.length > 0) {
        toast(nextWarnings.join(" "));
      }
      onSaved(response.data);
    } catch (err) {
      setError(apiError(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      {warnings.length > 0 && (
        <div className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {warnings.map((warning) => (
            <p key={warning}>{warning}</p>
          ))}
          <p className="mt-1">The report can still be submitted.</p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <span className={labelClass}>Branch</span>
          <div className="mt-1">
            {canEditBranch ? (
              <ScalableSelect
                options={branchOptions}
                value={branchId}
                onChange={setBranchId}
                placeholder="Select a branch"
                searchPlaceholder="Search branches..."
                className="w-full"
                showSearch
                maxHeight={280}
                emptyMessage="No branches found"
              />
            ) : (
              <input
                type="text"
                readOnly
                value={branchDisplayName}
                className={`${inputClass} bg-gray-50 text-gray-700`}
              />
            )}
          </div>
        </div>
        <label className={labelClass}>
          Sunday
          <input
            type="date"
            required
            value={sessionDate}
            onChange={(event) => setSessionDate(event.target.value)}
            className={inputClass}
          />
          {sessionDate && (
            <span className="mt-1 block text-xs text-gray-500">
              {isoWeekLabel(sessionDate)}
            </span>
          )}
        </label>
        <label className={labelClass}>
          Session type
          <select
            value={sessionType}
            onChange={(event) =>
              setSessionType(event.target.value as SundaySessionType)
            }
            className={inputClass}
          >
            <option value="BEFORE_SERVICE">Before Service</option>
            <option value="AFTER_SERVICE">After Service</option>
          </select>
        </label>
        {!cancelled && (
          <label className={labelClass}>
            Session format
            <select
              value={gatheringType || "PHYSICAL"}
              onChange={(event) =>
                setGatheringType(event.target.value as typeof gatheringType)
              }
              className={inputClass}
            >
              <option value="PHYSICAL">Physical</option>
              <option value="ONLINE">Online</option>
              <option value="HYBRID">Hybrid</option>
            </select>
          </label>
        )}
      </div>

      <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
        <input
          type="checkbox"
          checked={cancelled}
          onChange={(event) => setCancelled(event.target.checked)}
          className="h-5 w-5"
        />
        Session was cancelled
      </label>
      {cancelled && (
        <label className={labelClass}>
          Cancellation reason
          <textarea
            required
            value={cancellationReason}
            onChange={(event) => setCancellationReason(event.target.value)}
            placeholder="Why was this Sunday Bible study cancelled?"
            className={textAreaClass}
          />
        </label>
      )}

      {!cancelled && (
        <>
          <section className="space-y-3">
            <h3 className="text-base font-semibold text-gray-900">
              Facilitators
            </h3>
            <ScalableSelect
              options={facilitatorOptions}
              value={facilitatorPick}
              onChange={addFacilitator}
              placeholder="Add a Bible Sharer"
              searchPlaceholder="Search facilitators..."
            />
            <ul className="space-y-2">
              {facilitators.map((row) => (
                <li
                  key={row.personId}
                  className="flex flex-wrap items-center gap-3 rounded-md border border-gray-200 px-3 py-2"
                >
                  <span className="text-sm font-medium text-gray-900">
                    {row.name}
                  </span>
                  <label className="flex items-center gap-1 text-sm text-gray-700">
                    <input
                      type="radio"
                      name="lead-facilitator"
                      checked={row.isLead}
                      onChange={() =>
                        setFacilitators((current) =>
                          current.map((item) => ({
                            ...item,
                            isLead: item.personId === row.personId,
                          })),
                        )
                      }
                    />
                    Lead
                  </label>
                  <button
                    type="button"
                    className="ml-auto min-h-[44px] text-sm text-red-700"
                    onClick={() =>
                      setFacilitators((current) =>
                        current.filter(
                          (item) => item.personId !== row.personId,
                        ),
                      )
                    }
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          </section>

          <section className="space-y-3">
            <h3 className="text-base font-semibold text-gray-900">
              Attendance
            </h3>
            <AttendanceSelector
              label="Members attended"
              selectedIds={memberIds}
              availablePeople={members}
              filterRole="MEMBER"
              onSelectionChange={setMemberIds}
              openRoster
              isLoadingRoster={membersLoading || (isAdmin && !branchId)}
              hint={
                isAdmin && !branchId
                  ? "Select a branch first to list people from that branch."
                  : "People from this branch. Some that wants to sit-in including those that were just recently baptized."
              }
            />
            <div>
              <div className="flex items-center justify-between gap-2">
                <p className={labelClass}>Visitors</p>
                <Button
                  type="button"
                  variant="primary"
                  className="text-sm"
                  onClick={() => setShowAddVisitor(true)}
                >
                  + Add New Visitor
                </Button>
              </div>
              <div className="relative mt-1" ref={visitorSearchRef}>
                <input
                  value={visitorQuery}
                  onChange={(event) => {
                    const value = event.target.value;
                    setVisitorQuery(value);
                    setVisitorDropdownOpen(value.trim().length >= 1);
                  }}
                  onFocus={() => {
                    if (visitorQuery.trim().length >= 1) {
                      setVisitorDropdownOpen(true);
                    }
                  }}
                  placeholder="Search visitors or prospects..."
                  className="min-h-[44px] w-full rounded-md border border-gray-300 px-3 focus:border-transparent focus:ring-2 focus:ring-ring"
                />
                {visitorDropdownOpen && visitorQuery.trim().length >= 1 && (
                  <div className="absolute z-10 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-gray-300 bg-white shadow-lg">
                    {visitorSearching ? (
                      <div className="px-3 py-2 text-sm text-gray-500">
                        Searching…
                      </div>
                    ) : visibleVisitorMatches.length > 0 ? (
                      visibleVisitorMatches.map((match) => (
                        <button
                          key={match.key}
                          type="button"
                          className="w-full px-3 py-2 text-left text-sm transition-colors hover:bg-gray-100 focus:bg-gray-100 focus:outline-none"
                          onClick={() => addVisitorMatch(match)}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="min-w-0 truncate font-medium text-gray-900">
                              {match.name}
                            </span>
                            <span className="flex max-w-[55%] flex-wrap items-center justify-end gap-1.5">
                              {match.statusLabel ? (
                                <span
                                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                    match.statusClassName ??
                                    "bg-gray-100 text-gray-800"
                                  }`}
                                >
                                  {match.statusLabel}
                                </span>
                              ) : null}
                              {match.clusterCode ? (
                                match.clusterCode === "NO CLUSTER" ? (
                                  <span className="chip-red-sm shrink-0">
                                    NO CLUSTER
                                  </span>
                                ) : (
                                  <span
                                    className={`${CLUSTER_CODE_BADGE_CLASSNAME} shrink-0`}
                                    style={getClusterCodeBadgeStyle(
                                      match.clusterBranchId,
                                    )}
                                  >
                                    {match.clusterCode}
                                  </span>
                                )
                              ) : null}
                              {match.evangelismGroupCode ? (
                                <span className="inline-flex shrink-0 items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
                                  {match.evangelismGroupCode}
                                </span>
                              ) : null}
                              {match.kind === "prospect" ? (
                                <span className="inline-flex shrink-0 items-center rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-semibold text-orange-800">
                                  Prospect
                                </span>
                              ) : null}
                            </span>
                          </div>
                        </button>
                      ))
                    ) : (
                      <div className="px-3 py-2 text-sm text-gray-500">
                        No match. If they came, use Add New Visitor.
                      </div>
                    )}
                  </div>
                )}
              </div>
              <ul className="mt-3 space-y-3">
                {visitors.map((row) => {
                  const tone = visitorCardTone(row);
                  const style = VISITOR_CARD_STYLES[tone];
                  return (
                    <li
                      key={row.key}
                      className={`space-y-2 rounded-md border p-3 ${style.card}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-medium text-gray-900">
                              {row.name}
                            </p>
                            <span
                              className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${style.badge}`}
                            >
                              {style.label}
                            </span>
                            {row.kind === "RETURNING" &&
                            tone !== "returning" ? (
                              <span className="inline-flex shrink-0 items-center rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-semibold text-purple-800">
                                Returning
                              </span>
                            ) : null}
                            {row.kind === "FIRST_TIME" &&
                            tone !== "first" &&
                            tone !== "new" ? (
                              <span className="inline-flex shrink-0 items-center rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-semibold text-sky-800">
                                First time
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-0.5 text-xs text-gray-500">
                            Attended {sessionDate || "this Sunday"}
                          </p>
                        </div>
                        <button
                          type="button"
                          className="min-h-[44px] shrink-0 text-sm text-red-700"
                          onClick={() =>
                            setVisitorPendingRemove({
                              key: row.key,
                              name: row.name,
                              isProspect: Boolean(row.pending?.prospect_id),
                            })
                          }
                        >
                          Remove
                        </button>
                      </div>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <label className={labelClass}>
                          Attendance
                          <select
                            value={row.kind}
                            onChange={(event) => {
                              const kind = event.target
                                .value as SundayVisitorKind;
                              updateVisitor(row.key, {
                                kind,
                                ...(row.pending
                                  ? {
                                      pending: {
                                        ...row.pending,
                                        attendance_kind: kind,
                                      },
                                    }
                                  : {}),
                              });
                            }}
                            className={inputClass}
                          >
                            <option value="FIRST_TIME">First time</option>
                            <option value="RETURNING">Returning</option>
                          </select>
                        </label>
                        <div>
                          <p className={labelClass}>Inviter</p>
                          <div className="mt-1">
                            <SearchableSelect
                              value={
                                row.inviterId != null
                                  ? String(row.inviterId)
                                  : ""
                              }
                              onChange={(value) =>
                                updateVisitor(row.key, {
                                  inviterId: value ? Number(value) : null,
                                })
                              }
                              options={inviterOptions}
                              placeholder="Search for inviter..."
                              emptyMessage="No inviter found"
                              showEmptyOption
                              emptyOptionLabel="Walk-in"
                              showRole={false}
                              showStatus={false}
                              controlClassName="!min-h-[44px] box-border flex items-center !py-0 !text-sm"
                            />
                          </div>
                        </div>
                      </div>
                      {shouldShowFirstAttendanceFields(row) ? (
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                          <label className={labelClass}>
                            Date first attended
                            <input
                              type="date"
                              required
                              value={
                                row.pending?.date_first_attended ??
                                row.dateFirstAttended ??
                                ""
                              }
                              max={sessionDate || undefined}
                              onChange={(event) => {
                                const value = event.target.value || null;
                                if (row.pending) {
                                  updateVisitorPending(row.key, {
                                    date_first_attended: value,
                                  });
                                } else {
                                  updateVisitor(row.key, {
                                    dateFirstAttended: value,
                                  });
                                }
                              }}
                              className={inputClass}
                            />
                          </label>
                          <label className={labelClass}>
                            First activity attended
                            <select
                              value={
                                row.pending?.first_activity_attended ??
                                row.firstActivityAttended ??
                                ""
                              }
                              onChange={(event) => {
                                const value = event.target.value;
                                if (row.pending) {
                                  updateVisitorPending(row.key, {
                                    first_activity_attended: value,
                                  });
                                } else {
                                  updateVisitor(row.key, {
                                    firstActivityAttended: value,
                                  });
                                }
                              }}
                              className={inputClass}
                            >
                              <option value="">Select...</option>
                              {activityTypes.map((type) => (
                                <option key={type.code} value={type.code}>
                                  {type.label}
                                </option>
                              ))}
                            </select>
                          </label>
                        </div>
                      ) : null}
                      <div className="block text-sm font-medium text-gray-700">
                        Progress
                        <div className="mt-1">
                          <ScalableSelect
                            options={SUNDAY_PROGRESS_OPTIONS.filter(
                              (option) => option.value !== "",
                            ).map((option) => ({
                              value: option.value,
                              label: option.label,
                            }))}
                            value={row.progress}
                            onChange={(value) =>
                              updateVisitor(row.key, {
                                progress: value as SundayBibleStudyProgress,
                              })
                            }
                            pinnedOption={{ value: "", label: "None" }}
                            placeholder="Select progress"
                            searchPlaceholder="Search progress..."
                            className="w-full"
                            showSearch
                            maxHeight={240}
                            emptyMessage="No progress options"
                          />
                        </div>
                      </div>
                      <label className={labelClass}>
                        Note
                        <textarea
                          value={row.note}
                          onChange={(event) =>
                            updateVisitor(row.key, { note: event.target.value })
                          }
                          placeholder="Optional note for their journey"
                          className="mt-1 min-h-[72px] w-full rounded-md border border-gray-300 px-3 py-2"
                        />
                      </label>
                    </li>
                  );
                })}
              </ul>
            </div>
          </section>

          <section className="grid grid-cols-1 gap-4">
            <h3 className="text-base font-semibold text-gray-900">
              Bible study
            </h3>
            <label className={labelClass}>
              Topic
              <input
                value={topic}
                onChange={(event) => setTopic(event.target.value)}
                placeholder="Lesson topic"
                className={inputClass}
              />
            </label>
            <label className={labelClass}>
              Scripture reference
              <input
                value={scripture}
                onChange={(event) => setScripture(event.target.value)}
                placeholder="e.g. Acts 2:38"
                className={inputClass}
              />
            </label>
            <label className={labelClass}>
              Flow
              <textarea
                value={flow}
                onChange={(event) => setFlow(event.target.value)}
                placeholder="How the study went"
                className={textAreaClass}
              />
            </label>
            <label className={labelClass}>
              Observation
              <textarea
                value={observation}
                onChange={(event) => setObservation(event.target.value)}
                placeholder="How visitors responded in the study and during the service"
                className={textAreaClass}
              />
            </label>
            <label className={labelClass}>
              Testimonies
              <textarea
                value={testimonies}
                onChange={(event) => setTestimonies(event.target.value)}
                placeholder="Optional testimonies from the study"
                className="mt-1 min-h-[72px] w-full rounded-md border border-gray-300 px-3 py-2"
              />
            </label>
            <label className={labelClass}>
              Prayer requests
              <textarea
                value={prayerRequests}
                onChange={(event) => setPrayerRequests(event.target.value)}
                placeholder="Optional prayer requests"
                className="mt-1 min-h-[72px] w-full rounded-md border border-gray-300 px-3 py-2"
              />
            </label>
            <label className={labelClass}>
              Notes and follow-up
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Optional notes and follow-up"
                className="mt-1 min-h-[72px] w-full rounded-md border border-gray-300 px-3 py-2"
              />
            </label>
          </section>
        </>
      )}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="tertiary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? "Saving..." : "Submit Report"}
        </Button>
      </div>

      <AddVisitorModal
        isOpen={showAddVisitor}
        onClose={() => setShowAddVisitor(false)}
        defaultDateFirstAttended={sessionDate}
        defaultFirstActivityAttended="SUNDAY_SERVICE"
        forReport
        onAdd={async (visitorData) => {
          const tempId =
            typeof crypto !== "undefined" && "randomUUID" in crypto
              ? crypto.randomUUID()
              : `tmp-${Date.now()}`;
          const inviterId =
            visitorData.inviter != null &&
            String(visitorData.inviter).trim() !== ""
              ? Number(visitorData.inviter)
              : null;
          setVisitors((current) => [
            ...current,
            {
              key: tempId,
              name: `${visitorData.first_name || ""} ${visitorData.last_name || ""}`.trim(),
              kind: "FIRST_TIME",
              progress: "",
              note: String(visitorData.note || ""),
              inviterId,
              pending: {
                first_name: visitorData.first_name || "",
                last_name: visitorData.last_name || "",
                middle_name: visitorData.middle_name || "",
                suffix: visitorData.suffix || "",
                gender: visitorData.gender || "",
                facebook_name: visitorData.facebook_name || "",
                note: String(visitorData.note || ""),
                inviter_id: inviterId,
                attendance_kind: "FIRST_TIME",
                first_activity_attended:
                  visitorData.first_activity_attended || null,
              },
            },
          ]);
          return {
            first_name: visitorData.first_name || "",
            last_name: visitorData.last_name || "",
          };
        }}
      />

      <ConfirmationModal
        isOpen={visitorPendingRemove != null}
        onClose={() => setVisitorPendingRemove(null)}
        onConfirm={() => {
          if (!visitorPendingRemove) return;
          setVisitors((current) =>
            current.filter((item) => item.key !== visitorPendingRemove.key),
          );
          setVisitorPendingRemove(null);
        }}
        title={
          visitorPendingRemove?.isProspect
            ? "Remove this prospect?"
            : "Remove this visitor?"
        }
        message={
          <>
            Remove{" "}
            <span className="font-medium text-gray-700">
              {visitorPendingRemove?.name || "this person"}
            </span>{" "}
            from attendance on this report.
          </>
        }
        confirmText="Remove"
        variant="danger"
      />
    </form>
  );
}
