import { useState } from "react";
import Button from "@/src/components/ui/Button";
import { Family, Cluster, Person } from "@/src/types/person";

interface ClusterFormProps {
  onSubmit: (data: Partial<Cluster>) => Promise<void> | void;
  onClose: () => void;
  initialData?: Partial<Cluster>;
  availableFamilies?: Family[];
  availablePeople?: Person[];
}

export default function ClusterForm({
  onSubmit,
  onClose,
  initialData,
  availableFamilies = [],
  availablePeople = [],
}: ClusterFormProps) {
  const [formData, setFormData] = useState<Partial<Cluster>>({
    name: initialData?.name || "",
    code: initialData?.code || "",
    description: (initialData as any)?.description || "",
    families: (initialData?.families as any) || [],
    members: (initialData?.members as any) || [],
    location: (initialData as any)?.location || "",
    meeting_schedule: (initialData as any)?.meeting_schedule || "",
    coordinator: (initialData as any)?.coordinator || undefined,
  } as any);
  const [loading, setLoading] = useState(false);

  const toggleFamily = (familyId: string) => {
    setFormData((prev: any) => {
      const cur: string[] = prev.families || [];
      return cur.includes(familyId)
        ? { ...prev, families: cur.filter((id) => id !== familyId) }
        : { ...prev, families: [...cur, familyId] };
    });
  };

  const toggleMember = (personId: string) => {
    setFormData((prev: any) => {
      const cur: string[] = prev.members || [];
      if (cur.includes(personId)) {
        const nextMembers = cur.filter((id) => id !== personId);
        const next: any = { ...prev, members: nextMembers };
        // If removing the current coordinator, unset it to enforce coordinator ∈ members
        if (prev.coordinator === personId) {
          next.coordinator = undefined;
        }
        return next;
      }
      return { ...prev, members: [...cur, personId] };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name?.trim()) return;
    // Ensure coordinator (if set) is included in members
    if (
      formData.coordinator &&
      !(formData.members || []).includes(formData.coordinator as string)
    ) {
      setFormData((prev: any) => ({
        ...prev,
        members: [...(prev.members || []), prev.coordinator],
      }));
    }
    try {
      setLoading(true);
      await onSubmit(formData);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Cluster Name *
        </label>
        <input
          type="text"
          value={formData.name || ""}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          required
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Code
        </label>
        <input
          type="text"
          value={(formData as any).code || ""}
          onChange={(e) => setFormData({ ...formData, code: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Description
        </label>
        <textarea
          value={(formData as any).description || ""}
          onChange={(e) =>
            setFormData({ ...formData, description: e.target.value as any })
          }
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Location
        </label>
        <input
          type="text"
          value={(formData as any).location || ""}
          onChange={(e) =>
            setFormData({ ...formData, location: e.target.value })
          }
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Meeting Schedule
        </label>
        <input
          type="text"
          placeholder="e.g., Every Sunday 2:00 PM"
          value={(formData as any).meeting_schedule || ""}
          onChange={(e) =>
            setFormData({ ...formData, meeting_schedule: e.target.value })
          }
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Coordinator (must be a selected member)
        </label>
        <select
          value={(formData as any).coordinator || ""}
          onChange={(e) =>
            setFormData({
              ...formData,
              coordinator: e.target.value || undefined,
            })
          }
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="">— None —</option>
          {(availablePeople || [])
            .filter((p) => (formData as any).members?.includes(p.id))
            .map((p) => (
              <option key={p.id} value={p.id}>
                {p.first_name} {p.last_name}
              </option>
            ))}
        </select>
      </div>

      {availableFamilies.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Families (optional)
          </label>
          <div className="max-h-40 overflow-y-auto border rounded-lg p-2 space-y-1">
            {availableFamilies.map((f) => (
              <label key={f.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={(formData as any).families?.includes(f.id)}
                  onChange={() => toggleFamily(f.id)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span>{f.name}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {availablePeople.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Individual Members (optional)
          </label>
          <div className="max-h-40 overflow-y-auto border rounded-lg p-2 space-y-1">
            {availablePeople
              .filter((p) => p.username !== "admin" && p.role !== "ADMIN")
              .map((p) => (
                <label key={p.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={(formData as any).members?.includes(p.id)}
                    onChange={() => toggleMember(p.id)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span>
                    {p.first_name} {p.last_name}
                  </span>
                </label>
              ))}
          </div>
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <Button className="flex-1" disabled={loading}>
          {loading
            ? "Saving…"
            : initialData?.id
            ? "Update Cluster"
            : "Create Cluster"}
        </Button>
        <Button
          variant="tertiary"
          className="flex-1"
          onClick={onClose}
          disabled={loading}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
