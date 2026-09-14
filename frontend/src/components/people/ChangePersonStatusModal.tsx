"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import Button from "@/src/components/ui/Button";
import Modal from "@/src/components/ui/Modal";
import { peopleApi } from "@/src/lib/api";
import { formatApiErrorMessage } from "@/src/lib/apiErrors";
import { formatPersonName } from "@/src/lib/name";
import {
  formatPersonStatusLabel,
  personStatusOptionsForRole,
  statusRequiresChangeReason,
} from "@/src/lib/personStatus";
import type { Person, PersonStatus } from "@/src/types/person";

type StatusPerson = Pick<
  Person,
  "id" | "first_name" | "last_name" | "role" | "status"
> & {
  nickname?: string;
  middle_name?: string;
  suffix?: string;
  full_name?: string;
};

export default function ChangePersonStatusModal({
  person,
  isOpen,
  onClose,
  onSaved,
}: {
  person: StatusPerson | null;
  isOpen: boolean;
  onClose: () => void;
  onSaved: (updated: Person) => void;
}) {
  const [status, setStatus] = useState<PersonStatus>("ACTIVE");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!person) return;
    setStatus((person.status as PersonStatus) || "ACTIVE");
    setReason("");
    setSaving(false);
  }, [person?.id, person?.status, isOpen]);

  if (!person) {
    return null;
  }

  const options = personStatusOptionsForRole(person.role);
  const changed = status !== person.status;
  const reasonRequired = changed && statusRequiresChangeReason(status);

  const handleSave = async () => {
    if (!changed) {
      onClose();
      return;
    }
    if (reasonRequired && !reason.trim()) {
      toast.error("A reason is required for this status.");
      return;
    }
    setSaving(true);
    try {
      const payload: Partial<Person> = { status };
      if (reason.trim()) {
        payload.status_change_reason = reason.trim();
      }
      const { data } = await peopleApi.patch(String(person.id), payload);
      toast.success(
        `${formatPersonName(person)} is now ${formatPersonStatusLabel(status)}.`,
      );
      onSaved(data);
      onClose();
    } catch (err) {
      toast.error(formatApiErrorMessage(err, "Could not update status"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Change status"
      className="max-w-lg md:h-auto"
      closeOnOutsideClick={!saving}
    >
      <div className="space-y-4 p-4 md:p-5">
        <p className="text-sm text-gray-700">
          {formatPersonName(person)}
        </p>
        <label className="block text-sm font-medium text-gray-700">
          Status
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as PersonStatus)}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-ring"
          >
            {options.map((option) => (
              <option key={option} value={option}>
                {formatPersonStatusLabel(option)}
              </option>
            ))}
          </select>
        </label>
        {changed && (
          <label className="block text-sm font-medium text-gray-700">
            Reason for status change
            {reasonRequired ? <span className="text-red-500"> *</span> : null}
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              required={reasonRequired}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-ring"
              placeholder={
                reasonRequired
                  ? `Why is this person being marked ${formatPersonStatusLabel(status)}?`
                  : "Optional note for this status change"
              }
            />
            <span className="mt-1 block text-xs font-normal text-gray-500">
              {reasonRequired
                ? "Required for Semi-active, Inactive, Dormant, Fall Away, and Deceased."
                : "Optional. Saved with this status change."}
            </span>
          </label>
        )}
        <div className="flex flex-wrap gap-2 pt-1">
          <Button onClick={handleSave} disabled={saving || !changed}>
            {saving ? "Saving…" : "Save"}
          </Button>
          <Button variant="tertiary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
        </div>
      </div>
    </Modal>
  );
}
