import { useEffect, useRef, useState, useMemo } from "react";
import { Person, JourneyType } from "@/src/types/person";
import Button from "@/src/components/ui/Button";
import { journeysApi } from "@/src/lib/api";
import ConfirmationModal from "@/src/components/ui/ConfirmationModal";
import toast from "react-hot-toast";
import { useVirtualizer } from "@tanstack/react-virtual";

interface PersonFormProps {
  onSubmit: (data: Partial<Person>) => Promise<Person | void>;
  onClose: () => void;
  onBackToProfile?: () => void;
  initialData?: Partial<Person>;
  isEditingFromProfile?: boolean;
  startOnTimelineTab?: boolean;
  peopleOptions?: Person[];
}

export default function PersonForm({
  onSubmit,
  onClose,
  onBackToProfile,
  initialData,
  isEditingFromProfile = false,
  startOnTimelineTab = false,
  peopleOptions = [],
}: PersonFormProps) {
  // Determine initial tab: use timeline only if user has permission and startOnTimelineTab is true
  const canViewTimeline = initialData?.can_view_journey_timeline !== false;
  const initialTab =
    startOnTimelineTab && canViewTimeline ? "timeline" : "basic";
  const [activeTab, setActiveTab] = useState<"basic" | "timeline">(initialTab);

  const [formData, setFormData] = useState<Partial<Person>>({
    role: "MEMBER",
    status: "ACTIVE",
    journeys: [],
    ...initialData,
    country: initialData?.country || "Philippines",
  });

  const [loading, setLoading] = useState(false);
  const [inviterSearch, setInviterSearch] = useState("");
  const [showInviterDropdown, setShowInviterDropdown] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [tabSwitchConfirmation, setTabSwitchConfirmation] = useState<{
    isOpen: boolean;
    targetTab: "basic" | "timeline" | null;
  }>({ isOpen: false, targetTab: null });
  // Toast validation removed per request

  // Track initial journeys to avoid re-creating unchanged ones on save
  const initialJourneyKeysRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    const keyOf = (m: any) =>
      `${m.date}|${m.type}|${m.title ?? ""}|${m.description ?? ""}`;
    const initialKeys = new Set(
      (initialData?.journeys || []).map((m: any) => keyOf(m))
    );
    initialJourneyKeysRef.current = initialKeys;
  }, [initialData]);

  // Phone management: country code and local number
  const COUNTRY_META: Record<string, { code: string; localMax: number }> = {
    Philippines: { code: "+63", localMax: 10 },
    "United States": { code: "+1", localMax: 10 },
    Canada: { code: "+1", localMax: 10 },
    "United Kingdom": { code: "+44", localMax: 10 },
    Australia: { code: "+61", localMax: 9 },
    India: { code: "+91", localMax: 10 },
  };
  const ALL_COUNTRIES = Object.keys(COUNTRY_META).concat([
    "Japan",
    "Singapore",
    "Malaysia",
    "Indonesia",
    "Vietnam",
    "Thailand",
  ]);

  const initialCode = (() => {
    const c = (initialData?.country || "Philippines") as string;
    return COUNTRY_META[c]?.code || "+63";
  })();
  const initialLocal = (() => {
    const phoneVal = (initialData?.phone || "") as string;
    if (!phoneVal) return "";
    // naive parse: remove non-digits, then strip possible country code digits
    const digits = phoneVal.replace(/[^0-9+]/g, "");
    if (digits.startsWith("+")) {
      // try match by known codes
      const knownCodes = Object.values(COUNTRY_META).map((m) => m.code);
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
  }>({
    date: new Date().toISOString().slice(0, 10),
    type: "NOTE",
    title: "",
    description: "",
  });

  const [editingJourneyIndex, setEditingJourneyIndex] = useState<number | null>(
    null
  );
  const [journeySearch, setJourneySearch] = useState("");
  const [journeyFilter, setJourneyFilter] = useState<JourneyType | "ALL">(
    "ALL"
  );
  const journeyListRef = useRef<HTMLDivElement>(null);

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => {
      const next = { ...prev, [name]: value } as Partial<Person>;
      if (name === "role") {
        if (value === "VISITOR") {
          if (next.status !== "INVITED" && next.status !== "ATTENDED") {
            next.status = "INVITED";
          }
        } else {
          if (next.status === "INVITED" || next.status === "ATTENDED") {
            next.status = "ACTIVE";
          }
        }
      }
      return next;
    });
    setHasUnsavedChanges(true);
  };

  const statusOptions =
    formData.role === "VISITOR"
      ? ["INVITED", "ATTENDED"]
      : ["ACTIVE", "SEMIACTIVE", "INACTIVE", "DECEASED"];

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData((prev) => ({ ...prev, photo: reader.result as string }));
        setHasUnsavedChanges(true);
      };
      reader.readAsDataURL(file);
    }
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
          });
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
          toast.success("Journey event added successfully.");
        } catch (e: any) {
          console.error("Failed to create journey immediately:", e);
          toast.error(
            e.response?.data?.message ||
              e.message ||
              "Failed to add journey event."
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
        "Journey event added. It will be saved when you submit the form."
      );
    }
    setNewJourney({
      date: new Date().toISOString().slice(0, 10),
      type: "NOTE",
      title: "",
      description: "",
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

    if (existingUserId && journeyToUpdate?.id) {
      (async () => {
        try {
          await journeysApi.update(journeyToUpdate.id, {
            title: newJourney.title,
            date: newJourney.date,
            type: newJourney.type,
            description: newJourney.description,
          });

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

          toast.success("Journey event updated successfully.");
          handleCancelEdit();
        } catch (e: any) {
          console.error("Failed to update journey:", e);
          toast.error(
            e.response?.data?.message ||
              e.message ||
              "Failed to update journey event."
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
        "Journey event updated. It will be saved when you submit the form."
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
    });
  };

  // Filter and sort journeys for virtualization
  const filteredAndSortedJourneys = useMemo(() => {
    let filtered = formData.journeys || [];

    // Filter by search
    if (journeySearch.trim()) {
      const searchLower = journeySearch.toLowerCase();
      filtered = filtered.filter(
        (j) =>
          j.title?.toLowerCase().includes(searchLower) ||
          j.description?.toLowerCase().includes(searchLower) ||
          j.type?.toLowerCase().includes(searchLower)
      );
    }

    // Filter by type
    if (journeyFilter !== "ALL") {
      filtered = filtered.filter((j) => j.type === journeyFilter);
    }

    // Sort by date (newest first)
    return [...filtered].sort((a, b) => {
      const dateA = new Date(a.date || 0).getTime();
      const dateB = new Date(b.date || 0).getTime();
      return dateB - dateA;
    });
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
    try {
      setJourneyDeleteConfirm((p) => ({ ...p, loading: true }));
      if (toDelete?.id && (initialData?.id || (formData as any).id)) {
        await journeysApi.delete(toDelete.id);
      }
      setFormData((prev) => ({
        ...prev,
        journeys: (prev.journeys || []).filter((_, i) => i !== idx),
      }));
      closeJourneyDelete();
    } catch (e) {
      console.error("Failed to delete journey:", e);
      setJourneyDeleteConfirm((p) => ({ ...p, loading: false }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Extract journeys from formData before submitting person
    const journeys = formData.journeys || [];
    const personData = { ...formData };
    delete personData.journeys; // Remove journeys from person data

    // Submit person data first
    let result: Person | void;
    try {
      setLoading(true);
      result = await onSubmit(personData);

      // If person was created/updated successfully and we have new journeys, save only new/changed ones
      if (result && typeof result === "object" && "id" in result) {
        const keyOf = (m: any) =>
          `${m.date}|${m.type}|${m.title ?? ""}|${m.description ?? ""}`;
        const newOrChanged = (journeys || []).filter((m: any) => {
          const key = keyOf(m);
          return !initialJourneyKeysRef.current.has(key);
        });
        if (newOrChanged.length > 0) {
          try {
            for (const journey of newOrChanged) {
              // skip if no date or all fields empty
              if (!journey.date && !journey.title && !journey.description)
                continue;
              await journeysApi.create({
                user: (result as { id: string }).id,
                title: journey.title,
                date: journey.date,
                type: journey.type,
                description: journey.description,
              });
            }
          } catch (error) {
            console.error("Failed to save journeys:", error);
            toast.error(
              "Person saved, but some journey events failed to save."
            );
          }
        }

        // Show success toast
        if (initialData?.id) {
          toast.success("Person updated successfully.");
        } else {
          toast.success("Person created successfully.");
        }
      }
      setHasUnsavedChanges(false);
    } catch (error: any) {
      console.error("Failed to save person:", error);
      toast.error(
        error?.response?.data?.message || error?.message || initialData?.id
          ? "Failed to update person. Please try again."
          : "Failed to create person. Please try again."
      );
      throw error; // Re-throw to let parent handle if needed
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <form
        onSubmit={handleSubmit}
        className="overflow-y-auto space-y-6 text-sm max-w-3xl -mt-2 md:-mt-4"
      >
        {/* Tabs */}
        <div className="flex border-b mb-4">
          <button
            type="button"
            className={`px-4 py-2 font-medium ${
              activeTab === "basic"
                ? "border-b-2 border-blue-600 text-blue-600"
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
                  ? "border-b-2 border-blue-600 text-blue-600"
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
          <div className="space-y-6 overflow-y-auto pr-1">
            <div>
              <div className="p-0">
                <h3 className="text-sm font-semibold text-gray-900 mb-2">
                  Personal Details
                </h3>
                <p className="text-xs text-gray-500 mb-4">
                  Basic identity information.
                </p>
                <div className="space-y-4">
                  {/* Name Fields */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        First Name *
                      </label>
                      <input
                        type="text"
                        name="first_name"
                        required
                        value={formData.first_name || ""}
                        onChange={handleChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Last Name *
                      </label>
                      <input
                        type="text"
                        name="last_name"
                        required
                        value={formData.last_name || ""}
                        onChange={handleChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Suffix
                      </label>
                      <input
                        type="text"
                        name="suffix"
                        value={(formData as any).suffix || ""}
                        onChange={handleChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Nickname
                      </label>
                      <input
                        type="text"
                        name="nickname"
                        value={(formData as any).nickname || ""}
                        onChange={handleChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Gender
                      </label>
                      <select
                        name="gender"
                        value={formData.gender || ""}
                        onChange={handleChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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

            <div>
              <div className="p-0">
                <h3 className="text-sm font-semibold text-gray-900 mb-2">
                  Contact
                </h3>
                <p className="text-xs text-gray-500 mb-4">
                  How we can reach them.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Email
                    </label>
                    <input
                      type="email"
                      name="email"
                      value={formData.email || ""}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                            COUNTRY_META
                          ).find(
                            ([, meta]) => meta.code === phoneCountryCode
                          )?.[1];
                          const max = selectedCountry?.localMax ?? 10;
                          const next = digitsOnly.slice(0, max);
                          setPhoneLocal(next);
                          syncPhoneToForm(phoneCountryCode, next);
                          setHasUnsavedChanges(true);
                        }}
                        placeholder="##########"
                        className="flex-1 min-w-0 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Country
                    </label>
                    <select
                      name="country"
                      value={formData.country || "Philippines"}
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
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      {ALL_COUNTRIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
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
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Role
                    </label>
                    <select
                      name="role"
                      value={formData.role}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      {"MEMBER,VISITOR,COORDINATOR,PASTOR,ADMIN"
                        .split(",")
                        .map((role) => (
                          <option key={role} value={role}>
                            {role.charAt(0) + role.slice(1).toLowerCase()}
                          </option>
                        ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Status
                    </label>
                    <select
                      name="status"
                      value={formData.status}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      {statusOptions.map((status) => (
                        <option key={status} value={status}>
                          {status.charAt(0) + status.slice(1).toLowerCase()}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      LAMP ID
                    </label>
                    <input
                      type="text"
                      name="member_id"
                      value={formData.member_id || ""}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      name="has_finished_lessons"
                      id="has_finished_lessons"
                      checked={(formData as any).has_finished_lessons || false}
                      onChange={(e) => {
                        setFormData((prev) => ({
                          ...prev,
                          has_finished_lessons: e.target.checked,
                        }));
                        setHasUnsavedChanges(true);
                      }}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <label
                      htmlFor="has_finished_lessons"
                      className="ml-2 block text-sm font-medium text-gray-700"
                    >
                      Has Finished NC Lessons
                    </label>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <div className="p-0">
                <h3 className="text-sm font-semibold text-gray-900 mb-2">
                  Dates
                </h3>
                <p className="text-xs text-gray-500 mb-4">
                  Important dates for records.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Date of Birth
                    </label>
                    <input
                      type="date"
                      name="date_of_birth"
                      value={formData.date_of_birth || ""}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Date First Attended
                    </label>
                    <input
                      type="date"
                      name="date_first_attended"
                      value={formData.date_first_attended || ""}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Water Baptism Date
                    </label>
                    <input
                      type="date"
                      name="water_baptism_date"
                      value={(formData as any).water_baptism_date || ""}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Spirit Baptism Date
                    </label>
                    <input
                      type="date"
                      name="spirit_baptism_date"
                      value={(formData as any).spirit_baptism_date || ""}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Facebook Name
                    </label>
                    <input
                      type="text"
                      name="facebook_name"
                      value={formData.facebook_name || ""}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      First Activity Attended
                    </label>
                    <select
                      name="first_activity_attended"
                      value={(formData as any).first_activity_attended || ""}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">Select activity</option>
                      {[
                        "CLUSTER_BS_EVANGELISM",
                        "CLUSTERING",
                        "SUNDAY_SERVICE",
                        "DOCTRINAL_CLASS",
                        "PRAYER_MEETING",
                        "CYM_CLASS",
                        "MINI_WORSHIP",
                        "GOLDEN_WARRIORS",
                        "CAMPING",
                        "AWTA",
                        "CONFERENCE",
                        "CONCERT_CRUSADE",
                      ].map((opt) => (
                        <option key={opt} value={opt}>
                          {opt
                            .toLowerCase()
                            .split("_")
                            .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
                            .join(" ")}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Photo
                    </label>
                    <input
                      type="file"
                      accept="image/*"
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
                  Link to the inviter.
                </p>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Inviter
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Type a name to search..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      value={inviterSearch}
                      onChange={(e) => {
                        setInviterSearch(e.target.value);
                        setShowInviterDropdown(true);
                      }}
                      onFocus={() => setShowInviterDropdown(true)}
                    />
                    {showInviterDropdown && inviterSearch && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                        {peopleOptions
                          .filter((p) => {
                            // Exclude ADMIN users
                            if (p.role === "ADMIN" || p.username === "admin") {
                              return false;
                            }
                            const name = `${p.first_name ?? ""} ${
                              p.last_name ?? ""
                            }`.toLowerCase();
                            const email = (p.email ?? "").toLowerCase();
                            const q = inviterSearch.toLowerCase();
                            return name.includes(q) || email.includes(q);
                          })
                          .slice(0, 20)
                          .map((p) => (
                            <button
                              type="button"
                              key={p.id}
                              onClick={() => {
                                setFormData(
                                  (prev) => ({ ...prev, inviter: p.id } as any)
                                );
                                setHasUnsavedChanges(true);
                                setInviterSearch(
                                  `${p.first_name ?? ""} ${
                                    p.last_name ?? ""
                                  }`.trim()
                                );
                                setShowInviterDropdown(false);
                              }}
                              className="w-full px-3 py-2 text-left hover:bg-gray-50"
                            >
                              {`${p.first_name ?? ""} ${
                                p.last_name ?? ""
                              }`.trim()}
                            </button>
                          ))}
                      </div>
                    )}
                  </div>
                  {showInviterDropdown && (
                    <div
                      className="fixed inset-0 z-0"
                      onClick={() => setShowInviterDropdown(false)}
                    />
                  )}
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
                Cancel
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
          <div className="space-y-4 overflow-y-auto pr-1 p-0">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Event Title *
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
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="e.g., Baptism, First attendance"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Date *
              </label>
              <input
                type="date"
                value={newJourney.date}
                onChange={(e) =>
                  setNewJourney((prev) => ({ ...prev, date: e.target.value }))
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {["BAPTISM", "SPIRIT", "CLUSTER", "LESSON", "NOTE"].map(
                  (type) => (
                    <option key={type} value={type}>
                      {type.charAt(0) + type.slice(1).toLowerCase()}
                    </option>
                  )
                )}
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
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Event description..."
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="ALL">All Types</option>
                      {[
                        "BAPTISM",
                        "SPIRIT",
                        "CLUSTER",
                        "LESSON",
                        "NOTE",
                        "EVENT_ATTENDANCE",
                      ].map((type) => (
                        <option key={type} value={type}>
                          {type.charAt(0) + type.slice(1).toLowerCase()}
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
            {filteredAndSortedJourneys.length > 0 && (
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
                    const journey = filteredAndSortedJourneys[virtualRow.index];
                    const originalIndex = getOriginalJourneyIndex(
                      virtualRow.index
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
                              ? "border-2 border-blue-500 shadow-md"
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
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

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
                    className="mt-2 text-sm text-blue-600 hover:text-blue-700 underline"
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
    </>
  );
}
