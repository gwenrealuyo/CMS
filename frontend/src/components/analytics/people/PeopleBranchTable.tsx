"use client";

import Card from "@/src/components/ui/Card";
import type { PeopleBranchBreakdownItem } from "@/src/types/reports";

interface PeopleBranchTableProps {
  rows: PeopleBranchBreakdownItem[];
}

export default function PeopleBranchTable({ rows }: PeopleBranchTableProps) {
  if (rows.length === 0) return null;

  const total = rows.reduce((sum, row) => sum + row.count, 0);

  return (
    <Card title="By Branch">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Branch
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Count
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Share
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {rows.map((row) => (
              <tr key={row.branch_id}>
                <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
                  {row.branch_name}
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
                  {row.count}
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
                  {total > 0
                    ? `${((row.count / total) * 100).toFixed(1)}%`
                    : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
