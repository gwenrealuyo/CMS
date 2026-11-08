"use client";

import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import Modal from "@/src/components/ui/Modal";
import Button from "@/src/components/ui/Button";
import ConfirmationModal from "@/src/components/ui/ConfirmationModal";
import SearchableSelect, {
  type SearchableOption,
} from "@/src/components/ui/SearchableSelect";
import { useAuth } from "@/src/contexts/AuthContext";
import { useBranches } from "@/src/hooks/useBranches";
import { peopleApi, vehiclesApi } from "@/src/lib/api";
import { formatPersonName } from "@/src/lib/name";
import {
  formatPersonClusterLabel,
  getPersonClusterChipClass,
} from "@/src/lib/personStatus";
import { Vehicle } from "@/src/types/facilities";

type Props = { isOpen: boolean; onClose: () => void };

type FormState = {
  name: string;
  is_active: boolean;
};

const emptyForm = (): FormState => ({
  name: "",
  is_active: true,
});

export default function VehiclesManager({ isOpen, onClose }: Props) {
  const { user } = useAuth();
  const { branches } = useBranches();
  const canPickBranch = Boolean(user?.can_see_all_branches);
  const [branchId, setBranchId] = useState<number | null>(null);
  const [rows, setRows] = useState<Vehicle[]>([]);
  const [peopleOptions, setPeopleOptions] = useState<SearchableOption[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Vehicle | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [driversTarget, setDriversTarget] = useState<Vehicle | null>(null);
  const [driverIds, setDriverIds] = useState<number[]>([]);
  const [addDriverValue, setAddDriverValue] = useState("");

  const reload = async (branch: number) => {
    const res = await vehiclesApi.list({ branch });
    setRows(res.data as Vehicle[]);
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
    reload(branchId).catch(() => toast.error("Failed to load vehicles."));
    peopleApi
      .getAll({ branch: branchId, page_size: 200 })
      .then((res) => {
        setPeopleOptions(
          (res.data || [])
            .filter(
              (person) => (person.role || "").toUpperCase() !== "VISITOR",
            )
            .map((person) => ({
              id: Number(person.id),
              first_name: person.first_name,
              middle_name: person.middle_name,
              last_name: person.last_name,
              suffix: person.suffix,
              nickname: person.nickname,
              username: person.username || "",
              role: person.role,
              status: person.status,
              cluster_codes: person.cluster_codes || [],
            })),
        );
      })
      .catch(() => {
        /* people list optional for allowlist */
      });
  }, [isOpen, branchId]);

  useEffect(() => {
    if (!isOpen) {
      setForm(emptyForm());
      setEditingId(null);
      setDeleteTarget(null);
      setDriversTarget(null);
      setAddDriverValue("");
      setDriverIds([]);
    }
  }, [isOpen]);

  const selectedDrivers = useMemo(() => {
    return driverIds.map((id) => {
      const option = peopleOptions.find((p) => Number(p.id) === id);
      if (option) return option;
      const fromVehicle = driversTarget?.drivers?.find((d) => d.person === id);
      return {
        id,
        username: "",
        first_name: fromVehicle?.person_name || `Person #${id}`,
        cluster_codes: [] as string[],
      } satisfies SearchableOption;
    });
  }, [driverIds, peopleOptions, driversTarget]);

  const addableDriverOptions = useMemo(() => {
    const selected = new Set(driverIds);
    return peopleOptions.filter((p) => !selected.has(Number(p.id)));
  }, [peopleOptions, driverIds]);

  const resetForm = () => {
    setForm(emptyForm());
    setEditingId(null);
  };

  const openEdit = (row: Vehicle) => {
    setDriversTarget(null);
    setAddDriverValue("");
    setEditingId(row.id);
    setForm({
      name: row.name,
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
        is_active: form.is_active,
      };
      if (editingId) {
        await vehiclesApi.update(editingId, payload);
        toast.success("Vehicle updated.");
      } else {
        await vehiclesApi.create({
          ...payload,
          driver_ids: [],
        });
        toast.success("Vehicle added.");
      }
      resetForm();
      await reload(branchId);
    } catch {
      toast.error(
        editingId ? "Failed to update vehicle." : "Failed to save vehicle.",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget || branchId == null) return;
    setDeleteLoading(true);
    try {
      await vehiclesApi.delete(deleteTarget.id);
      toast.success(`Deleted "${deleteTarget.name}".`);
      if (editingId === deleteTarget.id) {
        resetForm();
      }
      if (driversTarget?.id === deleteTarget.id) {
        setDriversTarget(null);
        setDriverIds([]);
        setAddDriverValue("");
      }
      setDeleteTarget(null);
      await reload(branchId);
    } catch {
      toast.error(
        "Failed to delete. It may still be referenced by vehicle bookings.",
      );
    } finally {
      setDeleteLoading(false);
    }
  };

  const saveDrivers = async () => {
    if (!driversTarget) return;
    try {
      await vehiclesApi.update(driversTarget.id, { driver_ids: driverIds });
      toast.success("Driver allowlist updated.");
      setDriversTarget(null);
      setAddDriverValue("");
      if (branchId != null) {
        await reload(branchId);
      }
    } catch {
      toast.error("Failed to update drivers.");
    }
  };

  const addDriver = (value: string) => {
    if (!value) return;
    const id = Number(value);
    if (!Number.isFinite(id)) return;
    setDriverIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
    setAddDriverValue("");
  };

  const removeDriver = (id: number) => {
    setDriverIds((prev) => prev.filter((driverId) => driverId !== id));
  };

  const driverLabel = (personId: number, fallback?: string) => {
    const option = peopleOptions.find((p) => Number(p.id) === personId);
    if (option) return formatPersonName(option);
    return fallback || `Person #${personId}`;
  };

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} title="Manage Vehicles">
        <div className="space-y-4">
          {canPickBranch && (
            <select
              className="w-full px-3 py-2 border rounded-lg min-h-[44px]"
              value={branchId ?? ""}
              onChange={(e) => {
                setBranchId(e.target.value ? Number(e.target.value) : null);
                resetForm();
                setDriversTarget(null);
                setAddDriverValue("");
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
              {editingId ? "Edit vehicle" : "Add vehicle"}
            </h4>
            <input
              className="w-full px-3 py-2 border rounded-lg min-h-[44px] bg-white"
              placeholder="Vehicle name"
              value={form.name}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, name: e.target.value }))
              }
            />
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
              Active (available to book)
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
                No vehicles for this branch yet.
              </li>
            ) : (
              rows.map((row) => (
                <li key={row.id} className="px-3 py-3 text-sm space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
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
                        Last odo: {row.last_odometer ?? "—"} · RFID balance:{" "}
                        {row.last_rfid_balance ?? "—"}
                      </div>
                      <div className="text-xs text-gray-500">
                        Drivers:{" "}
                        {(row.drivers || [])
                          .map((d) =>
                            driverLabel(d.person, d.person_name || undefined),
                          )
                          .join(", ") || "—"}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="secondary"
                        className="flex-1 sm:flex-none !px-3 text-sm min-h-[44px]"
                        onClick={() => {
                          resetForm();
                          setDriversTarget(row);
                          setDriverIds(
                            (row.drivers || []).map((d) => d.person),
                          );
                          setAddDriverValue("");
                        }}
                      >
                        Drivers
                      </Button>
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
                  </div>
                </li>
              ))
            )}
          </ul>

          {driversTarget && (
            <div className="border rounded-lg p-3 space-y-3 bg-gray-50">
              <h4 className="font-medium text-sm">
                Allowlist for {driversTarget.name}
              </h4>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Add driver
                </label>
                <SearchableSelect
                  value={addDriverValue}
                  onChange={addDriver}
                  options={addableDriverOptions}
                  placeholder="Type a name to search..."
                  emptyMessage="No people found"
                  showEmptyOption={false}
                  emptyOptionLabel=""
                  showRole={false}
                  showStatus
                  showClusterCodes
                />
              </div>
              {selectedDrivers.length === 0 ? (
                <p className="text-sm text-gray-500">
                  No drivers on the allowlist yet.
                </p>
              ) : (
                <ul className="space-y-2">
                  {selectedDrivers.map((person) => {
                    const clusterCodes = Array.isArray(person.cluster_codes)
                      ? (person.cluster_codes as string[])
                      : [];
                    return (
                      <li
                        key={String(person.id)}
                        className="flex items-center justify-between gap-2 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm"
                      >
                        <div className="min-w-0 flex flex-wrap items-center gap-2">
                          <span className="font-medium text-gray-900">
                            {formatPersonName(person)}
                          </span>
                          <span
                            className={getPersonClusterChipClass(
                              clusterCodes.filter(Boolean).length > 0,
                            )}
                          >
                            {formatPersonClusterLabel(clusterCodes)}
                          </span>
                        </div>
                        <Button
                          type="button"
                          variant="tertiary"
                          className="!px-3 text-sm min-h-[44px] text-red-600"
                          onClick={() => removeDriver(Number(person.id))}
                        >
                          Remove
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              )}
              <div className="flex flex-wrap justify-end gap-2">
                <Button
                  variant="tertiary"
                  className="min-h-[44px]"
                  onClick={() => {
                    setDriversTarget(null);
                    setAddDriverValue("");
                  }}
                >
                  Cancel
                </Button>
                <Button className="min-h-[44px]" onClick={saveDrivers}>
                  Save allowlist
                </Button>
              </div>
            </div>
          )}
        </div>
      </Modal>

      <ConfirmationModal
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete vehicle"
        message={`Delete "${deleteTarget?.name}"? This cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
        loading={deleteLoading}
      />
    </>
  );
}
