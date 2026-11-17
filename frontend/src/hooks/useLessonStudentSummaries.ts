import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { lessonsApi } from "@/src/lib/api";
import {
  PersonProgressSummary,
  ProgressSortField,
} from "@/src/types/lesson";

export interface UseLessonStudentSummariesOptions {
  branchParams?: { branch_id: string } | Record<string, never> | null;
  search?: string;
  teacherKey?: string;
  status?: string;
  nextLessonId?: number | null;
  sortField?: ProgressSortField;
  sortDirection?: "asc" | "desc";
  page?: number;
  pageSize?: number;
  enabled?: boolean;
  debounceMs?: number;
}

export interface UseLessonStudentSummariesResult {
  summaries: PersonProgressSummary[];
  totalCount: number;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

function progressSortToOrdering(
  field: ProgressSortField,
  direction: "asc" | "desc",
): string {
  const prefix = direction === "desc" ? "-" : "";
  const map: Record<ProgressSortField, string> = {
    person: "person",
    teacher: "teacher",
    previousLesson: "previousLesson",
    progress: "progress",
    nextLesson: "nextLesson",
    status: "status",
    recentActivity: "recentActivity",
  };
  return `${prefix}${map[field] ?? "recentActivity"}`;
}

export function useLessonStudentSummaries(
  options: UseLessonStudentSummariesOptions = {},
): UseLessonStudentSummariesResult {
  const {
    branchParams = {},
    search = "",
    teacherKey = "",
    status,
    nextLessonId = null,
    sortField = "recentActivity",
    sortDirection = "desc",
    page = 1,
    pageSize = 25,
    enabled = true,
    debounceMs = 300,
  } = options;

  const [summaries, setSummaries] = useState<PersonProgressSummary[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  const abortRef = useRef<AbortController | null>(null);

  const branchKey = useMemo(() => JSON.stringify(branchParams), [branchParams]);
  const ordering = useMemo(
    () => progressSortToOrdering(sortField, sortDirection),
    [sortField, sortDirection],
  );

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), debounceMs);
    return () => clearTimeout(timer);
  }, [search, debounceMs]);

  const fetchPage = useCallback(async () => {
    if (!enabled || branchParams === null) {
      setSummaries([]);
      setTotalCount(0);
      setLoading(false);
      setError(null);
      return;
    }

    abortRef.current?.abort();
    abortRef.current = new AbortController();

    try {
      setLoading(true);
      setError(null);
      const params: Record<string, unknown> = {
        ...JSON.parse(branchKey),
        page,
        page_size: pageSize,
        ordering,
      };
      const trimmed = debouncedSearch.trim();
      if (trimmed) {
        params.search = trimmed;
      }
      if (teacherKey) {
        if (teacherKey === "no-teacher") {
          params.teacher_key = "no-teacher";
        } else {
          params.teacher_key = teacherKey;
        }
      }
      if (status && status !== "ALL") {
        params.status = status;
      }
      if (nextLessonId != null) {
        params.next_lesson_id = nextLessonId;
      }

      const response = await lessonsApi.getStudentSummaries(
        params as Parameters<typeof lessonsApi.getStudentSummaries>[0],
      );
      if (abortRef.current.signal.aborted) {
        return;
      }
      setSummaries(response.data.results ?? []);
      setTotalCount(response.data.count ?? 0);
    } catch (err: unknown) {
      if (
        abortRef.current?.signal.aborted ||
        (err as { name?: string })?.name === "CanceledError" ||
        (err as { name?: string })?.name === "AbortError"
      ) {
        return;
      }
      setError("Failed to load student progress");
      setSummaries([]);
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
    page,
    pageSize,
    ordering,
    debouncedSearch,
    teacherKey,
    status,
    nextLessonId,
  ]);

  useEffect(() => {
    fetchPage();
    return () => abortRef.current?.abort();
  }, [fetchPage]);

  return {
    summaries,
    totalCount,
    loading,
    error,
    refetch: fetchPage,
  };
}