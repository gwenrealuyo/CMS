"use client";

import { useState } from "react";
import Card from "@/src/components/ui/Card";
import Button from "@/src/components/ui/Button";
import LoadingSpinner from "@/src/components/ui/LoadingSpinner";
import ErrorMessage from "@/src/components/ui/ErrorMessage";
import Table from "@/src/components/ui/Table";
import {
  UnenrolledByCategory as UnenrolledByCategoryType,
  SundaySchoolClass,
} from "@/src/types/sundaySchool";
import { ClassMemberRole } from "@/src/types/sundaySchool";

interface UnenrolledByCategoryProps {
  unenrolled: UnenrolledByCategoryType[];
  loading: boolean;
  error: string | null;
  classes?: SundaySchoolClass[];
  onBulkEnroll?: (
    categoryId: number,
    personIds: number[],
    role: ClassMemberRole
  ) => Promise<void>;
}

export default function UnenrolledByCategory({
  unenrolled,
  loading,
  error,
  classes = [],
  onBulkEnroll,
}: UnenrolledByCategoryProps) {
  const [expandedCategories, setExpandedCategories] = useState<Set<number>>(
    new Set()
  );
  const [isEnrolling, setIsEnrolling] = useState<number | null>(null);

  const toggleCategory = (categoryId: number) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(categoryId)) {
      newExpanded.delete(categoryId);
    } else {
      newExpanded.add(categoryId);
    }
    setExpandedCategories(newExpanded);
  };

  const handleBulkEnroll = async (categoryId: number, personIds: number[]) => {
    if (!onBulkEnroll) return;
    setIsEnrolling(categoryId);
    try {
      await onBulkEnroll(categoryId, personIds, "STUDENT");
    } finally {
      setIsEnrolling(null);
    }
  };

  if (loading) {
    return (
      <Card title="Unenrolled Students by Category">
        <LoadingSpinner />
      </Card>
    );
  }

  if (error) {
    return (
      <Card title="Unenrolled Students by Category">
        <ErrorMessage message={error} />
      </Card>
    );
  }

  const totalUnenrolled = unenrolled.reduce(
    (sum, cat) => sum + cat.unenrolled_count,
    0
  );

  const personColumns = [
    {
      header: "Name",
      accessor: "full_name" as const,
      render: (_value: any, row: any) => (
        <div>
          <p className="font-medium text-gray-900">{row.full_name}</p>
          {row.age && <p className="text-xs text-gray-500">Age: {row.age}</p>}
        </div>
      ),
    },
    {
      header: "Cluster",
      accessor: "cluster_info" as const,
      render: (value: string) => (
        <span className="text-sm text-gray-700">{value || "—"}</span>
      ),
    },
    {
      header: "Family",
      accessor: "family_names" as const,
      render: (value: string) => (
        <span className="text-sm text-gray-700">{value || "—"}</span>
      ),
    },
    {
      header: "Status",
      accessor: "status" as const,
      render: (value: string) => (
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
            value === "ACTIVE"
              ? "bg-green-100 text-green-800"
              : "bg-gray-100 text-gray-800"
          }`}
        >
          {value || "—"}
        </span>
      ),
    },
  ];

  return (
    <Card title="Unenrolled Students by Category">
      <div className="space-y-4">
        {totalUnenrolled > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm font-medium text-blue-900">
              Total Unenrolled: {totalUnenrolled}{" "}
              {totalUnenrolled === 1 ? "person" : "people"}
            </p>
          </div>
        )}

        {unenrolled.length === 0 ? (
          <p className="text-sm text-gray-500 py-4 text-center">
            All eligible people are enrolled in Sunday School classes.
          </p>
        ) : (
          <div className="space-y-3">
            {unenrolled.map((category) => {
              const isExpanded = expandedCategories.has(category.category_id);
              const isEnrollingThis = isEnrolling === category.category_id;
              const hasClassForCategory = classes.some(
                (c) =>
                  c.category.id === category.category_id ||
                  c.category_id === category.category_id
              );

              return (
                <div
                  key={category.category_id}
                  className="border border-gray-200 rounded-lg overflow-hidden"
                >
                  <button
                    onClick={() => toggleCategory(category.category_id)}
                    className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <svg
                        className={`w-5 h-5 text-gray-400 transition-transform ${
                          isExpanded ? "rotate-90" : ""
                        }`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 5l7 7-7 7"
                        />
                      </svg>
                      <div className="text-left">
                        <p className="font-medium text-gray-900">
                          {category.category_name}
                          {category.age_range && (
                            <span className="text-gray-500 ml-2">
                              ({category.age_range})
                            </span>
                          )}
                        </p>
                        <p className="text-sm text-gray-500">
                          {category.unenrolled_count}{" "}
                          {category.unenrolled_count === 1
                            ? "person"
                            : "people"}{" "}
                          not enrolled
                        </p>
                      </div>
                    </div>
                    {category.unenrolled_count > 0 && (
                      <span className="inline-flex items-center rounded-full bg-blue-100 text-blue-800 px-3 py-1 text-xs font-semibold">
                        {category.unenrolled_count}
                      </span>
                    )}
                  </button>

                  {isExpanded && category.unenrolled_people.length > 0 && (
                    <div className="border-t border-gray-200 bg-gray-50 p-4">
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-sm font-medium text-gray-700">
                          {category.unenrolled_people.length}{" "}
                          {category.unenrolled_people.length === 1
                            ? "person"
                            : "people"}
                        </p>
                        {onBulkEnroll && hasClassForCategory && (
                          <Button
                            variant="primary"
                            onClick={() =>
                              handleBulkEnroll(
                                category.category_id,
                                category.unenrolled_people.map((p) => p.id)
                              )
                            }
                            disabled={isEnrollingThis}
                            className="text-xs !px-3 !py-1"
                          >
                            {isEnrollingThis
                              ? "Enrolling..."
                              : `Enroll All (${category.unenrolled_people.length})`}
                          </Button>
                        )}
                      </div>
                      <Table
                        data={category.unenrolled_people}
                        columns={personColumns}
                      />
                    </div>
                  )}

                  {isExpanded && category.unenrolled_people.length === 0 && (
                    <div className="border-t border-gray-200 bg-gray-50 p-4 text-center text-sm text-gray-500">
                      No unenrolled people in this category.
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Card>
  );
}
