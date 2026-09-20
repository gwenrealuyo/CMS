"use client";

import { useState } from "react";
import Table from "@/src/components/ui/Table";
import Button from "@/src/components/ui/Button";
import PersonAvatar from "@/src/components/people/PersonAvatar";
import { Person } from "@/src/types/person";
import { formatPersonName } from "@/src/lib/name";
import { formatLocaleDate } from "@/src/lib/date";

interface GroupPeopleProgressSectionProps {
  people: Person[];
  onAddProgress?: () => void;
  onEditProgress?: (person: Person) => void;
  loading?: boolean;
}

function isReached(person: Person): boolean {
  return Boolean(
    person.date_first_invited &&
      person.date_first_attended &&
      person.water_baptism_date &&
      person.spirit_baptism_date &&
      person.lessons_started_at,
  );
}

export default function GroupPeopleProgressSection({
  people,
  onAddProgress,
  onEditProgress,
  loading = false,
}: GroupPeopleProgressSectionProps) {
  const [showAll, setShowAll] = useState(false);
  const DEFAULT_LIMIT = 5;

  const displayed = showAll ? people : people.slice(0, DEFAULT_LIMIT);
  const hasMore = people.length > DEFAULT_LIMIT;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <h3 className="text-base font-semibold text-gray-900 md:text-lg">
          Visitor progress
        </h3>
        {onAddProgress && (
          <Button
            onClick={onAddProgress}
            className="!bg-emerald-600 hover:!bg-emerald-700 w-full sm:w-auto min-h-[44px]"
          >
            Update visitor
          </Button>
        )}
      </div>

      {loading ? (
        <div className="text-center py-8 text-gray-500">Loading...</div>
      ) : people.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          No attended visitors linked to this group yet
        </div>
      ) : (
        <>
          <Table
            columns={[
              {
                header: "Person",
                accessor: "id" as keyof Person,
                render: (_value, row) => (
                  <div className="flex items-center gap-2 min-w-0">
                    <PersonAvatar person={row} size="sm" />
                    <span className="text-sm font-medium text-gray-900 truncate">
                      {formatPersonName(row)}
                    </span>
                  </div>
                ),
              },
              {
                header: "Invited",
                accessor: "date_first_invited" as keyof Person,
                render: (value) => (
                  <span className="text-sm text-gray-700">
                    {value ? formatLocaleDate(value as string) : "—"}
                  </span>
                ),
              },
              {
                header: "Attended",
                accessor: "date_first_attended" as keyof Person,
                render: (value) => (
                  <span className="text-sm text-gray-700">
                    {value ? formatLocaleDate(value as string) : "—"}
                  </span>
                ),
              },
              {
                header: "NCC",
                accessor: "lessons_started_at" as keyof Person,
                render: (value) => (
                  <span className="text-sm text-gray-700">
                    {value ? formatLocaleDate(value as string) : "—"}
                  </span>
                ),
              },
              {
                header: "Baptism",
                accessor: "water_baptism_date" as keyof Person,
                render: (value, row) => (
                  <span
                    className={`text-sm ${
                      isReached(row)
                        ? "text-green-600 font-medium"
                        : "text-gray-700"
                    }`}
                  >
                    {value ? formatLocaleDate(value as string) : "—"}
                  </span>
                ),
              },
              {
                header: "HG",
                accessor: "spirit_baptism_date" as keyof Person,
                render: (value, row) => (
                  <span
                    className={`text-sm ${
                      isReached(row)
                        ? "text-green-600 font-medium"
                        : "text-gray-700"
                    }`}
                  >
                    {value ? formatLocaleDate(value as string) : "—"}
                  </span>
                ),
              },
              ...(onEditProgress
                ? [
                    {
                      header: "Actions",
                      accessor: "id" as keyof Person,
                      render: (_value: unknown, row: Person) => (
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => onEditProgress(row)}
                          className="w-full min-h-[44px] border border-amber-200 bg-white px-2 py-1 text-xs !text-amber-600 hover:border-amber-300 hover:bg-amber-50 md:min-h-0 md:w-auto"
                        >
                          Update
                        </Button>
                      ),
                    },
                  ]
                : []),
            ]}
            data={displayed}
          />
          {hasMore && (
            <div className="text-center">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setShowAll((v) => !v)}
                className="text-sm"
              >
                {showAll
                  ? "Show less"
                  : `Show more (${people.length - DEFAULT_LIMIT})`}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
