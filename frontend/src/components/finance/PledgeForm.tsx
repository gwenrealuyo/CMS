import { useMemo, useState, useEffect } from "react";
import Button from "@/src/components/ui/Button";
import { Pledge, PledgeStatus } from "@/src/types/finance";

interface PledgeFormProps {
  onSubmit: (payload: Partial<Pledge>) => void;
  onCancel?: () => void;
  onDelete?: () => void;
  initialData?: Pledge;
  submitting?: boolean;
  deleteDisabled?: boolean;
  existingPledges?: Pledge[];
}

const STATUS_OPTIONS: { value: PledgeStatus; label: string }[] = [
  { value: "ACTIVE", label: "Active" },
  { value: "FULFILLED", label: "Fulfilled" },
  { value: "CANCELLED", label: "Cancelled" },
];

const STATUS_BADGES: Record<PledgeStatus, string> = {
  ACTIVE: "bg-blue-100 text-blue-700",
  FULFILLED: "bg-green-100 text-green-700",
  CANCELLED: "bg-gray-100 text-gray-600",
};

export default function PledgeForm({
  onSubmit,
  onCancel,
  onDelete,
  initialData,
  submitting,
  deleteDisabled = false,
  existingPledges = [],
}: PledgeFormProps) {
  const [selectedPledgeId, setSelectedPledgeId] = useState<string>("");
  const [isCreatingNew, setIsCreatingNew] = useState(false);

  const [formData, setFormData] = useState({
    pledgeTitle: initialData?.pledgeTitle || "",
    pledgeAmount: initialData?.pledgeAmount ?? 0,
    amountReceived: initialData?.amountReceived ?? 0,
    startDate: initialData?.startDate || new Date().toISOString().slice(0, 10),
    targetDate: initialData?.targetDate || "",
    status: initialData?.status || "ACTIVE",
    purpose: initialData?.purpose || "",
    notes: initialData?.notes || "",
  });

  const isEditing = Boolean(initialData);

  // Reset form when modal opens/closes (when initialData changes)
  useEffect(() => {
    if (isEditing && initialData) {
      // Initialize form with initialData when editing
      setFormData({
        pledgeTitle: initialData.pledgeTitle || "",
        pledgeAmount: initialData.pledgeAmount ?? 0,
        amountReceived: initialData.amountReceived ?? 0,
        startDate:
          initialData.startDate || new Date().toISOString().slice(0, 10),
        targetDate: initialData.targetDate || "",
        status: initialData.status || "ACTIVE",
        purpose: initialData.purpose || "",
        notes: initialData.notes || "",
      });
      setSelectedPledgeId("");
      setIsCreatingNew(false);
    } else if (!isEditing) {
      // Reset form when creating new
      setSelectedPledgeId("");
      setIsCreatingNew(false);
      setFormData({
        pledgeTitle: "",
        pledgeAmount: 0,
        amountReceived: 0,
        startDate: new Date().toISOString().slice(0, 10),
        targetDate: "",
        status: "ACTIVE",
        purpose: "",
        notes: "",
      });
    }
  }, [isEditing, initialData]);

  // When an existing pledge is selected, prefill all fields
  useEffect(() => {
    if (selectedPledgeId && selectedPledgeId !== "new" && !isEditing) {
      const selectedPledge = existingPledges.find(
        (p) => String(p.id) === selectedPledgeId
      );
      if (selectedPledge) {
        setFormData({
          pledgeTitle: selectedPledge.pledgeTitle,
          pledgeAmount: selectedPledge.pledgeAmount,
          amountReceived: selectedPledge.amountReceived,
          startDate: selectedPledge.startDate,
          targetDate: selectedPledge.targetDate || "",
          status: selectedPledge.status,
          purpose: selectedPledge.purpose || "",
          notes: selectedPledge.notes || "",
        });
        setIsCreatingNew(false);
      }
    } else if (selectedPledgeId === "new") {
      // Reset form when "Create new" is selected
      setIsCreatingNew(true);
      setFormData({
        pledgeTitle: "",
        pledgeAmount: 0,
        amountReceived: 0,
        startDate: new Date().toISOString().slice(0, 10),
        targetDate: "",
        status: "ACTIVE",
        purpose: "",
        notes: "",
      });
    }
  }, [selectedPledgeId, existingPledges, isEditing]);

  const sanitizeAmount = (value: number) =>
    Number.isFinite(value) ? Number.parseFloat(value.toFixed(2)) : 0;

  const pledgeAmount = sanitizeAmount(formData.pledgeAmount || 0);
  const amountReceivedRaw = sanitizeAmount(formData.amountReceived || 0);
  const amountReceived = Math.min(amountReceivedRaw, pledgeAmount);

  const outstandingBalance = useMemo(() => {
    const diff = pledgeAmount - amountReceived;
    return diff > 0 ? diff : 0;
  }, [pledgeAmount, amountReceived]);

  const progressPercent = useMemo(() => {
    if (!pledgeAmount) return 0;
    const percent = (amountReceived / pledgeAmount) * 100;
    return Math.min(100, Math.max(0, Math.round(percent)));
  }, [pledgeAmount, amountReceived]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    // Validate pledge amount
    if (pledgeAmount <= 0) {
      alert("Pledge amount must be greater than zero.");
      return;
    }

    // Validate amount received (can be 0 but not negative)
    if (amountReceivedRaw < 0) {
      alert("Amount received cannot be negative.");
      return;
    }

    onSubmit({
      pledgeTitle: formData.pledgeTitle,
      pledgeAmount,
      amountReceived,
      startDate: formData.startDate,
      targetDate: formData.targetDate || null,
      status: formData.status as PledgeStatus,
      purpose: formData.purpose,
      notes: formData.notes,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <section className="rounded-2xl border border-emerald-100 bg-emerald-50/40 p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <span className="inline-flex items-center rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-700">
              Pledge Overview
            </span>
            <p className="text-sm text-gray-600">
              Set up the commitment details and current fulfilment status.
            </p>
          </div>
          <span
            className={`inline-flex h-fit items-center rounded-full px-3 py-1 text-xs font-semibold ${
              STATUS_BADGES[formData.status as PledgeStatus]
            }`}
          >
            {formData.status.charAt(0)}
            {formData.status.slice(1).toLowerCase()}
          </span>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Pledge Name *
            </label>
            {!isEditing && existingPledges.length > 0 ? (
              <div className="space-y-2">
                <select
                  value={selectedPledgeId}
                  onChange={(e) => {
                    setSelectedPledgeId(e.target.value);
                  }}
                  className="w-full rounded-lg border border-emerald-100 bg-white py-2 px-3 text-sm shadow-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  required={!isCreatingNew}
                >
                  <option value="">
                    Select existing pledge or create new...
                  </option>
                  {existingPledges.map((pledge) => (
                    <option key={pledge.id} value={String(pledge.id)}>
                      {pledge.pledgeTitle}
                    </option>
                  ))}
                  <option value="new">+ Create New Pledge</option>
                </select>
                {selectedPledgeId === "new" && (
                  <input
                    type="text"
                    value={formData.pledgeTitle}
                    onChange={(e) =>
                      setFormData((previous) => ({
                        ...previous,
                        pledgeTitle: e.target.value,
                      }))
                    }
                    placeholder="e.g., Building Fund Campaign"
                    className="w-full rounded-lg border border-emerald-100 bg-white py-2 px-3 text-sm shadow-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    required
                  />
                )}
              </div>
            ) : (
              <input
                type="text"
                value={formData.pledgeTitle}
                onChange={(e) =>
                  setFormData((previous) => ({
                    ...previous,
                    pledgeTitle: e.target.value,
                  }))
                }
                placeholder="e.g., Building Fund Campaign"
                className="w-full rounded-lg border border-emerald-100 bg-white py-2 px-3 text-sm shadow-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-emerald-500"
                required
              />
            )}
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Campaign / Purpose
            </label>
            <input
              type="text"
              value={formData.purpose}
              onChange={(e) =>
                setFormData((previous) => ({
                  ...previous,
                  purpose: e.target.value,
                }))
              }
              placeholder="Building improvements, missions, etc."
              className="w-full rounded-lg border border-emerald-100 bg-white py-2 px-3 text-sm shadow-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Target Amount *
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-sm text-gray-500">
                ₱
              </span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={
                  Number.isNaN(formData.pledgeAmount)
                    ? ""
                    : formData.pledgeAmount
                }
                onChange={(e) =>
                  setFormData((previous) => ({
                    ...previous,
                    pledgeAmount: Number.parseFloat(e.target.value || "0"),
                  }))
                }
                className="w-full rounded-lg border border-emerald-100 bg-white py-2 pl-7 pr-3 text-sm shadow-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-emerald-500"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Amount Received
              <span className="ml-1 text-xs text-gray-500 font-normal">
                (for pre-existing contributions)
              </span>
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-sm text-gray-500">
                ₱
              </span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={
                  Number.isNaN(formData.amountReceived)
                    ? ""
                    : formData.amountReceived
                }
                onChange={(e) =>
                  setFormData((previous) => ({
                    ...previous,
                    amountReceived: Number.parseFloat(e.target.value || "0"),
                  }))
                }
                className="w-full rounded-lg border border-emerald-100 bg-white py-2 pl-7 pr-3 text-sm shadow-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Status
            </label>
            <select
              value={formData.status}
              onChange={(e) =>
                setFormData((previous) => ({
                  ...previous,
                  status: e.target.value as PledgeStatus,
                }))
              }
              className="w-full rounded-lg border border-emerald-100 bg-white py-2 px-3 text-sm shadow-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              {STATUS_OPTIONS.map(({ value, label }) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Progress Snapshot
            </label>
            <div className="rounded-xl border border-emerald-100 bg-white px-4 py-3 shadow-sm">
              <div className="flex items-center justify-between text-sm text-gray-600">
                <span>{progressPercent}% fulfilled</span>
                <span>Outstanding ₱{outstandingBalance.toLocaleString()}</span>
              </div>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-emerald-100">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-600">
          Timeline & Notes
        </span>
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Start Date *
            </label>
            <input
              type="date"
              value={formData.startDate}
              onChange={(e) =>
                setFormData((previous) => ({
                  ...previous,
                  startDate: e.target.value,
                }))
              }
              className="w-full rounded-lg border border-slate-200 bg-white py-2 px-3 text-sm shadow-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-emerald-500"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Target Date (optional)
            </label>
            <input
              type="date"
              value={formData.targetDate}
              onChange={(e) =>
                setFormData((previous) => ({
                  ...previous,
                  targetDate: e.target.value,
                }))
              }
              className="w-full rounded-lg border border-slate-200 bg-white py-2 px-3 text-sm shadow-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>

        <div className="mt-4 space-y-2">
          <label className="block text-sm font-medium text-gray-700">
            Notes
          </label>
          <textarea
            value={formData.notes}
            onChange={(e) =>
              setFormData((previous) => ({
                ...previous,
                notes: e.target.value,
              }))
            }
            rows={4}
            placeholder="Capture reminders, donor commitments, or milestones."
            className="w-full rounded-lg border border-slate-200 bg-white py-2 px-3 text-sm leading-relaxed focus:border-transparent focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
      </section>

      {onDelete && isEditing && (
        <div className="flex justify-end">
          <Button
            type="button"
            variant="tertiary"
            onClick={onDelete}
            disabled={submitting || deleteDisabled}
            className="text-xs text-red-600 hover:text-red-700 !py-0 !px-0 border-none bg-transparent hover:bg-transparent hover:underline shadow-none"
          >
            Delete Pledge
          </Button>
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <Button
          type="button"
          variant="tertiary"
          onClick={onCancel}
          disabled={submitting}
          className="flex-1"
        >
          Cancel
        </Button>
        <Button type="submit" disabled={submitting} className="flex-1">
          {submitting ? "Saving…" : isEditing ? "Update Pledge" : "Save Pledge"}
        </Button>
      </div>
    </form>
  );
}
