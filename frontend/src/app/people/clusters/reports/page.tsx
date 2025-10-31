"use client";

import React, { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import DashboardLayout from "@/src/components/layout/DashboardLayout";
import { clustersApi } from "@/src/lib/api";
import { Cluster } from "@/src/types/person";

const ClusterReportsDashboard = dynamic(
  () => import("@/src/components/reports/ClusterReportsDashboard"),
  { ssr: false }
);

export default function ClusterReportsPage() {
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const fetchClusters = async () => {
      try {
        setLoading(true);
        const res = await clustersApi.getAll();
        setClusters(res.data);
      } finally {
        setLoading(false);
      }
    };
    fetchClusters();
  }, []);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {loading ? (
          <p className="text-sm text-gray-500">Loading clusters…</p>
        ) : (
          <ClusterReportsDashboard clusters={clusters} />
        )}
      </div>
    </DashboardLayout>
  );
}
