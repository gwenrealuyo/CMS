import { useCallback, useEffect, useState } from "react";
import { branchesApi } from "@/src/lib/api";
import { Branch } from "@/src/types/branch";

export const useBranches = () => {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getBranches = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await branchesApi.getAll();
      setBranches(response.data);
    } catch (err) {
      console.error("Failed to fetch branches:", err);
      setError("Failed to load branches");
    } finally {
      setLoading(false);
    }
  }, []);

  const getBranch = useCallback(async (id: number | string) => {
    try {
      setLoading(true);
      setError(null);
      const response = await branchesApi.getById(id);
      return response.data;
    } catch (err) {
      console.error("Failed to fetch branch:", err);
      setError("Failed to load branch");
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const createBranch = useCallback(async (data: Partial<Branch>) => {
    try {
      setLoading(true);
      setError(null);
      const response = await branchesApi.create(data);
      setBranches((prev) =>
        [...prev, response.data].sort((a, b) => a.name.localeCompare(b.name))
      );
      return response.data;
    } catch (err) {
      console.error("Failed to create branch:", err);
      setError("Failed to create branch");
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const updateBranch = useCallback(
    async (id: number | string, data: Partial<Branch>) => {
      try {
        setLoading(true);
        setError(null);
        const response = await branchesApi.patch(id, data);
        setBranches((prev) =>
          prev.map((branch) =>
            branch.id === response.data.id ? response.data : branch
          )
        );
        return response.data;
      } catch (err) {
        console.error("Failed to update branch:", err);
        setError("Failed to update branch");
        throw err;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const deleteBranch = useCallback(async (id: number | string) => {
    try {
      setLoading(true);
      setError(null);
      await branchesApi.delete(id);
      setBranches((prev) => prev.filter((branch) => branch.id !== Number(id)));
    } catch (err) {
      console.error("Failed to delete branch:", err);
      setError("Failed to delete branch");
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    getBranches();
  }, [getBranches]);

  return {
    branches,
    loading,
    error,
    getBranches,
    getBranch,
    createBranch,
    updateBranch,
    deleteBranch,
  };
};



