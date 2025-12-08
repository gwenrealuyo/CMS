"use client";

import { useState } from "react";
import Button from "@/src/components/ui/Button";
import Card from "@/src/components/ui/Card";
import Modal from "@/src/components/ui/Modal";
import ErrorMessage from "@/src/components/ui/ErrorMessage";
import LoadingSpinner from "@/src/components/ui/LoadingSpinner";
import { SundaySchoolCategory } from "@/src/types/sundaySchool";

interface CategoryManagementProps {
  categories: SundaySchoolCategory[];
  loading: boolean;
  error: string | null;
  onCreate: (data: Partial<SundaySchoolCategory>) => Promise<void>;
  onUpdate: (id: number | string, data: Partial<SundaySchoolCategory>) => Promise<void>;
  onDelete: (id: number | string) => Promise<void>;
}

export default function CategoryManagement({
  categories,
  loading,
  error,
  onCreate,
  onUpdate,
  onDelete,
}: CategoryManagementProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<SundaySchoolCategory | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    min_age: "",
    max_age: "",
    order: 0,
    is_active: true,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const handleOpenCreate = () => {
    setEditingCategory(null);
    setFormData({
      name: "",
      description: "",
      min_age: "",
      max_age: "",
      order: categories.length,
      is_active: true,
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (category: SundaySchoolCategory) => {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      description: category.description || "",
      min_age: category.min_age?.toString() || "",
      max_age: category.max_age?.toString() || "",
      order: category.order,
      is_active: category.is_active,
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFormError(null);

    try {
      const payload: Partial<SundaySchoolCategory> = {
        name: formData.name,
        description: formData.description,
        min_age: formData.min_age ? parseInt(formData.min_age) : undefined,
        max_age: formData.max_age ? parseInt(formData.max_age) : undefined,
        order: formData.order,
        is_active: formData.is_active,
      };

      if (editingCategory) {
        await onUpdate(editingCategory.id, payload);
      } else {
        await onCreate(payload);
      }

      setIsModalOpen(false);
    } catch (err: any) {
      setFormError(err.response?.data?.detail || "Failed to save category");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Card title="Categories" headerAction={<Button onClick={handleOpenCreate} className="w-full sm:w-auto min-h-[44px]">Add Category</Button>}>
        {error && <ErrorMessage message={error} />}
        {loading ? (
          <LoadingSpinner />
        ) : categories.length === 0 ? (
          <p className="text-sm text-gray-500 py-4">No categories yet. Create your first category.</p>
        ) : (
          <div className="space-y-2">
            {categories.map((category) => (
              <div
                key={category.id}
                className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900">{category.name}</span>
                    {category.age_range_display && (
                      <span className="text-sm text-gray-500">
                        ({category.age_range_display})
                      </span>
                    )}
                    {!category.is_active && (
                      <span className="text-xs text-gray-400">(Inactive)</span>
                    )}
                  </div>
                  {category.description && (
                    <p className="text-sm text-gray-500 mt-1">{category.description}</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="tertiary"
                    onClick={() => handleOpenEdit(category)}
                    className="text-xs !px-3 !py-1"
                  >
                    Edit
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Modal
        isOpen={isModalOpen}
        onClose={() => !isSubmitting && setIsModalOpen(false)}
        title={editingCategory ? "Edit Category" : "Add Category"}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {formError && <ErrorMessage message={formError} />}

          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              className="w-full rounded-md border border-gray-200 px-3 py-2 min-h-[44px] text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={2}
              className="w-full rounded-md border border-gray-200 px-3 py-2 min-h-[44px] text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">Min Age</label>
              <input
                type="number"
                min="0"
                value={formData.min_age}
                onChange={(e) => setFormData({ ...formData, min_age: e.target.value })}
                className="w-full rounded-md border border-gray-200 px-3 py-2 min-h-[44px] text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">Max Age</label>
              <input
                type="number"
                min="0"
                value={formData.max_age}
                onChange={(e) => setFormData({ ...formData, max_age: e.target.value })}
                className="w-full rounded-md border border-gray-200 px-3 py-2 min-h-[44px] text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">Order</label>
            <input
              type="number"
              min="0"
              value={formData.order}
              onChange={(e) => setFormData({ ...formData, order: parseInt(e.target.value) || 0 })}
              className="w-full rounded-md border border-gray-200 px-3 py-2 min-h-[44px] text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="is_active"
              checked={formData.is_active}
              onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="is_active" className="text-sm font-medium text-gray-700">
              Active
            </label>
          </div>

          <div className="flex flex-col-reverse sm:flex-row gap-3 pt-4">
            <Button
              type="button"
              variant="tertiary"
              className="w-full sm:flex-1 min-h-[44px]"
              onClick={() => setIsModalOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              variant="primary" 
              className="w-full sm:flex-1 min-h-[44px]" 
              disabled={isSubmitting}
            >
              {isSubmitting ? "Saving..." : editingCategory ? "Update" : "Create"}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}

