import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { lessonsApi } from "@/src/lib/api";
import { LessonTimelinePayload } from "@/src/types/lesson";

export type LessonTimelineFilterMode =
  | "follow-up"
  | "finished"
  | "dropped"
  | "all";

export interface UseLessonTimelineOptions {
  branchParams?: { branch_id: string } | Record<string, never> | null;
  search?: string;
  filterMode?: LessonTimelineFilterMode;
  ordering?: string;
  page?: number;
  pageSize?: number;
  enabled?: boolean;
  debounceMs?: number;
}

export interface UseLessonTimelineResult {
  timeline: LessonTimelinePayload | null;
  totalCount: number;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useLessonTimeline(
  options: UseLessonTimelineOptions = {},
): UseLessonTimelineResult {
  const {
    branchParams = {},
    search = "",
    filterMode = "follow-up",
    ordering,
    page = 1,
    pageSize = 10,
    enabled = true,
    debounceMs = 300,
  } = options;

  const [timeline, setTimeline] = useState<LessonTimelinePayload | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  const abortRef = useRef<AbortController | null>(null);

  const branchKey = useMemo(() => JSON.stringify(branchParams), [branchParams]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), debounceMs);
    return () => clearTimeout(timer);
  }, [search, debounceMs]);

  const fetchPage = useCallback(async () => {
    if (!enabled || branchParams === null) {
      setTimeline(null);
      setTotalCount(0);
      setLoading(false);
      return;
    }

    abortRef.current?.abort();
    abortRef.current = new AbortController();

    try {
      setLoading(true);
      setError(null);
      const params: Record<string, unknown> = {
        ...JSON.parse(branchKey),
        filter_mode: filterMode,
        page,
        page_size: pageSize,
      };
      const trimmed = debouncedSearch.trim();
      if (trimmed) {
        params.search = trimmed;
      }
      if (ordering) {
        params.ordering = ordering;
      }

      const response = await lessonsApi.getTimeline(
        params as Parameters<typeof lessonsApi.getTimeline>[0],
      );
      if (abortRef.current.signal.aborted) {
        return;
      }
      const payload = response.data;
      setTimeline(payload);
      setTotalCount(
        payload.count ?? payload.results?.length ?? payload.students?.length ?? 0,
      );
    } catch (err: unknown) {
      if (abortRef.current?.signal.aborted) {
        return;
      }
      setError("Failed to load the lessons timeline");
      setTimeline(null);
      setTotalCount(0);
    } finally {
      if (!abortRef.current?.signal.aborted) {
        setLoading(false);
      }
    }
  }, [
    enabled,
    branchParams,
    branchKey,
    filterMode,
    ordering,
    page,
    pageSize,
    debouncedSearch,
  ]);

  useEffect(() => {
    fetchPage();
    return () => abortRef.current?.abort();
  }, [fetchPage]);

  return { timeline, totalCount, loading, error, refetch: fetchPage };
}