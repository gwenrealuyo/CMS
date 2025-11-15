import { useState, useMemo } from "react";
import Card from "@/src/components/ui/Card";
import { Offering } from "@/src/types/finance";
import { ChevronUpIcon, ChevronDownIcon } from "@heroicons/react/24/outline";

interface OfferingTableProps {
  offerings: Offering[];
  onAddOffering?: () => void;
  loading?: boolean;
  onEditOffering?: (offering: Offering) => void;
}

type SortColumn =
  | "serviceName"
  | "serviceDate"
  | "fund"
  | "amount"
  | "recordedByName";

type SortDirection = "asc" | "desc";

export default function OfferingTable({
  offerings,
  onAddOffering,
  loading,
  onEditOffering,
}: OfferingTableProps) {
  const [sortColumn, setSortColumn] = useState<SortColumn>("serviceDate");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const sortedOfferings = useMemo(() => {
    const sorted = [...offerings];
    sorted.sort((a, b) => {
      let aValue: string | number | null;
      let bValue: string | number | null;

      switch (sortColumn) {
        case "serviceName":
          aValue = a.serviceName.toLowerCase();
          bValue = b.serviceName.toLowerCase();
          break;
        case "serviceDate":
          aValue = a.serviceDate;
          bValue = b.serviceDate;
          break;
        case "fund":
          aValue = (a.fund || "General Fund").toLowerCase();
          bValue = (b.fund || "General Fund").toLowerCase();
          break;
        case "amount":
          aValue = a.amount;
          bValue = b.amount;
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
  }, [offerings, sortColumn, sortDirection]);

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
        className={`px-4 py-2 ${
          align === "right" ? "text-right" : "text-left"
        } text-xs font-semibold uppercase tracking-wider text-gray-500 cursor-pointer hover:bg-gray-50 transition-colors select-none`}
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
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-[#2D3748]">Offering Log</h3>
          <p className="text-xs text-gray-500">
            Capture weekly Sunday service offerings for quick tracking.
          </p>
        </div>
        {onAddOffering && (
          <button
            onClick={onAddOffering}
            className="rounded-md bg-[#2563EB] px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#1E4DB7] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#2563EB]"
          >
            Record Offering
          </button>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">Loading offerings…</p>
      ) : offerings.length === 0 ? (
        <p className="text-sm text-gray-500">
          No offerings recorded yet. Once you add Sunday offerings, they will
          show up here.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead>
              <tr>
                <SortableHeader column="serviceDate" align="left">
                  Service
                </SortableHeader>
                <SortableHeader column="fund" align="left">
                  Fund
                </SortableHeader>
                <SortableHeader column="amount" align="right">
                  Amount
                </SortableHeader>
                <SortableHeader column="recordedByName" align="left">
                  Recorded By
                </SortableHeader>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sortedOfferings.map((offering) => (
                <tr key={offering.id}>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {onEditOffering ? (
                      <button
                        type="button"
                        onClick={() => onEditOffering(offering)}
                        className="group text-left focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:ring-offset-1 rounded"
                      >
                        <div className="font-medium text-[#2563EB] group-hover:text-[#1D4ED8] group-hover:underline transition-colors cursor-pointer">
                          {offering.serviceName}
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          {new Date(offering.serviceDate).toLocaleDateString()}
                        </div>
                      </button>
                    ) : (
                      <>
                        <div className="font-medium text-[#2D3748]">
                          {offering.serviceName}
                        </div>
                        <div className="text-xs text-gray-500">
                          {new Date(offering.serviceDate).toLocaleDateString()}
                        </div>
                      </>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {offering.fund || "General Fund"}
                  </td>
                  <td className="px-4 py-3 text-sm text-right font-semibold text-[#2563EB]">
                    ₱
                    {offering.amount.toLocaleString(undefined, {
                      maximumFractionDigits: 2,
                    })}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {offering.recordedByName || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
