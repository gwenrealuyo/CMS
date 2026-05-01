"use client";

import { useState } from "react";
import Table from "@/src/components/ui/Table";
import { Conversion } from "@/src/types/evangelism";

import Button from "@/src/components/ui/Button";

interface GroupConversionsSectionProps {
  conversions: Conversion[];
  onAddConversion?: () => void;
  onEditConversion?: (conversion: Conversion) => void;
  loading?: boolean;
}

export default function GroupConversionsSection({
  conversions,
  onAddConversion,
  onEditConversion,
  loading = false,
}: GroupConversionsSectionProps) {
  const [showAll, setShowAll] = useState(false);
  const DEFAULT_LIMIT = 5;

  const displayedConversions = showAll
    ? conversions
    : conversions.slice(0, DEFAULT_LIMIT);
  const hasMoreConversions = conversions.length > DEFAULT_LIMIT;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <h3 className="text-lg font-semibold text-gray-900">Conversions</h3>
        {onAddConversion && (
          <Button
            onClick={onAddConversion}
            className="bg-emerald-600 hover:bg-emerald-700 w-full sm:w-auto min-h-[44px]"
          >
            Record Conversion
          </Button>
        )}
      </div>

      {loading ? (
        <div className="text-center py-8 text-gray-500">Loading...</div>
      ) : conversions.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          No conversions recorded
        </div>
      ) : (
        <>
          <Table
            columns={[
              {
                header: "Person",
                accessor: "person" as keyof Conversion,
                render: (_value, row) => (
                  <span className="text-sm font-medium text-gray-900">
                    {row.person?.full_name || row.person?.username || "N/A"}
                  </span>
                ),
              },
              {
                header: "Invited By",
                accessor: "converted_by" as keyof Conversion,
                render: (_value, row) => (
                  <span className="text-sm text-gray-700">
                    {row.converted_by?.full_name ||
                      row.converted_by?.username ||
                      "N/A"}
                  </span>
                ),
              },
              {
                header: "Baptism Date",
                accessor: "water_baptism_date" as keyof Conversion,
                render: (value, row) => (
                  <span
                    className={`text-sm ${row.is_complete ? "text-green-600 font-medium" : "text-gray-700"}`}
                  >
                    {value
                      ? new Date(value as string).toLocaleDateString()
                      : "N/A"}
                  </span>
                ),
              },
              {
                header: "HG Date",
                accessor: "spirit_baptism_date" as keyof Conversion,
                render: (value, row) => (
                  <span
                    className={`text-sm ${row.is_complete ? "text-green-600 font-medium" : "text-gray-700"}`}
                  >
                    {value
                      ? new Date(value as string).toLocaleDateString()
                      : "N/A"}
                  </span>
                ),
              },
              ...(onEditConversion
                ? [
                    {
                      header: "Actions",
                      accessor: "id" as keyof Conversion,
                      render: (_value: unknown, row: Conversion) => (
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => onEditConversion(row)}
                          className="!text-amber-600 bg-white border border-amber-200 hover:bg-amber-50 hover:border-amber-300 text-xs py-1 px-2"
                        >
                          Update
                        </Button>
                      ),
                    },
                  ]
                : []),
            ]}
            data={displayedConversions}
          />
          {hasMoreConversions && (
            <div className="flex justify-center pt-2">
              <Button
                variant="tertiary"
                onClick={() => setShowAll(!showAll)}
                className="text-sm"
              >
                {showAll
                  ? "Show Less"
                  : `Show More (${conversions.length - DEFAULT_LIMIT} more)`}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
