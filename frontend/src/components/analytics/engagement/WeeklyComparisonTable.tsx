"use client";

import Card from "@/src/components/ui/Card";

interface WeeklyComparisonRow {
  id: number;
  label: string;
  report_count: number;
  sum_members_attended: number;
}

interface WeeklyComparisonTableProps {
  title: string;
  entityColumnLabel: string;
  rows: WeeklyComparisonRow[];
}

export default function WeeklyComparisonTable({
  title,
  entityColumnLabel,
  rows,
}: WeeklyComparisonTableProps) {
  if (rows.length === 0) return null;

  return (
    <Card title={title}>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                {entityColumnLabel}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Reports
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Members Attended
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {rows.map((row) => (
              <tr key={row.id}>
                <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
                  {row.label}
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
                  {row.report_count}
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
                  {row.sum_members_attended}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
