import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { lessonsApi, unwrapList } from "@/src/lib/api";
import { SessionFilterValues, sanitizeNumericValue } from "@/src/lib/lessonsUtils";
import { LessonSessionReport } from "@/src/types/lesson";
import { compareSessionReportsByStartThenLessonOrder } from "@/src/lib/sessionTopic";

export interface UseLessonSessionReportsOptions {
  branchParams?: { branch_id: string } | Record<string, never> | null;
  filters: SessionFilterValues;
  page?: number;
  pageSize?: number;
  enabled?: boolean;
}

export interface UseLessonSessionReportsResult {
  reports: LessonSessionReport[];
  totalCount: number;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

function sessionFilterParams(
  filters: SessionFilterValues,
  branchParams: Record<string, unknown>,
  page: number,
  pageSize: number,
): Record<string, unknown> {
  const params: Record<string, unknown> = {
    ...branchParams,
    page,
    page_size: pageSize,
  };

  const lessonValue = sanitizeNumericValue(filters.lessonId);
  if (lessonValue) {
    params.lesson = lessonValue;
  }
  const teacherValue = sanitizeNumericValue(filters.teacherId);
  if (teacherValue) {
    params.teacher = teacherValue;
  }
  const studentValue = sanitizeNumericValue(filters.studentId);
  if (studentValue) {
    params.student = studentValue;
  }

  const monthValue = sanitizeNumericValue(filters.month);
  const yearValue = sanitizeNumericValue(filters.year);
  if (yearValue && monthValue && monthValue >= 1 && monthValue <= 12) {
    const start = new Date(yearValue, monthValue - 1, 1);
    const end = new Date(yearValue, monthValue, 0);
    params.date_from = start.toISOString().slice(0, 10);
    params.date_to = end.toISOString().slice(0, 10);
  } else if (yearValue) {
    const start = new Date(yearValue, 0, 1);
    const end = new Date(yearValue, 11, 31);
    params.date_from = start.toISOString().slice(0, 10);
    params.date_to = end.toISOString().slice(0, 10);
  }

  return params;
}

export function useLessonSessionReports(
  options: UseLessonSessionReportsOptions,
): UseLessonSessionReportsResult {
  const {
    branchParams = {},
    filters,
    page = 1,
    pageSize = 10,
    enabled = true,
  } = options;

  const [reports, setReports] = useState<LessonSessionReport[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const filtersKey = useMemo(() => JSON.stringify(filters), [filters]);
  const branchKey = useMemo(() => JSON.stringify(branchParams), [branchParams]);

  const fetchPage = useCallback(async () => {
    if (!enabled || branchParams === null) {
      setReports([]);
      setTotalCount(0);
      setLoading(false);
      return;
    }

    abortRef.current?.abort();
    abortRef.current = new AbortController();

    try {
      setLoading(true);
      setError(null);
      const params = sessionFilterParams(
        JSON.parse(filtersKey) as SessionFilterValues,
        JSON.parse(branchKey) as Record<string, unknown>,
        page,
        pageSize,
      );
      const response = await lessonsApi.listSessionReports(
        params as Parameters<typeof lessonsApi.listSessionReports>[0],
      );
      if (abortRef.current.signal.aborted) {
        return;
      }
      const data = response.data;
      const rows = unwrapList(data);
      const sorted = [...rows].sort(compareSessionReportsByStartThenLessonOrder);
      setReports(sorted);
      setTotalCount(Array.isArray(data) ? rows.length : (data.count ?? rows.length));
    } catch (err: unknown) {
      if (
        abortRef.current?.signal.aborted ||
        (err as { name?: string })?.name === "CanceledError"
      ) {
        return;
      }
      setError("Failed to load session reports");
      setReports([]);
      setTotalCount(0);
    } finally {
      if (!abortRef.current?.signal.aborted) {
        setLoading(false);
      }
    }
  }, [enabled, branchParams, branchKey, filtersKey, page, pageSize]);

  useEffect(() => {
    fetchPage();
    return () => abortRef.current?.abort();
  }, [fetchPage]);

  return { reports, totalCount, loading, error, refetch: fetchPage };
}