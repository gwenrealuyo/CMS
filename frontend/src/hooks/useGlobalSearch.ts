import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  peopleApi,
  familiesApi,
  clustersApi,
  eventsApi,
  ministriesApi,
  evangelismApi,
  sundaySchoolApi,
  moduleSettingsApi,
} from "@/src/lib/api";
import { useAuth } from "@/src/contexts/AuthContext";
import { isSelectablePerson } from "@/src/lib/peopleSelectors";
import {
  GLOBAL_SEARCH_ENTITY_ORDER,
  GlobalSearchEntity,
  GlobalSearchResult,
} from "@/src/types/globalSearch";
import { ModuleType } from "@/src/types/moduleSettings";
import {
  GLOBAL_SEARCH_PAGE_SIZE,
  MIN_GLOBAL_SEARCH_LENGTH,
  isEntityEnabled,
  mapClusterToResult,
  mapEventToResult,
  mapEvangelismGroupToResult,
  mapFamilyToResult,
  mapMinistryToResult,
  mapPersonToResult,
  mapProspectToResult,
  mapSundaySchoolClassToResult,
  unwrapList,
} from "@/src/lib/globalSearchUtils";

interface UseGlobalSearchOptions {
  query: string;
  debounceMs?: number;
}

export function useGlobalSearch({
  query,
  debounceMs = 300,
}: UseGlobalSearchOptions) {
  const { user } = useAuth();
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [resultsByEntity, setResultsByEntity] = useState<
    Partial<Record<GlobalSearchEntity, GlobalSearchResult[]>>
  >({});
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<GlobalSearchEntity, string>>>(
    {},
  );
  const [moduleEnabled, setModuleEnabled] = useState<
    Partial<Record<ModuleType, boolean>>
  >({});
  const requestIdRef = useRef(0);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const isAdmin = user?.role === "ADMIN";

  useEffect(() => {
    if (!user) {
      return;
    }
    let cancelled = false;
    moduleSettingsApi
      .getAll()
      .then((response) => {
        if (cancelled) {
          return;
        }
        const next: Partial<Record<ModuleType, boolean>> = {};
        response.data.forEach((setting) => {
          next[setting.module] = setting.is_enabled;
        });
        setModuleEnabled(next);
      })
      .catch(() => {
        // Keep defaults if settings are unavailable.
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, debounceMs);
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [query, debounceMs]);

  const enabledEntities = useMemo(() => {
    return GLOBAL_SEARCH_ENTITY_ORDER.filter((entity) =>
      isEntityEnabled(entity, moduleEnabled, Boolean(isAdmin)),
    );
  }, [moduleEnabled, isAdmin]);

  const runSearch = useCallback(async () => {
    const trimmed = debouncedQuery;
    if (trimmed.length < MIN_GLOBAL_SEARCH_LENGTH) {
      setResultsByEntity({});
      setErrors({});
      setLoading(false);
      return;
    }

    const requestId = ++requestIdRef.current;
    setLoading(true);
    setErrors({});

    const params = { search: trimmed, page: 1, page_size: GLOBAL_SEARCH_PAGE_SIZE };

    type FetchTask = {
      entity: GlobalSearchEntity;
      run: () => Promise<GlobalSearchResult[]>;
    };

    const tasks: FetchTask[] = [];

    if (enabledEntities.includes("person")) {
      tasks.push({
        entity: "person",
        run: async () => {
          const response = await peopleApi.search(params);
          return unwrapList(response.data)
            .filter(isSelectablePerson)
            .map(mapPersonToResult);
        },
      });
    }

    if (enabledEntities.includes("family")) {
      tasks.push({
        entity: "family",
        run: async () => {
          const response = await familiesApi.getAll(params);
          return unwrapList(response.data).map(mapFamilyToResult);
        },
      });
    }

    if (enabledEntities.includes("cluster")) {
      tasks.push({
        entity: "cluster",
        run: async () => {
          const response = await clustersApi.getAll(params);
          return response.data.map(mapClusterToResult);
        },
      });
    }

    if (enabledEntities.includes("event")) {
      tasks.push({
        entity: "event",
        run: async () => {
          const response = await eventsApi.getAll(params);
          return unwrapList(response.data).map(mapEventToResult);
        },
      });
    }

    if (enabledEntities.includes("ministry")) {
      tasks.push({
        entity: "ministry",
        run: async () => {
          const response = await ministriesApi.list(params);
          return unwrapList(response.data).map(mapMinistryToResult);
        },
      });
    }

    if (enabledEntities.includes("evangelism_group")) {
      tasks.push({
        entity: "evangelism_group",
        run: async () => {
          const response = await evangelismApi.listGroups(params);
          return response.data.map(mapEvangelismGroupToResult);
        },
      });
    }

    if (enabledEntities.includes("prospect")) {
      tasks.push({
        entity: "prospect",
        run: async () => {
          const response = await evangelismApi.listProspects(params);
          return unwrapList(response.data).map(mapProspectToResult);
        },
      });
    }

    if (enabledEntities.includes("sunday_school_class")) {
      tasks.push({
        entity: "sunday_school_class",
        run: async () => {
          const response = await sundaySchoolApi.listClasses(params);
          return unwrapList(response.data).map(mapSundaySchoolClassToResult);
        },
      });
    }

    const settled = await Promise.allSettled(
      tasks.map(async (task) => ({
        entity: task.entity,
        results: await task.run(),
      })),
    );

    if (requestId !== requestIdRef.current) {
      return;
    }

    const nextResults: Partial<Record<GlobalSearchEntity, GlobalSearchResult[]>> =
      {};
    const nextErrors: Partial<Record<GlobalSearchEntity, string>> = {};

    settled.forEach((outcome, index) => {
      const entity = tasks[index]?.entity;
      if (!entity) {
        return;
      }
      if (outcome.status === "fulfilled") {
        nextResults[entity] = outcome.value.results;
      } else {
        nextErrors[entity] = "Search failed";
      }
    });

    setResultsByEntity(nextResults);
    setErrors(nextErrors);
    setLoading(false);
  }, [debouncedQuery, enabledEntities]);

  useEffect(() => {
    runSearch();
  }, [runSearch]);

  const flatResults = useMemo(() => {
    const items: GlobalSearchResult[] = [];
    GLOBAL_SEARCH_ENTITY_ORDER.forEach((entity) => {
      const rows = resultsByEntity[entity];
      if (rows?.length) {
        items.push(...rows);
      }
    });
    return items;
  }, [resultsByEntity]);

  const hasQuery = debouncedQuery.length >= MIN_GLOBAL_SEARCH_LENGTH;
  const isEmpty =
    hasQuery &&
    !loading &&
    flatResults.length === 0 &&
    Object.keys(errors).length === 0;

  return {
    resultsByEntity,
    flatResults,
    loading,
    errors,
    hasQuery,
    isEmpty,
    debouncedQuery,
    enabledEntities,
  };
}
