"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import Modal from "@/src/components/ui/Modal";
import Button from "@/src/components/ui/Button";
import ConfirmationModal from "@/src/components/ui/ConfirmationModal";
import { useAuth } from "@/src/contexts/AuthContext";
import { useBranches } from "@/src/hooks/useBranches";
import { useEventRooms } from "@/src/hooks/useEventRooms";
import { EventRoom } from "@/src/types/event";

type EventRoomsManagerProps = {
  isOpen: boolean;
  onClose: () => void;
};

type FormState = {
  name: string;
  capacity: string;
  notes: string;
  is_active: boolean;
  sort_order: number;
};

const emptyForm = (): FormState => ({
  name: "",
  capacity: "",
  notes: "",
  is_active: true,
  sort_order: 10,
});

export default function EventRoomsManager({
  isOpen,
  onClose,
}: EventRoomsManagerProps) {
  const { user } = useAuth();
  const canPickBranch = Boolean(user?.can_see_all_branches);
  const { branches } = useBranches();
  const [selectedBranchId, setSelectedBranchId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<EventRoom | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    if (canPickBranch) {
      if (selectedBranchId == null && branches.length > 0) {
        const preferred =
          branches.find((branch) => branch.id === user?.branch) ?? branches[0];
        setSelectedBranchId(preferred.id);
      }
      return;
    }
    if (user?.branch != null) {
      setSelectedBranchId(Number(user.branch));
    }
  }, [isOpen, canPickBranch, branches, user?.branch, selectedBranchId]);

  const {
    rooms,
    createRoom,
    updateRoom,
    deleteRoom,
  } = useEventRooms({
    branchId: selectedBranchId,
    enabled: isOpen && selectedBranchId != null,
  });

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

  const nextSortOrder = useMemo(() => {
    if (rooms.length === 0) return 10;
    return Math.max(...rooms.map((room) => room.sort_order)) + 10;
  }, [rooms]);

  useEffect(() => {
    if (!isOpen) {
      setEditingId(null);
      setShowForm(false);
      setForm(emptyForm());
    }
  }, [isOpen]);

  useEffect(() => {
    setEditingId(null);
    setShowForm(false);
    setForm(emptyForm());
  }, [selectedBranchId]);

  useEffect(() => {
    if (!isOpen || !showForm || !editingId) return;
    requestAnimationFrame(() => scrollModalContentToTop());
  }, [isOpen, showForm, editingId, scrollModalContentToTop]);

  const openCreateForm = () => {
    setEditingId(null);
    setForm({ ...emptyForm(), sort_order: nextSortOrder });
    setShowForm(true);
  };

  const openEditForm = (room: EventRoom) => {
    setEditingId(room.id);
    setForm({
      name: room.name,
      capacity: room.capacity != null ? String(room.capacity) : "",
      notes: room.notes || "",
      is_active: room.is_active,
      sort_order: room.sort_order,
    });
    setShowForm(true);
    requestAnimationFrame(() => scrollModalContentToTop());
  };

  const parseCapacity = (): number | null => {
    const trimmed = form.capacity.trim();
    if (!trimmed) return null;
    const value = Number(trimmed);
    if (!Number.isInteger(value) || value < 0) {
      throw new Error("Capacity must be a whole number.");
    }
    return value;
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error("Name is required.");
      return;
    }
    if (selectedBranchId == null) {
      toast.error("Select a branch first.");
      return;
    }

    let capacity: number | null;
    try {
      capacity = parseCapacity();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Invalid capacity.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        branch: selectedBranchId,
        name: form.name.trim(),
        capacity,
        notes: form.notes.trim(),
        is_active: form.is_active,
        sort_order: form.sort_order,
      };
      if (editingId) {
        await updateRoom(editingId, payload);
        toast.success(`Room "${payload.name}" updated.`);
      } else {
        await createRoom(payload);
        toast.success(`Room "${payload.name}" created.`);
      }
      setShowForm(false);
      setEditingId(null);
      setForm(emptyForm());
    } catch (error: unknown) {
      const data = (
        error as {
          response?: {
            data?: {
              detail?: string;
              message?: string;
              details?: { name?: string[]; branch?: string[] };
            };
          };
        }
      )?.response?.data;
      const message =
        data?.details?.name?.[0] ||
        data?.details?.branch?.[0] ||
        data?.detail ||
        data?.message ||
        "Failed to save room.";
      toast.error(String(message));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await deleteRoom(deleteTarget.id);
      toast.success(`Room "${deleteTarget.name}" deleted.`);
      setDeleteTarget(null);
    } catch (error: unknown) {
      const message =
        (error as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail || "Failed to delete room.";
      toast.error(message);
    } finally {
      setDeleteLoading(false);
    }
  };

  const selectedBranchName =
    branches.find((branch) => branch.id === selectedBranchId)?.name ||
    user?.branch_name ||
    "your branch";

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} title="Manage Rooms">
        <div ref={contentRef} className="space-y-4">
          <p className="text-sm text-gray-600">
            Rooms are specific to each branch. Event forms will offer the
            active rooms for the selected church.
          </p>

          {canPickBranch ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Branch
              </label>
              <select
                value={selectedBranchId ?? ""}
                onChange={(e) =>
                  setSelectedBranchId(
                    e.target.value ? Number(e.target.value) : null
                  )
                }
                className="w-full px-3 py-2 min-h-[44px] text-base md:text-sm border border-gray-300 rounded-lg"
              >
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                    {branch.is_headquarters ? " (HQ)" : ""}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <p className="text-sm text-gray-700">
              Branch: <span className="font-medium">{selectedBranchName}</span>
            </p>
          )}

          {!showForm ? (
            <div className="flex sm:justify-end">
              <Button
                onClick={openCreateForm}
                className="w-full sm:w-auto min-h-[44px]"
                disabled={selectedBranchId == null}
              >
                Add Room
              </Button>
            </div>
          ) : (
            <form
              onSubmit={handleSave}
              className="rounded-lg border border-gray-200 p-3 sm:p-4 space-y-4 bg-gray-50"
            >
              <h3 className="text-sm font-semibold text-gray-900">
                {editingId ? "Edit Room" : "New Room"}
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Name *
                  </label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, name: e.target.value }))
                    }
                    className="w-full px-3 py-2 min-h-[44px] text-base md:text-sm border border-gray-300 rounded-lg"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Capacity
                  </label>
                  <input
                    type="number"
                    min={0}
                    inputMode="numeric"
                    value={form.capacity}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, capacity: e.target.value }))
                    }
                    className="w-full px-3 py-2 min-h-[44px] text-base md:text-sm border border-gray-300 rounded-lg"
                    placeholder="Optional"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Sort Order
                  </label>
                  <input
                    type="number"
                    min={0}
                    inputMode="numeric"
                    value={form.sort_order}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        sort_order: Number(e.target.value) || 0,
                      }))
                    }
                    className="w-full px-3 py-2 min-h-[44px] text-base md:text-sm border border-gray-300 rounded-lg"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Notes
                  </label>
                  <textarea
                    value={form.notes}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, notes: e.target.value }))
                    }
                    rows={2}
                    className="w-full px-3 py-2 min-h-[44px] text-base md:text-sm border border-gray-300 rounded-lg"
                  />
                </div>
                <label className="sm:col-span-2 flex items-center gap-3 text-sm text-gray-700 min-h-[44px]">
                  <input
                    type="checkbox"
                    checked={form.is_active}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        is_active: e.target.checked,
                      }))
                    }
                    className="h-5 w-5 text-primary border-gray-300 rounded"
                  />
                  Active (shown on event form)
                </label>
              </div>

              <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
                <Button
                  type="button"
                  variant="tertiary"
                  className="w-full sm:w-auto min-h-[44px]"
                  onClick={() => {
                    setShowForm(false);
                    setEditingId(null);
                    setForm(emptyForm());
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={saving}
                  className="w-full sm:w-auto min-h-[44px]"
                >
                  {saving ? "Saving..." : editingId ? "Save Changes" : "Create Room"}
                </Button>
              </div>
            </form>
          )}

          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <div className="hidden md:grid md:grid-cols-[minmax(0,1fr)_auto_auto_auto] gap-3 px-4 py-2 bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wide">
              <span>Name</span>
              <span>Capacity</span>
              <span>Status</span>
              <span className="text-right">Actions</span>
            </div>
            <div className="divide-y divide-gray-100">
              {rooms.length === 0 ? (
                <p className="px-4 py-6 text-sm text-gray-500">
                  No rooms for this branch yet.
                </p>
              ) : (
                rooms.map((room) => {
                  const canDelete = (room.event_count ?? 0) === 0;
                  const capacityLabel =
                    room.capacity != null ? `Capacity ${room.capacity}` : "No capacity";
                  return (
                    <div
                      key={room.id}
                      className="px-4 py-3 grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_auto_auto_auto] md:items-center"
                    >
                      <div className="min-w-0">
                        <div className="font-medium text-gray-900 break-words">
                          {room.name}
                        </div>
                        <div className="md:hidden text-xs text-gray-500 mt-1">
                          {capacityLabel}
                          {" · "}
                          {room.is_active ? "Active" : "Inactive"}
                        </div>
                        {room.notes ? (
                          <div className="text-xs text-gray-500 mt-1 line-clamp-2 break-words">
                            {room.notes}
                          </div>
                        ) : null}
                      </div>
                      <span className="hidden md:block text-sm text-gray-500">
                        {room.capacity != null ? room.capacity : "—"}
                      </span>
                      <span
                        className={`hidden md:block text-xs font-medium ${
                          room.is_active ? "text-green-700" : "text-gray-400"
                        }`}
                      >
                        {room.is_active ? "Active" : "Inactive"}
                      </span>
                      <div className="flex gap-2 w-full md:w-auto md:justify-end">
                        <Button
                          type="button"
                          variant="tertiary"
                          className="flex-1 md:flex-none !px-3 text-sm min-h-[44px]"
                          onClick={() => openEditForm(room)}
                        >
                          Edit
                        </Button>
                        <Button
                          type="button"
                          variant="tertiary"
                          className="flex-1 md:flex-none !px-3 text-sm min-h-[44px] text-red-600 disabled:opacity-40"
                          onClick={() => setDeleteTarget(room)}
                          disabled={!canDelete}
                          title={
                            canDelete
                              ? "Delete room"
                              : "Room is used by existing events"
                          }
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </Modal>

      <ConfirmationModal
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Room"
        message={`Delete "${deleteTarget?.name}"? This cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
        loading={deleteLoading}
      />
    </>
  );
}
