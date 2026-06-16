"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import Modal from "@/src/components/ui/Modal";
import Button from "@/src/components/ui/Button";
import ConfirmationModal from "@/src/components/ui/ConfirmationModal";
import { EventTypeOption } from "@/src/types/event";
import { useEventTypeStyles } from "@/src/contexts/EventTypeStylesContext";
import {
  DEFAULT_EVENT_TYPE_COLOR,
  labelToEventTypeCode,
  normalizeHexColor,
} from "@/src/lib/events/eventTypeStyles";

type EventTypesManagerProps = {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (data: {
    code: string;
    label: string;
    color: string;
    sort_order: number;
  }) => Promise<EventTypeOption>;
  onUpdate: (
    code: string,
    data: Partial<{ label: string; color: string; sort_order: number }>
  ) => Promise<EventTypeOption>;
  onDelete: (code: string) => Promise<void>;
};

type FormState = {
  code: string;
  label: string;
  color: string;
  sort_order: number;
};

const emptyForm = (): FormState => ({
  code: "",
  label: "",
  color: DEFAULT_EVENT_TYPE_COLOR,
  sort_order: 150,
});

export default function EventTypesManager({
  isOpen,
  onClose,
  onCreate,
  onUpdate,
  onDelete,
}: EventTypesManagerProps) {
  const { types, getDotStyle } = useEventTypeStyles();
  const [editingCode, setEditingCode] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<EventTypeOption | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  const scrollModalContentToTop = useCallback(() => {
    const el = contentRef.current;
    if (!el) return;
    let parent: HTMLElement | null = el.parentElement;
    while (parent) {
      const { overflowY } = getComputedStyle(parent);
      if (overflowY === "auto" || overflowY === "scroll") {
        parent.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
      parent = parent.parentElement;
    }
  }, []);

  const sortedTypes = useMemo(
    () =>
      [...types].sort(
        (a, b) =>
          a.sort_order - b.sort_order || a.label.localeCompare(b.label)
      ),
    [types]
  );

  const nextSortOrder = useMemo(() => {
    if (sortedTypes.length === 0) return 10;
    return Math.max(...sortedTypes.map((type) => type.sort_order)) + 10;
  }, [sortedTypes]);

  useEffect(() => {
    if (!isOpen) {
      setEditingCode(null);
      setShowForm(false);
      setForm(emptyForm());
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !showForm || !editingCode) return;
    requestAnimationFrame(() => scrollModalContentToTop());
  }, [isOpen, showForm, editingCode, scrollModalContentToTop]);

  const openCreateForm = () => {
    setEditingCode(null);
    setForm({ ...emptyForm(), sort_order: nextSortOrder });
    setShowForm(true);
  };

  const openEditForm = (type: EventTypeOption) => {
    setEditingCode(type.code);
    setForm({
      code: type.code,
      label: type.label,
      color: normalizeHexColor(type.color),
      sort_order: type.sort_order,
    });
    setShowForm(true);
    requestAnimationFrame(() => scrollModalContentToTop());
  };

  const handleLabelChange = (label: string) => {
    setForm((prev) => ({
      ...prev,
      label,
      code: editingCode ? prev.code : labelToEventTypeCode(label),
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.label.trim()) {
      toast.error("Label is required.");
      return;
    }
    if (!editingCode && !form.code.trim()) {
      toast.error("Code is required.");
      return;
    }

    setSaving(true);
    try {
      const color = normalizeHexColor(form.color);
      if (editingCode) {
        await onUpdate(editingCode, {
          label: form.label.trim(),
          color,
          sort_order: form.sort_order,
        });
        toast.success("Event type updated.");
      } else {
        await onCreate({
          code: form.code.trim().toUpperCase(),
          label: form.label.trim(),
          color,
          sort_order: form.sort_order,
        });
        toast.success("Event type created.");
      }
      setShowForm(false);
      setEditingCode(null);
      setForm(emptyForm());
    } catch (error: unknown) {
      const message =
        (error as { response?: { data?: { detail?: string; code?: string[] } } })
          ?.response?.data?.detail ||
        (error as { response?: { data?: { code?: string[] } } })?.response?.data
          ?.code?.[0] ||
        "Failed to save event type.";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await onDelete(deleteTarget.code);
      toast.success("Event type deleted.");
      setDeleteTarget(null);
    } catch (error: unknown) {
      const message =
        (error as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail || "Failed to delete event type.";
      toast.error(message);
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title="Manage Event Types"
      >
        <div ref={contentRef} className="space-y-4">
          <p className="text-sm text-gray-600">
            Customize labels and colors for calendar dots and agenda chips.
            System types cannot be deleted.
          </p>

          {!showForm ? (
            <div className="flex justify-end">
              <Button onClick={openCreateForm} className="min-h-[44px]">
                Add Type
              </Button>
            </div>
          ) : (
            <form
              onSubmit={handleSave}
              className="rounded-lg border border-gray-200 p-4 space-y-4 bg-gray-50"
            >
              <h3 className="text-sm font-semibold text-gray-900">
                {editingCode ? "Edit Event Type" : "New Event Type"}
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Label
                  </label>
                  <input
                    type="text"
                    value={form.label}
                    onChange={(e) => handleLabelChange(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Code
                  </label>
                  <input
                    type="text"
                    value={form.code}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        code: e.target.value.toUpperCase(),
                      }))
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg disabled:bg-gray-100"
                    disabled={Boolean(editingCode)}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Color
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={normalizeHexColor(form.color)}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, color: e.target.value }))
                      }
                      className="h-10 w-12 rounded border border-gray-300 p-1"
                    />
                    <input
                      type="text"
                      value={form.color}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, color: e.target.value }))
                      }
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg uppercase"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Sort Order
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={form.sort_order}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        sort_order: Number(e.target.value) || 0,
                      }))
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-500">Preview</span>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    borderRadius: "9999px",
                    border: `1px solid ${normalizeHexColor(form.color)}`,
                    color: normalizeHexColor(form.color),
                    backgroundColor: "transparent",
                    padding: "0.125rem 0.5rem",
                    fontSize: "0.625rem",
                    fontWeight: 600,
                    lineHeight: 1,
                  }}
                >
                  {form.label || "Preview"}
                </span>
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: normalizeHexColor(form.color) }}
                />
              </div>

              <div className="flex gap-2 justify-end">
                <Button
                  type="button"
                  variant="tertiary"
                  onClick={() => {
                    setShowForm(false);
                    setEditingCode(null);
                    setForm(emptyForm());
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? "Saving..." : editingCode ? "Save Changes" : "Create Type"}
                </Button>
              </div>
            </form>
          )}

          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <div className="hidden sm:grid sm:grid-cols-[auto_1fr_auto_auto_auto] gap-3 px-4 py-2 bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wide">
              <span>Color</span>
              <span>Label</span>
              <span>Code</span>
              <span>Order</span>
              <span className="text-right">Actions</span>
            </div>
            <div className="divide-y divide-gray-100">
              {sortedTypes.map((type) => {
                const canDelete =
                  !type.is_system && (type.event_count ?? 0) === 0;
                return (
                  <div
                    key={type.code}
                    className="px-4 py-3 grid grid-cols-1 sm:grid-cols-[auto_1fr_auto_auto_auto] gap-3 sm:items-center"
                  >
                    <span
                      className="w-4 h-4 rounded-full shrink-0"
                      style={getDotStyle(type.code)}
                    />
                    <div>
                      <div className="font-medium text-gray-900">{type.label}</div>
                      <div className="sm:hidden text-xs text-gray-500 mt-1">
                        {type.code} · order {type.sort_order}
                        {type.is_system ? " · system" : ""}
                      </div>
                    </div>
                    <span className="hidden sm:block text-xs text-gray-500 font-mono">
                      {type.code}
                    </span>
                    <span className="hidden sm:block text-xs text-gray-500">
                      {type.sort_order}
                    </span>
                    <div className="flex gap-2 sm:justify-end">
                      <Button
                        type="button"
                        variant="tertiary"
                        className="!px-2 !py-1 text-xs min-h-[36px]"
                        onClick={() => openEditForm(type)}
                      >
                        Edit
                      </Button>
                      <Button
                        type="button"
                        variant="tertiary"
                        className="!px-2 !py-1 text-xs min-h-[36px] text-red-600 disabled:opacity-40"
                        onClick={() => setDeleteTarget(type)}
                        disabled={!canDelete}
                        title={
                          type.is_system
                            ? "System types cannot be deleted"
                            : (type.event_count ?? 0) > 0
                              ? "Type is used by existing events"
                              : "Delete type"
                        }
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </Modal>

      <ConfirmationModal
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Event Type"
        message={`Delete "${deleteTarget?.label}"? This cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
        loading={deleteLoading}
      />
    </>
  );
}
