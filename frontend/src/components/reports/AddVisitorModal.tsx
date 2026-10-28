import { useState, FormEvent, useEffect } from "react";
import toast from "react-hot-toast";
import { Person, PersonUI } from "@/src/types/person";
import { peopleApi, eventTypesApi } from "@/src/lib/api";
import { isSelectablePerson } from "@/src/lib/peopleSelectors";
import { formatPersonName } from "@/src/lib/name";
import Button from "@/src/components/ui/Button";
import Modal from "@/src/components/ui/Modal";
import SearchableSelect from "@/src/components/ui/SearchableSelect";
import { EventTypeOption } from "@/src/types/event";
import { activityEventTypes } from "@/src/lib/events/activityTypes";

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
  /** Widen people list for inviter search when used from weekly reports. */
  forReport?: boolean;
}

export default function AddVisitorModal({
  isOpen,
  onClose,
  onAdd,
  defaultDateFirstAttended,
  defaultFirstActivityAttended,
  forReport = false,
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
  const activityTypes = activityEventTypes(eventTypes);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [people, setPeople] = useState<PersonUI[]>([]);

  const defaultActivityValue =
    defaultFirstActivityAttended ||
    activityTypes.find((type) => type.code === "CLUSTERING")?.code ||
    activityTypes[0]?.code ||
    "";

  useEffect(() => {
    if (!isOpen) return;
    const defaultActivity =
      defaultFirstActivityAttended ||
      activityTypes.find((type) => type.code === "CLUSTERING")?.code ||
      activityTypes[0]?.code ||
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

  // Inviter list only when the modal is open — mounting under a report form
  // must not hit people/?for_report while the visitor dialog is closed.
  useEffect(() => {
    if (!isOpen) {
      setPeople([]);
      return;
    }
    let cancelled = false;
    const fetchPeople = async () => {
      try {
        const response = await peopleApi.getAll(
          forReport ? { for_report: true } : undefined
        );
        if (cancelled) return;
        const peopleUI: PersonUI[] = response.data
          .filter(
            (person) =>
              isSelectablePerson(person) &&
              (person.role || "").toUpperCase() !== "VISITOR",
          )
          .map((p) => ({
            ...p,
            name: formatPersonName(p),
            dateFirstAttended: p.date_first_attended,
          }));
        setPeople(peopleUI);
      } catch (error) {
        if (!cancelled) {
          console.error("Error fetching people:", error);
        }
      }
    };
    void fetchPeople();
    return () => {
      cancelled = true;
    };
  }, [isOpen, forReport]);

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

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Add New Visitor"
      closeOnOutsideClick={false}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              First Name *
            </label>
            <input
              type="text"
              value={formData.first_name}
              onChange={(e) =>
                setFormData({ ...formData, first_name: e.target.value })
              }
              className="min-h-[44px] w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-ring"
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Middle Name
            </label>
            <input
              type="text"
              value={formData.middle_name}
              onChange={(e) =>
                setFormData({ ...formData, middle_name: e.target.value })
              }
              className="min-h-[44px] w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-ring"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Last Name *
            </label>
            <input
              type="text"
              value={formData.last_name}
              onChange={(e) =>
                setFormData({ ...formData, last_name: e.target.value })
              }
              className="min-h-[44px] w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-ring"
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Suffix
            </label>
            <input
              type="text"
              value={formData.suffix}
              onChange={(e) =>
                setFormData({ ...formData, suffix: e.target.value })
              }
              placeholder="Jr., Sr., III, etc."
              className="min-h-[44px] w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Facebook Name
            </label>
            <input
              type="text"
              value={formData.facebook_name}
              onChange={(e) =>
                setFormData({ ...formData, facebook_name: e.target.value })
              }
              className="min-h-[44px] w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-ring"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
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
              className="min-h-[44px] w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-ring"
            >
              <option value="">Select...</option>
              <option value="MALE">Male</option>
              <option value="FEMALE">Female</option>
            </select>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Notes
          </label>
          <textarea
            value={formData.note}
            onChange={(e) =>
              setFormData({ ...formData, note: e.target.value })
            }
            rows={3}
            className="min-h-[88px] w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-ring"
            placeholder="Add notes about this visitor..."
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
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
              className="min-h-[44px] w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-ring"
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
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
              className="min-h-[44px] w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-ring"
            >
              <option value="">Select...</option>
              {activityTypes.map((type) => (
                <option key={type.code} value={type.code}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Inviter
          </label>
          <SearchableSelect
            value={formData.inviter ? String(formData.inviter) : ""}
            onChange={(value) =>
              setFormData((prev) => ({ ...prev, inviter: value }))
            }
            options={people.map((p) => ({
              ...p,
              id: p.id,
              username: p.username || p.email || String(p.id),
            }))}
            placeholder="Search for inviter..."
            emptyMessage="No inviter found"
            showEmptyOption
            emptyOptionLabel="No inviter"
            showRole={false}
            showStatus={false}
            controlClassName="!min-h-[44px] box-border flex items-center !py-0 !text-sm"
          />
        </div>

        <div className="flex flex-col-reverse gap-3 pt-4 sm:flex-row sm:gap-4">
          <Button
            variant="tertiary"
            className="w-full flex-1"
            onClick={handleClose}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button className="w-full flex-1" disabled={loading} type="submit">
            {loading ? "Adding..." : "Add Visitor"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
