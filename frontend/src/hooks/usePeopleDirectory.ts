import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Person, PersonUI } from "@/src/types/person";
import { peopleApi, type PeopleListParams } from "@/src/lib/api";

export interface UsePeopleDirectoryOptions {
  search?: string;
  filters?: PeopleListParams;
  page?: number;
  pageSize?: number;
  ordering?: string;
  enabled?: boolean;
  debounceMs?: number;
}

export interface UsePeopleDirectoryResult {
  people: Person[];
  peopleUI: PersonUI[];
  totalCount: number;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function usePeopleDirectory(
  options: UsePeopleDirectoryOptions = {}
): UsePeopleDirectoryResult {
  const {
    search = "",
    filters = {},
    page = 1,
    pageSize = 25,
    ordering = "last_name,first_name,id",
    enabled = true,
    debounceMs = 300,
  } = options;

  const [people, setPeople] = useState<Person[]>([]);
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
      setPeople([]);
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

      const parsedFilters = JSON.parse(filtersKey) as PeopleListParams;
      const params: PeopleListParams = {
        ...parsedFilters,
        page,
        page_size: pageSize,
        ordering,
        has_name: true,
        exclude_username: "admin",
      };
      if (debouncedSearch.trim()) {
        params.search = debouncedSearch.trim();
      }

      const response = await peopleApi.list(params);
      if (abortControllerRef.current.signal.aborted) {
        return;
      }

      const data = response.data;
      setPeople(data.results ?? []);
      setTotalCount(data.count ?? 0);
    } catch (err: unknown) {
      if (
        abortControllerRef.current?.signal.aborted ||
        (err as { name?: string })?.name === "CanceledError" ||
        (err as { name?: string })?.name === "AbortError"
      ) {
        return;
      }
      setError("Failed to fetch people");
      setPeople([]);
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

  const peopleUI: PersonUI[] = useMemo(
    () =>
      people.map((p) => ({
        ...p,
        name: `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim(),
        dateFirstAttended: p.date_first_attended,
      })),
    [people]
  );

  return {
    people,
    peopleUI,
    totalCount,
    loading,
    error,
    refetch: fetchPage,
  };
}
