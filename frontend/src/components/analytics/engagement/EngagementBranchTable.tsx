"use client";

import Card from "@/src/components/ui/Card";
import type { EngagementBranchRow } from "@/src/types/reports";

interface EngagementBranchTableProps {
  rows: EngagementBranchRow[];
}

export default function EngagementBranchTable({
  rows,
}: EngagementBranchTableProps) {
  if (rows.length === 0) return null;

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
                Cluster Members
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Evangelism Members
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Service Headcount
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
                  {row.cluster_members}
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
                  {row.evangelism_members}
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
                  {row.service_headcount}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
