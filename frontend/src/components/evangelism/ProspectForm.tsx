"use client";

import {
  ChangeEvent,
  FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Button from "@/src/components/ui/Button";
import type { Prospect, EvangelismGroup } from "@/src/types/evangelism";
import type { Person } from "@/src/types/person";

/** Match cluster weekly report `AddVisitorModal` inputs / selects. */
const CLUSTER_VISITOR_CONTROL =
  "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent";

function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function personDisplayLabel(p: Person): string {
  const middleInitial = p.middle_name
    ? ` ${p.middle_name.trim().charAt(0)}.`
    : "";
  const suffixPart =
    p.suffix && p.suffix.trim().length > 0 ? ` ${p.suffix.trim()}` : "";
  const base = `${p.first_name ?? ""}${middleInitial} ${
    p.last_name ?? ""
  }${suffixPart}`.trim();
  return base || p.email || p.username || "";
}

function groupDisplayLabel(g: EvangelismGroup): string {
  const cluster = g.cluster;
  const clusterBit = cluster
    ? [cluster.code, cluster.name].filter(Boolean).join(" ")
    : "";
  if (clusterBit) return `${g.name} — ${clusterBit}`;
  return g.name;
}

function groupMatchesSearch(g: EvangelismGroup, q: string): boolean {
  if (!q.trim()) return true;
  const hay = [
    g.name,
    g.description,
    g.location,
    g.cluster?.code,
    g.cluster?.name,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return hay.includes(q.trim().toLowerCase());
}

export interface ProspectFormValues {
  first_name: string;
  middle_name: string;
  last_name: string;
  suffix: string;
  gender: string;
  date_first_invited: string;
  contact_info: string;
  facebook_name: string;
  invited_by_id: string;
  evangelism_group_id?: string;
  notes: string;
}

interface ProspectFormProps {
  inviters?: Person[];
  groups?: EvangelismGroup[];
  /** When set (e.g. group modal context), selects this bible study group and ensures it appears in options. */
  selectedBibleStudyGroup?: EvangelismGroup | null;
  onSubmit: (values: ProspectFormValues) => Promise<void>;
  onCancel: () => void;
  isSubmitting: boolean;
  error?: string | null;
  submitLabel?: string;
  initialData?: Prospect;
  defaultGroupId?: string;
}

const DEFAULT_VALUES: ProspectFormValues = {
  first_name: "",
  middle_name: "",
  last_name: "",
  suffix: "",
  gender: "",
  date_first_invited: todayISO(),
  contact_info: "",
  facebook_name: "",
  invited_by_id: "",
  evangelism_group_id: "",
  notes: "",
};

export default function ProspectForm({
  inviters = [],
  groups = [],
  onSubmit,
  onCancel,
  isSubmitting,
  error,
  submitLabel = "Create Invited Visitor",
  initialData,
  selectedBibleStudyGroup,
  defaultGroupId,
}: ProspectFormProps) {
  const contextGroupId = useMemo(() => {
    if (defaultGroupId) return defaultGroupId;
    const id = selectedBibleStudyGroup?.id;
    return id != null && id !== "" ? String(id) : "";
  }, [defaultGroupId, selectedBibleStudyGroup?.id]);

  const groupChoices = useMemo(() => {
    const byId = new Map<string, EvangelismGroup>();
    const add = (g: EvangelismGroup | null | undefined) => {
      if (g?.id != null && String(g.id) !== "") {
        byId.set(String(g.id), g);
      }
    };
    add(selectedBibleStudyGroup);
    add(initialData?.evangelism_group);
    for (const g of groups) {
      add(g);
    }
    return Array.from(byId.values());
  }, [groups, selectedBibleStudyGroup, initialData?.evangelism_group]);

  const [values, setValues] = useState<ProspectFormValues>(
    initialData
      ? {
          first_name: initialData.first_name,
          middle_name: initialData.middle_name || "",
          last_name: initialData.last_name,
          suffix: initialData.suffix || "",
          gender: initialData.gender || "",
          date_first_invited:
            initialData.date_first_invited?.slice(0, 10) || todayISO(),
          contact_info: initialData.contact_info || "",
          facebook_name: initialData.facebook_name || "",
          invited_by_id: initialData.invited_by?.id || "",
          evangelism_group_id: initialData.evangelism_group?.id || "",
          notes: initialData.notes || "",
        }
      : {
          ...DEFAULT_VALUES,
          evangelism_group_id: contextGroupId || "",
          date_first_invited: todayISO(),
        },
  );

  const [inviterSearch, setInviterSearch] = useState("");
  const [showInviterDropdown, setShowInviterDropdown] = useState(false);
  const inviterDropdownRef = useRef<HTMLDivElement>(null);

  const [groupSearch, setGroupSearch] = useState("");
  const [showGroupDropdown, setShowGroupDropdown] = useState(false);
  const groupDropdownRef = useRef<HTMLDivElement>(null);

  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (initialData) return;
    if (contextGroupId) {
      setValues((prev) => ({
        ...prev,
        evangelism_group_id: contextGroupId,
      }));
    }
  }, [initialData, contextGroupId]);

  const inviterCandidates = useMemo(
    () =>
      [...inviters].sort((a, b) =>
        personDisplayLabel(a).localeCompare(personDisplayLabel(b)),
      ),
    [inviters],
  );

  const selectedInviter = inviterCandidates.find(
    (p) => String(p.id) === values.invited_by_id,
  );

  const filteredInviters = inviterCandidates.filter((person) =>
    personDisplayLabel(person)
      .toLowerCase()
      .includes(inviterSearch.toLowerCase()),
  );

  const groupCandidates = useMemo(
    () =>
      [...groupChoices].sort((a, b) =>
        (a.name || "").localeCompare(b.name || ""),
      ),
    [groupChoices],
  );

  const selectedGroup = groupCandidates.find(
    (g) => String(g.id) === (values.evangelism_group_id || ""),
  );

  const filteredGroups = groupCandidates.filter((g) =>
    groupMatchesSearch(g, groupSearch),
  );

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        inviterDropdownRef.current &&
        !inviterDropdownRef.current.contains(target)
      ) {
        setShowInviterDropdown(false);
      }
      if (
        groupDropdownRef.current &&
        !groupDropdownRef.current.contains(target)
      ) {
        setShowGroupDropdown(false);
      }
    };
    if (showInviterDropdown || showGroupDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showInviterDropdown, showGroupDropdown]);

  useEffect(() => {
    setValidationError(null);
  }, [values.invited_by_id, values.first_name, values.last_name]);

  useEffect(() => {
    setValidationError(null);
  }, [error]);

  const handleChange =
    (field: keyof ProspectFormValues) =>
    (
      event: ChangeEvent<
        HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
      >,
    ) => {
      setValues((prev) => ({
        ...prev,
        [field]: event.target.value,
      }));
    };

  const handleInviterSelect = (personId: string) => {
    setValues((prev) => ({ ...prev, invited_by_id: personId }));
    setShowInviterDropdown(false);
    setInviterSearch("");
  };

  const handleGroupSelect = (groupId: string) => {
    setValues((prev) => ({
      ...prev,
      evangelism_group_id: groupId || "",
    }));
    setShowGroupDropdown(false);
    setGroupSearch("");
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!values.first_name.trim() || !values.last_name.trim()) {
      setValidationError("First name and last name are required.");
      return;
    }
    if (!values.invited_by_id) {
      setValidationError("Inviter is required.");
      return;
    }
    await onSubmit(values);
  };

  const shownError = validationError || error || null;

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      {shownError && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {shownError}
        </div>
      )}

      <div className="grid grid-cols-4 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            First Name *
          </label>
          <input
            type="text"
            value={values.first_name}
            onChange={handleChange("first_name")}
            className={CLUSTER_VISITOR_CONTROL}
            required
            autoComplete="given-name"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Middle Name
          </label>
          <input
            type="text"
            value={values.middle_name}
            onChange={handleChange("middle_name")}
            className={CLUSTER_VISITOR_CONTROL}
            autoComplete="additional-name"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Last Name *
          </label>
          <input
            type="text"
            value={values.last_name}
            onChange={handleChange("last_name")}
            className={CLUSTER_VISITOR_CONTROL}
            required
            autoComplete="family-name"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Suffix
          </label>
          <input
            type="text"
            value={values.suffix}
            onChange={handleChange("suffix")}
            placeholder="Jr., Sr., III, etc."
            className={CLUSTER_VISITOR_CONTROL}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Facebook Name
          </label>
          <input
            type="text"
            value={values.facebook_name}
            onChange={handleChange("facebook_name")}
            className={CLUSTER_VISITOR_CONTROL}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Gender
          </label>
          <select
            value={values.gender}
            onChange={handleChange("gender")}
            className={CLUSTER_VISITOR_CONTROL}
          >
            <option value="">Select...</option>
            <option value="MALE">Male</option>
            <option value="FEMALE">Female</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Notes
        </label>
        <textarea
          value={values.notes}
          onChange={handleChange("notes")}
          rows={3}
          placeholder="Invitation notes (shown on timeline when visitor becomes a Person)…"
          className={CLUSTER_VISITOR_CONTROL}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Date First Invited *
          </label>
          <input
            type="date"
            value={values.date_first_invited}
            onChange={handleChange("date_first_invited")}
            className={CLUSTER_VISITOR_CONTROL}
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Contact Info
          </label>
          <input
            type="text"
            value={values.contact_info}
            onChange={handleChange("contact_info")}
            placeholder="Phone number"
            className={CLUSTER_VISITOR_CONTROL}
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Bible Study Group
        </label>
        <div className="relative" ref={groupDropdownRef}>
          <input
            type="text"
            role="combobox"
            aria-expanded={showGroupDropdown}
            aria-autocomplete="list"
            value={
              groupSearch ||
              (selectedGroup ? groupDisplayLabel(selectedGroup) : "")
            }
            onChange={(e) => {
              setGroupSearch(e.target.value);
              setShowGroupDropdown(true);
            }}
            onFocus={() => setShowGroupDropdown(true)}
            placeholder="Search bible study groups..."
            className={CLUSTER_VISITOR_CONTROL}
          />
          {showGroupDropdown && (
            <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
              <button
                type="button"
                onClick={() => handleGroupSelect("")}
                className="w-full px-3 py-2 text-left text-gray-600 hover:bg-gray-100 focus:bg-gray-100 focus:outline-none border-b border-gray-100"
              >
                Not set
              </button>
              {filteredGroups.length > 0 ? (
                filteredGroups.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => handleGroupSelect(String(g.id))}
                    className="w-full px-3 py-2 text-left hover:bg-gray-100 focus:bg-gray-100 focus:outline-none"
                  >
                    <div className="font-medium text-gray-900">
                      {groupDisplayLabel(g)}
                    </div>
                  </button>
                ))
              ) : (
                <div className="px-3 py-2 text-sm text-gray-500">
                  {groupCandidates.length === 0
                    ? "No bible study groups available"
                    : "No groups match your search"}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Inviter *
        </label>
        <div className="relative" ref={inviterDropdownRef}>
          <input
            type="text"
            value={
              inviterSearch ||
              (selectedInviter ? personDisplayLabel(selectedInviter) : "")
            }
            onChange={(e) => {
              setInviterSearch(e.target.value);
              setShowInviterDropdown(true);
            }}
            onFocus={() => setShowInviterDropdown(true)}
            placeholder="Search for inviter..."
            className={CLUSTER_VISITOR_CONTROL}
          />
          {showInviterDropdown && filteredInviters.length > 0 && (
            <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
              {filteredInviters.map((person) => (
                <button
                  key={person.id}
                  type="button"
                  onClick={() => handleInviterSelect(String(person.id))}
                  className="w-full px-3 py-2 text-left hover:bg-gray-100 focus:bg-gray-100 focus:outline-none"
                >
                  <div className="font-medium text-gray-900">
                    {personDisplayLabel(person)}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex gap-4 pt-4">
        <Button
          variant="tertiary"
          className="flex-1"
          onClick={onCancel}
          disabled={isSubmitting}
          type="button"
        >
          Cancel
        </Button>
        <Button className="flex-1" disabled={isSubmitting} type="submit">
          {isSubmitting ? "Saving..." : submitLabel}
        </Button>
      </div>
    </form>
  );
}
