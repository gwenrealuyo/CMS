import { useState, useEffect, useCallback, useRef } from "react";
import { Person, PersonUI } from "@/src/types/person";
import { familiesApi } from "@/src/lib/api";

export interface UseUnassignedPeopleOptions {
  search?: string;
  page?: number;
  pageSize?: number;
  enabled?: boolean;
  debounceMs?: number;
}

export function useUnassignedPeople(options: UseUnassignedPeopleOptions = {}) {
  const {
    search = "",
    page = 1,
    pageSize = 20,
    enabled = true,
    debounceMs = 300,
  } = options;

  const [people, setPeople] = useState<Person[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), debounceMs);
    return () => clearTimeout(timer);
  }, [search, debounceMs]);

  const fetchPage = useCallback(async () => {
    if (!enabled) {
      setPeople([]);
      setTotalCount(0);
      setLoading(false);
      return;
    }

    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();

    try {
      setLoading(true);
      setError(null);
      const response = await familiesApi.unassignedPeople({
        search: debouncedSearch.trim() || undefined,
        page,
        page_size: pageSize,
      });
      if (abortControllerRef.current.signal.aborted) return;
      setPeople(response.data.results ?? []);
      setTotalCount(response.data.count ?? 0);
    } catch (err: unknown) {
      if (
        abortControllerRef.current?.signal.aborted ||
        (err as { name?: string })?.name === "CanceledError" ||
        (err as { name?: string })?.name === "AbortError"
      ) {
        return;
      }
      setError("Failed to fetch unassigned people");
      setPeople([]);
      setTotalCount(0);
    } finally {
      if (!abortControllerRef.current?.signal.aborted) {
        setLoading(false);
      }
    }
  }, [enabled, debouncedSearch, page, pageSize]);

  useEffect(() => {
    fetchPage();
    return () => abortControllerRef.current?.abort();
  }, [fetchPage]);

  const peopleUI: PersonUI[] = people.map((p) => ({
    ...p,
    name: `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim(),
    dateFirstAttended: p.date_first_attended,
  }));

  return {
    people,
    peopleUI,
    totalCount,
    loading,
    error,
    refetch: fetchPage,
  };
}
