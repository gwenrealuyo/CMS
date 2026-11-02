import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  peopleApi,
  familiesApi,
  clustersApi,
  ministriesApi,
  evangelismApi,
  sundaySchoolApi,
  moduleSettingsApi,
} from "@/src/lib/api";
import { useAuth } from "@/src/contexts/AuthContext";
import { canBrowseProspects } from "@/src/lib/evangelism/evangelismPermissions";
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
  const { user, isSeniorCoordinator } = useAuth();
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
  const canOpenProspects = canBrowseProspects({ user, isSeniorCoordinator });
  const isLessonsTeacher = Boolean(
    user?.module_coordinator_assignments?.some(
      (assignment) =>
        assignment.module === "LESSONS" && assignment.level === "TEACHER",
    ),
  );

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
    return GLOBAL_SEARCH_ENTITY_ORDER.filter((entity) => {
      // NCC / Lessons teachers need prospect preview even when Evangelism is off.
      if (entity === "prospect" && isLessonsTeacher) {
        return true;
      }
      return isEntityEnabled(entity, moduleEnabled, Boolean(isAdmin));
    });
  }, [moduleEnabled, isAdmin, isLessonsTeacher]);

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
    const prospectParams = {
      ...params,
      person_isnull: true as const,
      ...(user?.branch && !user.can_see_all_branches
        ? { branch: user.branch }
        : {}),
    };

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
          return unwrapList(response.data).map(mapEvangelismGroupToResult);
        },
      });
    }

    if (enabledEntities.includes("prospect")) {
      tasks.push({
        entity: "prospect",
        run: async () => {
          const response = await evangelismApi.listProspects(prospectParams);
          return unwrapList(response.data)
            .filter((prospect) => !prospect.person)
            .map((prospect) =>
              mapProspectToResult(prospect, {
                // Teachers and other non-privileged users get preview only.
                canOpen: canOpenProspects,
              }),
            );
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
  }, [debouncedQuery, enabledEntities, user, canOpenProspects]);

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
