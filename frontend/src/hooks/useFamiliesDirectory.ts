import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Family } from "@/src/types/person";
import { familiesApi, type FamiliesListParams } from "@/src/lib/api";

export interface UseFamiliesDirectoryOptions {
  search?: string;
  filters?: FamiliesListParams;
  page?: number;
  pageSize?: number;
  ordering?: string;
  enabled?: boolean;
  debounceMs?: number;
}

export interface UseFamiliesDirectoryResult {
  families: Family[];
  totalCount: number;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useFamiliesDirectory(
  options: UseFamiliesDirectoryOptions = {}
): UseFamiliesDirectoryResult {
  const {
    search = "",
    filters = {},
    page = 1,
    pageSize = 25,
    ordering = "name,id",
    enabled = true,
    debounceMs = 300,
  } = options;

  const [families, setFamilies] = useState<Family[]>([]);
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
      setFamilies([]);
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

      const parsedFilters = JSON.parse(filtersKey) as FamiliesListParams;
      const params: FamiliesListParams = {
        ...parsedFilters,
        page,
        page_size: pageSize,
        ordering,
      };
      if (debouncedSearch.trim()) {
        params.search = debouncedSearch.trim();
      }

      const response = await familiesApi.list(params);
      if (abortControllerRef.current.signal.aborted) {
        return;
      }

      const data = response.data;
      setFamilies(data.results ?? []);
      setTotalCount(data.count ?? 0);
    } catch (err: unknown) {
      if (
        abortControllerRef.current?.signal.aborted ||
        (err as { name?: string })?.name === "CanceledError" ||
        (err as { name?: string })?.name === "AbortError"
      ) {
        return;
      }
      setError("Failed to fetch families");
      setFamilies([]);
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
    families,
    totalCount,
    loading,
    error,
    refetch: fetchPage,
  };
}
