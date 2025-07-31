import { useState } from "react";
import { Donation } from "@/src/types/donation";
import Button from "@/src/components/ui/Button";

interface DonationFormProps {
  onSubmit: (donation: Partial<Donation>) => void;
  initialData?: Donation;
}

export default function DonationForm({
  onSubmit,
  initialData,
}: DonationFormProps) {
  const [formData, setFormData] = useState({
    amount: initialData?.amount || 0,
    purpose: initialData?.purpose || "Tithe",
    donorName: initialData?.donorName || "",
    notes: initialData?.notes || "",
    paymentMethod: initialData?.paymentMethod || "Cash",
    isAnonymous: initialData?.isAnonymous || false,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      ...formData,
      date: new Date(),
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700">
          Amount
        </label>
        <div className="mt-1 relative rounded-md shadow-sm">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <span className="text-gray-500 sm:text-sm">$</span>
          </div>
          <input
            type="number"
            min="0"
            step="0.01"
            value={formData.amount}
            onChange={(e) =>
              setFormData({ ...formData, amount: parseFloat(e.target.value) })
            }
            className="pl-7 mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-[#2563EB] focus:ring-[#2563EB]"
            required
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">
          Purpose
        </label>
        <select
          value={formData.purpose}
          onChange={(e) =>
            setFormData({
              ...formData,
              purpose: e.target.value as Donation["purpose"],
            })
          }
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-[#2563EB] focus:ring-[#2563EB]"
        >
          <option value="Tithe">Tithe</option>
          <option value="Offering">Offering</option>
          <option value="Project">Project</option>
          <option value="Other">Other</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">
          Payment Method
        </label>
        <select
          value={formData.paymentMethod}
          onChange={(e) =>
            setFormData({
              ...formData,
              paymentMethod: e.target.value as Donation["paymentMethod"],
            })
          }
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-[#2563EB] focus:ring-[#2563EB]"
        >
          <option value="Cash">Cash</option>
          <option value="Check">Check</option>
          <option value="Bank Transfer">Bank Transfer</option>
          <option value="Online">Online</option>
        </select>
      </div>

      <div className="flex items-center">
        <input
          type="checkbox"
          checked={formData.isAnonymous}
          onChange={(e) =>
            setFormData({ ...formData, isAnonymous: e.target.checked })
          }
          className="h-4 w-4 text-[#2563EB] focus:ring-[#2563EB] border-gray-300 rounded"
        />
        <label className="ml-2 block text-sm text-gray-700">
          Anonymous Donation
        </label>
      </div>

      {!formData.isAnonymous && (
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Donor Name
          </label>
          <input
            type="text"
            value={formData.donorName}
            onChange={(e) =>
              setFormData({ ...formData, donorName: e.target.value })
            }
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-[#2563EB] focus:ring-[#2563EB]"
          />
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700">Notes</label>
        <textarea
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-[#2563EB] focus:ring-[#2563EB]"
          rows={3}
        />
      </div>

      <Button>{initialData ? "Update Donation" : "Record Donation"}</Button>
    </form>
  );
}
