import { useState, useEffect } from "react";
import { clustersApi, clusterReportsApi } from "@/src/lib/api";
import {
  Cluster,
  ClusterInput,
  ClusterWeeklyReport,
  ClusterWeeklyReportInput,
  ClusterAnalytics,
  OverdueClusters,
} from "@/src/types/cluster";

export function useClusters() {
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchClusters = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await clustersApi.getAll();
      setClusters(response.data);
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to fetch clusters");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClusters();
  }, []);

  const createCluster = async (data: ClusterInput) => {
    try {
      const response = await clustersApi.create(data);
      setClusters((prev) => [response.data, ...prev]);
      return response.data;
    } catch (err: any) {
      throw new Error(err.response?.data?.detail || "Failed to create cluster");
    }
  };

  const updateCluster = async (id: number, data: Partial<ClusterInput>) => {
    try {
      const response = await clustersApi.update(id, data);
      setClusters((prev) =>
        prev.map((c) => (c.id === id ? response.data : c))
      );
      return response.data;
    } catch (err: any) {
      throw new Error(err.response?.data?.detail || "Failed to update cluster");
    }
  };

  const deleteCluster = async (id: number) => {
    try {
      await clustersApi.delete(id);
      setClusters((prev) => prev.filter((c) => c.id !== id));
    } catch (err: any) {
      throw new Error(err.response?.data?.detail || "Failed to delete cluster");
    }
  };

  return {
    clusters,
    loading,
    error,
    refetch: fetchClusters,
    createCluster,
    updateCluster,
    deleteCluster,
  };
}

export function useClusterReports(params?: {
  cluster?: string;
  year?: number;
  week_number?: number;
  gathering_type?: string;
  submitted_by?: string;
  month?: number;
  page?: number;
  page_size?: number;
}) {
  const [reports, setReports] = useState<ClusterWeeklyReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [count, setCount] = useState(0);
  const [next, setNext] = useState<string | null>(null);
  const [previous, setPrevious] = useState<string | null>(null);

  const fetchReports = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await clusterReportsApi.getAll(params);
      setReports(response.data.results);
      setCount(response.data.count);
      setNext(response.data.next || null);
      setPrevious(response.data.previous || null);
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to fetch reports");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [JSON.stringify(params)]);

  const createReport = async (data: ClusterWeeklyReportInput) => {
    try {
      const response = await clusterReportsApi.create(data);
      setReports((prev) => [response.data, ...prev]);
      return response.data;
    } catch (err: any) {
      throw new Error(err.response?.data?.detail || "Failed to create report");
    }
  };

  const updateReport = async (
    id: number,
    data: Partial<ClusterWeeklyReportInput>
  ) => {
    try {
      const response = await clusterReportsApi.update(id, data);
      setReports((prev) =>
        prev.map((r) => (r.id === id ? response.data : r))
      );
      return response.data;
    } catch (err: any) {
      throw new Error(err.response?.data?.detail || "Failed to update report");
    }
  };

  const deleteReport = async (id: number) => {
    try {
      await clusterReportsApi.delete(id.toString());
      setReports((prev) => prev.filter((r) => r.id !== id));
    } catch (err: any) {
      throw new Error(err.response?.data?.detail || "Failed to delete report");
    }
  };

  return {
    reports,
    loading,
    error,
    count,
    next,
    previous,
    refetch: fetchReports,
    createReport,
    updateReport,
    deleteReport,
  };
}

export function useClusterAnalytics(params?: {
  cluster?: string;
  year?: number;
}) {
  const [analytics, setAnalytics] = useState<ClusterAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await clusterReportsApi.analytics(params);
      setAnalytics(response.data);
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to fetch analytics");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [JSON.stringify(params)]);

  return { analytics, loading, error, refetch: fetchAnalytics };
}

export function useOverdueClusters() {
  const [overdue, setOverdue] = useState<OverdueClusters | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOverdue = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await clusterReportsApi.overdue();
      setOverdue(response.data);
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to fetch overdue clusters");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOverdue();
  }, []);

  return { overdue, loading, error, refetch: fetchOverdue };
}
