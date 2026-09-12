import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Family } from "@/src/types/person";
import {
  familiesApi,
  type FamiliesListParams,
  type FamiliesSummary,
} from "@/src/lib/api";

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
  const requestIdRef = useRef(0);
  const filtersKey = useMemo(() => JSON.stringify(filters), [filters]);

  useEffect(() => {
    if (!search.trim()) {
      setDebouncedSearch("");
      return;
    }
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

    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;
    const requestId = ++requestIdRef.current;

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

      const response = await familiesApi.list(params, {
        signal: controller.signal,
      });
      if (requestId !== requestIdRef.current || controller.signal.aborted) {
        return;
      }

      const data = response.data;
      setFamilies(data.results ?? []);
      setTotalCount(data.count ?? 0);
    } catch (err: unknown) {
      if (
        requestId !== requestIdRef.current ||
        controller.signal.aborted ||
        (err as { name?: string })?.name === "CanceledError" ||
        (err as { name?: string })?.name === "AbortError"
      ) {
        return;
      }
      setError("Failed to fetch families");
      setFamilies([]);
      setTotalCount(0);
    } finally {
      if (requestId === requestIdRef.current && !controller.signal.aborted) {
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

const EMPTY_FAMILIES_SUMMARY: FamiliesSummary = {
  family_count: 0,
  member_count: 0,
  unassigned_count: 0,
};

export function useFamiliesSummary(options: {
  branch?: string;
  enabled?: boolean;
} = {}) {
  const { branch = "", enabled = true } = options;
  const [summary, setSummary] = useState<FamiliesSummary>(EMPTY_FAMILIES_SUMMARY);
  const abortControllerRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);

  const fetchSummary = useCallback(async () => {
    if (!enabled) {
      setSummary(EMPTY_FAMILIES_SUMMARY);
      return;
    }

    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;
    const requestId = ++requestIdRef.current;

    try {
      const response = await familiesApi.summary(
        branch ? { branch } : undefined,
      );
      if (requestId !== requestIdRef.current || controller.signal.aborted) {
        return;
      }
      setSummary(response.data);
    } catch (err: unknown) {
      if (
        requestId !== requestIdRef.current ||
        controller.signal.aborted ||
        (err as { name?: string })?.name === "CanceledError" ||
        (err as { name?: string })?.name === "AbortError"
      ) {
        return;
      }
      console.error("Failed to load families summary", err);
    }
  }, [enabled, branch]);

  useEffect(() => {
    void fetchSummary();
    return () => {
      abortControllerRef.current?.abort();
    };
  }, [fetchSummary]);

  return { summary, refetch: fetchSummary };
}
