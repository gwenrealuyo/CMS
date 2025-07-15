import { useState } from "react";
import { Person, PersonRole } from "@/src/types/person";
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
  const [formData, setFormData] = useState<Partial<Person>>(
    initialData || {
      name: "",
      email: "",
      phone: "",
      photo: "",
      role: "Member",
      dateFirstAttended: new Date(),
      milestones: [],
    }
  );

  const [newMilestone, setNewMilestone] = useState<{
    date: Date;
    type: "Lesson" | "Baptism" | "Spirit";
    description: string;
  }>({
    date: new Date(),
    type: "Lesson",
    description: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

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
      reader.onloadend = () => {
        setFormData((prev) => ({ ...prev, photo: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAddMilestone = () => {
    setFormData((prev) => ({
      ...prev,
      milestones: [
        ...(prev.milestones || []),
        { ...newMilestone, id: crypto.randomUUID() },
      ],
    }));
    setNewMilestone({
      date: new Date(),
      type: "Lesson",
      description: "",
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700">
          Full Name
        </label>
        <input
          type="text"
          name="name"
          value={formData.name}
          onChange={handleChange}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Email</label>
        <input
          type="email"
          name="email"
          value={formData.email}
          onChange={handleChange}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Phone</label>
        <input
          type="tel"
          name="phone"
          value={formData.phone}
          onChange={handleChange}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Role</label>
        <select
          name="role"
          value={formData.role}
          onChange={handleChange}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500"
          required
        >
          <option value="Member">Member</option>
          <option value="Visitor">Visitor</option>
          <option value="Coordinator">Coordinator</option>
          <option value="Pastor">Pastor</option>
          <option value="Admin">Admin</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Photo</label>
        <input
          type="file"
          accept="image/*"
          onChange={handlePhotoChange}
          className="mt-1 block w-full"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">
          First Attended
        </label>
        <input
          type="date"
          name="dateFirstAttended"
          value={
            formData.dateFirstAttended
              ? new Date(formData.dateFirstAttended).toISOString().split("T")[0]
              : ""
          }
          onChange={handleChange}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500"
          required
        />
      </div>

      <div className="space-y-2">
        <h3 className="text-lg font-medium">Milestones</h3>
        <div className="flex gap-2">
          <input
            type="date"
            value={newMilestone.date.toISOString().split("T")[0]}
            onChange={(e) =>
              setNewMilestone((prev) => ({
                ...prev,
                date: new Date(e.target.value),
              }))
            }
            className="flex-1 rounded-md border-gray-300"
          />
          <select
            value={newMilestone.type}
            onChange={(e) =>
              setNewMilestone((prev) => ({
                ...prev,
                type: e.target.value as "Lesson" | "Baptism" | "Spirit",
              }))
            }
            className="flex-1 rounded-md border-gray-300"
          >
            <option value="Lesson">Lesson</option>
            <option value="Baptism">Baptism</option>
            <option value="Spirit">Received HG</option>
            <option value="Cluster">Joined a cluster</option>
          </select>
          <input
            type="text"
            placeholder="Description"
            value={newMilestone.description}
            onChange={(e) =>
              setNewMilestone((prev) => ({
                ...prev,
                description: e.target.value,
              }))
            }
            className="flex-2 rounded-md border-gray-300"
          />
          <button
            type="button"
            onClick={handleAddMilestone}
            className="px-4 py-2 bg-blue-500 text-white rounded-md"
          >
            Add
          </button>
        </div>

        <div className="space-y-2">
          {formData.milestones?.map((milestone, index) => (
            <div
              key={milestone.id}
              className="flex gap-2 items-center bg-gray-50 p-2 rounded"
            >
              <span>{new Date(milestone.date).toLocaleDateString()}</span>
              <span className="font-medium">{milestone.type}</span>
              <span className="flex-1">{milestone.description}</span>
              <button
                type="button"
                onClick={() =>
                  setFormData((prev) => ({
                    ...prev,
                    milestones: prev.milestones?.filter((_, i) => i !== index),
                  }))
                }
                className="text-red-500"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-4">
        <Button className="w-1/2">Save Person</Button>
        <Button className="w-1/2" variant="tertiary" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
