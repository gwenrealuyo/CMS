import { useState, useEffect } from "react";
import { Branch } from "@/src/types/branch";
import Button from "@/src/components/ui/Button";

interface BranchFormProps {
  branch: Branch | null;
  onSave: (data: Partial<Branch>) => Promise<void>;
  onCancel: () => void;
  loading?: boolean;
}

export default function BranchForm({
  branch,
  onSave,
  onCancel,
  loading = false,
}: BranchFormProps) {
  const [formData, setFormData] = useState<Partial<Branch>>({
    name: "",
    code: "",
    address: "",
    phone: "",
    email: "",
    is_headquarters: false,
    is_active: true,
  });

  useEffect(() => {
    if (branch) {
      setFormData({
        name: branch.name || "",
        code: branch.code || "",
        address: branch.address || "",
        phone: branch.phone || "",
        email: branch.email || "",
        is_headquarters: branch.is_headquarters || false,
        is_active: branch.is_active !== undefined ? branch.is_active : true,
      });
    } else {
      setFormData({
        name: "",
        code: "",
        address: "",
        phone: "",
        email: "",
        is_headquarters: false,
        is_active: true,
      });
    }
  }, [branch]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name?.trim()) {
      return;
    }
    await onSave(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Name <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={formData.name || ""}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, name: e.target.value }))
          }
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Code
        </label>
        <input
          type="text"
          value={formData.code || ""}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, code: e.target.value }))
          }
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="e.g., HQ, BRANCH1"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Address
        </label>
        <textarea
          value={formData.address || ""}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, address: e.target.value }))
          }
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Phone
          </label>
          <input
            type="text"
            value={formData.phone || ""}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, phone: e.target.value }))
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Email
          </label>
          <input
            type="email"
            value={formData.email || ""}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, email: e.target.value }))
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      <div className="flex items-center space-x-6">
        <label className="flex items-center">
          <input
            type="checkbox"
            checked={formData.is_headquarters || false}
            onChange={(e) =>
              setFormData((prev) => ({
                ...prev,
                is_headquarters: e.target.checked,
              }))
            }
            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
          />
          <span className="ml-2 text-sm text-gray-700">
            Mark as Headquarters
          </span>
        </label>

        <label className="flex items-center">
          <input
            type="checkbox"
            checked={
              formData.is_active !== undefined ? formData.is_active : true
            }
            onChange={(e) =>
              setFormData((prev) => ({
                ...prev,
                is_active: e.target.checked,
              }))
            }
            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
          />
          <span className="ml-2 text-sm text-gray-700">Active</span>
        </label>
      </div>

      {/* Footer Buttons - At bottom of form fields */}
      <div className="flex flex-col-reverse sm:flex-row gap-3 pt-6">
        <Button
          variant="tertiary"
          className="w-full sm:flex-1 min-h-[44px]"
          onClick={onCancel}
          disabled={loading}
        >
          Cancel
        </Button>
        <Button
          className="w-full sm:flex-1 min-h-[44px]"
          disabled={loading}
          type="submit"
        >
          {loading ? "Saving..." : branch ? "Update Branch" : "Create Branch"}
        </Button>
      </div>
    </form>
  );
}



