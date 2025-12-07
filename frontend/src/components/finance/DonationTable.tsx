import { useState, useMemo } from "react";
import Card from "@/src/components/ui/Card";
import { Donation } from "@/src/types/finance";
import { ChevronUpIcon, ChevronDownIcon } from "@heroicons/react/24/outline";

interface DonationTableProps {
  donations: Donation[];
  onAddDonation?: () => void;
  loading?: boolean;
  onEditDonation?: (donation: Donation) => void;
}

type SortColumn =
  | "date"
  | "donorName"
  | "purpose"
  | "amount"
  | "paymentMethod"
  | "recordedByName";

type SortDirection = "asc" | "desc";

const formatCurrency = (amount: number) =>
  `₱${amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

const formatPaymentMethod = (method: string) => {
  const methodMap: Record<string, string> = {
    CASH: "Cash",
    CHECK: "Check",
    BANK_TRANSFER: "Bank Transfer",
    CARD: "Card",
    DIGITAL_WALLET: "Digital Wallet",
  };
  return methodMap[method] || method;
};

export default function DonationTable({
  donations,
  onAddDonation,
  loading,
  onEditDonation,
}: DonationTableProps) {
  const [sortColumn, setSortColumn] = useState<SortColumn>("date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const sortedDonations = useMemo(() => {
    const sorted = [...donations];
    sorted.sort((a, b) => {
      let aValue: string | number | null;
      let bValue: string | number | null;

      switch (sortColumn) {
        case "date":
          aValue = a.date;
          bValue = b.date;
          break;
        case "donorName":
          aValue = (a.donorName || "Anonymous").toLowerCase();
          bValue = (b.donorName || "Anonymous").toLowerCase();
          break;
        case "purpose":
          aValue = (a.purpose || "").toLowerCase();
          bValue = (b.purpose || "").toLowerCase();
          break;
        case "amount":
          aValue = a.amount;
          bValue = b.amount;
          break;
        case "paymentMethod":
          aValue = (a.paymentMethod || "").toLowerCase();
          bValue = (b.paymentMethod || "").toLowerCase();
          break;
        case "recordedByName":
          aValue = (a.recordedByName || "").toLowerCase();
          bValue = (b.recordedByName || "").toLowerCase();
          break;
        default:
          return 0;
      }

      // Handle null/empty values
      if (aValue === null || aValue === "") {
        return sortDirection === "asc" ? 1 : -1;
      }
      if (bValue === null || bValue === "") {
        return sortDirection === "asc" ? -1 : 1;
      }

      // Compare values
      if (typeof aValue === "string" && typeof bValue === "string") {
        const comparison = aValue.localeCompare(bValue);
        return sortDirection === "asc" ? comparison : -comparison;
      } else {
        const comparison = (aValue as number) - (bValue as number);
        return sortDirection === "asc" ? comparison : -comparison;
      }
    });

    return sorted;
  }, [donations, sortColumn, sortDirection]);

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  // SortIcon component - only shows arrow for active field
  const SortIcon = ({ field }: { field: SortColumn }) => {
    if (field !== sortColumn) return null;
    return sortDirection === "asc" ? (
      <ChevronUpIcon className="w-4 h-4 inline-block text-[#2563EB]" />
    ) : (
      <ChevronDownIcon className="w-4 h-4 inline-block text-[#2563EB]" />
    );
  };

  const SortableHeader = ({
    column,
    children,
    align = "left",
  }: {
    column: SortColumn;
    children: React.ReactNode;
    align?: "left" | "right";
  }) => {
    return (
      <th
        className={`px-3 md:px-4 py-2 ${
          align === "right" ? "text-right" : "text-left"
        } text-xs font-semibold uppercase tracking-wider text-gray-500 cursor-pointer hover:bg-gray-50 transition-colors select-none min-h-[44px] md:min-h-0 flex items-center`}
        onClick={() => handleSort(column)}
      >
        <div
          className={`flex items-center gap-1.5 ${
            align === "right" ? "justify-end" : "justify-start"
          }`}
        >
          <span>{children}</span>
          <SortIcon field={column} />
        </div>
      </th>
    );
  };

  return (
    <Card>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
        <div>
          <h3 className="text-lg font-semibold text-[#2D3748]">Donation Log</h3>
          <p className="text-xs text-gray-500">
            Track all individual donations and contributions.
          </p>
        </div>
        {onAddDonation && (
          <button
            onClick={onAddDonation}
            className="rounded-md bg-[#2563EB] px-3 py-2.5 md:py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#1E4DB7] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#2563EB] min-h-[44px] md:min-h-0 w-full sm:w-auto"
          >
            Record Donation
          </button>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">Loading donations…</p>
      ) : donations.length === 0 ? (
        <p className="text-sm text-gray-500">
          No donations recorded yet. Record a donation to get started.
        </p>
      ) : (
        <div className="overflow-x-auto -mx-4 md:mx-0">
          <div className="inline-block min-w-full align-middle md:px-0 px-4">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <SortableHeader column="date" align="left">
                    Date
                  </SortableHeader>
                  <SortableHeader column="donorName" align="left">
                    Donor
                  </SortableHeader>
                  <SortableHeader column="purpose" align="left">
                    Purpose
                  </SortableHeader>
                  <SortableHeader column="amount" align="right">
                    Amount
                  </SortableHeader>
                  <SortableHeader column="paymentMethod" align="left">
                    <span className="hidden md:inline">Payment Method</span>
                    <span className="md:hidden">Method</span>
                  </SortableHeader>
                  <SortableHeader column="recordedByName" align="left">
                    <span className="hidden lg:inline">Recorded By</span>
                    <span className="lg:hidden">By</span>
                  </SortableHeader>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sortedDonations.map((donation) => (
                  <tr key={donation.id}>
                    <td className="px-3 md:px-4 py-3 text-sm text-gray-700">
                      {onEditDonation ? (
                        <button
                          type="button"
                          onClick={() => onEditDonation(donation)}
                          className="group text-left focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:ring-offset-1 rounded"
                        >
                          <div className="font-medium text-[#2563EB] group-hover:text-[#1D4ED8] group-hover:underline transition-colors cursor-pointer">
                            {new Date(donation.date).toLocaleDateString()}
                          </div>
                          {donation.receiptNumber && (
                            <div className="text-xs text-gray-500 mt-0.5">
                              {donation.receiptNumber}
                            </div>
                          )}
                        </button>
                      ) : (
                        <>
                          <div className="font-medium text-[#2D3748]">
                            {new Date(donation.date).toLocaleDateString()}
                          </div>
                          {donation.receiptNumber && (
                            <div className="text-xs text-gray-500">
                              {donation.receiptNumber}
                            </div>
                          )}
                        </>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {donation.isAnonymous || !donation.donorName
                        ? "Anonymous"
                        : donation.donorName}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {donation.purpose || "—"}
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-semibold text-[#2563EB]">
                      {formatCurrency(donation.amount)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {formatPaymentMethod(donation.paymentMethod)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {donation.recordedByName || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Card>
  );
}
