import { useState, FormEvent, useEffect, useRef } from "react";
import toast from "react-hot-toast";
import { Person, PersonUI } from "@/src/types/person";
import { peopleApi, eventTypesApi } from "@/src/lib/api";
import { isSelectablePerson } from "@/src/lib/peopleSelectors";
import { formatPersonName } from "@/src/lib/name";
import Button from "@/src/components/ui/Button";
import Modal from "@/src/components/ui/Modal";
import { EventTypeOption } from "@/src/types/event";

/** Local calendar date as YYYY-MM-DD (avoids UTC off-by-one from toISOString). */
const getLocalTodayDateString = (): string => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

interface AddVisitorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (
    visitorData: Partial<Person> & { note?: string }
  ) => Promise<Pick<Person, "first_name" | "last_name"> & Partial<Person>>;
  defaultDateFirstAttended?: string;
  defaultFirstActivityAttended?: string;
}

export default function AddVisitorModal({
  isOpen,
  onClose,
  onAdd,
  defaultDateFirstAttended,
  defaultFirstActivityAttended,
}: AddVisitorModalProps) {
  const todayDateMax = getLocalTodayDateString();
  const [formData, setFormData] = useState({
    first_name: "",
    middle_name: "",
    suffix: "",
    last_name: "",
    facebook_name: "",
    inviter: "",
    date_first_attended:
      defaultDateFirstAttended || todayDateMax,
    first_activity_attended: defaultFirstActivityAttended || "",
    gender: "" as "MALE" | "FEMALE" | "",
    note: "",
  });
  const [eventTypes, setEventTypes] = useState<EventTypeOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [people, setPeople] = useState<PersonUI[]>([]);
  const [inviterSearch, setInviterSearch] = useState("");
  const [showInviterDropdown, setShowInviterDropdown] = useState(false);
  const inviterDropdownRef = useRef<HTMLDivElement>(null);

  const defaultActivityValue =
    defaultFirstActivityAttended ||
    eventTypes.find((type) => type.code === "CLUSTERING")?.code ||
    eventTypes[0]?.code ||
    "";

  useEffect(() => {
    if (!isOpen) return;
    const defaultActivity =
      defaultFirstActivityAttended ||
      eventTypes.find((type) => type.code === "CLUSTERING")?.code ||
      eventTypes[0]?.code ||
      "";
    setFormData((prev) => ({
      ...prev,
      date_first_attended:
        defaultDateFirstAttended || getLocalTodayDateString(),
      first_activity_attended: defaultActivity,
    }));
  }, [
    isOpen,
    defaultDateFirstAttended,
    defaultFirstActivityAttended,
    eventTypes,
  ]);

  useEffect(() => {
    const fetchEventTypes = async () => {
      try {
        const response = await eventTypesApi.list();
        setEventTypes(response.data);
      } catch (error) {
        console.error("Error fetching event types:", error);
      }
    };
    fetchEventTypes();
  }, []);

  // Fetch people for inviter selection
  useEffect(() => {
    const fetchPeople = async () => {
      try {
        const response = await peopleApi.getAll();
        const peopleUI: PersonUI[] = response.data
          .filter(isSelectablePerson)
          .map((p) => {
          const middleInitial = p.middle_name
            ? ` ${p.middle_name.trim().charAt(0)}.`
            : "";
          const suffixPart =
            p.suffix && p.suffix.trim().length > 0 ? ` ${p.suffix.trim()}` : "";
          const name = `${p.first_name ?? ""}${middleInitial} ${
            p.last_name ?? ""
          }${suffixPart}`.trim();
            return {
              ...p,
              name,
              dateFirstAttended: p.date_first_attended,
            };
          });
        setPeople(peopleUI);
      } catch (error) {
        console.error("Error fetching people:", error);
      }
    };
    fetchPeople();
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!formData.first_name || !formData.last_name) {
      setError("First name and last name are required");
      return;
    }

    if (
      formData.date_first_attended &&
      formData.date_first_attended > todayDateMax
    ) {
      setError("Date First Attended cannot be in the future.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const visitorData = {
        ...formData,
        role: "VISITOR" as const,
        status: "ONGOING" as const,
        gender: formData.gender || undefined,
        note: formData.note?.trim() || undefined,
      };

      const created = await onAdd(visitorData);
      toast.success(
        `${formatPersonName(created)} added to this report.`
      );

      // Reset form and close modal - user can reopen to add another visitor
      setFormData({
        first_name: "",
        middle_name: "",
        suffix: "",
        last_name: "",
        facebook_name: "",
        inviter: "",
        date_first_attended:
          defaultDateFirstAttended || todayDateMax,
        first_activity_attended: defaultActivityValue,
        gender: "",
        note: "",
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add visitor");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setFormData({
        first_name: "",
        middle_name: "",
        suffix: "",
        last_name: "",
        facebook_name: "",
        inviter: "",
        date_first_attended:
          defaultDateFirstAttended || todayDateMax,
        first_activity_attended: defaultActivityValue,
        gender: "",
        note: "",
      });
      setError(null);
      onClose();
    }
  };

  // Filter people for inviter dropdown
  const filteredPeople = people.filter((person) =>
    person.name.toLowerCase().includes(inviterSearch.toLowerCase())
  );

  // Handle inviter selection
  const handleInviterSelect = (personId: string) => {
    setFormData({ ...formData, inviter: personId });
    setShowInviterDropdown(false);
    setInviterSearch("");
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        inviterDropdownRef.current &&
        !inviterDropdownRef.current.contains(event.target as Node)
      ) {
        setShowInviterDropdown(false);
      }
    };

    if (showInviterDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showInviterDropdown]);

  // Get selected inviter name for display
  const selectedInviter = people.find((p) => p.id === formData.inviter);

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Add New Visitor">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        {/* Name Fields - 4 columns including Suffix */}
        <div className="grid grid-cols-4 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              First Name *
            </label>
            <input
              type="text"
              value={formData.first_name}
              onChange={(e) =>
                setFormData({ ...formData, first_name: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Middle Name
            </label>
            <input
              type="text"
              value={formData.middle_name}
              onChange={(e) =>
                setFormData({ ...formData, middle_name: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Last Name *
            </label>
            <input
              type="text"
              value={formData.last_name}
              onChange={(e) =>
                setFormData({ ...formData, last_name: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Suffix
            </label>
            <input
              type="text"
              value={formData.suffix}
              onChange={(e) =>
                setFormData({ ...formData, suffix: e.target.value })
              }
              placeholder="Jr., Sr., III, etc."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent"
            />
          </div>
        </div>

        {/* Facebook Name and Gender - 2 columns */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Facebook Name
            </label>
            <input
              type="text"
              value={formData.facebook_name}
              onChange={(e) =>
                setFormData({ ...formData, facebook_name: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Gender
            </label>
            <select
              value={formData.gender}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  gender: e.target.value as "MALE" | "FEMALE" | "",
                })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent"
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
            value={formData.note}
            onChange={(e) =>
              setFormData({ ...formData, note: e.target.value })
            }
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent"
            placeholder="Add notes about this visitor..."
          />
        </div>

        {/* Date First Attended and First Activity Attended - 2 columns */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Date First Attended *
            </label>
            <input
              type="date"
              value={formData.date_first_attended}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  date_first_attended: e.target.value,
                })
              }
              max={todayDateMax}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              First Activity Attended
            </label>
            <select
              value={formData.first_activity_attended}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  first_activity_attended: e.target.value,
                })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent"
            >
              <option value="">Select...</option>
              {eventTypes.map((type) => (
                <option key={type.code} value={type.code}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Inviter
          </label>
          <div className="relative" ref={inviterDropdownRef}>
            <input
              type="text"
              value={inviterSearch || selectedInviter?.name || ""}
              onChange={(e) => {
                setInviterSearch(e.target.value);
                setShowInviterDropdown(true);
              }}
              onFocus={() => setShowInviterDropdown(true)}
              placeholder="Search for inviter..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent"
            />
            {showInviterDropdown && filteredPeople.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                {filteredPeople.map((person) => (
                  <button
                    key={person.id}
                    type="button"
                    onClick={() => handleInviterSelect(person.id)}
                    className="w-full px-3 py-2 text-left hover:bg-gray-100 focus:bg-gray-100 focus:outline-none"
                  >
                    <div className="font-medium text-gray-900">
                      {person.name}
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
            onClick={handleClose}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button className="flex-1" disabled={loading} type="submit">
            {loading ? "Adding..." : "Add Visitor"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
