import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { EvangelismGroup } from "@/src/types/evangelism";
import {
  evangelismApi,
  type EvangelismGroupsListParams,
} from "@/src/lib/api";

export interface UseEvangelismGroupsDirectoryOptions {
  search?: string;
  filters?: EvangelismGroupsListParams;
  page?: number;
  pageSize?: number;
  ordering?: string;
  enabled?: boolean;
  debounceMs?: number;
}

export interface UseEvangelismGroupsDirectoryResult {
  groups: EvangelismGroup[];
  totalCount: number;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useEvangelismGroupsDirectory(
  options: UseEvangelismGroupsDirectoryOptions = {},
): UseEvangelismGroupsDirectoryResult {
  const {
    search = "",
    filters = {},
    page = 1,
    pageSize = 25,
    ordering = "name,id",
    enabled = true,
    debounceMs = 300,
  } = options;

  const [groups, setGroups] = useState<EvangelismGroup[]>([]);
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
      setGroups([]);
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

      const parsedFilters = JSON.parse(filtersKey) as EvangelismGroupsListParams;
      const params: EvangelismGroupsListParams = {
        ...parsedFilters,
        page,
        page_size: pageSize,
        ordering,
      };
      if (debouncedSearch.trim()) {
        params.search = debouncedSearch.trim();
      }

      const response = await evangelismApi.listGroups(params, {
        signal: abortControllerRef.current.signal,
      });
      if (abortControllerRef.current.signal.aborted) {
        return;
      }

      const data = response.data;
      setGroups(data.results ?? []);
      setTotalCount(data.count ?? 0);
    } catch (err: unknown) {
      if (
        abortControllerRef.current?.signal.aborted ||
        (err as { name?: string })?.name === "CanceledError" ||
        (err as { name?: string })?.name === "AbortError"
      ) {
        return;
      }
      setError("Failed to fetch evangelism groups");
      setGroups([]);
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
    groups,
    totalCount,
    loading,
    error,
    refetch: fetchPage,
  };
}
