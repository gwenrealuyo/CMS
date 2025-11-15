import { useEffect, useRef, useState } from "react";
import { Person, MilestoneType } from "@/src/types/person";
import Button from "@/src/components/ui/Button";
import { milestonesApi } from "@/src/lib/api";
import ConfirmationModal from "@/src/components/ui/ConfirmationModal";

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
  const [activeTab, setActiveTab] = useState<"basic" | "timeline">(
    startOnTimelineTab ? "timeline" : "basic"
  );

  const [formData, setFormData] = useState<Partial<Person>>({
    role: "MEMBER",
    status: "ACTIVE",
    milestones: [],
    ...initialData,
    country: initialData?.country || "Philippines",
  });

  const [loading, setLoading] = useState(false);
  const [inviterSearch, setInviterSearch] = useState("");
  const [showInviterDropdown, setShowInviterDropdown] = useState(false);
  // Toast validation removed per request

  // Track initial milestones to avoid re-creating unchanged ones on save
  const initialMilestoneKeysRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    const keyOf = (m: any) =>
      `${m.date}|${m.type}|${m.title ?? ""}|${m.description ?? ""}`;
    const initialKeys = new Set(
      (initialData?.milestones || []).map((m: any) => keyOf(m))
    );
    initialMilestoneKeysRef.current = initialKeys;
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
  };

  const [newMilestone, setNewMilestone] = useState<{
    date: string;
    type: MilestoneType;
    title: string;
    description: string;
  }>({
    date: new Date().toISOString().slice(0, 10),
    type: "NOTE",
    title: "",
    description: "",
  });

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
  };

  const statusOptions =
    formData.role === "VISITOR"
      ? ["INVITED", "ATTENDED"]
      : ["ACTIVE", "SEMIACTIVE", "INACTIVE", "DECEASED"];

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () =>
        setFormData((prev) => ({ ...prev, photo: reader.result as string }));
      reader.readAsDataURL(file);
    }
  };

  const handleAddMilestone = () => {
    if (!newMilestone.date || !newMilestone.title.trim()) {
      return;
    }
    // If editing an existing person, persist immediately so it remains after closing
    const existingUserId = (initialData?.id || (formData as any).id) as
      | string
      | undefined;
    if (existingUserId) {
      (async () => {
        try {
          const created = await milestonesApi.create({
            user: existingUserId,
            title: newMilestone.title,
            date: newMilestone.date,
            type: newMilestone.type,
            description: newMilestone.description,
          });
          // optimistic append so it shows instantly
          const createdId = (created?.data as any)?.id || crypto.randomUUID();
          setFormData((prev) => ({
            ...prev,
            milestones: [
              ...(prev.milestones || []),
              {
                id: createdId,
                user: existingUserId,
                ...newMilestone,
              } as any,
            ],
          }));
        } catch (e) {
          console.error("Failed to create milestone immediately:", e);
        }
      })();
    } else {
      const id = crypto.randomUUID();
      setFormData((prev) => ({
        ...prev,
        milestones: [
          ...(prev.milestones || []),
          {
            id,
            user: prev.id || "",
            ...newMilestone,
          } as any,
        ],
      }));
    }
    setNewMilestone({
      date: new Date().toISOString().slice(0, 10),
      type: "NOTE",
      title: "",
      description: "",
    });
  };

  // Delete milestone confirmation state
  const [milestoneDeleteConfirm, setMilestoneDeleteConfirm] = useState<{
    isOpen: boolean;
    index: number | null;
    loading: boolean;
  }>({ isOpen: false, index: null, loading: false });

  const openMilestoneDelete = (index: number) => {
    setMilestoneDeleteConfirm({ isOpen: true, index, loading: false });
  };

  const closeMilestoneDelete = () => {
    setMilestoneDeleteConfirm({ isOpen: false, index: null, loading: false });
  };

  const confirmMilestoneDelete = async () => {
    if (milestoneDeleteConfirm.index === null) return;
    const idx = milestoneDeleteConfirm.index;
    const current = formData.milestones || [];
    const toDelete = current[idx] as any;
    try {
      setMilestoneDeleteConfirm((p) => ({ ...p, loading: true }));
      if (toDelete?.id && (initialData?.id || (formData as any).id)) {
        await milestonesApi.delete(toDelete.id);
      }
      setFormData((prev) => ({
        ...prev,
        milestones: (prev.milestones || []).filter((_, i) => i !== idx),
      }));
      closeMilestoneDelete();
    } catch (e) {
      console.error("Failed to delete milestone:", e);
      setMilestoneDeleteConfirm((p) => ({ ...p, loading: false }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Extract milestones from formData before submitting person
    const milestones = formData.milestones || [];
    const personData = { ...formData };
    delete personData.milestones; // Remove milestones from person data

    // Submit person data first
    let result: Person | void;
    try {
      setLoading(true);
      result = await onSubmit(personData);

      // If person was created/updated successfully and we have new milestones, save only new/changed ones
      if (result && typeof result === "object" && "id" in result) {
        const keyOf = (m: any) =>
          `${m.date}|${m.type}|${m.title ?? ""}|${m.description ?? ""}`;
        const newOrChanged = (milestones || []).filter((m: any) => {
          const key = keyOf(m);
          return !initialMilestoneKeysRef.current.has(key);
        });
        if (newOrChanged.length > 0) {
          try {
            for (const milestone of newOrChanged) {
              // skip if no date or all fields empty
              if (!milestone.date && !milestone.title && !milestone.description)
                continue;
              await milestonesApi.create({
                user: (result as { id: string }).id,
                title: milestone.title,
                date: milestone.date,
                type: milestone.type,
                description: milestone.description,
              });
            }
          } catch (error) {
            console.error("Failed to save milestones:", error);
          }
        }
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <form
        onSubmit={handleSubmit}
        className="max-h-[85vh] overflow-y-auto space-y-6 text-sm max-w-3xl"
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
            onClick={() => setActiveTab("basic")}
          >
            Basic Info
          </button>
          <button
            type="button"
            className={`px-4 py-2 font-medium ${
              activeTab === "timeline"
                ? "border-b-2 border-blue-600 text-blue-600"
                : "text-gray-500"
            }`}
            onClick={() => setActiveTab("timeline")}
          >
            Timeline Events
          </button>
        </div>

        {/* BASIC INFO TAB */}
        {activeTab === "basic" && (
          <div className="space-y-6 overflow-y-auto max-h-[60vh] pr-1">
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
          </div>
        )}

        {/* TIMELINE EVENTS TAB */}
        {activeTab === "timeline" && (
          <div className="space-y-4 overflow-y-auto max-h-[60vh] pr-1 p-0">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Event Title *
              </label>
              <input
                type="text"
                value={newMilestone.title}
                onChange={(e) =>
                  setNewMilestone((prev) => ({
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
                value={newMilestone.date}
                onChange={(e) =>
                  setNewMilestone((prev) => ({ ...prev, date: e.target.value }))
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Type
              </label>
              <select
                value={newMilestone.type}
                onChange={(e) =>
                  setNewMilestone((prev) => ({
                    ...prev,
                    type: e.target.value as MilestoneType,
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
                value={newMilestone.description}
                onChange={(e) =>
                  setNewMilestone((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Event description..."
              />
            </div>
            <Button
              onClick={() => {
                // prevent form submit triggering page reload from parent browser default
                handleAddMilestone();
              }}
              disabled={!newMilestone.date || !newMilestone.title.trim()}
            >
              + Add Event
            </Button>

            {formData.milestones && formData.milestones?.length > 0 && (
              <div className="space-y-2 mt-4">
                {formData.milestones.map((m, i) => (
                  <div
                    key={m.id}
                    className="flex justify-between items-start bg-gray-50 p-2 rounded"
                  >
                    <div>
                      <div className="font-semibold">{m.title}</div>
                      <div className="text-xs text-gray-500">
                        {m.date} • {m.type}
                      </div>
                      <div>{m.description}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => openMilestoneDelete(i)}
                      className="text-gray-400 hover:text-red-600 p-1"
                      title="Remove milestone"
                      aria-label="Remove milestone"
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
        )}

        {/* Footer */}
        <div className="flex gap-4 pt-4">
          <Button
            variant="tertiary"
            className="flex-1"
            onClick={
              isEditingFromProfile && onBackToProfile
                ? onBackToProfile
                : onClose
            }
            disabled={loading}
          >
            Cancel
          </Button>
          <Button className="flex-1" disabled={loading} type="submit">
            {loading
              ? "Saving..."
              : initialData?.id
              ? "Update Person"
              : "Create Person"}
          </Button>
        </div>
      </form>

      {/* Milestone delete confirmation */}
      <ConfirmationModal
        isOpen={milestoneDeleteConfirm.isOpen}
        onClose={closeMilestoneDelete}
        onConfirm={confirmMilestoneDelete}
        title="Delete Milestone"
        message="Are you sure you want to delete this timeline event? This action cannot be undone."
        confirmText="Delete Event"
        cancelText="Cancel"
        variant="danger"
        loading={milestoneDeleteConfirm.loading}
      />
      {/* toast removed */}
    </>
  );
}
