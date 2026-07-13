import { useState, useEffect, useRef, useMemo } from "react";
import { PersonUI, Person } from "@/src/types/person";
import {
  ClusterWeeklyReport,
  ClusterWeeklyReportInput,
  ClusterReportNewProspectInput,
  Cluster,
  GatheringType,
} from "@/src/types/cluster";
import type { Prospect } from "@/src/types/evangelism";
import { isSelectablePerson } from "@/src/lib/peopleSelectors";
import {
  getIsoWeekParts,
  getIsoWeekPartsFromDateString,
} from "@/src/lib/isoWeek";
import { peopleApi, clusterReportsApi, evangelismApi } from "@/src/lib/api";
import {
  buildClusterWeeklyReportPayloadFromFormValues,
  isProspectAttendanceId,
  toPendingNewProspectId,
  toProspectAttendanceId,
  prospectIdFromAttendanceId,
} from "@/src/lib/clusterWeeklyReportSubmit";
import { useAuth } from "@/src/contexts/AuthContext";
import Button from "@/src/components/ui/Button";
import Modal from "@/src/components/ui/Modal";
import AttendanceSelector from "./AttendanceSelector";
import AddVisitorModal from "./AddVisitorModal";
import ProspectForm, {
  type ProspectFormValues,
} from "@/src/components/evangelism/ProspectForm";

type ReportAttendeeDetail = {
  id: number;
  first_name?: string;
  last_name?: string;
  middle_name?: string;
  suffix?: string;
  username?: string;
  email?: string;
  role?: string;
  status?: string;
};

function formatPersonNameFromFields(person: {
  first_name?: string;
  last_name?: string;
  middle_name?: string;
  suffix?: string;
}): string {
  const middleInitial = person.middle_name
    ? ` ${person.middle_name.trim().charAt(0)}.`
    : "";
  const suffixPart =
    person.suffix && person.suffix.trim().length > 0
      ? ` ${person.suffix.trim()}`
      : "";
  return `${person.first_name ?? ""}${middleInitial} ${
    person.last_name ?? ""
  }${suffixPart}`.trim();
}

function reportAttendeeToPersonUI(
  detail: ReportAttendeeDetail,
  defaultRole: "MEMBER" | "VISITOR"
): PersonUI {
  return {
    id: String(detail.id),
    name: formatPersonNameFromFields(detail),
    first_name: detail.first_name ?? "",
    last_name: detail.last_name ?? "",
    username: detail.username ?? "",
    email: detail.email ?? "",
    role: (detail.role ?? defaultRole) as PersonUI["role"],
    status: (detail.status ?? "ACTIVE") as PersonUI["status"],
  };
}

function mergeReportAttendeesIntoPeople(
  people: PersonUI[],
  initialData?: Partial<ClusterWeeklyReport>
): PersonUI[] {
  if (!initialData?.id) return people;

  const existingIds = new Set(people.map((p) => String(p.id)));
  const merged = [...people];

  const appendDetails = (
    details: ReportAttendeeDetail[] | undefined,
    defaultRole: "MEMBER" | "VISITOR"
  ) => {
    for (const detail of details || []) {
      const id = String(detail.id);
      if (!existingIds.has(id) && isSelectablePerson(detail)) {
        merged.push(reportAttendeeToPersonUI(detail, defaultRole));
        existingIds.add(id);
      }
    }
  };

  appendDetails(initialData.visitors_attended_details, "VISITOR");
  appendDetails(initialData.members_attended_details, "MEMBER");

  return merged;
}

function prospectInviteDisplayName(prospect: Prospect): string {
  if (prospect.display_name?.trim()) return prospect.display_name.trim();
  const middleInitial = prospect.middle_name
    ? ` ${prospect.middle_name.trim().charAt(0)}.`
    : "";
  const suffixPart =
    prospect.suffix && prospect.suffix.trim().length > 0
      ? ` ${prospect.suffix.trim()}`
      : "";
  return `${prospect.first_name ?? ""}${middleInitial} ${
    prospect.last_name ?? ""
  }${suffixPart}`.trim();
}

function prospectToPersonUI(prospect: Prospect): PersonUI {
  const invitedBy =
    prospect.invited_by &&
    typeof prospect.invited_by === "object" &&
    "first_name" in prospect.invited_by
      ? `${prospect.invited_by.first_name ?? ""} ${
          prospect.invited_by.last_name ?? ""
        }`.trim()
      : "Unknown";
  const stageLabel =
    prospect.pipeline_stage_display || prospect.pipeline_stage || "INVITED";
  return {
    id: toProspectAttendanceId(prospect.id),
    name: `${prospectInviteDisplayName(prospect)} (${stageLabel.toLowerCase()})`,
    role: "VISITOR",
    status: "NO_RESPONSE",
    inviter: prospect.invited_by?.id,
    inviterName: invitedBy || "Unknown",
    username: "",
    email: "",
    first_name: prospect.first_name || "",
    last_name: prospect.last_name || "",
  } as unknown as PersonUI;
}

interface ClusterWeeklyReportFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: ClusterWeeklyReportInput) => Promise<void>;
  initialData?: Partial<ClusterWeeklyReport>;
  cluster?: Cluster | null;
  clusters: Cluster[];
}

export default function ClusterWeeklyReportForm({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  cluster,
  clusters,
}: ClusterWeeklyReportFormProps) {
  const { user } = useAuth();

  const todayIsoParts = getIsoWeekParts(new Date());
  const [formData, setFormData] = useState({
    cluster: cluster?.id || 0,
    year: todayIsoParts.year,
    week_number: todayIsoParts.week,
    meeting_date: new Date().toISOString().split("T")[0],
    gathering_type: "PHYSICAL" as GatheringType,
    activities_held: "",
    prayer_requests: "",
    testimonies: "",
    offerings: "" as string | number,
    highlights: "",
    lowlights: "",
    members_attended: (initialData?.members_attended || []).map(String),
    visitors_attended: (initialData?.visitors_attended || []).map(String),
    prospects_invited: (initialData?.prospects_invited || []).map(String),
  });

  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [clusterSearchTerm, setClusterSearchTerm] = useState("");
  const [showClusterDropdown, setShowClusterDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [people, setPeople] = useState<PersonUI[]>([]);
  const [loadingPeople, setLoadingPeople] = useState(true);
  const [showAddVisitorModal, setShowAddVisitorModal] = useState(false);
  const [showAddProspectModal, setShowAddProspectModal] = useState(false);
  const [prospectSubmitting, setProspectSubmitting] = useState(false);
  const [prospectFormError, setProspectFormError] = useState<string | null>(
    null
  );
  const [clusterProspects, setClusterProspects] = useState<Prospect[]>([]);
  const [pendingNewProspects, setPendingNewProspects] = useState<
    Record<string, ClusterReportNewProspectInput>
  >({});
  const [previouslyAttendedVisitors, setPreviouslyAttendedVisitors] = useState<
    string[]
  >([]);
  const [mostRecentAttendedVisitors, setMostRecentAttendedVisitors] = useState<
    string[]
  >([]);
  const [previouslyAttendedMembers, setPreviouslyAttendedMembers] = useState<
    string[]
  >([]);
  const [mostRecentAttendedMembers, setMostRecentAttendedMembers] = useState<
    string[]
  >([]);

  // Fetch people data
  useEffect(() => {
    const fetchPeople = async () => {
      try {
        setLoadingPeople(true);
        const response = await peopleApi.getAll();
        const peopleUI: PersonUI[] = response.data
          .filter(isSelectablePerson)
          .map((p) => {
          const name = formatPersonNameFromFields(p);
            return {
              ...p,
              name,
              dateFirstAttended: p.date_first_attended,
            };
          });
        // Normalize people IDs to strings
        const normalizedPeopleUI = peopleUI.map((p) => ({
          ...p,
          id: p.id?.toString() || "",
        }));
        const mergedPeopleUI = mergeReportAttendeesIntoPeople(
          normalizedPeopleUI,
          initialData
        );
        setPeople(mergedPeopleUI);

        // Filter out invalid IDs from formData (visitors/members that were deleted)
        setFormData((prev) => {
          const validPeopleIds = new Set(
            mergedPeopleUI.map((p) => String(p.id)).filter(Boolean)
          );

          const validMembers = (prev.members_attended || []).filter((id) =>
            validPeopleIds.has(String(id))
          );
          // Keep prospect: ids; only prune numeric person IDs not in people list
          const validVisitors = (prev.visitors_attended || []).filter((id) => {
            const sid = String(id);
            if (isProspectAttendanceId(sid)) return true;
            return validPeopleIds.has(sid);
          });

          if (
            validMembers.length !== (prev.members_attended || []).length ||
            validVisitors.length !== (prev.visitors_attended || []).length ||
            JSON.stringify(validMembers) !==
              JSON.stringify(prev.members_attended) ||
            JSON.stringify(validVisitors) !==
              JSON.stringify(prev.visitors_attended)
          ) {
            return {
              ...prev,
              members_attended: validMembers,
              visitors_attended: validVisitors,
            };
          }
          return prev;
        });
      } catch (error) {
        console.error("Error fetching people:", error);
      } finally {
        setLoadingPeople(false);
      }
    };
    fetchPeople();
  }, []);

  // Load INVITED prospects for selected cluster (no Person yet)
  useEffect(() => {
    const clusterId = formData.cluster;
    if (!clusterId) {
      setClusterProspects([]);
      return;
    }
    let cancelled = false;
    const loadProspects = async () => {
      try {
        const unwrapList = (data: unknown): Prospect[] => {
          if (Array.isArray(data)) return data;
          if (
            data &&
            typeof data === "object" &&
            Array.isArray((data as { results?: Prospect[] }).results)
          ) {
            return (data as { results: Prospect[] }).results;
          }
          return [];
        };
        const [byInviter, byEndorsed] = await Promise.all([
          evangelismApi.listProspects({
            inviter_cluster: clusterId,
            pipeline_stage: "INVITED",
            is_dropped_off: false,
          }),
          evangelismApi.listProspects({
            endorsed_cluster: clusterId,
            pipeline_stage: "INVITED",
            is_dropped_off: false,
          }),
        ]);
        if (cancelled) return;
        const byId = new Map<string, Prospect>();
        for (const p of [
          ...unwrapList(byInviter.data),
          ...unwrapList(byEndorsed.data),
        ]) {
          if (p.person) continue;
          byId.set(String(p.id), p);
        }
        setClusterProspects(Array.from(byId.values()));
      } catch (error) {
        console.error("Error fetching cluster prospects:", error);
        if (!cancelled) setClusterProspects([]);
      }
    };
    loadProspects();
    return () => {
      cancelled = true;
    };
  }, [formData.cluster]);

  // Filter clusters based on search term
  const filteredClusters = clusters.filter((cluster) => {
    const searchLower = clusterSearchTerm.toLowerCase();
    return (
      cluster.name?.toLowerCase().includes(searchLower) ||
      (cluster.code && cluster.code.toLowerCase().includes(searchLower))
    );
  });

  // Get selected cluster name for display
  const selectedCluster = clusters.find((c) => c.id === formData.cluster);
  const selectedClusterDisplay = selectedCluster
    ? selectedCluster.code
      ? `${selectedCluster.code} - ${selectedCluster.name}`
      : selectedCluster.name
    : "";

  useEffect(() => {
    if (cluster) {
      setFormData((prev) => ({ ...prev, cluster: cluster.id }));
    }
  }, [cluster]);

  // Update formData when initialData changes (when editing)
  useEffect(() => {
    if (initialData) {
      setFormData((prev) => ({
        ...prev,
        year: initialData.year ?? prev.year,
        week_number: initialData.week_number ?? prev.week_number,
        cluster: initialData.cluster ?? prev.cluster,
        meeting_date: initialData.meeting_date ?? prev.meeting_date,
        gathering_type: initialData.gathering_type ?? prev.gathering_type,
        activities_held: initialData.activities_held ?? prev.activities_held,
        prayer_requests: initialData.prayer_requests ?? prev.prayer_requests,
        testimonies: initialData.testimonies ?? prev.testimonies,
        offerings: initialData.offerings ?? prev.offerings,
        highlights: initialData.highlights ?? prev.highlights,
        lowlights: initialData.lowlights ?? prev.lowlights,
        members_attended: (initialData.members_attended || []).map(String),
        visitors_attended: (initialData.visitors_attended || []).map(String),
        prospects_invited: (initialData.prospects_invited || []).map(String),
      }));
    }
  }, [initialData?.id, initialData?.year, initialData?.week_number, initialData?.updated_at]);

  // Fetch previously attended visitors and members when cluster is selected
  useEffect(() => {
    const fetchPreviousAttendance = async () => {
      if (selectedCluster) {
        try {
          // Get current report's year and week to filter previous reports
          // When editing (initialData exists), ALWAYS use initialData's week/year
          // When creating new, use formData or defaults
          // This ensures we get the correct previous reports even when dashboard filters are active
          const currentYear = Number(
            initialData?.year ?? formData.year ?? new Date().getFullYear()
          );
          const currentWeek = Number(
            initialData?.week_number ??
              formData.week_number ??
              getIsoWeekParts(new Date()).week
          );
          const currentReportId = initialData?.id?.toString();

          // Fetch all previous reports for this cluster
          // We'll filter client-side to only get reports from earlier weeks/years
          const response = await clusterReportsApi.getAll({
            cluster: selectedCluster.id.toString(),
            page_size: 100, // Get all reports to collect all unique visitors/members
          });

          // Collect all unique visitor IDs from all previous reports of this cluster
          const visitorIds = new Set<string>();
          // Collect all unique member IDs from all previous reports of this cluster
          const memberIds = new Set<string>();

          // Track the most recent report (before current week)
          let mostRecentReport: any = null;

          if (response.data.results && response.data.results.length > 0) {
            response.data.results.forEach((report) => {
              // Skip the current report if editing
              if (
                currentReportId &&
                report.id?.toString() === currentReportId
              ) {
                return;
              }

              // Only include reports from earlier weeks/years
              // Ensure week_number and year are numbers for proper comparison
              const reportYear = Number(report.year || 0);
              const reportWeek = Number(report.week_number || 0);

              // Include if: earlier year (any week), OR same year but earlier week
              // This ensures we get all historical data from before the current report
              const isPreviousReport =
                reportYear < currentYear ||
                (reportYear === currentYear && reportWeek < currentWeek);

              if (
                report.cluster?.toString() === selectedCluster.id.toString() &&
                isPreviousReport
              ) {
                // Collect all unique visitors/members from previous reports
                if (report.visitors_attended) {
                  report.visitors_attended.forEach((id: number) => {
                    visitorIds.add(id.toString());
                  });
                }
                if (report.members_attended) {
                  report.members_attended.forEach((id: number) => {
                    memberIds.add(id.toString());
                  });
                }

                // Track the most recent report (highest week in same year, or latest year)
                if (!mostRecentReport) {
                  mostRecentReport = report;
                } else {
                  const mostRecentYear = mostRecentReport.year || 0;
                  const mostRecentWeek = mostRecentReport.week_number || 0;

                  if (
                    reportYear > mostRecentYear ||
                    (reportYear === mostRecentYear &&
                      reportWeek > mostRecentWeek)
                  ) {
                    mostRecentReport = report;
                  }
                }
              }
            });
          }

          // For auto-selection, use only the most recent report's visitors/members
          const mostRecentVisitorIds: string[] =
            mostRecentReport?.visitors_attended
              ? Array.from(
                  new Set(
                    mostRecentReport.visitors_attended.map((id: number) =>
                      id.toString()
                    )
                  )
                )
              : [];
          const mostRecentMemberIds: string[] =
            mostRecentReport?.members_attended
              ? Array.from(
                  new Set(
                    mostRecentReport.members_attended.map((id: number) =>
                      id.toString()
                    )
                  )
                )
              : [];

          // Store all previously attended visitors/members for filtering the list
          setPreviouslyAttendedVisitors(Array.from(visitorIds));
          setPreviouslyAttendedMembers(Array.from(memberIds));

          // Store most recent visitors/members for auto-selection
          setMostRecentAttendedVisitors(mostRecentVisitorIds);
          setMostRecentAttendedMembers(mostRecentMemberIds);
        } catch (error) {
          console.error("Error fetching previous attendance:", error);
          setPreviouslyAttendedVisitors([]);
          setMostRecentAttendedVisitors([]);
          setPreviouslyAttendedMembers([]);
          setMostRecentAttendedMembers([]);
        }
      } else {
        setPreviouslyAttendedVisitors([]);
        setMostRecentAttendedVisitors([]);
        setPreviouslyAttendedMembers([]);
        setMostRecentAttendedMembers([]);
      }
    };

    fetchPreviousAttendance();
  }, [
    selectedCluster?.id,
    initialData?.year,
    initialData?.week_number,
    initialData?.id,
    formData.year,
    formData.week_number,
  ]);

  const handleChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleMeetingDateChange = (value: string) => {
    setFormData((prev) => {
      const next = {
        ...prev,
        meeting_date: value,
      };
      const parts = getIsoWeekPartsFromDateString(value);
      if (parts) {
        next.year = parts.year;
        next.week_number = parts.week;
      }
      return next;
    });
  };

  const handleClusterSelect = (clusterId: number | string) => {
    const numId =
      typeof clusterId === "string" ? parseInt(clusterId, 10) : clusterId;
    handleChange("cluster", numId);
    setShowClusterDropdown(false);
    setClusterSearchTerm("");
  };

  const handleClusterSearchChange = (value: string) => {
    setClusterSearchTerm(value);
    setShowClusterDropdown(true);
  };

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setShowClusterDropdown(false);
      }
    };

    if (showClusterDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showClusterDropdown]);

  const handleCreateVisitor = async (visitorData: Partial<Person>) => {
    const branchId = selectedCluster?.branch ?? user?.branch ?? undefined;
    const payload: Partial<Person> = {
      ...visitorData,
      ...(branchId != null ? { branch: branchId } : {}),
    };
    try {
      const response = await peopleApi.create(payload);
      const name = formatPersonNameFromFields(response.data);

      const newVisitor: PersonUI = {
        ...response.data,
        id: String(response.data.id),
        name,
        dateFirstAttended: response.data.date_first_attended,
      };

      setPeople((prev) => [...prev, newVisitor]);
      setFormData((prev) => ({
        ...prev,
        visitors_attended: [
          ...(prev.visitors_attended || []),
          String(response.data.id),
        ],
      }));

      return response.data;
    } catch (error) {
      throw error;
    }
  };

  const invitedProspectIdsSelected = useMemo(
    () => new Set((formData.prospects_invited || []).map(String)),
    [formData.prospects_invited]
  );

  const visitorOptions = useMemo(() => {
    const personVisitors = people.filter((p) => p.role === "VISITOR");
    const prospectOptions = clusterProspects
      .filter((p) => !invitedProspectIdsSelected.has(String(p.id)))
      .map(prospectToPersonUI);
    // Pending new prospects can also be promoted to attended? Plan says block dual list.
    // They stay in invite list only until submit.
    return [...personVisitors, ...prospectOptions];
  }, [people, clusterProspects, invitedProspectIdsSelected]);

  const prospectInviteOptions = useMemo(() => {
    const attendedProspectIds = new Set(
      (formData.visitors_attended || [])
        .filter((id) => isProspectAttendanceId(String(id)))
        .map((id) => prospectIdFromAttendanceId(String(id)))
    );
    const fromApi = clusterProspects
      .filter((p) => !attendedProspectIds.has(String(p.id)))
      .map(prospectToPersonUI);
    const pendingOptions: PersonUI[] = Object.entries(pendingNewProspects).map(
      ([tempId, payload]) =>
        ({
          id: toPendingNewProspectId(tempId),
          name: `${payload.first_name} ${payload.last_name} (new invite)`.trim(),
          role: "VISITOR",
          status: "NO_RESPONSE",
          inviter: payload.invited_by_id,
          username: "",
          email: "",
          first_name: payload.first_name,
          last_name: payload.last_name,
        }) as unknown as PersonUI
    );
    return [...fromApi, ...pendingOptions];
  }, [
    clusterProspects,
    formData.visitors_attended,
    pendingNewProspects,
  ]);

  const handleMembersChange = (ids: string[]) => {
    setFormData((prev) => ({ ...prev, members_attended: ids }));
  };

  const handleVisitorsChange = (ids: string[]) => {
    const prospectIdsSelected = ids
      .filter((id) => isProspectAttendanceId(id))
      .map((id) => prospectIdFromAttendanceId(id));
    setFormData((prev) => ({
      ...prev,
      visitors_attended: ids,
      prospects_invited: (prev.prospects_invited || []).filter(
        (id) => !prospectIdsSelected.includes(String(id))
      ),
    }));
  };

  const handleProspectsInvitedChange = (ids: string[]) => {
    const numericOrPending = ids.map((id) =>
      isProspectAttendanceId(id) ? prospectIdFromAttendanceId(id) : id
    );
    const blockedFromVisitors = new Set(
      numericOrPending
        .filter((id) => !String(id).startsWith("new:"))
        .map((id) => toProspectAttendanceId(id))
    );
    setFormData((prev) => ({
      ...prev,
      prospects_invited: numericOrPending,
      visitors_attended: (prev.visitors_attended || []).filter(
        (id) => !blockedFromVisitors.has(String(id))
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
      const payload: ClusterReportNewProspectInput = {
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
    } catch (error: any) {
      setProspectFormError(
        error?.message || "Failed to add prospect to this report"
      );
    } finally {
      setProspectSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (showAddVisitorModal || showAddProspectModal) {
      return;
    }
    setLoading(true);
    setFormError(null);
    try {
      const payload = buildClusterWeeklyReportPayloadFromFormValues({
        cluster: formData.cluster,
        year: formData.year,
        week_number: formData.week_number,
        meeting_date: formData.meeting_date,
        gathering_type: formData.gathering_type,
        activities_held: formData.activities_held,
        prayer_requests: formData.prayer_requests,
        testimonies: formData.testimonies,
        offerings: formData.offerings,
        highlights: formData.highlights,
        lowlights: formData.lowlights,
        members_attended: formData.members_attended || [],
        visitors_attended: formData.visitors_attended || [],
        prospects_invited: formData.prospects_invited || [],
        pending_new_prospects: pendingNewProspects,
      });
      await onSubmit(payload);
      onClose();
    } catch (error: any) {
      console.error("Error submitting report:", error);
      const details = error?.response?.data?.details || error?.response?.data;
      const message =
        error?.message ||
        details?.non_field_errors?.[0] ||
        details?.prospects_attended?.[0] ||
        "Failed to submit report";
      setFormError(typeof message === "string" ? message : "Failed to submit report");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const invitersForProspectForm = people.filter(
    (p) => p.role !== "VISITOR" && p.role !== "ADMIN"
  );

  const prospectOptionsForForm = useMemo(() => {
    const fromCluster = clusterProspects;
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
    return [...fromCluster, ...fromPending];
  }, [clusterProspects, pendingNewProspects]);

  return (
    <form
      onSubmit={handleSubmit}
      onKeyDown={(e) => {
        // Prevent Enter key from submitting form when modal is open
        if (e.key === "Enter" && (showAddVisitorModal || showAddProspectModal)) {
          e.preventDefault();
          e.stopPropagation();
        }
      }}
      className="text-sm max-w-3xl"
    >
      {formError && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {formError}
        </div>
      )}

      {/* Cluster Selection */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Cluster *
        </label>
        <div className="relative" ref={dropdownRef}>
          <input
            type="text"
            value={selectedClusterDisplay || ""}
            onClick={() => setShowClusterDropdown(true)}
            readOnly
            placeholder="Select cluster..."
            className="w-full px-3 py-2 min-h-[44px] border border-gray-300 rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent cursor-pointer"
            required
          />
          {showClusterDropdown && (
            <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
              <div className="p-2 border-b border-gray-100 sticky top-0 bg-white">
                <input
                  type="text"
                  value={clusterSearchTerm}
                  onChange={(e) => handleClusterSearchChange(e.target.value)}
                  placeholder="Search clusters..."
                  className="w-full px-2 py-1.5 min-h-[44px] border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-ring focus:border-transparent"
                />
              </div>
              {filteredClusters.length > 0 ? (
                filteredClusters.map((cluster) => (
                  <button
                    key={cluster.id}
                    type="button"
                    onClick={() => handleClusterSelect(cluster.id)}
                    className="w-full px-3 py-2 min-h-[44px] text-left hover:bg-gray-100 focus:bg-gray-100 focus:outline-none"
                  >
                    <div className="font-medium text-gray-900">
                      {cluster.code
                        ? `${cluster.code} - ${cluster.name}`
                        : cluster.name}
                    </div>
                    {cluster.location && (
                      <div className="text-sm text-gray-500">
                        {cluster.location}
                      </div>
                    )}
                  </button>
                ))
              ) : (
                <div className="px-3 py-2 text-gray-500 text-sm">
                  No clusters found
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Basic Information Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Year *
          </label>
          <input
            type="number"
            value={formData.year || ""}
            onChange={(e) => handleChange("year", parseInt(e.target.value))}
            min="2020"
            max="2030"
            className="w-full px-3 py-2 min-h-[44px] border border-gray-300 rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Week Number *
          </label>
          <input
            type="number"
            value={formData.week_number || ""}
            onChange={(e) =>
              handleChange("week_number", parseInt(e.target.value))
            }
            min="1"
            max="53"
            className="w-full px-3 py-2 min-h-[44px] border border-gray-300 rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Meeting Date *
          </label>
          <input
            type="date"
            value={formData.meeting_date || ""}
            onChange={(e) => handleMeetingDateChange(e.target.value)}
            className="w-full px-3 py-2 min-h-[44px] border border-gray-300 rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Gathering Type *
          </label>
          <select
            value={formData.gathering_type || "PHYSICAL"}
            onChange={(e) =>
              handleChange("gathering_type", e.target.value as GatheringType)
            }
            className="w-full px-3 py-2 min-h-[44px] border border-gray-300 rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent"
            required
          >
            <option value="PHYSICAL">Physical</option>
            <option value="ONLINE">Online</option>
            <option value="HYBRID">Hybrid</option>
          </select>
        </div>
      </div>

      {/* Attendance Selection */}
      {loadingPeople ? (
        <div className="mb-6 text-center py-8 text-gray-500">
          Loading people data...
        </div>
      ) : (
        <>
          <AttendanceSelector
            label="Members Attended"
            selectedIds={(formData.members_attended || []).map((id) =>
              String(id)
            )}
            availablePeople={people}
            filterRole="MEMBER"
            onSelectionChange={handleMembersChange}
            selectedCluster={(selectedCluster as any) || undefined}
            previouslyAttendedIds={previouslyAttendedMembers}
            mostRecentAttendedIds={mostRecentAttendedMembers}
          />

          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">
                Visitors Attended
              </label>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  e.nativeEvent.stopImmediatePropagation();
                  setShowAddVisitorModal(true);
                  return false;
                }}
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                className="text-sm text-primary hover:text-primary font-medium border border-primary/30 hover:border-primary rounded-lg px-3 py-1.5 transition-colors"
              >
                + Add New Visitor
              </button>
            </div>
            <AttendanceSelector
              label=""
              selectedIds={(formData.visitors_attended || []).map((id) =>
                String(id)
              )}
              availablePeople={visitorOptions}
              filterRole="VISITOR"
              onSelectionChange={handleVisitorsChange}
              className="mb-0"
              selectedCluster={(selectedCluster as any) || undefined}
              previouslyAttendedIds={previouslyAttendedVisitors}
              mostRecentAttendedIds={mostRecentAttendedVisitors}
            />
          </div>

          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">
                Prospects Invited
              </label>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowAddProspectModal(true);
                }}
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                className="text-sm text-primary hover:text-primary font-medium border border-primary/30 hover:border-primary rounded-lg px-3 py-1.5 transition-colors"
              >
                + Add Prospect
              </button>
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
              className="mb-0"
              selectedCluster={(selectedCluster as any) || undefined}
            />
          </div>
        </>
      )}

      {/* Offerings */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Offerings (₱)
        </label>
        <input
          type="number"
          step="0.01"
          value={
            formData.offerings === "" || formData.offerings === "0"
              ? ""
              : String(formData.offerings)
          }
          onChange={(e) =>
            handleChange(
              "offerings",
              e.target.value === "" ? 0 : parseFloat(e.target.value)
            )
          }
          min="0"
          className="w-full px-3 py-2 min-h-[44px] border border-gray-300 rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent"
        />
      </div>

      {/* Add Visitor Modal */}
      <AddVisitorModal
        isOpen={showAddVisitorModal}
        onClose={() => setShowAddVisitorModal(false)}
        onAdd={handleCreateVisitor}
        defaultDateFirstAttended={formData.meeting_date}
        defaultFirstActivityAttended="CLUSTERING"
      />

      <Modal
        isOpen={showAddProspectModal}
        onClose={() => {
          setShowAddProspectModal(false);
          setProspectFormError(null);
        }}
        title="Add Prospect"
      >
        <p className="text-sm text-gray-600 mb-4">
          Invited visitors only — not yet attended. They are not added to People
          until they attend.
        </p>
        <ProspectForm
          inviters={invitersForProspectForm as unknown as Person[]}
          groups={[]}
          prospectOptions={prospectOptionsForForm}
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

      {/* Activities and Content */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Activities Held
        </label>
        <textarea
          value={formData.activities_held || ""}
          onChange={(e) => handleChange("activities_held", e.target.value)}
          rows={3}
          placeholder="Describe activities or events held during the cluster meeting..."
          className="w-full px-3 py-2 min-h-[44px] border border-gray-300 rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent"
        />
      </div>

      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Prayer Requests
        </label>
        <textarea
          value={formData.prayer_requests || ""}
          onChange={(e) => handleChange("prayer_requests", e.target.value)}
          rows={3}
          placeholder="List prayer requests shared during the meeting..."
          className="w-full px-3 py-2 min-h-[44px] border border-gray-300 rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent"
        />
      </div>

      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Testimonies
        </label>
        <textarea
          value={formData.testimonies || ""}
          onChange={(e) => handleChange("testimonies", e.target.value)}
          rows={3}
          placeholder="Share testimonies or encouraging stories from members..."
          className="w-full px-3 py-2 min-h-[44px] border border-gray-300 rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent"
        />
      </div>

      {/* Highlights and Lowlights */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Highlights
        </label>
        <textarea
          value={formData.highlights || ""}
          onChange={(e) => handleChange("highlights", e.target.value)}
          rows={3}
          placeholder="Positive events, achievements, or encouraging moments..."
          className="w-full px-3 py-2 min-h-[44px] border border-gray-300 rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent"
        />
      </div>

      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Lowlights
        </label>
        <textarea
          value={formData.lowlights || ""}
          onChange={(e) => handleChange("lowlights", e.target.value)}
          rows={3}
          placeholder="Challenges, concerns, or areas needing attention..."
          className="w-full px-3 py-2 min-h-[44px] border border-gray-300 rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent"
        />
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col-reverse sm:flex-row gap-4 pt-4">
        <Button
          variant="tertiary"
          className="w-full sm:flex-1 min-h-[44px]"
          onClick={onClose}
          disabled={loading}
        >
          Cancel
        </Button>
        <Button className="w-full sm:flex-1 min-h-[44px]" disabled={loading} type="submit">
          {loading
            ? "Saving..."
            : initialData
            ? "Update Report"
            : "Submit Report"}
        </Button>
      </div>
    </form>
  );
}
