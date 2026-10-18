"use client";

import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import Button from "@/src/components/ui/Button";
import ConfirmationModal from "@/src/components/ui/ConfirmationModal";
import Modal from "@/src/components/ui/Modal";
import SearchableSelect from "@/src/components/ui/SearchableSelect";
import LoadingSpinner from "@/src/components/ui/LoadingSpinner";
import { clusterCordsApi } from "@/src/lib/api";
import { formatPersonName } from "@/src/lib/name";
import {
  formatPersonStatusLabel,
  getPersonStatusColor,
} from "@/src/lib/personStatus";
import type {
  ClusterCord,
  ClusterCordEligibleMember,
  ClusterCordInput,
} from "@/src/types/cluster";

const TARGET_SIZE = 5;

type CordFormModalProps = {
  clusterId: number | string;
  cord?: ClusterCord | null;
  isOpen: boolean;
  onClose: () => void;
  onSaved: (cord: ClusterCord) => void;
  onDeactivated?: () => void;
};

export default function CordFormModal({
  clusterId,
  cord,
  isOpen,
  onClose,
  onSaved,
  onDeactivated,
}: CordFormModalProps) {
  const isEdit = Boolean(cord);
  const [name, setName] = useState("");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [subCoordinatorId, setSubCoordinatorId] = useState("");
  const [eligible, setEligible] = useState<ClusterCordEligibleMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmDeactivate, setConfirmDeactivate] = useState(false);
  const [deactivating, setDeactivating] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const { data } = await clusterCordsApi.eligibleMembers(clusterId);
        if (cancelled) return;
        setEligible(data);
        if (cord) {
          setName(cord.name);
          setSelectedIds(cord.members_details.map((m) => m.id));
          setSubCoordinatorId(
            cord.sub_coordinator?.id != null
              ? String(cord.sub_coordinator.id)
              : "",
          );
        } else {
          const nextNum =
            data.reduce((max, e) => {
              const match = e.assigned_cord_name?.match(/Cord\s+(\d+)/i);
              const n = match ? Number(match[1]) : 0;
              return Math.max(max, n);
            }, 0) + 1;
          setName(`Cord ${nextNum}`);
          setSelectedIds([]);
          setSubCoordinatorId("");
        }
      } catch {
        if (!cancelled) toast.error("Could not load eligible members");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen, clusterId, cord]);

  const selectable = useMemo(() => {
    return eligible.filter((person) => {
      if (!person.assigned_cord_id) return true;
      if (cord && person.assigned_cord_id === cord.id) return true;
      return false;
    });
  }, [eligible, cord]);

  const selectedMembers = useMemo(
    () => selectable.filter((p) => selectedIds.includes(p.id)),
    [selectable, selectedIds],
  );

  const sizeHint =
    selectedIds.length === TARGET_SIZE
      ? null
      : selectedIds.length < TARGET_SIZE
        ? `Target is ${TARGET_SIZE} members (${selectedIds.length} selected).`
        : `Above target size of ${TARGET_SIZE} (${selectedIds.length} selected).`;

  const toggleMember = (id: number) => {
    setSelectedIds((prev) => {
      const next = prev.includes(id)
        ? prev.filter((x) => x !== id)
        : [...prev, id];
      if (!next.includes(Number(subCoordinatorId))) {
        setSubCoordinatorId("");
      }
      return next;
    });
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }
    if (selectedIds.length > 0 && !subCoordinatorId) {
      toast.error("Pick a sub-coordinator from the selected members");
      return;
    }
    const payload: ClusterCordInput = {
      name: name.trim(),
      members: selectedIds,
      sub_coordinator_id: subCoordinatorId
        ? Number(subCoordinatorId)
        : null,
    };
    setSaving(true);
    try {
      const { data } = isEdit && cord
        ? await clusterCordsApi.update(cord.id, payload)
        : await clusterCordsApi.create(clusterId, payload);
      toast.success(isEdit ? "Cord updated" : "Cord created");
      onSaved(data);
      onClose();
    } catch (err: unknown) {
      const ax = err as {
        response?: { data?: { message?: string; details?: { members?: string[] } } };
      };
      const membersErr = ax.response?.data?.details?.members;
      toast.error(
        (Array.isArray(membersErr) && membersErr[0]) ||
          ax.response?.data?.message ||
          "Could not save cord",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async () => {
    if (!cord) return;
    setDeactivating(true);
    try {
      await clusterCordsApi.deactivate(cord.id);
      toast.success("Cord deactivated");
      setConfirmDeactivate(false);
      onClose();
      onDeactivated?.();
    } catch {
      toast.error("Could not deactivate cord");
    } finally {
      setDeactivating(false);
    }
  };

  const busy = saving || deactivating;

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={isEdit ? "Edit 5x5 Cord" : "Create 5x5 Cord"}
        className="max-w-lg"
      >
        {loading ? (
          <div className="flex justify-center py-10">
            <LoadingSpinner />
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              “A cord… is not quickly broken” (Ecc 4:12)—we form small cords of
              five so each person is held by others. Care and follow-up for cord
              members stay on Cluster Care.
            </p>
            <label className="block text-sm font-medium text-gray-700">
              Name
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm min-h-[44px]"
              />
            </label>

            <div>
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-gray-700">
                  Members ({selectedIds.length})
                </span>
                {sizeHint && (
                  <span className="text-xs text-amber-700">{sizeHint}</span>
                )}
              </div>
              <div className="max-h-56 overflow-y-auto rounded-md border border-gray-200 divide-y divide-gray-100">
                {selectable.length === 0 ? (
                  <p className="p-3 text-sm text-gray-500">
                    No eligible ACTIVE / SEMIACTIVE members available.
                  </p>
                ) : (
                  selectable.map((person) => {
                    const checked = selectedIds.includes(person.id);
                    return (
                      <label
                        key={person.id}
                        className="flex cursor-pointer items-center gap-3 px-3 py-2.5 hover:bg-gray-50 min-h-[44px]"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleMember(person.id)}
                          className="h-4 w-4 rounded border-gray-300 text-primary"
                        />
                        <span className="min-w-0 flex-1 text-sm text-gray-900">
                          {formatPersonName(person)}
                        </span>
                        {person.status && (
                          <span
                            className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${getPersonStatusColor(person.status)}`}
                          >
                            {formatPersonStatusLabel(person.status)}
                          </span>
                        )}
                      </label>
                    );
                  })
                )}
              </div>
            </div>

            <SearchableSelect
              label="Sub-coordinator"
              value={subCoordinatorId}
              onChange={setSubCoordinatorId}
              options={selectedMembers.map((m) => ({
                id: m.id,
                username: String(m.id),
                first_name: m.first_name,
                last_name: m.last_name,
                middle_name: m.middle_name,
                suffix: m.suffix,
                nickname: m.nickname,
                status: m.status,
              }))}
              placeholder={
                selectedIds.length
                  ? "Select from cord members"
                  : "Select members first"
              }
              emptyMessage="Select cord members first"
              showEmptyOption
              emptyOptionLabel="— None —"
              disabled={selectedIds.length === 0}
              showStatus
            />

            <div className="flex items-center justify-between gap-2 pt-2">
              <div>
                {isEdit && (
                  <Button
                    type="button"
                    variant="tertiary"
                    onClick={() => setConfirmDeactivate(true)}
                    disabled={busy}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    Deactivate
                  </Button>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={onClose} disabled={busy}>
                  Cancel
                </Button>
                <Button onClick={handleSave} disabled={busy || loading}>
                  {saving ? "Saving…" : isEdit ? "Save" : "Create"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmationModal
        isOpen={confirmDeactivate}
        onClose={() => setConfirmDeactivate(false)}
        onConfirm={handleDeactivate}
        title="Deactivate cord?"
        message={
          cord
            ? `Deactivate “${cord.name}”? Members become unassigned and can join another cord. Care cases stay on Cluster Care.`
            : ""
        }
        confirmText={deactivating ? "Deactivating…" : "Deactivate"}
        variant="danger"
        loading={deactivating}
        zIndex={80}
      />
    </>
  );
}
