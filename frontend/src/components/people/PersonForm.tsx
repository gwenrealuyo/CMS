import {
  useEffect,
  useRef,
  useState,
  useMemo,
  useCallback,
  type ReactNode,
} from "react";
import { Person, JourneyType, Family } from "@/src/types/person";
import { Cluster } from "@/src/types/cluster";
import { Branch } from "@/src/types/branch";
import Button from "@/src/components/ui/Button";
import { journeysApi, personDataToFormData } from "@/src/lib/api";
import PersonAvatar from "@/src/components/people/PersonAvatar";
import { compareJourneysNewestFirst } from "@/src/lib/journeySort";
import ConfirmationModal from "@/src/components/ui/ConfirmationModal";
import toast from "react-hot-toast";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useAuth } from "@/src/contexts/AuthContext";
import { useBranches } from "@/src/hooks/useBranches";
import { useEventTypeOptions } from "@/src/hooks/useEventTypeOptions";
import { getCreatableRoles } from "@/src/lib/personRolePermissions";
import {
  userCanEditVitalDates,
  userCanEditVitalDatesOnCreate,
} from "@/src/lib/clusterPermissions";
import { LockedControlTooltip } from "@/src/components/ui/LockedControlTooltip";
import SearchableSelect from "@/src/components/ui/SearchableSelect";
import PasswordInput from "@/src/components/ui/PasswordInput";
import {
  CLUSTER_BRANCH_CHIP_CLASSNAME,
  getBranchDisplayCode,
  getBranchOutlineBadgeStyle,
} from "@/src/lib/branchChipColor";
import {
  ALL_COUNTRIES,
  COUNTRY_META,
  DEFAULT_COUNTRY,
  getCountryDialCode,
} from "@/src/lib/countries";
import {
  describeDuplicatePerson,
  findMemberIdConflict,
  findPossibleNameDuplicates,
} from "@/src/lib/personDuplicates";
import { formatPersonName } from "@/src/lib/name";
import {
  PERSON_PHOTO_ACCEPT,
  PERSON_PHOTO_HELPER_TEXT,
  validatePersonPhoto,
} from "@/src/lib/personPhoto";
import { getLocalTodayDateString } from "@/src/lib/date";
import PersonDateField, {
  ESTIMATE_HELP,
} from "@/src/components/people/PersonDateField";

const JOURNEY_TYPE_OPTIONS: JourneyType[] = [
  "BAPTISM",
  "SPIRIT",
  "CLUSTER",
  "LESSON",
  "NOTE",
  "EVENT_ATTENDANCE",
  "SUNDAY_SCHOOL",
  "MINISTRY",
  "BRANCH_TRANSFER",
];

const formatJourneyTypeLabel = (type: JourneyType) =>
  type
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

interface PersonFormProps {
  onSubmit: (data: Partial<Person> | FormData) => Promise<Person | void>;
  onClose: () => void;
  onBackToProfile?: () => void;
  onJourneySaved?: (personId: string) => Promise<void> | void;
  initialData?: Partial<Person>;
  isEditingFromProfile?: boolean;
  startOnTimelineTab?: boolean;
  peopleOptions?: Person[];
  familyOptions?: Family[];
  clusterOptions?: Cluster[];
  panelLayout?: boolean;
}

const normalizeIdList = (ids?: (string | number)[] | null): string[] =>
  (ids || []).map((id) => String(id));

const VITAL_DATE_HINT =
  "Contact your cluster coordinator to request a change to this date.";
const STAFF_FIELD_HINT =
  "Contact your cluster coordinator to request a change.";

function LockedField({
  locked,
  hint,
  children,
}: {
  locked: boolean;
  hint: string;
  children: ReactNode;
}) {
  if (!locked) return <>{children}</>;
  return (
    <LockedControlTooltip label={hint} wrapperClassName="block w-full">
      <div className="pointer-events-none">{children}</div>
    </LockedControlTooltip>
  );
}

const PERSON_DATE_FIELDS: { key: keyof Person; label: string }[] = [
  { key: "date_of_birth", label: "Date of Birth" },
  { key: "date_first_invited", label: "Date First Invited" },
  { key: "date_first_attended", label: "Date First Attended" },
  { key: "water_baptism_date", label: "Water Baptism Date" },
  { key: "spirit_baptism_date", label: "Spirit Baptism Date" },
  { key: "lessons_started_at", label: "Lessons Started Date" },
  { key: "lessons_finished_at", label: "Lessons Finished Date" },
];

function EntityBranchChip({
  branchId,
  branches,
}: {
  branchId?: number | null;
  branches: Branch[];
}) {
  if (branchId == null) return null;
  const id = Number(branchId);
  const branch = branches.find((b) => b.id === id);
  if (!branch) return null;
  return (
    <span
      className={`${CLUSTER_BRANCH_CHIP_CLASSNAME} shrink-0`}
      style={getBranchOutlineBadgeStyle(branch.id, branch.is_headquarters)}
    >
      {getBranchDisplayCode(branch)}
    </span>
  );
}

export default function PersonForm({
  onSubmit,
  onClose,
  onBackToProfile,
  onJourneySaved,
  initialData,
  isEditingFromProfile = false,
  startOnTimelineTab = false,
  peopleOptions = [],
  familyOptions = [],
  clusterOptions = [],
  panelLayout = false,
}: PersonFormProps) {
  const {
    user,
    hasAnyModuleCoordinatorAssignment,
    isPlainMember,
    isSeniorCoordinator,
    isModuleCoordinator,
  } = useAuth();
  const { eventTypes } = useEventTypeOptions();
  const plainMember = isPlainMember();
  const isAdmin = user?.role === "ADMIN";
  const isCreating = !initialData?.id;
  const editingSelf = Boolean(
    initialData?.id &&
    user?.id != null &&
    String(initialData.id) === String(user.id),
  );
  /** Plain member editing their own record: profile fields yes; staff fields locked. */
  const selfEditLocked = plainMember && editingSelf;
  const todayDateMax = getLocalTodayDateString();

  const clusterAuthCtx = useMemo(
    () => ({
      userId: user?.id,
      role: user?.role,
      isSeniorCoordinator,
      isModuleCoordinator,
    }),
    [user?.id, user?.role, isSeniorCoordinator, isModuleCoordinator],
  );
  const [autoGeneratePassword, setAutoGeneratePassword] = useState(true);
  const [manualPassword, setManualPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Determine initial tab: use timeline only if user has permission and startOnTimelineTab is true
  const canViewTimeline = initialData?.can_view_journey_timeline !== false;
  const initialTab =
    startOnTimelineTab && canViewTimeline ? "timeline" : "basic";
  const [activeTab, setActiveTab] = useState<"basic" | "timeline">(initialTab);

  const validEditRoles = ["MEMBER", "VISITOR", "PASTOR", "ADMIN"] as const;
  const normalizedRole =
    initialData?.role &&
    (validEditRoles as readonly string[]).includes(initialData.role)
      ? initialData.role
      : initialData?.role
        ? "MEMBER"
        : undefined;
  const defaultRole = normalizedRole ?? (plainMember ? "VISITOR" : "MEMBER");
  const initialPersonId = initialData?.id ? String(initialData.id) : undefined;
  const initialFamilyIds = useMemo(() => {
    if (initialData?.family_ids) {
      return normalizeIdList(initialData.family_ids as (string | number)[]);
    }
    if (!initialPersonId) return [];
    return familyOptions
      .filter((f) =>
        (f.members || []).some((m) => String(m) === initialPersonId),
      )
      .map((f) => String(f.id));
  }, [initialData?.family_ids, initialPersonId, familyOptions]);
  const initialClusterIds = useMemo(() => {
    if (initialData?.cluster_ids) {
      return normalizeIdList(initialData.cluster_ids as (string | number)[]);
    }
    if (!initialPersonId) return [];
    return clusterOptions
      .filter((c) =>
        (c.members || []).some((m) => String(m) === initialPersonId),
      )
      .map((c) => String(c.id));
  }, [initialData?.cluster_ids, initialPersonId, clusterOptions]);

  const [formData, setFormData] = useState<Partial<Person>>({
    status: "ACTIVE",
    journeys: [],
    country: initialData?.country || DEFAULT_COUNTRY,
    ...initialData,
    role: defaultRole,
    family_ids: initialFamilyIds,
    cluster_ids: initialClusterIds,
    // Create: show creator's branch (API sets it for plain members; editable roles can change it)
    branch: isCreating
      ? (initialData?.branch ?? user?.branch ?? undefined)
      : initialData?.branch,
  });

  const [familySearch, setFamilySearch] = useState("");
  const [showFamilyDropdown, setShowFamilyDropdown] = useState(false);
  const [clusterSearch, setClusterSearch] = useState("");
  const [showClusterDropdown, setShowClusterDropdown] = useState(false);

  const creatableRoles = useMemo(() => {
    if (plainMember) {
      if (editingSelf && initialData?.role) {
        return [initialData.role];
      }
      return formData.water_baptism_date ? ["MEMBER"] : ["VISITOR"];
    }
    const roles = getCreatableRoles(user, false);
    if (
      initialData?.role === "ADMIN" &&
      !roles.includes("ADMIN") &&
      !isCreating
    ) {
      return [...roles, "ADMIN"];
    }
    return roles;
  }, [
    plainMember,
    editingSelf,
    user,
    initialData?.role,
    isCreating,
    formData.water_baptism_date,
  ]);

  const roleSelectDisabled =
    plainMember || (initialData?.role === "ADMIN" && !isAdmin);
  const statusSelectDisabled = selfEditLocked;

  const canEditVitalDates = useMemo(() => {
    if (isCreating) {
      return userCanEditVitalDatesOnCreate(clusterAuthCtx);
    }
    return userCanEditVitalDates(
      formData.cluster_ids || [],
      clusterOptions,
      clusterAuthCtx,
    );
  }, [isCreating, clusterAuthCtx, formData.cluster_ids, clusterOptions]);

  // Invite/attend + first activity: writable when creating a visitor (API accepts on create)
  const canEditInviteAttendDates =
    canEditVitalDates || (isCreating && formData.role === "VISITOR");

  const showLoginAccess = isAdmin && isCreating && formData.role !== "VISITOR";

  const [loading, setLoading] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoRemoved, setPhotoRemoved] = useState(false);
  const [showPhotoRemoveConfirmation, setShowPhotoRemoveConfirmation] =
    useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const { branches, getBranches } = useBranches();

  // Users who submit branch on create/update via API (not MEMBER visitor flow — branch server-set)
  const canEditBranch =
    user?.role === "ADMIN" ||
    user?.role === "PASTOR" ||
    hasAnyModuleCoordinatorAssignment();

  // Fetch branches on mount
  useEffect(() => {
    getBranches();
  }, [getBranches]);

  // Prefill membership when options load after mount (edit without API IDs yet)
  useEffect(() => {
    if (initialData?.family_ids) return;
    if (!initialPersonId || initialFamilyIds.length === 0) return;
    setFormData((prev) => {
      if ((prev.family_ids || []).length > 0) return prev;
      return { ...prev, family_ids: initialFamilyIds };
    });
  }, [initialData?.family_ids, initialPersonId, initialFamilyIds]);

  useEffect(() => {
    if (initialData?.cluster_ids) return;
    if (!initialPersonId || initialClusterIds.length === 0) return;
    setFormData((prev) => {
      if ((prev.cluster_ids || []).length > 0) return prev;
      return { ...prev, cluster_ids: initialClusterIds };
    });
  }, [initialData?.cluster_ids, initialPersonId, initialClusterIds]);

  useEffect(() => {
    if (plainMember && !initialData?.id && formData.role !== "VISITOR") {
      const hasWaterBaptism = Boolean(formData.water_baptism_date);
      if (!hasWaterBaptism) {
        setFormData((prev) => ({ ...prev, role: "VISITOR" }));
      }
    }
  }, [
    formData.role,
    formData.water_baptism_date,
    initialData?.id,
    plainMember,
  ]);
  const [tabSwitchConfirmation, setTabSwitchConfirmation] = useState<{
    isOpen: boolean;
    targetTab: "basic" | "timeline" | null;
  }>({ isOpen: false, targetTab: null });
  // Toast validation removed per request

  // Track initial journeys to avoid re-creating unchanged ones on save
  const initialJourneyKeysRef = useRef<Set<string>>(new Set());
  const journeyContentKey = (m: {
    date?: string;
    type?: string;
    title?: string;
    description?: string;
    verified_by?: string | null;
  }) =>
    `${m.date ?? ""}|${m.type ?? ""}|${m.title ?? ""}|${m.description ?? ""}|${
      m.verified_by ?? ""
    }`;
  useEffect(() => {
    const initialKeys = new Set(
      (initialData?.journeys || []).map((m: any) => journeyContentKey(m)),
    );
    initialJourneyKeysRef.current = initialKeys;
  }, [initialData]);

  // Phone management: country code and local number
  const initialCode = (() => {
    const c = (initialData?.country || DEFAULT_COUNTRY) as string;
    return getCountryDialCode(c);
  })();
  const initialLocal = (() => {
    const phoneVal = (initialData?.phone || "") as string;
    if (!phoneVal) return "";
    // naive parse: remove non-digits, then strip possible country code digits
    const digits = phoneVal.replace(/[^0-9+]/g, "");
    if (digits.startsWith("+")) {
      // try match by known codes (longest first so +1 does not steal +1868-style codes)
      const knownCodes = Object.values(COUNTRY_META)
        .map((m) => m.code)
        .sort((a, b) => b.length - a.length);
      const match = knownCodes.find((code) => digits.startsWith(code));
      if (match) return digits.slice(match.length);
      return digits.replace(/^\+\d{1,3}/, "");
    }
    return digits;
  })();

  const [phoneCountryCode, setPhoneCountryCode] = useState<string>(initialCode);
  const [phoneLocal, setPhoneLocal] = useState<string>(initialLocal);

  const syncPhoneToForm = (code: string, local: string) => {
    setFormData((prev) => ({ ...prev, phone: `${code}${local}` }));
    // Note: hasUnsavedChanges is set in the onChange handler that calls this function
  };

  const handleTabSwitch = (targetTab: "basic" | "timeline") => {
    // Prevent switching to timeline tab if user doesn't have permission
    if (targetTab === "timeline" && !canViewTimeline) {
      return;
    }
    if (hasUnsavedChanges && activeTab === "basic") {
      setTabSwitchConfirmation({ isOpen: true, targetTab });
    } else {
      setActiveTab(targetTab);
    }
  };

  // Redirect to basic tab if user somehow accesses timeline tab without permission
  useEffect(() => {
    if (activeTab === "timeline" && !canViewTimeline) {
      setActiveTab("basic");
    }
  }, [activeTab, canViewTimeline]);

  const [newJourney, setNewJourney] = useState<{
    date: string;
    type: JourneyType;
    title: string;
    description: string;
    verified_by: string;
  }>({
    date: new Date().toISOString().slice(0, 10),
    type: "NOTE",
    title: "",
    description: "",
    verified_by: "",
  });

  const [editingJourneyIndex, setEditingJourneyIndex] = useState<number | null>(
    null,
  );
  const [journeySearch, setJourneySearch] = useState("");
  const [journeyFilter, setJourneyFilter] = useState<JourneyType | "ALL">(
    "ALL",
  );
  const journeyListRef = useRef<HTMLDivElement>(null);

  const applyWaterBaptismRoleRules = (
    next: Partial<Person>,
    waterBaptismDate: string,
  ): Partial<Person> => {
    if (waterBaptismDate && next.role === "VISITOR") {
      return { ...next, role: "MEMBER", status: "ACTIVE" };
    }
    if (!waterBaptismDate && next.role === "MEMBER") {
      return {
        ...next,
        role: "VISITOR",
        status: next.date_first_attended ? "ONGOING" : "NO_RESPONSE",
      };
    }
    return next;
  };

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => {
      let next = { ...prev, [name]: value } as Partial<Person>;
      if (name === "role") {
        if (value === "VISITOR") {
          const visitorStatuses = ["ONGOING", "NO_RESPONSE", "DECEASED"];
          if (!visitorStatuses.includes(next.status || "")) {
            next.status = "ONGOING";
          }
        } else {
          if (next.status === "ONGOING" || next.status === "NO_RESPONSE") {
            next.status = "ACTIVE";
          }
        }
      }
      if (name === "gender" && value === "MALE") {
        next.maiden_name = "";
      }
      if (name === "water_baptism_date") {
        next = applyWaterBaptismRoleRules(next, value);
      }
      return next;
    });
    setHasUnsavedChanges(true);
  };

  const handleDateFieldChange = (name: keyof Person, value: string) => {
    setFormData((prev) => {
      let next = { ...prev, [name]: value } as Partial<Person>;
      if (name === "water_baptism_date") {
        next = applyWaterBaptismRoleRules(next, value);
      }
      return next;
    });
    setHasUnsavedChanges(true);
  };

  const statusOptions =
    formData.role === "VISITOR"
      ? ["ONGOING", "NO_RESPONSE", "DECEASED"]
      : ["ACTIVE", "SEMIACTIVE", "INACTIVE", "DORMANT", "FALLAWAY", "DECEASED"];

  useEffect(() => {
    setPhotoFile(null);
    setPhotoRemoved(false);
    if (photoInputRef.current) {
      photoInputRef.current.value = "";
    }
  }, [initialData?.id]);

  const photoPreviewUrl = useMemo(() => {
    if (photoFile) {
      return URL.createObjectURL(photoFile);
    }
    return null;
  }, [photoFile]);

  useEffect(() => {
    return () => {
      if (photoPreviewUrl) {
        URL.revokeObjectURL(photoPreviewUrl);
      }
    };
  }, [photoPreviewUrl]);

  const photoPreviewPerson = useMemo(
    () => ({
      id: initialData?.id,
      first_name: formData.first_name,
      last_name: formData.last_name,
      photo: photoRemoved ? undefined : photoPreviewUrl || initialData?.photo,
    }),
    [
      initialData?.id,
      initialData?.photo,
      formData.first_name,
      formData.last_name,
      photoPreviewUrl,
      photoRemoved,
    ],
  );

  const showPhotoPreview =
    Boolean(photoPreviewUrl) || Boolean(initialData?.photo && !photoRemoved);

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const result = await validatePersonPhoto(file);
    if (!result.ok) {
      toast.error(result.message);
      if (photoInputRef.current) {
        photoInputRef.current.value = "";
      }
      return;
    }

    setPhotoFile(file);
    setPhotoRemoved(false);
    setHasUnsavedChanges(true);
  };

  const handleClearSelectedPhoto = () => {
    setPhotoFile(null);
    if (photoInputRef.current) {
      photoInputRef.current.value = "";
    }
    setHasUnsavedChanges(true);
  };

  const handleRemovePhoto = () => {
    setPhotoRemoved(true);
    setPhotoFile(null);
    if (photoInputRef.current) {
      photoInputRef.current.value = "";
    }
    setHasUnsavedChanges(true);
  };

  const handleAddJourney = () => {
    if (!newJourney.date || !newJourney.title.trim()) {
      return;
    }
    // If editing an existing person, persist immediately so it remains after closing
    const existingUserId = (initialData?.id || (formData as any).id) as
      | string
      | undefined;
    if (existingUserId) {
      (async () => {
        try {
          const created = await journeysApi.create({
            user: existingUserId,
            title: newJourney.title,
            date: newJourney.date,
            type: newJourney.type,
            description: newJourney.description,
            verified_by: newJourney.verified_by || undefined,
          });
          await finishJourneyMutation(existingUserId);
          if (!(isEditingFromProfile && onBackToProfile)) {
            // optimistic append so it shows instantly
            const createdId = (created?.data as any)?.id || crypto.randomUUID();
            setFormData((prev) => ({
              ...prev,
              journeys: [
                ...(prev.journeys || []),
                {
                  id: createdId,
                  user: existingUserId,
                  ...newJourney,
                } as any,
              ],
            }));
          }
          toast.success("Journey event added successfully.");
        } catch (e: any) {
          console.error("Failed to create journey immediately:", e);
          toast.error(
            e.response?.data?.message ||
              e.message ||
              "Failed to add journey event.",
          );
        }
      })();
    } else {
      const id = crypto.randomUUID();
      setFormData((prev) => ({
        ...prev,
        journeys: [
          ...(prev.journeys || []),
          {
            id,
            user: prev.id || "",
            ...newJourney,
          } as any,
        ],
      }));
      toast.success(
        "Journey event added. It will be saved when you submit the form.",
      );
    }
    setNewJourney({
      date: new Date().toISOString().slice(0, 10),
      type: "NOTE",
      title: "",
      description: "",
      verified_by: "",
    });
  };

  const handleEditJourney = (index: number) => {
    const journey = formData.journeys?.[index];
    if (journey) {
      setEditingJourneyIndex(index);
      setNewJourney({
        date: journey.date || new Date().toISOString().slice(0, 10),
        type: journey.type || "NOTE",
        title: journey.title || "",
        description: journey.description || "",
        verified_by: journey.verified_by ? String(journey.verified_by) : "",
      });
    }
  };

  const handleUpdateJourney = () => {
    if (
      !newJourney.date ||
      !newJourney.title.trim() ||
      editingJourneyIndex === null
    ) {
      return;
    }

    const existingUserId = (initialData?.id || (formData as any).id) as
      | string
      | undefined;
    const currentJourneys = formData.journeys || [];
    const journeyToUpdate = currentJourneys[editingJourneyIndex];

    const journeyUnchanged =
      !!journeyToUpdate &&
      journeyContentKey(journeyToUpdate) === journeyContentKey(newJourney);
    if (journeyUnchanged) {
      handleCancelEdit();
      return;
    }

    if (existingUserId && journeyToUpdate?.id) {
      (async () => {
        try {
          await journeysApi.update(journeyToUpdate.id, {
            user: existingUserId,
            title: newJourney.title,
            date: newJourney.date,
            type: newJourney.type,
            description: newJourney.description,
            verified_by: newJourney.verified_by || undefined,
          });
          await finishJourneyMutation(existingUserId);

          if (!(isEditingFromProfile && onBackToProfile)) {
            // Update the journey in the form data
            setFormData((prev) => {
              const updatedJourneys = [...(prev.journeys || [])];
              updatedJourneys[editingJourneyIndex] = {
                ...updatedJourneys[editingJourneyIndex],
                ...newJourney,
              } as any;
              return {
                ...prev,
                journeys: updatedJourneys,
              };
            });
          }

          toast.success("Journey event updated successfully.");
          handleCancelEdit();
        } catch (e: any) {
          console.error("Failed to update journey:", e);
          toast.error(
            e.response?.data?.message ||
              e.message ||
              "Failed to update journey event.",
          );
        }
      })();
    } else {
      // For new users, just update the local state
      setFormData((prev) => {
        const updatedJourneys = [...(prev.journeys || [])];
        updatedJourneys[editingJourneyIndex] = {
          ...updatedJourneys[editingJourneyIndex],
          ...newJourney,
        } as any;
        return {
          ...prev,
          journeys: updatedJourneys,
        };
      });
      toast.success(
        "Journey event updated. It will be saved when you submit the form.",
      );
      handleCancelEdit();
    }
  };

  const handleCancelEdit = () => {
    setEditingJourneyIndex(null);
    setNewJourney({
      date: new Date().toISOString().slice(0, 10),
      type: "NOTE",
      title: "",
      description: "",
      verified_by: "",
    });
  };

  const finishJourneyMutation = async (personId: string) => {
    await onJourneySaved?.(personId);
    if (isEditingFromProfile && onBackToProfile) {
      onBackToProfile();
    }
  };

  // Delete journey confirmation state
  const filteredAndSortedJourneys = useMemo(() => {
    let filtered = formData.journeys || [];

    // Filter by search
    if (journeySearch.trim()) {
      const searchLower = journeySearch.toLowerCase();
      filtered = filtered.filter(
        (j) =>
          j.title?.toLowerCase().includes(searchLower) ||
          j.description?.toLowerCase().includes(searchLower) ||
          j.type?.toLowerCase().includes(searchLower),
      );
    }

    // Filter by type
    if (journeyFilter !== "ALL") {
      filtered = filtered.filter((j) => j.type === journeyFilter);
    }

    return [...filtered].sort(compareJourneysNewestFirst);
  }, [formData.journeys, journeySearch, journeyFilter]);

  // Virtualizer for journey list
  const virtualizer = useVirtualizer({
    count: filteredAndSortedJourneys.length,
    getScrollElement: () => journeyListRef.current,
    estimateSize: () => 100, // Estimated height per journey item
    overscan: 5, // Render 5 extra items outside viewport for smooth scrolling
  });

  // Map original index to filtered index for edit/delete operations
  const getOriginalJourneyIndex = (filteredIndex: number): number => {
    const journey = filteredAndSortedJourneys[filteredIndex];
    return formData.journeys?.findIndex((j) => j.id === journey.id) ?? -1;
  };

  // Delete journey confirmation state
  const [journeyDeleteConfirm, setJourneyDeleteConfirm] = useState<{
    isOpen: boolean;
    index: number | null;
    loading: boolean;
  }>({ isOpen: false, index: null, loading: false });
  const [duplicateNameConfirm, setDuplicateNameConfirm] = useState<{
    isOpen: boolean;
    matches: Person[];
  }>({ isOpen: false, matches: [] });

  const openJourneyDelete = (index: number) => {
    setJourneyDeleteConfirm({ isOpen: true, index, loading: false });
  };

  const closeJourneyDelete = () => {
    setJourneyDeleteConfirm({ isOpen: false, index: null, loading: false });
  };

  const confirmJourneyDelete = async () => {
    if (journeyDeleteConfirm.index === null) return;
    const idx = journeyDeleteConfirm.index;
    const current = formData.journeys || [];
    const toDelete = current[idx] as any;
    const existingUserId = (initialData?.id || (formData as any).id) as
      | string
      | undefined;
    try {
      setJourneyDeleteConfirm((p) => ({ ...p, loading: true }));
      if (toDelete?.id && existingUserId) {
        await journeysApi.delete(toDelete.id);
        await finishJourneyMutation(existingUserId);
      }
      if (!(isEditingFromProfile && onBackToProfile)) {
        setFormData((prev) => ({
          ...prev,
          journeys: (prev.journeys || []).filter((_, i) => i !== idx),
        }));
      }
      closeJourneyDelete();
    } catch (e) {
      console.error("Failed to delete journey:", e);
      setJourneyDeleteConfirm((p) => ({ ...p, loading: false }));
    }
  };

  const performSave = useCallback(async () => {
    // Extract journeys from formData before submitting person
    const journeys = formData.journeys || [];
    const personData = { ...formData };
    delete personData.journeys;
    delete personData.photo;
    personData.family_ids = normalizeIdList(formData.family_ids);
    personData.cluster_ids = normalizeIdList(formData.cluster_ids);

    if (showLoginAccess) {
      if (autoGeneratePassword) {
        personData.generate_temporary_password = true;
      } else {
        personData.initial_password = manualPassword;
        personData.generate_temporary_password = false;
      }
    }

    const submitData: Partial<Person> | FormData = photoFile
      ? personDataToFormData(personData, photoFile)
      : photoRemoved && initialData?.id
        ? { ...personData, photo: null }
        : personData;

    // Submit person data first
    let result: Person | void;
    try {
      setLoading(true);
      result = await onSubmit(submitData);

      // If person was created/updated successfully and we have new journeys, save only new/changed ones
      if (result && typeof result === "object" && "id" in result) {
        const initialJourneyIds = new Set(
          (initialData?.journeys || [])
            .map((j: any) => (j?.id != null ? String(j.id) : ""))
            .filter(Boolean),
        );
        const newOrChanged = (journeys || []).filter((m: any) => {
          if (!m.date && !m.title && !m.description) return false;
          // Already-persisted journeys from initial load must not be recreated
          if (m.id != null && initialJourneyIds.has(String(m.id))) {
            return false;
          }
          return !initialJourneyKeysRef.current.has(journeyContentKey(m));
        });
        if (newOrChanged.length > 0) {
          try {
            for (const journey of newOrChanged) {
              await journeysApi.create({
                user: (result as { id: string }).id,
                title: journey.title,
                date: journey.date,
                type: journey.type,
                description: journey.description,
                verified_by: journey.verified_by || undefined,
              });
            }
          } catch (error) {
            console.error("Failed to save journeys:", error);
            toast.error(
              "Person saved, but some journey events failed to save.",
            );
          }
        }
      }

      toast.success(
        initialData?.id
          ? "Person updated successfully."
          : "Person created successfully.",
      );
      setHasUnsavedChanges(false);
      setPhotoFile(null);
      setPhotoRemoved(false);
    } catch (error: any) {
      console.error("Failed to save person:", error);
      const apiMessage =
        error?.response?.data?.message ||
        error?.response?.data?.detail ||
        error?.message;
      toast.error(
        apiMessage ||
          (initialData?.id
            ? "Failed to update person. Please try again."
            : "Failed to create person. Please try again."),
      );
      throw error; // Re-throw to let parent handle if needed
    } finally {
      setLoading(false);
    }
  }, [
    formData,
    showLoginAccess,
    autoGeneratePassword,
    manualPassword,
    photoFile,
    photoRemoved,
    initialData?.id,
    initialData?.journeys,
    onSubmit,
  ]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const skipBranchRequirement =
      !canEditBranch || (plainMember && !initialData?.id);

    if (!skipBranchRequirement && formData.branch == null) {
      toast.error("Please select a branch.");
      return;
    }

    if (formData.has_finished_lessons && !formData.lessons_finished_at) {
      toast.error(
        "Set Lessons Finished Date when marking this person as finished in NC lessons.",
      );
      return;
    }

    for (const { key, label } of PERSON_DATE_FIELDS) {
      const value = formData[key];
      if (typeof value === "string" && value && value > todayDateMax) {
        toast.error(`${label} cannot be in the future.`);
        return;
      }
    }

    if (showLoginAccess && !autoGeneratePassword) {
      if (!manualPassword) {
        toast.error("Please enter a temporary password.");
        return;
      }
      if (manualPassword.length < 8) {
        toast.error("Password must be at least 8 characters long.");
        return;
      }
      if (!/[a-zA-Z]/.test(manualPassword) || !/[0-9]/.test(manualPassword)) {
        toast.error(
          "Password must contain at least one letter and one number.",
        );
        return;
      }
      if (manualPassword !== confirmPassword) {
        toast.error("Passwords do not match.");
        return;
      }
    }

    const memberIdConflict = findMemberIdConflict(peopleOptions, {
      memberId: formData.member_id,
      excludeId: initialData?.id,
    });
    if (memberIdConflict) {
      toast.error(
        `LAMP ID "${formData.member_id?.trim()}" is already used by ${formatPersonName(memberIdConflict)}.`,
      );
      return;
    }

    if (peopleOptions.length > 0) {
      const nameMatches = findPossibleNameDuplicates(peopleOptions, {
        firstName: formData.first_name,
        lastName: formData.last_name,
        branch: formData.branch ?? null,
        excludeId: initialData?.id,
      });
      if (nameMatches.length > 0) {
        setDuplicateNameConfirm({ isOpen: true, matches: nameMatches });
        return;
      }
    }

    await performSave();
  };

  return (
    <>
      <form
        onSubmit={handleSubmit}
        className={`text-sm w-full ${
          panelLayout ? "p-4 sm:p-5 space-y-6 mt-0 max-w-3xl" : "space-y-4"
        }`}
      >
        {/* Tabs */}
        <div className="flex border-b border-gray-200 mb-0">
          <button
            type="button"
            className={`px-4 py-2 font-medium ${
              activeTab === "basic"
                ? "border-b-2 border-primary text-primary"
                : "text-gray-500"
            }`}
            onClick={() => handleTabSwitch("basic")}
          >
            Basic Info
          </button>
          {canViewTimeline && (
            <button
              type="button"
              className={`px-4 py-2 font-medium ${
                activeTab === "timeline"
                  ? "border-b-2 border-primary text-primary"
                  : "text-gray-500"
              }`}
              onClick={() => handleTabSwitch("timeline")}
            >
              Journey Timeline
            </button>
          )}
        </div>

        {/* BASIC INFO TAB */}
        {activeTab === "basic" && (
          <div className="space-y-6">
            <div className="pt-2">
              <div className="p-0">
                <h3 className="text-sm font-semibold text-gray-900 mb-1.5">
                  Personal Details
                </h3>
                <p className="text-xs text-gray-500 mb-5">
                  Basic identity information.
                </p>
                <div className="space-y-4">
                  {/* Name Fields: first / middle / last / narrow suffix */}
                  <div
                    className={`grid grid-cols-1 sm:grid-cols-2 gap-4 ${
                      panelLayout
                        ? "md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(2.5rem,3.5rem)]"
                        : "md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(4.5rem,6.5rem)]"
                    }`}
                  >
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        First Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        name="first_name"
                        required
                        value={formData.first_name || ""}
                        onChange={handleChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Middle Name
                      </label>
                      <input
                        type="text"
                        name="middle_name"
                        value={formData.middle_name || ""}
                        onChange={handleChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent"
                      />
                    </div>
                    <div className="sm:col-span-2 md:col-span-1">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Last Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        name="last_name"
                        required
                        value={formData.last_name || ""}
                        onChange={handleChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent"
                      />
                    </div>
                    <div className="sm:col-span-2 md:col-span-1">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Suffix
                      </label>
                      <input
                        type="text"
                        name="suffix"
                        value={(formData as any).suffix || ""}
                        onChange={handleChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent"
                      />
                    </div>
                  </div>

                  {/* Nickname (narrow) / Maiden (wider) / Gender (narrow) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.8fr)_minmax(0,0.9fr)] gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Nickname
                      </label>
                      <input
                        type="text"
                        name="nickname"
                        value={(formData as any).nickname || ""}
                        onChange={handleChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Only if they go by a name other than their first name.
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Maiden Name
                      </label>
                      <input
                        type="text"
                        name="maiden_name"
                        value={
                          formData.gender === "MALE"
                            ? ""
                            : formData.maiden_name || ""
                        }
                        onChange={handleChange}
                        disabled={formData.gender === "MALE"}
                        className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent ${
                          formData.gender === "MALE"
                            ? "bg-gray-100 cursor-not-allowed"
                            : ""
                        }`}
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        {formData.gender === "MALE"
                          ? "Not applicable when gender is male."
                          : "Previous middle and last name before marriage, if different from their current name."}
                      </p>
                    </div>
                    <div className="sm:col-span-2 md:col-span-1">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Gender
                      </label>
                      <select
                        name="gender"
                        value={formData.gender || ""}
                        onChange={handleChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent"
                      >
                        <option value="">Select gender</option>
                        <option value="MALE">Male</option>
                        <option value="FEMALE">Female</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-2">
              <div className="p-0">
                <h3 className="text-sm font-semibold text-gray-900 mb-1.5">
                  Contact
                </h3>
                <p className="text-xs text-gray-500 mb-5">
                  How we can reach them.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Email
                    </label>
                    <input
                      type="email"
                      name="email"
                      value={formData.email || ""}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Phone Number
                    </label>
                    <div className="flex gap-2 items-stretch">
                      <span className="px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-700 select-none flex items-center shrink-0">
                        {phoneCountryCode}
                      </span>
                      <input
                        type="tel"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={phoneLocal}
                        onChange={(e) => {
                          const digitsOnly = e.target.value.replace(/\D/g, "");
                          const selectedCountry = Object.entries(
                            COUNTRY_META,
                          ).find(
                            ([, meta]) => meta.code === phoneCountryCode,
                          )?.[1];
                          const max = selectedCountry?.localMax ?? 10;
                          const next = digitsOnly.slice(0, max);
                          setPhoneLocal(next);
                          syncPhoneToForm(phoneCountryCode, next);
                          setHasUnsavedChanges(true);
                        }}
                        placeholder="##########"
                        className="flex-1 min-w-0 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Country
                    </label>
                    <select
                      name="country"
                      value={formData.country || DEFAULT_COUNTRY}
                      onChange={(e) => {
                        const newCountry = e.target.value;
                        setFormData((prev) => ({
                          ...prev,
                          country: newCountry,
                        }));
                        setHasUnsavedChanges(true);
                        const meta = COUNTRY_META[newCountry];
                        if (meta) {
                          setPhoneCountryCode(meta.code);
                          const nextLocal = phoneLocal.slice(0, meta.localMax);
                          setPhoneLocal(nextLocal);
                          syncPhoneToForm(meta.code, nextLocal);
                        }
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent"
                    >
                      {ALL_COUNTRIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                      {formData.country &&
                        !ALL_COUNTRIES.includes(formData.country) && (
                          <option value={formData.country}>
                            {formData.country}
                          </option>
                        )}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Address
                    </label>
                    <textarea
                      name="address"
                      value={formData.address || ""}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div>
              <div className="p-0">
                <h3 className="text-sm font-semibold text-gray-900 mb-2">
                  Account & Role
                </h3>
                <p className="text-xs text-gray-500 mb-4">
                  Membership and system roles.
                </p>
                {plainMember && !editingSelf && (
                  <p className="text-xs text-primary mb-4">
                    Members can only add visitors. The role is fixed to Visitor.
                  </p>
                )}
                {selfEditLocked && (
                  <p className="text-xs text-gray-500 mb-4">
                    Role, status, branch, and vital dates are managed by your
                    cluster coordinator.
                  </p>
                )}
                {!canEditVitalDates && !selfEditLocked && (
                  <p className="text-xs text-gray-500 mb-4">
                    {isCreating && formData.role === "VISITOR"
                      ? "Baptism and lessons dates can only be set by a cluster coordinator (or higher)."
                      : "Vital dates can only be changed by a cluster coordinator (or higher)."}
                  </p>
                )}
                {!plainMember &&
                  !isAdmin &&
                  hasAnyModuleCoordinatorAssignment() && (
                    <p className="text-xs text-gray-500 mb-4">
                      Login passwords for new members are set by an
                      administrator.
                    </p>
                  )}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Role
                    </label>
                    <LockedField
                      locked={roleSelectDisabled && selfEditLocked}
                      hint={STAFF_FIELD_HINT}
                    >
                      <select
                        name="role"
                        value={formData.role}
                        onChange={handleChange}
                        disabled={roleSelectDisabled}
                        className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent ${
                          roleSelectDisabled
                            ? "bg-gray-100 cursor-not-allowed"
                            : ""
                        }`}
                      >
                        {creatableRoles.map((role) => (
                          <option key={role} value={role}>
                            {role.charAt(0) + role.slice(1).toLowerCase()}
                          </option>
                        ))}
                      </select>
                    </LockedField>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Status
                    </label>
                    <LockedField
                      locked={statusSelectDisabled}
                      hint={STAFF_FIELD_HINT}
                    >
                      <select
                        name="status"
                        value={formData.status}
                        onChange={handleChange}
                        disabled={statusSelectDisabled}
                        className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent ${
                          statusSelectDisabled
                            ? "bg-gray-100 cursor-not-allowed"
                            : ""
                        }`}
                      >
                        {statusOptions.map((status) => (
                          <option key={status} value={status}>
                            {status === "FALLAWAY"
                              ? "Fall Away"
                              : status === "SEMIACTIVE"
                                ? "Semi-active"
                                : status === "NO_RESPONSE"
                                  ? "No Response"
                                  : status.charAt(0) +
                                    status.slice(1).toLowerCase()}
                          </option>
                        ))}
                      </select>
                    </LockedField>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      LAMP ID
                    </label>
                    <LockedField
                      locked={selfEditLocked}
                      hint={STAFF_FIELD_HINT}
                    >
                      <input
                        type="text"
                        name="member_id"
                        value={formData.member_id || ""}
                        onChange={handleChange}
                        disabled={selfEditLocked}
                        className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent ${
                          selfEditLocked ? "bg-gray-100 cursor-not-allowed" : ""
                        }`}
                      />
                    </LockedField>
                    <p className="text-xs text-gray-500 mt-1">
                      Must be unique when set
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Branch <span className="text-red-500">*</span>
                    </label>
                    <LockedField
                      locked={!canEditBranch || selfEditLocked}
                      hint={STAFF_FIELD_HINT}
                    >
                      <select
                        name="branch"
                        value={formData.branch ?? ""}
                        onChange={(e) => {
                          const value =
                            e.target.value === ""
                              ? undefined
                              : Number(e.target.value);
                          setFormData((prev) => ({
                            ...prev,
                            branch: value,
                          }));
                          setHasUnsavedChanges(true);
                        }}
                        disabled={!canEditBranch || selfEditLocked}
                        required={
                          canEditBranch && !(plainMember && !initialData?.id)
                        }
                        className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent ${
                          !canEditBranch || selfEditLocked
                            ? "bg-gray-100 cursor-not-allowed"
                            : ""
                        }`}
                      >
                        <option value="">
                          {canEditBranch ? "Select branch" : "No branch"}
                        </option>
                        {branches
                          .filter(
                            (b) =>
                              b.is_active ||
                              Number(b.id) === Number(formData.branch),
                          )
                          .map((branch) => (
                            <option key={branch.id} value={branch.id}>
                              {branch.name}
                              {branch.is_headquarters ? " (HQ)" : ""}
                            </option>
                          ))}
                      </select>
                    </LockedField>
                    {(!canEditBranch || selfEditLocked) && (
                      <p className="text-xs text-gray-500 mt-1">
                        {selfEditLocked
                          ? "Contact your cluster coordinator to request a change."
                          : "Branch is set automatically when adding visitors; coordinators and above assign branch via roster screens where permitted."}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center">
                    <LockedField
                      locked={!canEditVitalDates}
                      hint={VITAL_DATE_HINT}
                    >
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          name="has_finished_lessons"
                          id="has_finished_lessons"
                          checked={
                            (formData as any).has_finished_lessons || false
                          }
                          disabled={!canEditVitalDates}
                          onChange={(e) => {
                            setFormData((prev) => ({
                              ...prev,
                              has_finished_lessons: e.target.checked,
                            }));
                            setHasUnsavedChanges(true);
                          }}
                          className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-ring"
                        />
                        <label
                          htmlFor="has_finished_lessons"
                          className="ml-2 block text-sm font-medium text-gray-700"
                        >
                          Has Finished NC Lessons
                        </label>
                      </div>
                    </LockedField>
                  </div>
                  {formData.has_finished_lessons && (
                    <div className="md:col-span-2">
                      <p className="text-xs text-gray-500">
                        Saving this with a lessons finished date auto-creates
                        missing completed lesson progress records for active
                        lessons.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {showLoginAccess && (
              <div>
                <div className="p-0">
                  <h3 className="text-sm font-semibold text-gray-900 mb-2">
                    Login access
                  </h3>
                  <p className="text-xs text-gray-500 mb-4">
                    Set a temporary password so this person can log in. They
                    will be required to change it on first login.
                  </p>
                  <div className="space-y-4">
                    <div className="flex flex-col sm:flex-row gap-3">
                      <label className="inline-flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="password_mode"
                          checked={autoGeneratePassword}
                          onChange={() => setAutoGeneratePassword(true)}
                          className="text-primary border-gray-300 focus:ring-ring"
                        />
                        <span className="text-sm text-gray-700">
                          Auto-generate temporary password
                        </span>
                      </label>
                      <label className="inline-flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="password_mode"
                          checked={!autoGeneratePassword}
                          onChange={() => setAutoGeneratePassword(false)}
                          className="text-primary border-gray-300 focus:ring-ring"
                        />
                        <span className="text-sm text-gray-700">
                          Set password manually
                        </span>
                      </label>
                    </div>
                    {!autoGeneratePassword && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Temporary password
                          </label>
                          <PasswordInput
                            name="initial_password"
                            value={manualPassword}
                            onChange={(e) => setManualPassword(e.target.value)}
                            placeholder="At least 8 characters"
                            showStrengthIndicator
                            autoComplete="new-password"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Confirm password
                          </label>
                          <PasswordInput
                            name="confirm_password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="Re-enter password"
                            autoComplete="new-password"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div>
              <div className="p-0">
                <h3 className="text-sm font-semibold text-gray-900 mb-2">
                  Dates
                </h3>
                <p className="text-xs text-gray-500 mb-1">
                  Important dates for records.
                  {!canEditVitalDates
                    ? isCreating && formData.role === "VISITOR"
                      ? " Baptism and lessons dates can only be set by your cluster coordinator."
                      : " Vital dates can only be changed by your cluster coordinator."
                    : ""}
                </p>
                <p className="text-xs text-gray-500 mb-4">{ESTIMATE_HELP}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Date of Birth
                    </label>
                    <PersonDateField
                      id="date_of_birth"
                      value={formData.date_of_birth || ""}
                      onChange={(next) =>
                        handleDateFieldChange("date_of_birth", next)
                      }
                      showAge
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Date First Invited
                    </label>
                    <LockedField
                      locked={!canEditInviteAttendDates}
                      hint={VITAL_DATE_HINT}
                    >
                      <PersonDateField
                        id="date_first_invited"
                        value={(formData as any).date_first_invited || ""}
                        onChange={(next) =>
                          handleDateFieldChange("date_first_invited", next)
                        }
                        disabled={!canEditInviteAttendDates}
                      />
                    </LockedField>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Date First Attended
                    </label>
                    <LockedField
                      locked={!canEditInviteAttendDates}
                      hint={VITAL_DATE_HINT}
                    >
                      <PersonDateField
                        id="date_first_attended"
                        value={formData.date_first_attended || ""}
                        onChange={(next) =>
                          handleDateFieldChange("date_first_attended", next)
                        }
                        disabled={!canEditInviteAttendDates}
                      />
                    </LockedField>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Water Baptism Date
                    </label>
                    <LockedField
                      locked={!canEditVitalDates}
                      hint={VITAL_DATE_HINT}
                    >
                      <PersonDateField
                        id="water_baptism_date"
                        value={(formData as any).water_baptism_date || ""}
                        onChange={(next) =>
                          handleDateFieldChange("water_baptism_date", next)
                        }
                        disabled={!canEditVitalDates}
                      />
                    </LockedField>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Spirit Baptism Date
                    </label>
                    <LockedField
                      locked={!canEditVitalDates}
                      hint={VITAL_DATE_HINT}
                    >
                      <PersonDateField
                        id="spirit_baptism_date"
                        value={(formData as any).spirit_baptism_date || ""}
                        onChange={(next) =>
                          handleDateFieldChange("spirit_baptism_date", next)
                        }
                        disabled={!canEditVitalDates}
                      />
                    </LockedField>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Lessons Started Date
                    </label>
                    <LockedField
                      locked={!canEditVitalDates}
                      hint={VITAL_DATE_HINT}
                    >
                      <PersonDateField
                        id="lessons_started_at"
                        value={(formData as any).lessons_started_at || ""}
                        onChange={(next) =>
                          handleDateFieldChange("lessons_started_at", next)
                        }
                        disabled={!canEditVitalDates}
                      />
                    </LockedField>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Lessons Finished Date
                    </label>
                    <LockedField
                      locked={!canEditVitalDates}
                      hint={VITAL_DATE_HINT}
                    >
                      <PersonDateField
                        id="lessons_finished_at"
                        value={(formData as any).lessons_finished_at || ""}
                        onChange={(next) =>
                          handleDateFieldChange("lessons_finished_at", next)
                        }
                        disabled={!canEditVitalDates}
                      />
                    </LockedField>
                    {formData.has_finished_lessons &&
                      !formData.lessons_finished_at && (
                        <p className="mt-1 text-xs text-red-600">
                          Required when Has Finished NC Lessons is enabled.
                        </p>
                      )}
                  </div>
                </div>
              </div>
            </div>

            <div>
              <div className="p-0">
                <h3 className="text-sm font-semibold text-gray-900 mb-2">
                  Social & Media
                </h3>
                <p className="text-xs text-gray-500 mb-4">
                  Optional social profile and photo.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Facebook Name
                    </label>
                    <input
                      type="text"
                      name="facebook_name"
                      value={formData.facebook_name || ""}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      First Activity Attended
                    </label>
                    <LockedField
                      locked={!canEditInviteAttendDates}
                      hint={VITAL_DATE_HINT}
                    >
                      <select
                        name="first_activity_attended"
                        value={(formData as any).first_activity_attended || ""}
                        onChange={handleChange}
                        disabled={!canEditInviteAttendDates}
                        className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent ${
                          !canEditInviteAttendDates
                            ? "bg-gray-100 cursor-not-allowed"
                            : ""
                        }`}
                      >
                        <option value="">Select activity</option>
                        {eventTypes.map((type) => (
                          <option key={type.code} value={type.code}>
                            {type.label}
                          </option>
                        ))}
                      </select>
                    </LockedField>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Photo
                    </label>
                    <p className="text-xs text-gray-500 mb-2">
                      {PERSON_PHOTO_HELPER_TEXT}
                    </p>
                    {showPhotoPreview && (
                      <div className="flex items-center gap-3 mb-3">
                        <PersonAvatar person={photoPreviewPerson} size="md" />
                        {(photoFile ||
                          (initialData?.photo && !photoRemoved)) && (
                          <Button
                            type="button"
                            variant="secondary"
                            onClick={() => {
                              if (photoFile) {
                                handleClearSelectedPhoto();
                              } else {
                                setShowPhotoRemoveConfirmation(true);
                              }
                            }}
                          >
                            Remove photo
                          </Button>
                        )}
                      </div>
                    )}
                    <input
                      ref={photoInputRef}
                      type="file"
                      accept={PERSON_PHOTO_ACCEPT}
                      onChange={handlePhotoChange}
                      className="w-full"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div>
              <div className="p-0">
                <h3 className="text-sm font-semibold text-gray-900 mb-2">
                  Relationships
                </h3>
                <p className="text-xs text-gray-500 mb-4">
                  Link inviter, family, and cluster membership.
                </p>
                {plainMember && !editingSelf && (
                  <p className="text-xs text-primary mb-4">
                    Inviter defaults to you. Coordinators can edit this later.
                  </p>
                )}
                {selfEditLocked && (
                  <p className="text-xs text-gray-500 mb-4">
                    Family and cluster membership are managed by church staff.
                  </p>
                )}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Inviter
                    </label>
                    <LockedField
                      locked={selfEditLocked}
                      hint={STAFF_FIELD_HINT}
                    >
                      <SearchableSelect
                        value={formData.inviter ? String(formData.inviter) : ""}
                        onChange={(value) => {
                          setFormData(
                            (prev) => ({ ...prev, inviter: value }) as any,
                          );
                          setHasUnsavedChanges(true);
                        }}
                        disabled={selfEditLocked}
                        options={peopleOptions
                          .filter(
                            (p) => p.role !== "ADMIN" && p.username !== "admin",
                          )
                          .map((p) => ({
                            ...p,
                            id: p.id,
                            username: p.username || p.email || String(p.id),
                          }))}
                        placeholder="Type a name to search..."
                        emptyMessage="No inviter found"
                        showEmptyOption={true}
                        emptyOptionLabel="No inviter"
                      />
                    </LockedField>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Families ({(formData.family_ids || []).length} selected)
                    </label>
                    <LockedField
                      locked={selfEditLocked}
                      hint={STAFF_FIELD_HINT}
                    >
                      <div className="relative">
                        <input
                          type="text"
                          value={familySearch}
                          onChange={(e) => {
                            setFamilySearch(e.target.value);
                            setShowFamilyDropdown(true);
                          }}
                          onFocus={() => setShowFamilyDropdown(true)}
                          disabled={selfEditLocked}
                          className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent ${
                            selfEditLocked
                              ? "bg-gray-100 cursor-not-allowed"
                              : ""
                          }`}
                          placeholder="Search families by name..."
                        />
                        {showFamilyDropdown &&
                          familySearch &&
                          !selfEditLocked && (
                            <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                              {familyOptions
                                .filter((f) =>
                                  f.name
                                    .toLowerCase()
                                    .includes(familySearch.toLowerCase()),
                                )
                                .map((family) => {
                                  const id = String(family.id);
                                  const selected = (
                                    formData.family_ids || []
                                  ).includes(id);
                                  return (
                                    <button
                                      key={id}
                                      type="button"
                                      disabled={selected}
                                      onClick={() => {
                                        setFormData((prev) => ({
                                          ...prev,
                                          family_ids: [
                                            ...(prev.family_ids || []),
                                            id,
                                          ],
                                        }));
                                        setFamilySearch("");
                                        setShowFamilyDropdown(false);
                                        setHasUnsavedChanges(true);
                                      }}
                                      className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center justify-between gap-3 ${
                                        selected
                                          ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                                          : "text-gray-900"
                                      }`}
                                    >
                                      <span className="font-medium truncate">
                                        {family.name}
                                      </span>
                                      <span className="min-w-0 flex items-center justify-end gap-2 shrink-0">
                                        <EntityBranchChip
                                          branchId={family.branch}
                                          branches={branches}
                                        />
                                        {selected && (
                                          <span className="text-xs text-gray-400">
                                            Added
                                          </span>
                                        )}
                                      </span>
                                    </button>
                                  );
                                })}
                              {familyOptions.filter((f) =>
                                f.name
                                  .toLowerCase()
                                  .includes(familySearch.toLowerCase()),
                              ).length === 0 && (
                                <div className="px-3 py-2 text-gray-500 text-sm">
                                  No families found matching &ldquo;
                                  {familySearch}
                                  &rdquo;
                                </div>
                              )}
                            </div>
                          )}
                      </div>
                      {(formData.family_ids || []).length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {(formData.family_ids || []).map((id) => {
                            const family = familyOptions.find(
                              (f) => String(f.id) === id,
                            );
                            return (
                              <div
                                key={id}
                                className="flex items-center space-x-2 bg-primary/10 border border-primary/20 rounded-lg px-3 py-2"
                              >
                                <span className="text-sm font-medium text-gray-900">
                                  {family?.name || `Family ${id}`}
                                </span>
                                {family && (
                                  <EntityBranchChip
                                    branchId={family.branch}
                                    branches={branches}
                                  />
                                )}
                                {!selfEditLocked && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setFormData((prev) => ({
                                        ...prev,
                                        family_ids: (
                                          prev.family_ids || []
                                        ).filter((fid) => fid !== id),
                                      }));
                                      setHasUnsavedChanges(true);
                                    }}
                                    className="text-gray-400 hover:text-red-500 ml-1"
                                    aria-label={`Remove ${family?.name || id}`}
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
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                      {showFamilyDropdown && (
                        <div
                          className="fixed inset-0 z-0"
                          onClick={() => setShowFamilyDropdown(false)}
                        />
                      )}
                    </LockedField>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Clusters ({(formData.cluster_ids || []).length} selected)
                    </label>
                    <LockedField
                      locked={selfEditLocked}
                      hint={STAFF_FIELD_HINT}
                    >
                      <div className="relative">
                        <input
                          type="text"
                          value={clusterSearch}
                          onChange={(e) => {
                            setClusterSearch(e.target.value);
                            setShowClusterDropdown(true);
                          }}
                          onFocus={() => setShowClusterDropdown(true)}
                          disabled={selfEditLocked}
                          className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent ${
                            selfEditLocked
                              ? "bg-gray-100 cursor-not-allowed"
                              : ""
                          }`}
                          placeholder="Search clusters by code or name..."
                        />
                        {showClusterDropdown &&
                          clusterSearch &&
                          !selfEditLocked && (
                            <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                              {clusterOptions
                                .filter((c) => {
                                  const q = clusterSearch.toLowerCase();
                                  return (
                                    (c.code || "").toLowerCase().includes(q) ||
                                    (c.name || "").toLowerCase().includes(q)
                                  );
                                })
                                .map((cluster) => {
                                  const id = String(cluster.id);
                                  const selected = (
                                    formData.cluster_ids || []
                                  ).includes(id);
                                  return (
                                    <button
                                      key={id}
                                      type="button"
                                      disabled={selected}
                                      onClick={() => {
                                        setFormData((prev) => ({
                                          ...prev,
                                          cluster_ids: [
                                            ...(prev.cluster_ids || []),
                                            id,
                                          ],
                                        }));
                                        setClusterSearch("");
                                        setShowClusterDropdown(false);
                                        setHasUnsavedChanges(true);
                                      }}
                                      className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center justify-between gap-3 ${
                                        selected
                                          ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                                          : "text-gray-900"
                                      }`}
                                    >
                                      <span className="min-w-0 flex items-center gap-2">
                                        <span className="font-medium shrink-0">
                                          {(cluster.code || "").trim() ||
                                            `Cluster ${cluster.id}`}
                                        </span>
                                        <span
                                          className={`truncate ${
                                            selected
                                              ? "text-gray-400"
                                              : "text-gray-500"
                                          }`}
                                        >
                                          {(cluster.name || "").trim() ||
                                            "Unnamed cluster"}
                                        </span>
                                      </span>
                                      <span className="flex items-center justify-end gap-2 shrink-0">
                                        <EntityBranchChip
                                          branchId={cluster.branch}
                                          branches={branches}
                                        />
                                        {selected && (
                                          <span className="text-xs text-gray-400">
                                            Added
                                          </span>
                                        )}
                                      </span>
                                    </button>
                                  );
                                })}
                              {clusterOptions.filter((c) => {
                                const q = clusterSearch.toLowerCase();
                                return (
                                  (c.code || "").toLowerCase().includes(q) ||
                                  (c.name || "").toLowerCase().includes(q)
                                );
                              }).length === 0 && (
                                <div className="px-3 py-2 text-gray-500 text-sm">
                                  No clusters found matching &ldquo;
                                  {clusterSearch}
                                  &rdquo;
                                </div>
                              )}
                            </div>
                          )}
                      </div>
                      {(formData.cluster_ids || []).length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {(formData.cluster_ids || []).map((id) => {
                            const cluster = clusterOptions.find(
                              (c) => String(c.id) === id,
                            );
                            return (
                              <div
                                key={id}
                                className="flex items-center space-x-2 bg-primary/10 border border-primary/20 rounded-lg px-3 py-2"
                              >
                                <span className="text-sm font-medium text-gray-900 shrink-0">
                                  {cluster
                                    ? (cluster.code || "").trim() ||
                                      `Cluster ${cluster.id}`
                                    : `Cluster ${id}`}
                                </span>
                                {cluster && (
                                  <span className="text-sm text-gray-600 truncate">
                                    {(cluster.name || "").trim() ||
                                      "Unnamed cluster"}
                                  </span>
                                )}
                                {!selfEditLocked && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setFormData((prev) => ({
                                        ...prev,
                                        cluster_ids: (
                                          prev.cluster_ids || []
                                        ).filter((cid) => cid !== id),
                                      }));
                                      setHasUnsavedChanges(true);
                                    }}
                                    className="text-gray-400 hover:text-red-500 ml-1"
                                    aria-label={`Remove cluster ${id}`}
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
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                      {showClusterDropdown && (
                        <div
                          className="fixed inset-0 z-0"
                          onClick={() => setShowClusterDropdown(false)}
                        />
                      )}
                    </LockedField>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer Buttons - At bottom of form fields */}
            <div className="flex flex-col-reverse sm:flex-row gap-3 pt-6">
              <Button
                variant="tertiary"
                className="w-full sm:flex-1 min-h-[44px]"
                onClick={
                  isEditingFromProfile && onBackToProfile
                    ? onBackToProfile
                    : onClose
                }
                disabled={loading}
              >
                {panelLayout ? "Back" : "Cancel"}
              </Button>
              <Button
                className="w-full sm:flex-1 min-h-[44px]"
                disabled={loading}
                type="submit"
              >
                {loading
                  ? "Saving..."
                  : initialData?.id
                    ? "Update Person"
                    : "Create Person"}
              </Button>
            </div>
          </div>
        )}

        {/* JOURNEY TIMELINE TAB */}
        {activeTab === "timeline" && (
          <div className="space-y-4 p-0">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Event Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={newJourney.title}
                onChange={(e) =>
                  setNewJourney((prev) => ({
                    ...prev,
                    title: e.target.value,
                  }))
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent"
                placeholder="e.g., Baptism, First attendance"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={newJourney.date}
                onChange={(e) =>
                  setNewJourney((prev) => ({ ...prev, date: e.target.value }))
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Type
              </label>
              <select
                value={newJourney.type}
                onChange={(e) =>
                  setNewJourney((prev) => ({
                    ...prev,
                    type: e.target.value as JourneyType,
                  }))
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent"
              >
                {JOURNEY_TYPE_OPTIONS.map((type) => (
                  <option key={type} value={type}>
                    {formatJourneyTypeLabel(type)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description
              </label>
              <textarea
                value={newJourney.description}
                onChange={(e) =>
                  setNewJourney((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent"
                placeholder="Event description..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Verified By
              </label>
              <SearchableSelect
                value={newJourney.verified_by || ""}
                onChange={(value) =>
                  setNewJourney((prev) => ({ ...prev, verified_by: value }))
                }
                options={peopleOptions
                  .filter((p) => p.role !== "ADMIN" && p.username !== "admin")
                  .map((p) => ({
                    ...p,
                    id: p.id,
                    username: p.username || p.email || String(p.id),
                  }))}
                placeholder="Type a name to search..."
                emptyMessage="No verifier found"
                showEmptyOption={true}
                emptyOptionLabel="No verifier"
              />
            </div>
            <div className="flex gap-3">
              {editingJourneyIndex !== null && (
                <Button
                  variant="tertiary"
                  onClick={handleCancelEdit}
                  className="flex-1 py-3 text-base font-medium"
                >
                  Cancel
                </Button>
              )}
              <Button
                onClick={() => {
                  // prevent form submit triggering page reload from parent browser default
                  if (editingJourneyIndex !== null) {
                    handleUpdateJourney();
                  } else {
                    handleAddJourney();
                  }
                }}
                disabled={!newJourney.date || !newJourney.title.trim()}
                className={`${
                  editingJourneyIndex !== null ? "flex-1" : "w-full"
                } py-3 text-base font-medium`}
              >
                {editingJourneyIndex !== null ? "Update Event" : "+ Add Event"}
              </Button>
            </div>

            {/* Search and Filter Controls */}
            {formData.journeys && formData.journeys.length > 0 && (
              <div className="space-y-3 mt-6 pt-6 border-t border-gray-200">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 gap-3">
                  {/* Search */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Search Events
                    </label>
                    <input
                      type="text"
                      value={journeySearch}
                      onChange={(e) => setJourneySearch(e.target.value)}
                      placeholder="Search by title, description, or type..."
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent"
                    />
                  </div>
                  {/* Filter by Type */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Filter by Type
                    </label>
                    <select
                      value={journeyFilter}
                      onChange={(e) =>
                        setJourneyFilter(e.target.value as JourneyType | "ALL")
                      }
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent"
                    >
                      <option value="ALL">All Types</option>
                      {JOURNEY_TYPE_OPTIONS.map((type) => (
                        <option key={type} value={type}>
                          {formatJourneyTypeLabel(type)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                {/* Results count */}
                {filteredAndSortedJourneys.length !==
                  formData.journeys.length && (
                  <div className="text-xs text-gray-500">
                    Showing {filteredAndSortedJourneys.length} of{" "}
                    {formData.journeys.length} events
                  </div>
                )}
              </div>
            )}

            {/* Virtualized Journey List */}
            {filteredAndSortedJourneys.length > 0 &&
              (panelLayout ? (
                <div className="mt-4 rounded-lg border border-gray-200 overflow-visible">
                  {filteredAndSortedJourneys.map((journey, index) => {
                    const originalIndex = getOriginalJourneyIndex(index);
                    const isEditing = editingJourneyIndex === originalIndex;

                    return (
                      <div
                        key={
                          journey.id ||
                          `${journey.date}-${journey.title}-${index}`
                        }
                        onClick={() => handleEditJourney(originalIndex)}
                        className={`mx-2 my-1 flex justify-between items-start bg-gray-50 p-3 rounded cursor-pointer transition-all ${
                          isEditing
                            ? "border-2 border-primary shadow-md"
                            : "border border-transparent hover:border-gray-300 hover:shadow-sm"
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-gray-900 truncate">
                            {journey.title}
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            {journey.date} • {journey.type}
                          </div>
                          {journey.description && (
                            <div className="text-sm text-gray-700 mt-1 line-clamp-2">
                              {journey.description}
                            </div>
                          )}
                        </div>
                        {isAdmin && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openJourneyDelete(originalIndex);
                            }}
                            className="text-gray-400 hover:text-red-600 p-1 ml-2 flex-shrink-0"
                            title="Remove journey"
                            aria-label="Remove journey"
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
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div
                  ref={journeyListRef}
                  className={`mt-4 rounded-lg border border-gray-200 ${
                    filteredAndSortedJourneys.length <= 3
                      ? "overflow-visible"
                      : "h-[300px] overflow-auto"
                  }`}
                >
                  <div
                    style={{
                      height: `${virtualizer.getTotalSize()}px`,
                      width: "100%",
                      position: "relative",
                    }}
                  >
                    {virtualizer.getVirtualItems().map((virtualRow) => {
                      const journey =
                        filteredAndSortedJourneys[virtualRow.index];
                      const originalIndex = getOriginalJourneyIndex(
                        virtualRow.index,
                      );
                      const isEditing = editingJourneyIndex === originalIndex;

                      return (
                        <div
                          key={virtualRow.key}
                          style={{
                            position: "absolute",
                            top: 0,
                            left: 0,
                            width: "100%",
                            height: `${virtualRow.size}px`,
                            transform: `translateY(${virtualRow.start}px)`,
                          }}
                        >
                          <div
                            onClick={() => handleEditJourney(originalIndex)}
                            className={`mx-2 my-1 flex justify-between items-start bg-gray-50 p-3 rounded cursor-pointer transition-all h-full ${
                              isEditing
                                ? "border-2 border-primary shadow-md"
                                : "border border-transparent hover:border-gray-300 hover:shadow-sm"
                            }`}
                          >
                            <div className="flex-1 min-w-0">
                              <div className="font-semibold text-gray-900 truncate">
                                {journey.title}
                              </div>
                              <div className="text-xs text-gray-500 mt-1">
                                {journey.date} • {journey.type}
                              </div>
                              {journey.description && (
                                <div className="text-sm text-gray-700 mt-1 line-clamp-2">
                                  {journey.description}
                                </div>
                              )}
                            </div>
                            {isAdmin && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openJourneyDelete(originalIndex);
                                }}
                                className="text-gray-400 hover:text-red-600 p-1 ml-2 flex-shrink-0"
                                title="Remove journey"
                                aria-label="Remove journey"
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
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}

            {/* Empty states */}
            {(!formData.journeys || formData.journeys.length === 0) && (
              <div className="mt-4 text-center py-8 text-gray-500">
                <p className="text-sm">No journey events yet.</p>
                <p className="text-xs mt-1">
                  Add your first journey event using the form above.
                </p>
              </div>
            )}
            {formData.journeys &&
              formData.journeys.length > 0 &&
              filteredAndSortedJourneys.length === 0 && (
                <div className="mt-4 text-center py-8 text-gray-500">
                  <p className="text-sm">
                    No journey events match your search or filter criteria.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setJourneySearch("");
                      setJourneyFilter("ALL");
                    }}
                    className="mt-2 text-sm text-primary hover:text-primary underline"
                  >
                    Clear filters
                  </button>
                </div>
              )}
          </div>
        )}
      </form>

      {/* Journey delete confirmation */}
      <ConfirmationModal
        isOpen={journeyDeleteConfirm.isOpen}
        onClose={closeJourneyDelete}
        onConfirm={confirmJourneyDelete}
        title="Delete Journey"
        message="Are you sure you want to delete this journey event? This action cannot be undone."
        confirmText="Delete Event"
        cancelText="Cancel"
        variant="danger"
        loading={journeyDeleteConfirm.loading}
      />

      {/* Tab switch confirmation */}
      <ConfirmationModal
        isOpen={tabSwitchConfirmation.isOpen}
        onClose={() =>
          setTabSwitchConfirmation({ isOpen: false, targetTab: null })
        }
        onConfirm={() => {
          if (tabSwitchConfirmation.targetTab) {
            setActiveTab(tabSwitchConfirmation.targetTab);
            setHasUnsavedChanges(false);
            setTabSwitchConfirmation({ isOpen: false, targetTab: null });
          }
        }}
        title="Unsaved Changes"
        message="You have unsaved changes in Basic Info. Are you sure you want to switch tabs? Your changes will be lost if you don't save first."
        confirmText="Switch Anyway"
        cancelText="Stay Here"
        variant="warning"
      />

      <ConfirmationModal
        isOpen={showPhotoRemoveConfirmation}
        onClose={() => setShowPhotoRemoveConfirmation(false)}
        onConfirm={() => {
          handleRemovePhoto();
          setShowPhotoRemoveConfirmation(false);
        }}
        title="Remove Photo"
        message="Remove this profile photo? Initials will be shown instead until a new photo is uploaded. Save the person to apply this change."
        confirmText="Remove Photo"
        cancelText="Cancel"
        variant="warning"
      />

      <ConfirmationModal
        isOpen={duplicateNameConfirm.isOpen}
        onClose={() => setDuplicateNameConfirm({ isOpen: false, matches: [] })}
        onConfirm={() => {
          setDuplicateNameConfirm({ isOpen: false, matches: [] });
          void performSave();
        }}
        title="Possible duplicate"
        message={
          <div className="space-y-2">
            <p>
              Someone with the same first and last name already exists. Continue
              anyway only if this is a different person.
            </p>
            <ul className="list-disc pl-5 space-y-1 text-sm text-gray-700 max-h-40 overflow-y-auto">
              {duplicateNameConfirm.matches.slice(0, 8).map((person) => (
                <li key={person.id}>{describeDuplicatePerson(person)}</li>
              ))}
              {duplicateNameConfirm.matches.length > 8 && (
                <li>…and {duplicateNameConfirm.matches.length - 8} more</li>
              )}
            </ul>
          </div>
        }
        confirmText={initialData?.id ? "Update anyway" : "Create anyway"}
        cancelText="Go back"
        variant="warning"
        zIndex={80}
      />
    </>
  );
}
