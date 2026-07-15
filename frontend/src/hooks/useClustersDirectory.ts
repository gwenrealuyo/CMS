import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Cluster } from "@/src/types/cluster";
import { clustersApi, type ClustersListParams } from "@/src/lib/api";

export interface UseClustersDirectoryOptions {
  search?: string;
  filters?: ClustersListParams;
  page?: number;
  pageSize?: number;
  ordering?: string;
  enabled?: boolean;
  debounceMs?: number;
}

export interface UseClustersDirectoryResult {
  clusters: Cluster[];
  totalCount: number;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useClustersDirectory(
  options: UseClustersDirectoryOptions = {}
): UseClustersDirectoryResult {
  const {
    search = "",
    filters = {},
    page = 1,
    pageSize = 25,
    ordering = "name,id",
    enabled = true,
    debounceMs = 300,
  } = options;

  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [debouncedSearch, setDebouncedSearch] = useState(search);

  const abortControllerRef = useRef<AbortController | null>(null);
  const filtersKey = useMemo(() => JSON.stringify(filters), [filters]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, debounceMs);
    return () => clearTimeout(timer);
  }, [search, debounceMs]);

  const fetchPage = useCallback(async () => {
    if (!enabled) {
      setClusters([]);
      setTotalCount(0);
      setLoading(false);
      setError(null);
      return;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    try {
      setLoading(true);
      setError(null);

      const parsedFilters = JSON.parse(filtersKey) as ClustersListParams;
      const params: ClustersListParams = {
        ...parsedFilters,
        page,
        page_size: pageSize,
        ordering,
      };
      if (debouncedSearch.trim()) {
        params.search = debouncedSearch.trim();
      }

      const response = await clustersApi.list(params);
      if (abortControllerRef.current.signal.aborted) {
        return;
      }

      const data = response.data;
      setClusters(data.results ?? []);
      setTotalCount(data.count ?? 0);
    } catch (err: unknown) {
      if (
        abortControllerRef.current?.signal.aborted ||
        (err as { name?: string })?.name === "CanceledError" ||
        (err as { name?: string })?.name === "AbortError"
      ) {
        return;
      }
      setError("Failed to fetch clusters");
      setClusters([]);
      setTotalCount(0);
    } finally {
      if (!abortControllerRef.current?.signal.aborted) {
        setLoading(false);
      }
    }
  }, [enabled, filtersKey, page, pageSize, ordering, debouncedSearch]);

  useEffect(() => {
    fetchPage();
    return () => {
      abortControllerRef.current?.abort();
    };
  }, [fetchPage]);

  return {
    clusters,
    totalCount,
    loading,
    error,
    refetch: fetchPage,
  };
}
