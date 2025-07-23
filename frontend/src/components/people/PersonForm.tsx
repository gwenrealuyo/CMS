import { useState } from "react";
import { Person, MilestoneType } from "@/src/types/person";
import Button from "@/src/components/ui/Button";

interface PersonFormProps {
  onSubmit: (data: Partial<Person>) => void;
  onClose: () => void;
  initialData?: Partial<Person>;
}

export default function PersonForm({
  onSubmit,
  onClose,
  initialData,
}: PersonFormProps) {
  const [activeTab, setActiveTab] = useState<"basic" | "timeline">("basic");

  const [formData, setFormData] = useState<Partial<Person>>({
    role: "MEMBER",
    status: "ACTIVE",
    milestones: [],
    ...initialData,
  });

  const [newMilestone, setNewMilestone] = useState<{
    date: string;
    type: MilestoneType;
    title: string;
    description: string;
  }>({
    date: "",
    type: "BAPTISM",
    title: "",
    description: "",
  });

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

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
    const id = crypto.randomUUID();
    setFormData((prev) => ({
      ...prev,
      milestones: [
        ...(prev.milestones || []),
        {
          id,
          user: prev.id || "", // Use the current person's ID if available, otherwise empty string
          ...newMilestone,
        },
      ],
    }));
    setNewMilestone({
      date: "",
      type: "BAPTISM",
      title: "",
      description: "",
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="max-h-[85vh] overflow-y-auto space-y-6 text-sm"
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
        <div className="space-y-4">
          {/* Name Fields */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label>First Name *</label>
              <input
                type="text"
                name="first_name"
                required
                value={formData.first_name || ""}
                onChange={handleChange}
                className="w-full mt-1 border rounded-md px-2 py-1"
              />
            </div>
            <div>
              <label>Middle Name</label>
              <input
                type="text"
                name="middle_name"
                value={formData.middle_name || ""}
                onChange={handleChange}
                className="w-full mt-1 border rounded-md px-2 py-1"
              />
            </div>
            <div>
              <label>Last Name *</label>
              <input
                type="text"
                name="last_name"
                required
                value={formData.last_name || ""}
                onChange={handleChange}
                className="w-full mt-1 border rounded-md px-2 py-1"
              />
            </div>
          </div>

          {/* Email & Phone */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label>Email *</label>
              <input
                type="email"
                name="email"
                required
                value={formData.email || ""}
                onChange={handleChange}
                className="w-full mt-1 border rounded-md px-2 py-1"
              />
            </div>
            <div>
              <label>Phone Number</label>
              <input
                type="tel"
                name="phone"
                value={formData.phone || ""}
                onChange={handleChange}
                className="w-full mt-1 border rounded-md px-2 py-1"
              />
            </div>
          </div>

          {/* Gender & Country */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label>Gender</label>
              <select
                name="gender"
                value={formData.gender || ""}
                onChange={handleChange}
                className="w-full mt-1 border rounded-md px-2 py-1"
              >
                <option value="">Select gender</option>
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
              </select>
            </div>
            <div>
              <label>Country</label>
              <input
                type="text"
                name="country"
                value={formData.country || ""}
                onChange={handleChange}
                className="w-full mt-1 border rounded-md px-2 py-1"
              />
            </div>
          </div>

          {/* Address */}
          <div>
            <label>Address</label>
            <textarea
              name="address"
              value={formData.address || ""}
              onChange={handleChange}
              className="w-full mt-1 border rounded-md px-2 py-1"
            />
          </div>

          {/* Facebook Name & Photo */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label>Facebook Name</label>
              <input
                type="text"
                name="facebook_name"
                value={formData.facebook_name || ""}
                onChange={handleChange}
                className="w-full mt-1 border rounded-md px-2 py-1"
              />
            </div>
            <div>
              <label>Photo</label>
              <input
                type="file"
                accept="image/*"
                onChange={handlePhotoChange}
                className="w-full mt-1"
              />
            </div>
          </div>

          {/* DOB & First Attended */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label>Date of Birth</label>
              <input
                type="date"
                name="date_of_birth"
                value={formData.date_of_birth || ""}
                onChange={handleChange}
                className="w-full mt-1 border rounded-md px-2 py-1"
              />
            </div>
            <div>
              <label>Date First Attended</label>
              <input
                type="date"
                name="date_first_attended"
                value={formData.date_first_attended || ""}
                onChange={handleChange}
                className="w-full mt-1 border rounded-md px-2 py-1"
              />
            </div>
          </div>

          {/* Role & Status */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label>Role</label>
              <select
                name="role"
                value={formData.role}
                onChange={handleChange}
                className="w-full mt-1 border rounded-md px-2 py-1"
              >
                {["MEMBER", "VISITOR", "COORDINATOR", "PASTOR", "ADMIN"].map(
                  (role) => (
                    <option key={role} value={role}>
                      {role.charAt(0) + role.slice(1).toLowerCase()}
                    </option>
                  )
                )}
              </select>
            </div>
            <div>
              <label>Status</label>
              <select
                name="status"
                value={formData.status}
                onChange={handleChange}
                className="w-full mt-1 border rounded-md px-2 py-1"
              >
                {["ACTIVE", "SEMIACTIVE", "INACTIVE", "DECEASED"].map(
                  (status) => (
                    <option key={status} value={status}>
                      {status.charAt(0) + status.slice(1).toLowerCase()}
                    </option>
                  )
                )}
              </select>
            </div>
          </div>

          {/* Inviter & Member ID */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label>Inviter (ID)</label>
              <input
                type="text"
                name="inviter"
                value={formData.inviter || ""}
                onChange={handleChange}
                className="w-full mt-1 border rounded-md px-2 py-1"
              />
            </div>
            <div>
              <label>Member ID</label>
              <input
                type="text"
                name="member_id"
                value={formData.member_id || ""}
                onChange={handleChange}
                className="w-full mt-1 border rounded-md px-2 py-1"
              />
            </div>
          </div>
        </div>
      )}

      {/* TIMELINE EVENTS TAB */}
      {activeTab === "timeline" && (
        <div className="space-y-4">
          <div>
            <label>Event Title</label>
            <input
              type="text"
              value={newMilestone.title}
              onChange={(e) =>
                setNewMilestone((prev) => ({ ...prev, title: e.target.value }))
              }
              className="w-full mt-1 border rounded-md px-2 py-1"
              placeholder="e.g., Baptism, First attendance"
            />
          </div>
          <div>
            <label>Date</label>
            <input
              type="date"
              value={newMilestone.date}
              onChange={(e) =>
                setNewMilestone((prev) => ({ ...prev, date: e.target.value }))
              }
              className="w-full mt-1 border rounded-md px-2 py-1"
            />
          </div>
          <div>
            <label>Type</label>
            <select
              value={newMilestone.type}
              onChange={(e) =>
                setNewMilestone((prev) => ({
                  ...prev,
                  type: e.target.value as MilestoneType,
                }))
              }
              className="w-full mt-1 border rounded-md px-2 py-1"
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
            <label>Description</label>
            <textarea
              value={newMilestone.description}
              onChange={(e) =>
                setNewMilestone((prev) => ({
                  ...prev,
                  description: e.target.value,
                }))
              }
              className="w-full mt-1 border rounded-md px-2 py-1"
              placeholder="Event description..."
            />
          </div>
          <Button onClick={handleAddMilestone}>+ Add Event</Button>

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
                    onClick={() =>
                      setFormData((prev) => ({
                        ...prev,
                        milestones: prev.milestones?.filter(
                          (_, idx) => idx !== i
                        ),
                      }))
                    }
                    className="text-red-500 text-sm"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="flex gap-4">
        <Button className="flex-1">Add Member</Button>
        <Button variant="tertiary" className="flex-1" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
