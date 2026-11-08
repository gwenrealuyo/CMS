"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import Modal from "@/src/components/ui/Modal";
import Button from "@/src/components/ui/Button";
import ConfirmationModal from "@/src/components/ui/ConfirmationModal";
import { useAuth } from "@/src/contexts/AuthContext";
import { useBranches } from "@/src/hooks/useBranches";
import { equipmentTypesApi } from "@/src/lib/api";
import { EquipmentType } from "@/src/types/facilities";

type Props = { isOpen: boolean; onClose: () => void };

type FormState = {
  name: string;
  qty: string;
  is_active: boolean;
};

const emptyForm = (): FormState => ({
  name: "",
  qty: "1",
  is_active: true,
});

export default function EquipmentTypesManager({ isOpen, onClose }: Props) {
  const { user } = useAuth();
  const { branches } = useBranches();
  const canPickBranch = Boolean(user?.can_see_all_branches);
  const [branchId, setBranchId] = useState<number | null>(null);
  const [rows, setRows] = useState<EquipmentType[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<EquipmentType | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const reload = async (branch: number) => {
    const res = await equipmentTypesApi.list({ branch });
    setRows(res.data as EquipmentType[]);
  };

  useEffect(() => {
    if (!isOpen) return;
    if (canPickBranch && branches.length && branchId == null) {
      setBranchId(
        branches.find((b) => b.id === user?.branch)?.id ?? branches[0].id,
      );
    } else if (!canPickBranch && user?.branch != null) {
      setBranchId(Number(user.branch));
    }
  }, [isOpen, canPickBranch, branches, user?.branch, branchId]);

  useEffect(() => {
    if (!isOpen || branchId == null) return;
    reload(branchId).catch(() => toast.error("Failed to load equipment types."));
  }, [isOpen, branchId]);

  useEffect(() => {
    if (!isOpen) {
      setForm(emptyForm());
      setEditingId(null);
      setDeleteTarget(null);
    }
  }, [isOpen]);

  const resetForm = () => {
    setForm(emptyForm());
    setEditingId(null);
  };

  const openEdit = (row: EquipmentType) => {
    setEditingId(row.id);
    setForm({
      name: row.name,
      qty: String(row.quantity_available),
      is_active: row.is_active,
    });
  };

  const save = async () => {
    if (!branchId || !form.name.trim()) return;
    setSaving(true);
    try {
      const payload = {
        branch: branchId,
        name: form.name.trim(),
        quantity_available: Math.max(1, Number(form.qty) || 1),
        is_active: form.is_active,
      };
      if (editingId) {
        await equipmentTypesApi.update(editingId, payload);
        toast.success("Equipment type updated.");
      } else {
        await equipmentTypesApi.create(payload);
        toast.success("Equipment type added.");
      }
      resetForm();
      await reload(branchId);
    } catch {
      toast.error(
        editingId
          ? "Failed to update equipment type."
          : "Failed to save equipment type.",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget || branchId == null) return;
    setDeleteLoading(true);
    try {
      await equipmentTypesApi.delete(deleteTarget.id);
      toast.success(`Deleted "${deleteTarget.name}".`);
      if (editingId === deleteTarget.id) {
        resetForm();
      }
      setDeleteTarget(null);
      await reload(branchId);
    } catch {
      toast.error(
        "Failed to delete. It may still be referenced by equipment bookings.",
      );
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} title="Manage Equipment">
        <div className="space-y-4">
          {canPickBranch && (
            <select
              className="w-full px-3 py-2 border rounded-lg min-h-[44px]"
              value={branchId ?? ""}
              onChange={(e) => {
                setBranchId(e.target.value ? Number(e.target.value) : null);
                resetForm();
              }}
            >
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          )}

          <div className="space-y-2 rounded-lg border border-gray-200 bg-gray-50 p-3">
            <h4 className="text-sm font-medium text-gray-800">
              {editingId ? "Edit equipment" : "Add equipment"}
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_100px] gap-2">
              <input
                className="px-3 py-2 border rounded-lg min-h-[44px] bg-white"
                placeholder="Name"
                value={form.name}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, name: e.target.value }))
                }
              />
              <input
                type="number"
                min={1}
                className="px-3 py-2 border rounded-lg min-h-[44px] bg-white"
                value={form.qty}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, qty: e.target.value }))
                }
                aria-label="Quantity available"
              />
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
                className="h-4 w-4 text-primary focus:ring-ring border-gray-300 rounded"
              />
              Active (available to borrow)
            </label>
            <div className="flex flex-wrap justify-end gap-2">
              {editingId && (
                <Button
                  variant="tertiary"
                  className="min-h-[44px]"
                  onClick={resetForm}
                  disabled={saving}
                >
                  Cancel edit
                </Button>
              )}
              <Button
                className="min-h-[44px]"
                onClick={save}
                disabled={saving || !form.name.trim()}
              >
                {saving
                  ? "Saving..."
                  : editingId
                    ? "Save changes"
                    : "Add"}
              </Button>
            </div>
          </div>

          <ul className="divide-y border rounded-lg">
            {rows.length === 0 ? (
              <li className="px-3 py-4 text-sm text-gray-500">
                No equipment types for this branch yet.
              </li>
            ) : (
              rows.map((row) => (
                <li
                  key={row.id}
                  className="px-3 py-2 text-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
                >
                  <div className="min-w-0">
                    <div className="font-medium text-gray-900">
                      {row.name}
                      {!row.is_active ? (
                        <span className="ml-2 text-xs font-normal text-gray-400">
                          Inactive
                        </span>
                      ) : null}
                    </div>
                    <div className="text-xs text-gray-500">
                      qty {row.quantity_available}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="tertiary"
                      className="flex-1 sm:flex-none !px-3 text-sm min-h-[44px]"
                      onClick={() => openEdit(row)}
                    >
                      Edit
                    </Button>
                    <Button
                      type="button"
                      variant="tertiary"
                      className="flex-1 sm:flex-none !px-3 text-sm min-h-[44px] text-red-600"
                      onClick={() => setDeleteTarget(row)}
                    >
                      Delete
                    </Button>
                  </div>
                </li>
              ))
            )}
          </ul>
        </div>
      </Modal>

      <ConfirmationModal
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete equipment"
        message={`Delete "${deleteTarget?.name}"? This cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
        loading={deleteLoading}
      />
    </>
  );
}
