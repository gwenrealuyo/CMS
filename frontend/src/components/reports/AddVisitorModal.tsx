import { useState, FormEvent, useEffect, useRef } from "react";
import { Person, PersonUI } from "@/src/types/person";
import { peopleApi } from "@/src/lib/api";
import Button from "@/src/components/ui/Button";
import Modal from "@/src/components/ui/Modal";

interface AddVisitorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (visitorData: Partial<Person>) => Promise<Person>;
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
  const [formData, setFormData] = useState({
    first_name: "",
    middle_name: "",
    suffix: "",
    last_name: "",
    facebook_name: "",
    inviter: "",
    date_first_attended:
      defaultDateFirstAttended || new Date().toISOString().split("T")[0],
    first_activity_attended:
      (defaultFirstActivityAttended as any) || ("CLUSTERING" as any),
    gender: "" as "MALE" | "FEMALE" | "",
    note: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [people, setPeople] = useState<PersonUI[]>([]);
  const [inviterSearch, setInviterSearch] = useState("");
  const [showInviterDropdown, setShowInviterDropdown] = useState(false);
  const inviterDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    setFormData((prev) => ({
      ...prev,
      date_first_attended:
        defaultDateFirstAttended || new Date().toISOString().split("T")[0],
      first_activity_attended:
        (defaultFirstActivityAttended as any) || "CLUSTERING",
    }));
  }, [isOpen, defaultDateFirstAttended, defaultFirstActivityAttended]);

  // Fetch people for inviter selection
  useEffect(() => {
    const fetchPeople = async () => {
      try {
        const response = await peopleApi.getAll();
        const peopleUI: PersonUI[] = response.data.map((p) => {
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
        setPeople(peopleUI.filter((person) => person.role !== "ADMIN"));
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

    setLoading(true);
    setError(null);

    try {
      const visitorData = {
        ...formData,
        role: "VISITOR" as const,
        status: "ACTIVE" as const,
        gender: formData.gender || undefined,
        note: formData.note?.trim() || undefined,
      };

      await onAdd(visitorData);

      // Reset form and close modal - user can reopen to add another visitor
      setFormData({
        first_name: "",
        middle_name: "",
        suffix: "",
        last_name: "",
        facebook_name: "",
        inviter: "",
        date_first_attended:
          defaultDateFirstAttended || new Date().toISOString().split("T")[0],
        first_activity_attended:
          (defaultFirstActivityAttended as any) || "CLUSTERING",
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
          defaultDateFirstAttended || new Date().toISOString().split("T")[0],
        first_activity_attended:
          (defaultFirstActivityAttended as any) || "CLUSTERING",
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
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Select...</option>
              <option value="CLUSTER_BS_EVANGELISM">
                Cluster/BS Evangelism
              </option>
              <option value="CLUSTERING">Clustering</option>
              <option value="SUNDAY_SERVICE">Sunday Service</option>
              <option value="DOCTRINAL_CLASS">Doctrinal Class</option>
              <option value="PRAYER_MEETING">Prayer Meeting</option>
              <option value="CYM_CLASS">CYM Class</option>
              <option value="MINI_WORSHIP">Mini Worship</option>
              <option value="GOLDEN_WARRIORS">Golden Warriors</option>
              <option value="CAMPING">Camping</option>
              <option value="AWTA">AWTA</option>
              <option value="CONFERENCE">Conference</option>
              <option value="CONCERT_CRUSADE">Concert/Crusade</option>
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
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
            {loading ? "Saving..." : "Add Visitor"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
