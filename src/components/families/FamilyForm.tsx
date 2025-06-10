import { useState } from "react";
import { Family, Member } from "@/src/types/member";
import Button from "../ui/Button";

interface FamilyFormProps {
  onSubmit: (family: Partial<Family>) => void;
  initialData?: Family;
  availableMembers: Member[];
}

export default function FamilyForm({
  onSubmit,
  initialData,
  availableMembers,
}: FamilyFormProps) {
  const [formData, setFormData] = useState({
    name: initialData?.name || "",
    members: initialData?.members || [],
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700">
          Family Name
        </label>
        <input
          type="text"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-[#805AD5] focus:ring-[#805AD5]"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Select Members
        </label>
        <div className="space-y-2 max-h-60 overflow-y-auto">
          {availableMembers.map((member) => (
            <label
              key={member.id}
              className="flex items-center space-x-3 p-2 hover:bg-gray-50 rounded-md"
            >
              <input
                type="checkbox"
                checked={formData.members.includes(member.id)}
                onChange={(e) => {
                  const newMembers = e.target.checked
                    ? [...formData.members, member.id]
                    : formData.members.filter((id) => id !== member.id);
                  setFormData({ ...formData, members: newMembers });
                }}
                className="rounded border-gray-300 text-[#805AD5] focus:ring-[#805AD5]"
              />
              <div className="flex items-center space-x-3">
                <img
                  src={member.photo || "https://via.placeholder.com/40"}
                  alt={member.name}
                  className="w-10 h-10 rounded-full object-cover"
                />
                <div>
                  <p className="font-medium text-sm">{member.name}</p>
                  <p className="text-xs text-gray-600">{member.role}</p>
                </div>
              </div>
            </label>
          ))}
        </div>
      </div>

      <Button>{initialData ? "Update Family" : "Create Family"}</Button>
    </form>
  );
}
