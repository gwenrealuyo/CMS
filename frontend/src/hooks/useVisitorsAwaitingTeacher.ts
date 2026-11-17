import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { lessonsApi, unwrapList } from "@/src/lib/api";
import { VisitorAwaitingTeacher } from "@/src/types/lesson";

export interface UseVisitorsAwaitingTeacherOptions {
  branchParams?: { branch_id: string } | Record<string, never> | null;
  search?: string;
  status?: string;
  ordering?: string;
  page?: number;
  pageSize?: number;
  enabled?: boolean;
  debounceMs?: number;
}

export interface UseVisitorsAwaitingTeacherResult {
  visitors: VisitorAwaitingTeacher[];
  totalCount: number;
  loading: boolean;
  error: string | null;
  loaded: boolean;
  refetch: () => void;
  exportAll: () => Promise<VisitorAwaitingTeacher[]>;
}

export function useVisitorsAwaitingTeacher(
  options: UseVisitorsAwaitingTeacherOptions = {},
): UseVisitorsAwaitingTeacherResult {
  const {
    branchParams = {},
    search = "",
    status,
    ordering,
    page = 1,
    pageSize = 10,
    enabled = true,
    debounceMs = 300,
  } = options;

  const [visitors, setVisitors] = useState<VisitorAwaitingTeacher[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  const abortRef = useRef<AbortController | null>(null);

  const branchKey = useMemo(() => JSON.stringify(branchParams), [branchParams]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), debounceMs);
    return () => clearTimeout(timer);
  }, [search, debounceMs]);

  const listParams = useCallback(() => {
    const params: Record<string, unknown> = {
      ...JSON.parse(branchKey),
      page,
      page_size: pageSize,
    };
    const trimmed = debouncedSearch.trim();
    if (trimmed) {
      params.search = trimmed;
    }
    if (status && status !== "ALL") {
      params.status = status;
    }
    if (ordering) {
      params.ordering = ordering;
    }
    return params;
  }, [branchKey, page, pageSize, debouncedSearch, status, ordering]);

  const fetchPage = useCallback(async () => {
    if (!enabled || branchParams === null) {
      setVisitors([]);
      setTotalCount(0);
      setLoading(false);
      setLoaded(false);
      return;
    }

    abortRef.current?.abort();
    abortRef.current = new AbortController();

    try {
      setLoading(true);
      setError(null);
      const response = await lessonsApi.listVisitorsAwaitingTeacher(
        listParams() as Parameters<
          typeof lessonsApi.listVisitorsAwaitingTeacher
        >[0],
      );
      if (abortRef.current.signal.aborted) {
        return;
      }
      const data = response.data;
      const rows = unwrapList(data);
      setVisitors(rows);
      setTotalCount(Array.isArray(data) ? rows.length : (data.count ?? rows.length));
      setLoaded(true);
    } catch (err: unknown) {
      if (abortRef.current?.signal.aborted) {
        return;
      }
      setError("Failed to load visitors awaiting a lessons teacher.");
      setVisitors([]);
      setTotalCount(0);
    } finally {
      if (!abortRef.current?.signal.aborted) {
        setLoading(false);
      }
    }
  }, [enabled, branchParams, listParams]);

  const exportAll = useCallback(async () => {
    const response = await lessonsApi.listVisitorsAwaitingTeacher({
      ...(listParams() as Record<string, unknown>),
      export: true,
    });
    return unwrapList(response.data);
  }, [listParams]);

  useEffect(() => {
    fetchPage();
    return () => abortRef.current?.abort();
  }, [fetchPage]);

  return {
    visitors,
    totalCount,
    loading,
    error,
    loaded,
    refetch: fetchPage,
    exportAll,
  };
}