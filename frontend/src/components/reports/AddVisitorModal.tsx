import { useState, FormEvent, useEffect, useRef } from "react";
import { Person, PersonUI } from "@/src/types/person";
import { peopleApi } from "@/src/lib/api";
import Button from "@/src/components/ui/Button";
import Modal from "@/src/components/ui/Modal";

interface AddVisitorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (visitorData: Partial<Person>) => Promise<Person>;
}

export default function AddVisitorModal({
  isOpen,
  onClose,
  onAdd,
}: AddVisitorModalProps) {
  const [formData, setFormData] = useState({
    first_name: "",
    middle_name: "",
    last_name: "",
    facebook_name: "",
    inviter: "",
    date_first_attended: new Date().toISOString().split("T")[0],
    first_activity_attended: "CLUSTERING" as any,
    gender: "" as "MALE" | "FEMALE" | "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [people, setPeople] = useState<PersonUI[]>([]);
  const [inviterSearch, setInviterSearch] = useState("");
  const [showInviterDropdown, setShowInviterDropdown] = useState(false);
  const inviterDropdownRef = useRef<HTMLDivElement>(null);

  // Fetch people for inviter selection
  useEffect(() => {
    const fetchPeople = async () => {
      try {
        const response = await peopleApi.getAll();
        const peopleUI: PersonUI[] = response.data.map((p) => ({
          ...p,
          name: `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim(),
          dateFirstAttended: p.date_first_attended,
        }));
        setPeople(peopleUI);
      } catch (error) {
        console.error("Error fetching people:", error);
      }
    };
    fetchPeople();
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
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
      };

      await onAdd(visitorData);

      // Reset form
      setFormData({
        first_name: "",
        middle_name: "",
        last_name: "",
        facebook_name: "",
        inviter: "",
        date_first_attended: new Date().toISOString().split("T")[0],
        first_activity_attended: "CLUSTERING",
        gender: "",
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
        last_name: "",
        facebook_name: "",
        inviter: "",
        date_first_attended: new Date().toISOString().split("T")[0],
        first_activity_attended: "CLUSTERING",
        gender: "",
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

        {/* Name Fields - 3 columns */}
        <div className="grid grid-cols-3 gap-3">
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

        <div className="flex justify-end gap-3 pt-4">
          <Button
            type="button"
            onClick={handleClose}
            variant="secondary"
            className="!text-black py-2 px-4 text-sm font-normal bg-white border border-gray-200 hover:bg-gray-50"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={loading}
            className="!text-white py-2 px-4 text-sm font-normal bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "Adding..." : "Add Visitor"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
