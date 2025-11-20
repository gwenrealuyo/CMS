"use client";

import { useMemo, useState } from "react";
import Card from "@/src/components/ui/Card";
import Button from "@/src/components/ui/Button";
import LoadingSpinner from "@/src/components/ui/LoadingSpinner";
import ErrorMessage from "@/src/components/ui/ErrorMessage";
import Modal from "@/src/components/ui/Modal";
import Table from "@/src/components/ui/Table";
import { Each1Reach1Goal } from "@/src/types/evangelism";
import { useEach1Reach1Goals } from "@/src/hooks/useEvangelism";

interface Each1Reach1DashboardProps {
  year?: number;
}

export default function Each1Reach1Dashboard({ year }: Each1Reach1DashboardProps) {
  const currentYear = year || new Date().getFullYear();
  const [showAllModal, setShowAllModal] = useState(false);
  
  // Memoize filters to prevent infinite re-renders
  const filters = useMemo(() => ({ year: currentYear }), [currentYear]);
  
  const { goals, loading, error } = useEach1Reach1Goals(filters);

  const getProgressBarColor = (percentage: number, achieved?: number) => {
    // Red if 0 or 1 conversions, or if percentage is very low (0-20%)
    if (achieved !== undefined && (achieved === 0 || achieved === 1)) {
      return "bg-red-500";
    }
    if (percentage === 0 || percentage <= 20) {
      return "bg-red-500";
    } else if (percentage <= 40) {
      return "bg-orange-500";
    } else if (percentage <= 70) {
      return "bg-yellow-500";
    } else if (percentage >= 100) {
      return "bg-green-500";
    } else {
      return "bg-yellow-500";
    }
  };

  if (loading) {
    return (
      <Card title={`Each 1 Reach 1 - ${currentYear}`}>
        <div className="flex justify-center py-8">
          <LoadingSpinner />
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card title={`Each 1 Reach 1 - ${currentYear}`}>
        <ErrorMessage message={error} />
      </Card>
    );
  }

  return (
    <Card
      title={`Each 1 Reach 1 Goals - ${currentYear}`}
      headerAction={
        <Button 
          variant="tertiary" 
          className="text-sm"
          onClick={() => setShowAllModal(true)}
        >
          View All
        </Button>
      }
    >
      {goals.length === 0 ? (
        <div className="text-center text-gray-500 py-16 border border-dashed border-gray-200 rounded-lg">
          No goals set for {currentYear}. Create goals to track conversion progress.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {goals.map((goal) => (
            <div
              key={goal.id}
              className="p-4 border border-gray-200 rounded-lg hover:border-gray-300 transition-colors"
            >
              <h3 className="font-semibold text-[#2D3748] mb-3">
                {goal.cluster?.name || "Unknown Cluster"}
              </h3>
              <div className="space-y-2">
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Progress</span>
                  <span className="font-medium">
                    {goal.achieved_conversions} / {goal.target_conversions}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2.5">
                  <div
                    className={`${getProgressBarColor(goal.progress_percentage || 0, goal.achieved_conversions)} h-2.5 rounded-full transition-all`}
                    style={{ width: `${Math.min(goal.progress_percentage || 0, 100)}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500">
                  {goal.progress_percentage?.toFixed(1) || 0}% complete
                </p>
                <div className="pt-2 border-t border-gray-100">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-600">Status:</span>
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        goal.status === "COMPLETED"
                          ? "bg-green-100 text-green-800"
                          : goal.status === "IN_PROGRESS"
                          ? "bg-blue-100 text-blue-800"
                          : goal.status === "NOT_STARTED"
                          ? "bg-gray-100 text-gray-800"
                          : "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {goal.status?.replace("_", " ") || "Not Started"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* View All Modal */}
      <Modal
        isOpen={showAllModal}
        onClose={() => setShowAllModal(false)}
        title={`Each 1 Reach 1 Goals - ${currentYear}`}
      >
        <div className="space-y-4">
          {goals.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              No goals set for {currentYear}. Create goals to track conversion progress.
            </div>
          ) : (
            <Table
              columns={[
                {
                  header: "Cluster",
                  accessor: "cluster" as keyof Each1Reach1Goal,
                  render: (_value, row) => (
                    <span className="font-medium text-[#2D3748]">
                      {row.cluster?.name || "Unknown Cluster"}
                    </span>
                  ),
                },
                {
                  header: "Target",
                  accessor: "target_conversions" as keyof Each1Reach1Goal,
                  render: (value) => (
                    <span className="text-gray-700">{value || 0}</span>
                  ),
                },
                {
                  header: "Achieved",
                  accessor: "achieved_conversions" as keyof Each1Reach1Goal,
                  render: (value) => (
                    <span className="font-medium text-gray-900">{value || 0}</span>
                  ),
                },
                {
                  header: "Progress",
                  accessor: "progress_percentage" as keyof Each1Reach1Goal,
                  render: (_value, row) => {
                    const percentage = row.progress_percentage || 0;
                    return (
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-gray-200 rounded-full h-2">
                          <div
                            className={`${getProgressBarColor(percentage, row.achieved_conversions)} h-2 rounded-full transition-all`}
                            style={{ width: `${Math.min(percentage, 100)}%` }}
                          />
                        </div>
                        <span className="text-sm text-gray-600 w-12 text-right">
                          {percentage.toFixed(1)}%
                        </span>
                      </div>
                    );
                  },
                },
                {
                  header: "Status",
                  accessor: "status" as keyof Each1Reach1Goal,
                  render: (value) => {
                    const status = value as string;
                    const statusColors = {
                      COMPLETED: "bg-green-100 text-green-800",
                      IN_PROGRESS: "bg-blue-100 text-blue-800",
                      NOT_STARTED: "bg-gray-100 text-gray-800",
                    };
                    return (
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
                          statusColors[status as keyof typeof statusColors] ||
                          "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {status?.replace("_", " ") || "Not Started"}
                      </span>
                    );
                  },
                },
              ]}
              data={goals}
            />
          )}
        </div>
      </Modal>
    </Card>
  );
}

