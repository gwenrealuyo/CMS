import { useState } from "react";
import Button from "@/src/components/ui/Button";
import { Offering } from "@/src/types/finance";

interface OfferingFormProps {
  onSubmit: (payload: Partial<Offering>) => void;
  onCancel?: () => void;
  onDelete?: () => void;
  initialData?: Offering;
  submitting?: boolean;
  deleteDisabled?: boolean;
}

export default function OfferingForm({
  onSubmit,
  onCancel,
  onDelete,
  initialData,
  submitting,
  deleteDisabled = false,
}: OfferingFormProps) {
  const [formData, setFormData] = useState({
    serviceName: initialData?.serviceName || "Sunday Service",
    serviceDate:
      initialData?.serviceDate || new Date().toISOString().slice(0, 10),
    fund: initialData?.fund || "General Fund",
    amount: Number.isFinite(initialData?.amount || 0)
      ? Number(initialData?.amount || 0)
      : "",
    notes: initialData?.notes || "",
  });

  const isEditing = Boolean(initialData);

  const normalizeAmount = (raw: string | number) => {
    const value = typeof raw === "number" ? raw : Number.parseFloat(raw || "0");
    if (!Number.isFinite(value) || value < 0) {
      return 0;
    }
    return Number.parseFloat(value.toFixed(2));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate amount
    const rawAmount = formData.amount;
    const amount = typeof rawAmount === "number" ? rawAmount : Number.parseFloat(rawAmount || "0");
    
    if (!Number.isFinite(amount) || amount <= 0) {
      alert("Amount must be greater than zero.");
      return;
    }
    
    const normalizedAmount = Number.parseFloat(amount.toFixed(2));
    onSubmit({
      serviceName: formData.serviceName,
      serviceDate: formData.serviceDate,
      fund: formData.fund,
      amount: normalizedAmount,
      notes: formData.notes,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <section className="rounded-2xl border border-indigo-100 bg-indigo-50/40 p-5">
        <div className="space-y-1">
          <span className="inline-flex items-center rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-indigo-700">
            Service Offering
          </span>
          <p className="text-sm text-gray-600">
            Log the weekly service totals to keep your giving reports in sync.
          </p>
        </div>

        <div className="mt-4 space-y-4">
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Service Name *
            </label>
            <input
              type="text"
              value={formData.serviceName}
              onChange={(e) =>
                setFormData((previous) => ({
                  ...previous,
                  serviceName: e.target.value,
                }))
              }
              placeholder="e.g., Sunday AM Service"
              className="w-full min-h-[44px] rounded-lg border border-indigo-100 bg-white py-2 px-3 text-sm shadow-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-indigo-500"
              required
            />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Service Date *
              </label>
              <input
                type="date"
                value={formData.serviceDate}
                onChange={(e) =>
                  setFormData((previous) => ({
                    ...previous,
                    serviceDate: e.target.value,
                  }))
                }
                className="w-full min-h-[44px] rounded-lg border border-indigo-100 bg-white py-2 px-3 text-sm shadow-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-indigo-500"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Fund (optional)
              </label>
              <input
                type="text"
                value={formData.fund}
                onChange={(e) =>
                  setFormData((previous) => ({
                    ...previous,
                    fund: e.target.value,
                  }))
                }
                placeholder="General Fund"
                className="w-full min-h-[44px] rounded-lg border border-indigo-100 bg-white py-2 px-3 text-sm shadow-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Amount *
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-sm text-gray-500">
                ₱
              </span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={formData.amount === "" ? "" : formData.amount}
                onChange={(e) =>
                  setFormData((previous) => ({
                    ...previous,
                    amount: e.target.value === "" ? "" : Number.parseFloat(e.target.value),
                  }))
                }
                className="w-full min-h-[44px] rounded-lg border border-indigo-100 bg-white py-2 pl-7 pr-3 text-sm shadow-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-indigo-500"
                required
              />
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-600">
          Notes
        </span>
        <div className="mt-4 space-y-2">
          <label className="block text-sm font-medium text-gray-700">
            Internal Notes
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
            placeholder="Mention additional services, combined offerings, or reminders."
            className="w-full min-h-[44px] rounded-lg border border-slate-200 bg-white py-2 px-3 text-sm leading-relaxed focus:border-transparent focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
            Delete Offering
          </Button>
        </div>
      )}

      <div className="flex flex-col-reverse sm:flex-row gap-3 pt-2">
        <Button
          type="button"
          variant="tertiary"
          onClick={onCancel}
          disabled={submitting}
          className="w-full sm:flex-1 min-h-[44px]"
        >
          Cancel
        </Button>
        <Button type="submit" disabled={submitting} className="w-full sm:flex-1 min-h-[44px]">
          {submitting ? "Saving…" : isEditing ? "Update Offering" : "Record Offering"}
        </Button>
      </div>
    </form>
  );
}

