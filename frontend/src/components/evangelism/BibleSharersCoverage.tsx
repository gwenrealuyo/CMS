"use client";

import { useState, useEffect } from "react";
import { evangelismApi } from "@/src/lib/api";
import { BibleSharersCoverage } from "@/src/types/evangelism";
import Card from "@/src/components/ui/Card";
import LoadingSpinner from "@/src/components/ui/LoadingSpinner";
import ErrorMessage from "@/src/components/ui/ErrorMessage";
import Table from "@/src/components/ui/Table";

export default function BibleSharersCoverageComponent() {
  const [coverage, setCoverage] = useState<BibleSharersCoverage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCoverage = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await evangelismApi.getBibleSharersCoverage();
        setCoverage(response.data);
      } catch (err: any) {
        setError(
          err.response?.data?.detail ||
            Object.values(err.response?.data || {})[0]?.[0] ||
            "Failed to load Bible Sharers coverage"
        );
      } finally {
        setLoading(false);
      }
    };

    fetchCoverage();
  }, []);

  if (loading) {
    return (
      <Card>
        <div className="flex justify-center items-center py-8">
          <LoadingSpinner />
        </div>
      </Card>
    );
  }

  if (error) {
    return <ErrorMessage message={error} />;
  }

  if (!coverage) {
    return null;
  }

  const { summary, coverage: coverageItems } = coverage;

  // Ensure coverageItems is an array
  const safeCoverageItems = coverageItems || [];

  const coveragePercentage = summary?.total_clusters
    ? Math.round(
        ((summary.clusters_with_bible_sharers || 0) / summary.total_clusters) * 100
      )
    : 0;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <div className="p-4">
            <h3 className="text-sm font-medium text-gray-500">Total Clusters</h3>
            <p className="text-2xl font-bold text-gray-900 mt-1">
              {summary?.total_clusters || 0}
            </p>
          </div>
        </Card>

        <Card>
          <div className="p-4">
            <h3 className="text-sm font-medium text-gray-500">
              With Bible Sharers
            </h3>
            <p className="text-2xl font-bold text-green-600 mt-1">
              {summary?.clusters_with_bible_sharers || 0}
            </p>
            <p className="text-sm text-gray-500 mt-1">
              {coveragePercentage}% coverage
            </p>
          </div>
        </Card>

        <Card>
          <div className="p-4">
            <h3 className="text-sm font-medium text-gray-500">
              Without Bible Sharers
            </h3>
            <p className="text-2xl font-bold text-red-600 mt-1">
              {summary?.clusters_without_bible_sharers || 0}
            </p>
          </div>
        </Card>

        <Card>
          <div className="p-4">
            <h3 className="text-sm font-medium text-gray-500">
              Bible Sharers Groups
            </h3>
            <p className="text-2xl font-bold text-blue-600 mt-1">
              {summary?.total_bible_sharers_groups || 0}
            </p>
          </div>
        </Card>
      </div>

      {/* Clusters Without Bible Sharers Alert */}
      {(summary?.clusters_without_bible_sharers || 0) > 0 && (
        <Card className="border-yellow-200 bg-yellow-50">
          <div className="p-4">
            <h3 className="text-sm font-medium text-yellow-800 mb-2">
              Clusters Without Bible Sharers
            </h3>
            <p className="text-sm text-yellow-700">
              {(summary?.clusters_without_names || []).length > 0
                ? summary.clusters_without_names.join(", ")
                : "No cluster names available"}
            </p>
            <p className="text-xs text-yellow-600 mt-2">
              Ideally, each cluster should have at least one Bible Sharer who can
              facilitate bible studies when needed.
            </p>
          </div>
        </Card>
      )}

      {/* Coverage Table */}
      <Card>
        <div className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Cluster Coverage Details
          </h2>
          {safeCoverageItems.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No clusters found</p>
          ) : (
            <Table
              columns={[
                {
                  header: "Cluster",
                  accessor: "cluster" as keyof BibleSharersCoverageItem,
                  render: (value, item) => item.cluster.name || item.cluster.code || "N/A",
                },
                {
                  header: "Status",
                  accessor: "has_bible_sharers" as keyof BibleSharersCoverageItem,
                  render: (value, item) => (
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium ${
                        item.has_bible_sharers
                          ? "bg-green-100 text-green-800"
                          : "bg-red-100 text-red-800"
                      }`}
                    >
                      {item.has_bible_sharers ? "Covered" : "Not Covered"}
                    </span>
                  ),
                },
                {
                  header: "Bible Sharers Groups",
                  accessor: "bible_sharers_groups" as keyof BibleSharersCoverageItem,
                  render: (value, item) => item.bible_sharers_groups.length,
                },
                {
                  header: "Total Bible Sharers",
                  accessor: "bible_sharers_count" as keyof BibleSharersCoverageItem,
                  render: (value) => value,
                },
                {
                  header: "Groups",
                  accessor: "bible_sharers_groups" as keyof BibleSharersCoverageItem,
                  render: (value, item) => {
                    if (item.bible_sharers_groups.length === 0) {
                      return <span className="text-gray-400">None</span>;
                    }
                    return (
                      <div className="space-y-1">
                        {item.bible_sharers_groups.map((group) => (
                          <div
                            key={group.id}
                            className="text-sm text-gray-700"
                          >
                            <span className="font-medium">{group.name}</span>
                            {group.coordinator && (
                              <span className="text-gray-500 ml-2">
                                (Coordinator: {group.coordinator})
                              </span>
                            )}
                            <span className="text-gray-400 ml-2">
                              ({group.members_count} members)
                            </span>
                          </div>
                        ))}
                      </div>
                    );
                  },
                },
              ]}
              data={safeCoverageItems}
            />
          )}
        </div>
      </Card>
    </div>
  );
}

