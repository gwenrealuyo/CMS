"use client";

import Card from "@/src/components/ui/Card";
import type { V2bClusterRow } from "@/src/types/reports";

interface V2bClusterTableProps {
  rows: V2bClusterRow[];
}

export default function V2bClusterTable({ rows }: V2bClusterTableProps) {
  if (rows.length === 0) {
    return null;
  }

  return (
    <Card title="Cluster Comparison">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Cluster
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Active Prospects
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Completed Conversions
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Drop-offs
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {rows.map((row) => (
              <tr key={row.cluster_id}>
                <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
                  {row.cluster_name}
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-700">
                  {row.active_prospects}
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-700">
                  {row.completed_conversions}
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-700">
                  {row.drop_offs}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
