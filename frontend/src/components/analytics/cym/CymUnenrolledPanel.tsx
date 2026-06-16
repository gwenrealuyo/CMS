"use client";

import Card from "@/src/components/ui/Card";
import type { CymUnenrolledCategory } from "@/src/types/reports";

interface CymUnenrolledPanelProps {
  categories: CymUnenrolledCategory[];
  loading?: boolean;
}

export default function CymUnenrolledPanel({
  categories,
  loading = false,
}: CymUnenrolledPanelProps) {
  const rows = categories.filter((row) => row.unenrolled_count > 0);

  if (!loading && rows.length === 0) {
    return null;
  }

  return (
    <Card title="Unenrolled by Age Category">
      {loading ? (
        <div className="py-8 text-center text-sm text-muted-foreground">
          Loading unenrolled breakdown...
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Category
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Age Range
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Unenrolled
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {rows.map((row) => (
                <tr key={row.category_id}>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
                    {row.category_name}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                    {row.age_range}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
                    {row.unenrolled_count}
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
