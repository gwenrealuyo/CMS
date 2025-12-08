import { useState } from "react";
import Button from "@/src/components/ui/Button";
import { Donation, DonationPurpose, PaymentMethod } from "@/src/types/finance";

interface DonationFormProps {
  onSubmit: (donation: Partial<Donation>) => void;
  onCancel?: () => void;
  onDelete?: () => void;
  initialData?: Donation;
  submitting?: boolean;
  deleteDisabled?: boolean;
}

const PAYMENT_METHOD_OPTIONS: { value: PaymentMethod; label: string }[] = [
  { value: "CASH", label: "Cash" },
  { value: "CHECK", label: "Check" },
  { value: "BANK_TRANSFER", label: "Bank Transfer" },
  { value: "CARD", label: "Card" },
  { value: "DIGITAL_WALLET", label: "Digital Wallet" },
];

const PURPOSE_OPTIONS: DonationPurpose[] = ["Offering", "Project", "Other"];

export default function DonationForm({
  onSubmit,
  onCancel,
  onDelete,
  initialData,
  submitting,
  deleteDisabled = false,
}: DonationFormProps) {
  const [formData, setFormData] = useState({
    amount: Number.isFinite(initialData?.amount || 0)
      ? Number(initialData?.amount || 0)
      : "",
    purpose: initialData?.purpose || "Tithe",
    donorName: initialData?.donorName || "",
    notes: initialData?.notes || "",
    paymentMethod: initialData?.paymentMethod || "CASH",
    isAnonymous: initialData?.isAnonymous || false,
    receiptNumber:
      initialData?.receiptNumber ||
      `REC-${Date.now().toString().slice(-6).padStart(6, "0")}`,
    date:
      initialData?.date ||
      new Date().toISOString().slice(0, 10) /* YYYY-MM-DD */,
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
    const amount =
      typeof rawAmount === "number"
        ? rawAmount
        : Number.parseFloat(rawAmount || "0");

    if (!Number.isFinite(amount) || amount <= 0) {
      alert("Amount must be greater than zero.");
      return;
    }

    const normalizedAmount = Number.parseFloat(amount.toFixed(2));
    onSubmit({
      amount: normalizedAmount,
      purpose: formData.purpose as DonationPurpose,
      donorName: formData.isAnonymous ? "" : formData.donorName,
      notes: formData.notes,
      paymentMethod: formData.paymentMethod as PaymentMethod,
      isAnonymous: formData.isAnonymous,
      receiptNumber: formData.receiptNumber,
      date: formData.date,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <section className="rounded-2xl border border-blue-100 bg-blue-50/40 p-5">
        <div className="space-y-1">
          <span className="inline-flex items-center rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-blue-700">
            Donation Details
          </span>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
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
                    amount:
                      e.target.value === ""
                        ? ""
                        : Number.parseFloat(e.target.value),
                  }))
                }
                className="w-full min-h-[44px] rounded-lg border border-blue-100 bg-white py-2 pl-7 pr-3 text-sm shadow-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Receipt Number *
            </label>
            <input
              type="text"
              value={formData.receiptNumber}
              onChange={(e) =>
                setFormData((previous) => ({
                  ...previous,
                  receiptNumber: e.target.value,
                }))
              }
              className="w-full min-h-[44px] rounded-lg border border-blue-100 bg-white py-2 px-3 text-sm shadow-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Donation Date *
            </label>
            <input
              type="date"
              value={formData.date}
              onChange={(e) =>
                setFormData((previous) => ({
                  ...previous,
                  date: e.target.value,
                }))
              }
              className="w-full min-h-[44px] rounded-lg border border-blue-100 bg-white py-2 px-3 text-sm shadow-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Payment Method
            </label>
            <select
              value={formData.paymentMethod}
              onChange={(e) =>
                setFormData((previous) => ({
                  ...previous,
                  paymentMethod: e.target.value as PaymentMethod,
                }))
              }
              className="w-full min-h-[44px] rounded-lg border border-blue-100 bg-white py-2 px-3 text-sm shadow-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {PAYMENT_METHOD_OPTIONS.map(({ value, label }) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Purpose
            </label>
            <select
              value={formData.purpose}
              onChange={(e) =>
                setFormData((previous) => ({
                  ...previous,
                  purpose: e.target.value as DonationPurpose,
                }))
              }
              className="w-full min-h-[44px] rounded-lg border border-blue-100 bg-white py-2 px-3 text-sm shadow-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {PURPOSE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-start gap-3 rounded-xl border border-blue-100 bg-white/70 px-4 py-3">
            <input
              id="anonymous"
              type="checkbox"
              checked={formData.isAnonymous}
              onChange={(e) =>
                setFormData((previous) => ({
                  ...previous,
                  isAnonymous: e.target.checked,
                  donorName: e.target.checked ? "" : previous.donorName,
                }))
              }
              className="mt-0.5 h-4 w-4 rounded border-blue-200 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="anonymous" className="text-sm text-gray-700">
              Anonymous Donation
              <span className="block text-xs text-gray-500">
                Hide the donor name in reports for this entry.
              </span>
            </label>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-600">
          Donor & Notes
        </span>
        <div className="mt-4 space-y-4">
          {!formData.isAnonymous && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Donor Name
              </label>
              <input
                type="text"
                value={formData.donorName}
                onChange={(e) =>
                  setFormData((previous) => ({
                    ...previous,
                    donorName: e.target.value,
                  }))
                }
                placeholder="e.g., Juan Dela Cruz"
                className="w-full min-h-[44px] rounded-lg border border-slate-200 bg-white py-2 px-3 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          <div className="space-y-2">
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
              placeholder="Add any remarks or fund designation details"
              className="w-full min-h-[44px] rounded-lg border border-slate-200 bg-white py-2 px-3 text-sm leading-relaxed focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
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
            Delete Donation
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
          {submitting
            ? "Saving…"
            : isEditing
            ? "Update Donation"
            : "Record Donation"}
        </Button>
      </div>
    </form>
  );
}
