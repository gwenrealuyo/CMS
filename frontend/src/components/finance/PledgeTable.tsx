import { useState, useMemo } from "react";
import Card from "@/src/components/ui/Card";
import { Pledge } from "@/src/types/finance";
import { ChevronUpIcon, ChevronDownIcon } from "@heroicons/react/24/outline";

interface PledgeTableProps {
  pledges: Pledge[];
  onAddPledge?: () => void;
  loading?: boolean;
  onManageContributions?: (pledge: Pledge) => void;
  onEditPledge?: (pledge: Pledge) => void;
}

type SortColumn =
  | "pledgeTitle"
  | "status"
  | "pledgeAmount"
  | "amountReceived"
  | "balance"
  | "progressPercent"
  | "targetDate";

type SortDirection = "asc" | "desc";

const STATUS_COLORS: Record<Pledge["status"], string> = {
  ACTIVE: "bg-blue-100 text-blue-700",
  FULFILLED: "bg-green-100 text-green-700",
  CANCELLED: "bg-gray-200 text-gray-600",
};

export default function PledgeTable({
  pledges,
  onAddPledge,
  loading,
  onManageContributions,
  onEditPledge,
}: PledgeTableProps) {
  const [sortColumn, setSortColumn] = useState<SortColumn>("pledgeTitle");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  const sortedPledges = useMemo(() => {
    const sorted = [...pledges];
    sorted.sort((a, b) => {
      let aValue: string | number | null;
      let bValue: string | number | null;

      switch (sortColumn) {
        case "pledgeTitle":
          aValue = a.pledgeTitle.toLowerCase();
          bValue = b.pledgeTitle.toLowerCase();
          break;
        case "status":
          aValue = a.status;
          bValue = b.status;
          break;
        case "pledgeAmount":
          aValue = a.pledgeAmount;
          bValue = b.pledgeAmount;
          break;
        case "amountReceived":
          aValue = a.amountReceived;
          bValue = b.amountReceived;
          break;
        case "balance":
          aValue = a.balance;
          bValue = b.balance;
          break;
        case "progressPercent":
          aValue = a.progressPercent;
          bValue = b.progressPercent;
          break;
        case "targetDate":
          aValue = a.targetDate || "";
          bValue = b.targetDate || "";
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
  }, [pledges, sortColumn, sortDirection]);

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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div>
          <h3 className="text-lg font-semibold text-[#2D3748]">
            Pledge Tracker
          </h3>
          <p className="text-xs text-gray-500">
            Keep tabs on pledge fulfillment progress and remaining balances.
          </p>
        </div>
        {onAddPledge && (
          <button
            onClick={onAddPledge}
            className="w-full sm:w-auto min-h-[44px] rounded-md bg-[#2563EB] px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#1E4DB7] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#2563EB]"
          >
            Add Pledge
          </button>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">Loading pledges…</p>
      ) : pledges.length === 0 ? (
        <p className="text-sm text-gray-500">
          No pledges on file yet. Capture campaign commitments to view them
          here.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead>
              <tr>
                <SortableHeader column="pledgeTitle" align="left">
                  Pledge
                </SortableHeader>
                <SortableHeader column="status" align="left">
                  Status
                </SortableHeader>
                <SortableHeader column="pledgeAmount" align="right">
                  Amount
                </SortableHeader>
                <SortableHeader column="amountReceived" align="right">
                  Received
                </SortableHeader>
                <SortableHeader column="balance" align="right">
                  Balance
                </SortableHeader>
                <SortableHeader column="progressPercent" align="left">
                  Progress
                </SortableHeader>
                {(onManageContributions || onEditPledge) && (
                  <th className="px-4 py-2 text-right text-xs font-semibold uppercase tracking-wider text-gray-500"></th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sortedPledges.map((pledge) => (
                <tr key={pledge.id}>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {onManageContributions ? (
                      <button
                        type="button"
                        onClick={() => onManageContributions(pledge)}
                        className="group text-left focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:ring-offset-1 rounded"
                      >
                        <div className="font-medium text-[#2563EB] group-hover:text-[#1D4ED8] group-hover:underline transition-colors cursor-pointer">
                          {pledge.pledgeTitle}
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          Due{" "}
                          {pledge.targetDate
                            ? new Date(pledge.targetDate).toLocaleDateString()
                            : "open-ended"}
                        </div>
                      </button>
                    ) : (
                      <>
                        <div className="font-medium text-[#2D3748]">
                          {pledge.pledgeTitle}
                        </div>
                        <div className="text-xs text-gray-500">
                          Due{" "}
                          {pledge.targetDate
                            ? new Date(pledge.targetDate).toLocaleDateString()
                            : "open-ended"}
                        </div>
                      </>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        STATUS_COLORS[pledge.status]
                      }`}
                    >
                      {pledge.status.charAt(0) +
                        pledge.status.slice(1).toLowerCase()}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-semibold text-[#2D3748]">
                    ₱
                    {pledge.pledgeAmount.toLocaleString(undefined, {
                      maximumFractionDigits: 2,
                    })}
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-gray-700">
                    ₱
                    {pledge.amountReceived.toLocaleString(undefined, {
                      maximumFractionDigits: 2,
                    })}
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-gray-700">
                    ₱
                    {pledge.balance.toLocaleString(undefined, {
                      maximumFractionDigits: 2,
                    })}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-32 overflow-hidden rounded-full bg-gray-200">
                        <div
                          className={`h-2 rounded-full ${
                            pledge.status === "FULFILLED"
                              ? "bg-green-500"
                              : "bg-[#2563EB]"
                          }`}
                          style={{
                            width: `${Math.min(
                              100,
                              Math.max(0, pledge.progressPercent)
                            )}%`,
                          }}
                        />
                      </div>
                      <span className="text-xs font-medium text-gray-600">
                        {pledge.progressPercent.toFixed(0)}%
                      </span>
                    </div>
                  </td>
                  {(onManageContributions || onEditPledge) && (
                    <td className="px-4 py-3 text-right text-sm">
                      <div className="flex items-center justify-end gap-2">
                        {onEditPledge && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onEditPledge(pledge);
                            }}
                            className="text-xs font-semibold text-[#2563EB] hover:text-[#1D4ED8] transition-colors focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:ring-offset-1 rounded"
                          >
                            Edit
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
