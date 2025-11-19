import { useState, useEffect, useCallback, useRef } from "react";
import { Person } from "@/src/types/person";
import { peopleApi } from "@/src/lib/api";

interface UseSearchablePeopleOptions {
  searchQuery?: string;
  role?: string;
  pageSize?: number;
  debounceMs?: number;
}

interface SearchablePeopleResult {
  people: Person[];
  loading: boolean;
  error: string | null;
  totalCount: number;
  hasMore: boolean;
  currentPage: number;
  fetchNextPage: () => void;
  refetch: () => void;
}

export const useSearchablePeople = (
  options: UseSearchablePeopleOptions = {}
): SearchablePeopleResult => {
  const { searchQuery = "", role, pageSize = 20, debounceMs = 300 } = options;
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchPeople = useCallback(
    async (page: number = 1, search: string = searchQuery, reset: boolean = true) => {
      // Cancel previous request if it exists
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      // Create new abort controller
      abortControllerRef.current = new AbortController();

      try {
        setLoading(true);
        setError(null);

        const params: any = {
          page,
          page_size: pageSize,
        };

        if (search.trim()) {
          params.search = search.trim();
        }

        if (role) {
          params.role = role;
        }

        const response = await peopleApi.search(params);

        // Check if request was aborted
        if (abortControllerRef.current.signal.aborted) {
          return;
        }

        // DRF pagination returns { results, count, next, previous }
        // If no pagination, it returns an array directly
        const data = Array.isArray(response.data) 
          ? { results: response.data, count: response.data.length, next: null, previous: null }
          : response.data;

        if (reset) {
          setPeople(data.results || []);
        } else {
          setPeople((prev) => [...prev, ...(data.results || [])]);
        }

        setTotalCount(data.count || 0);
        setHasMore(!!data.next);
        setCurrentPage(page);
      } catch (err: any) {
        // Don't set error if request was aborted
        if (err.name === "AbortError" || abortControllerRef.current?.signal.aborted) {
          return;
        }
        setError("Failed to fetch people");
        console.error("Error fetching people:", err);
      } finally {
        if (!abortControllerRef.current?.signal.aborted) {
          setLoading(false);
        }
      }
    },
    [searchQuery, role, pageSize]
  );

  // Debounced search effect
  useEffect(() => {
    // Clear existing timeout
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    // Set new timeout for debounced search
    debounceTimeoutRef.current = setTimeout(() => {
      fetchPeople(1, searchQuery, true);
    }, debounceMs);

    // Cleanup
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [searchQuery, role, fetchPeople, debounceMs]);

  const fetchNextPage = useCallback(() => {
    if (!loading && hasMore) {
      fetchPeople(currentPage + 1, searchQuery, false);
    }
  }, [loading, hasMore, currentPage, searchQuery, fetchPeople]);

  const refetch = useCallback(() => {
    fetchPeople(1, searchQuery, true);
  }, [fetchPeople, searchQuery]);

  return {
    people,
    loading,
    error,
    totalCount,
    hasMore,
    currentPage,
    fetchNextPage,
    refetch,
  };
};

