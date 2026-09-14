"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import Modal from "@/src/components/ui/Modal";
import Button from "@/src/components/ui/Button";
import ConfirmationModal from "@/src/components/ui/ConfirmationModal";
import { attendanceVenuesApi } from "@/src/lib/api";
import {
  DEFAULT_EVENT_TYPE_COLOR,
  labelToEventTypeCode,
  normalizeHexColor,
} from "@/src/lib/events/eventTypeStyles";
import { AttendanceVenueOption } from "@/src/types/event";

type FormState = {
  code: string;
  label: string;
  color: string;
  sort_order: number;
  is_active: boolean;
};

const emptyForm = (): FormState => ({
  code: "",
  label: "",
  color: DEFAULT_EVENT_TYPE_COLOR,
  sort_order: 100,
  is_active: true,
});

export default function AttendanceVenuesManager({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const [venues, setVenues] = useState<AttendanceVenueOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingCode, setEditingCode] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AttendanceVenueOption | null>(
    null
  );
  const [deleteLoading, setDeleteLoading] = useState(false);

  const loadVenues = useCallback(async () => {
    setLoading(true);
    try {
      const response = await attendanceVenuesApi.list();
      setVenues(response.data);
    } catch {
      toast.error("Failed to load attendance venues.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      void loadVenues();
    } else {
      setEditingCode(null);
      setShowForm(false);
      setForm(emptyForm());
      setDeleteTarget(null);
    }
  }, [isOpen, loadVenues]);

  const sortedVenues = useMemo(
    () =>
      [...venues].sort(
        (a, b) =>
          a.sort_order - b.sort_order || a.label.localeCompare(b.label)
      ),
    [venues]
  );

  const nextSortOrder = useMemo(() => {
    if (sortedVenues.length === 0) return 10;
    return Math.max(...sortedVenues.map((venue) => venue.sort_order)) + 10;
  }, [sortedVenues]);

  const openCreateForm = () => {
    setEditingCode(null);
    setForm({ ...emptyForm(), sort_order: nextSortOrder });
    setShowForm(true);
  };

  const openEditForm = (venue: AttendanceVenueOption) => {
    setEditingCode(venue.code);
    setForm({
      code: venue.code,
      label: venue.label,
      color: normalizeHexColor(venue.color),
      sort_order: venue.sort_order,
      is_active: venue.is_active,
    });
    setShowForm(true);
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
        await attendanceVenuesApi.update(editingCode, {
          label: form.label.trim(),
          color,
          sort_order: form.sort_order,
          is_active: form.is_active,
        });
        toast.success("Online venue updated.");
      } else {
        await attendanceVenuesApi.create({
          code: form.code.trim().toUpperCase(),
          label: form.label.trim(),
          color,
          sort_order: form.sort_order,
          is_active: form.is_active,
        });
        toast.success("Online venue created.");
      }
      setShowForm(false);
      setEditingCode(null);
      setForm(emptyForm());
      await loadVenues();
    } catch (error: unknown) {
      const message =
        (error as { response?: { data?: { detail?: string; code?: string[] } } })
          ?.response?.data?.detail ||
        (error as { response?: { data?: { code?: string[] } } })?.response?.data
          ?.code?.[0] ||
        "Failed to save online venue.";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await attendanceVenuesApi.delete(deleteTarget.code);
      toast.success("Online venue deleted.");
      setDeleteTarget(null);
      await loadVenues();
    } catch (error: unknown) {
      const message =
        (error as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail || "Failed to delete online venue.";
      toast.error(message);
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} title="Manage Online Venues">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Online check-in requires a venue (Home altar, Cluster house, etc.).
            Admins can add or edit venues over time. System venues cannot be
            deleted.
          </p>

          {!showForm ? (
            <div className="flex justify-end">
              <Button onClick={openCreateForm} className="min-h-[44px]">
                Add Venue
              </Button>
            </div>
          ) : (
            <form
              onSubmit={handleSave}
              className="space-y-4 rounded-lg border border-gray-200 bg-gray-50 p-4"
            >
              <h3 className="text-sm font-semibold text-gray-900">
                {editingCode ? "Edit Online Venue" : "New Online Venue"}
              </h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Label
                  </label>
                  <input
                    type="text"
                    value={form.label}
                    onChange={(e) => handleLabelChange(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2"
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
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
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 disabled:bg-gray-100"
                    disabled={Boolean(editingCode)}
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
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
                      className="flex-1 rounded-lg border border-gray-300 px-3 py-2 uppercase"
                    />
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
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
                    className="w-full rounded-lg border border-gray-300 px-3 py-2"
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      is_active: e.target.checked,
                    }))
                  }
                />
                Active (shown in check-in pickers)
              </label>
              <div className="flex justify-end gap-2">
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
                  {saving
                    ? "Saving..."
                    : editingCode
                      ? "Save Changes"
                      : "Create Venue"}
                </Button>
              </div>
            </form>
          )}

          <div className="overflow-hidden rounded-lg border border-gray-200">
            {loading ? (
              <p className="px-4 py-6 text-center text-sm text-gray-500">
                Loading venues...
              </p>
            ) : sortedVenues.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-gray-500">
                No online venues yet.
              </p>
            ) : (
              <div className="divide-y divide-gray-100">
                {sortedVenues.map((venue) => {
                  const canDelete =
                    !venue.is_system && (venue.attendance_count ?? 0) === 0;
                  return (
                    <div
                      key={venue.code}
                      className="grid grid-cols-1 gap-3 px-4 py-3 md:grid-cols-[auto_1fr_auto_auto] md:items-center"
                    >
                      <span
                        className="h-4 w-4 shrink-0 rounded-full"
                        style={{
                          backgroundColor: normalizeHexColor(venue.color),
                        }}
                      />
                      <div>
                        <div className="font-medium text-gray-900">
                          {venue.label}
                          {!venue.is_active ? (
                            <span className="ml-2 text-xs font-normal text-amber-700">
                              Inactive
                            </span>
                          ) : null}
                        </div>
                        <div className="mt-1 text-xs text-gray-500">
                          {venue.code} · order {venue.sort_order}
                          {venue.is_system ? " · system" : ""}
                          {(venue.attendance_count ?? 0) > 0
                            ? ` · used ${venue.attendance_count}`
                            : ""}
                        </div>
                      </div>
                      <div className="flex gap-2 md:justify-end">
                        <Button
                          type="button"
                          variant="tertiary"
                          className="!min-h-[36px] !px-2 !py-1 text-xs"
                          onClick={() => openEditForm(venue)}
                        >
                          Edit
                        </Button>
                        <Button
                          type="button"
                          variant="tertiary"
                          className="!min-h-[36px] !px-2 !py-1 text-xs text-red-600 disabled:opacity-40"
                          onClick={() => setDeleteTarget(venue)}
                          disabled={!canDelete}
                          title={
                            venue.is_system
                              ? "System venues cannot be deleted"
                              : (venue.attendance_count ?? 0) > 0
                                ? "Venue is used by attendance records"
                                : "Delete venue"
                          }
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </Modal>

      <ConfirmationModal
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Online Venue"
        message={
          deleteTarget
            ? `Delete "${deleteTarget.label}"? This cannot be undone.`
            : "Delete this venue?"
        }
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
        loading={deleteLoading}
      />
    </>
  );
}
