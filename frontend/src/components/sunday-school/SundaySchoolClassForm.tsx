"use client";

import { ChangeEvent, FormEvent, useState, useEffect, useRef } from "react";
import Button from "@/src/components/ui/Button";
import ErrorMessage from "@/src/components/ui/ErrorMessage";
import {
  SundaySchoolClass,
  SundaySchoolCategory,
} from "@/src/types/sundaySchool";

export interface SundaySchoolClassFormValues {
  name: string;
  category_id: number | string;
  description: string;
  yearly_theme: string;
  room_location: string;
  meeting_time: string;
  is_active: boolean;
}

interface SundaySchoolClassFormProps {
  categories: SundaySchoolCategory[];
  onSubmit: (values: SundaySchoolClassFormValues) => Promise<void>;
  onCancel: () => void;
  isSubmitting: boolean;
  error?: string | null;
  submitLabel?: string;
  initialData?: SundaySchoolClass;
}

const DEFAULT_VALUES: SundaySchoolClassFormValues = {
  name: "",
  category_id: "",
  description: "",
  yearly_theme: "",
  room_location: "",
  meeting_time: "",
  is_active: true,
};

export default function SundaySchoolClassForm({
  categories,
  onSubmit,
  onCancel,
  isSubmitting,
  error,
  submitLabel = "Create Class",
  initialData,
}: SundaySchoolClassFormProps) {
  const [values, setValues] = useState<SundaySchoolClassFormValues>(
    initialData
      ? {
          name: initialData.name,
          category_id: initialData.category?.id || "",
          description: initialData.description || "",
          yearly_theme: initialData.yearly_theme || "",
          room_location: initialData.room_location || "",
          meeting_time: initialData.meeting_time || "",
          is_active: initialData.is_active,
        }
      : DEFAULT_VALUES
  );

  const previousCategoryNameRef = useRef<string>("");

  // Auto-fill class name when category is selected
  useEffect(() => {
    if (!initialData && values.category_id) {
      const selectedCategory = categories.find(
        (cat) => cat.id === Number(values.category_id)
      );
      
      if (selectedCategory) {
        const categoryName = selectedCategory.name;
        // Only auto-fill if name is empty or matches previous category name
        const shouldAutoFill = 
          !values.name || 
          values.name === previousCategoryNameRef.current;
        
        if (shouldAutoFill) {
          setValues((prev) => ({
            ...prev,
            name: categoryName,
          }));
        }
        
        previousCategoryNameRef.current = categoryName;
      }
    }
  }, [values.category_id, categories, initialData]);

  const handleChange = (field: keyof SundaySchoolClassFormValues) => (
    event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const value =
      event.target.type === "checkbox"
        ? (event.target as HTMLInputElement).checked
        : event.target.value;
    setValues((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    await onSubmit(values);
  };

  // Generate time options in 30-minute intervals
  const generateTimeOptions = () => {
    const options = [];
    for (let hour = 6; hour < 24; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        const timeString = `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
        const displayTime = new Date(`2000-01-01T${timeString}`).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        });
        options.push({ value: timeString, label: displayTime });
      }
    }
    return options;
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      {error && <ErrorMessage message={error} />}

      <div className="space-y-1">
        <label className="block text-sm font-medium text-gray-700">
          Class Name <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={values.name}
          onChange={handleChange("name")}
          required
          placeholder="e.g., Kids Primary Class"
          className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      <div className="space-y-1">
        <label className="block text-sm font-medium text-gray-700">
          Category <span className="text-red-500">*</span>
        </label>
        <select
          value={values.category_id}
          onChange={handleChange("category_id")}
          required
          className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="">Select a category</option>
          {categories
            .filter((cat) => cat.is_active)
            .map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
                {category.age_range_display
                  ? ` (${category.age_range_display})`
                  : ""}
              </option>
            ))}
        </select>
      </div>

      <div className="space-y-1">
        <label className="block text-sm font-medium text-gray-700">
          Description
        </label>
        <textarea
          value={values.description}
          onChange={handleChange("description")}
          rows={3}
          placeholder="Brief description of the class..."
          className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      <div className="space-y-1">
        <label className="block text-sm font-medium text-gray-700">
          Yearly Theme
        </label>
        <input
          type="text"
          value={values.yearly_theme}
          onChange={handleChange("yearly_theme")}
          placeholder="e.g., Growing in Faith 2024"
          className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700">
            Room Location
          </label>
          <input
            type="text"
            value={values.room_location}
            onChange={handleChange("room_location")}
            placeholder="e.g., Room 101"
            className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700">
            Meeting Time
          </label>
          <select
            value={values.meeting_time}
            onChange={handleChange("meeting_time")}
            className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">Select time</option>
            {generateTimeOptions().map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex items-center space-x-2">
        <input
          type="checkbox"
          id="is_active"
          checked={values.is_active}
          onChange={handleChange("is_active")}
          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
        />
        <label htmlFor="is_active" className="text-sm font-medium text-gray-700">
          Active
        </label>
      </div>

      <div className="flex gap-4 pt-4">
        <Button type="button" variant="tertiary" className="flex-1" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" className="flex-1" disabled={isSubmitting}>
          {isSubmitting ? "Saving..." : submitLabel}
        </Button>
      </div>
    </form>
  );
}

