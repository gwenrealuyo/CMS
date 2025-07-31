import { useState } from "react";
import { Event } from "@/src/types/event";
import Button from "../ui/Button";

interface EventFormProps {
  onSubmit: (event: Partial<Event>) => void;
  initialData?: Event;
}

type EventType = "Sunday Service" | "Bible Study" | "Prayer Meeting" | "Other";

const eventTypes: EventType[] = [
  "Sunday Service",
  "Bible Study",
  "Prayer Meeting",
  "Other",
];

export default function EventForm({ onSubmit, initialData }: EventFormProps) {
  const [formData, setFormData] = useState({
    title: initialData?.title || "",
    description: initialData?.description || "",
    type: initialData?.type || "Sunday Service",
    startDate: initialData?.startDate || new Date(),
    endDate: initialData?.endDate || new Date(),
    isRecurring: initialData?.isRecurring || false,
    location: initialData?.location || "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700">Title</label>
        <input
          type="text"
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-[#2563EB] focus:ring-[#2563EB]"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Type</label>
        <select
          value={formData.type}
          onChange={(e) =>
            setFormData({ ...formData, type: e.target.value as EventType })
          }
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-[#2563EB] focus:ring-[#2563EB]"
        >
          {eventTypes.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">
          Description
        </label>
        <textarea
          value={formData.description}
          onChange={(e) =>
            setFormData({ ...formData, description: e.target.value })
          }
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-[#2563EB] focus:ring-[#2563EB]"
          rows={3}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Start Date
          </label>
          <input
            type="datetime-local"
            value={formData.startDate.toISOString().slice(0, 16)}
            onChange={(e) =>
              setFormData({ ...formData, startDate: new Date(e.target.value) })
            }
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-[#2563EB] focus:ring-[#2563EB]"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">
            End Date
          </label>
          <input
            type="datetime-local"
            value={formData.endDate.toISOString().slice(0, 16)}
            onChange={(e) =>
              setFormData({ ...formData, endDate: new Date(e.target.value) })
            }
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-[#2563EB] focus:ring-[#2563EB]"
            required
          />
        </div>
      </div>

      <div className="flex items-center">
        <input
          type="checkbox"
          checked={formData.isRecurring}
          onChange={(e) =>
            setFormData({ ...formData, isRecurring: e.target.checked })
          }
          className="h-4 w-4 text-[#2563EB] focus:ring-[#2563EB] border-gray-300 rounded"
        />
        <label className="ml-2 block text-sm text-gray-700">
          Recurring Event
        </label>
      </div>

      <button type="submit">
        <Button>{initialData ? "Update Event" : "Create Event"}</Button>
      </button>
    </form>
  );
}
