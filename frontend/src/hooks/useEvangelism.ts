import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useAuth } from "@/src/contexts/AuthContext";
import { evangelismApi } from "@/src/lib/api";
import {
  canChangeEvangelismBranchFilter,
  defaultEvangelismListBranch,
} from "@/src/lib/evangelismBranchFilter";
import {
  EvangelismGroup,
  EvangelismGroupWrite,
  EvangelismSession,
  EvangelismWeeklyReport,
  EvangelismPeopleTallyRow,
  EvangelismTallyRow,
  Prospect,
  FollowUpTask,
  DropOff,
  Conversion,
  MonthlyConversionTracking,
  MonthlyStatistics,
  Each1Reach1Goal,
  EvangelismSummary,
  RecurringSessionData,
  BulkEnrollData,
} from "@/src/types/evangelism";
import { Person } from "@/src/types/person";

export interface EvangelismFilters {
  search?: string;
  cluster?: number | string | "all";
  branch?: number | string | "all";
  is_active?: boolean | "all";
}

function isLikelyAbortError(e: unknown): boolean {
  if (typeof e !== "object" || e === null) return false;
  const code = (e as { code?: string }).code;
  const name = (e as { name?: string }).name;
  return code === "ERR_CANCELED" || name === "CanceledError";
}

export const useEvangelismGroups = () => {
  const { user, isLoading: authLoading, isSeniorCoordinator } = useAuth();
  const canChangeBranch = useMemo(
    () => canChangeEvangelismBranchFilter(user, isSeniorCoordinator),
    [user, isSeniorCoordinator],
  );

  const [groups, setGroups] = useState<EvangelismGroup[]>([]);
  const [filters, setFilters] = useState<EvangelismFilters>({
    search: "",
    cluster: "all",
    branch: "all",
    is_active: true,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const branchUserSyncRef = useRef<number | undefined>(undefined);
  const fetchAbortRef = useRef<AbortController | null>(null);
  const fetchGenRef = useRef(0);

  useLayoutEffect(() => {
    if (!user) {
      branchUserSyncRef.current = undefined;
      return;
    }
    if (branchUserSyncRef.current !== user.id) {
      branchUserSyncRef.current = user.id;
      const next = defaultEvangelismListBranch(user);
      setFilters((prev) => ({ ...prev, branch: next }));
    }
  }, [user]);

  useEffect(() => {
    if (!user || canChangeBranch) return;
    const expected = user.branch;
    if (expected == null) return;
    const cur = filters.branch;
    const curNum =
      cur === "all" || cur === undefined || cur === "" ? null : Number(cur);
    if (curNum !== expected) {
      setFilters((prev) => ({ ...prev, branch: expected }));
    }
  }, [user, canChangeBranch, filters.branch]);

  useEffect(() => {
    if (!authLoading && !user) {
      setGroups([]);
    }
  }, [authLoading, user]);

  useEffect(() => {
    return () => {
      fetchAbortRef.current?.abort();
    };
  }, []);

  const fetchGroups = useCallback(async () => {
    fetchAbortRef.current?.abort();
    const ac = new AbortController();
    fetchAbortRef.current = ac;
    const gen = ++fetchGenRef.current;
    try {
      setLoading(true);
      const params: Record<string, unknown> = {};
      if (filters.search) params.search = filters.search;
      if (filters.cluster && filters.cluster !== "all") {
        params.cluster = filters.cluster;
      }
      if (filters.branch && filters.branch !== "all") {
        params.branch = filters.branch;
      }
      if (filters.is_active !== "all") {
        params.is_active = filters.is_active ?? undefined;
      }

      const response = await evangelismApi.listGroups(params, {
        signal: ac.signal,
      });
      if (gen !== fetchGenRef.current) return;
      setGroups(response.data);
      setError(null);
    } catch (err) {
      if (isLikelyAbortError(err)) return;
      console.error(err);
      if (gen !== fetchGenRef.current) return;
      setError("Failed to load groups");
    } finally {
      if (gen === fetchGenRef.current) {
        setLoading(false);
      }
    }
  }, [filters]);

  useEffect(() => {
    if (authLoading || !user) return;
    fetchGroups();
  }, [fetchGroups, authLoading, user]);

  const createGroup = async (data: EvangelismGroupWrite) => {
    const response = await evangelismApi.createGroup(data);
    setGroups((prev) => [...prev, response.data]);
    return response.data;
  };

  const updateGroup = async (id: number | string, data: EvangelismGroupWrite) => {
    const response = await evangelismApi.updateGroup(id, data);
    setGroups((prev) =>
      prev.map((group) => (group.id === response.data.id ? response.data : group))
    );
    return response.data;
  };

  const deleteGroup = async (id: number | string) => {
    await evangelismApi.deleteGroup(id);
    setGroups((prev) => prev.filter((group) => group.id !== String(id)));
  };

  const bulkEnroll = async (groupId: number | string, payload: BulkEnrollData) => {
    const response = await evangelismApi.enroll(groupId, payload);
    const updatedGroup = await evangelismApi.getGroup(groupId);
    setGroups((prev) =>
      prev.map((group) => (group.id === updatedGroup.data.id ? updatedGroup.data : group))
    );
    return response.data;
  };

  const setFilter = <K extends keyof EvangelismFilters>(
    key: K,
    value: EvangelismFilters[K]
  ) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  return {
    groups,
    loading,
    error,
    filters,
    setFilter,
    fetchGroups,
    createGroup,
    updateGroup,
    deleteGroup,
    bulkEnroll,
  };
};

export const useEvangelismGroup = (id: number | string | null) => {
  const [groupData, setGroupData] = useState<EvangelismGroup | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchGroup = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      const response = await evangelismApi.getGroup(id);
      setGroupData(response.data);
      setError(null);
    } catch (err) {
      console.error(err);
      setError("Failed to load group");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchGroup();
  }, [fetchGroup]);

  return { groupData, loading, error, fetchGroup };
};

export const useEvangelismSessions = (groupId: number | string | null) => {
  const [sessions, setSessions] = useState<EvangelismSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSessions = useCallback(
    async (params?: { date_from?: string; date_to?: string }) => {
      if (!groupId) return;
      try {
        setLoading(true);
        const response = await evangelismApi.getGroupSessions(groupId, params);
        setSessions(response.data);
        setError(null);
      } catch (err) {
        console.error(err);
        setError("Failed to load sessions");
      } finally {
        setLoading(false);
      }
    },
    [groupId]
  );

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const createSession = async (data: Partial<EvangelismSession>) => {
    const response = await evangelismApi.createSession(data);
    setSessions((prev) => [...prev, response.data]);
    return response.data;
  };

  const updateSession = async (id: number | string, data: Partial<EvangelismSession>) => {
    const response = await evangelismApi.updateSession(id, data);
    setSessions((prev) =>
      prev.map((session) => (session.id === response.data.id ? response.data : session))
    );
    return response.data;
  };

  const deleteSession = async (id: number | string) => {
    await evangelismApi.deleteSession(id);
    setSessions((prev) => prev.filter((session) => session.id !== String(id)));
  };

  const createRecurringSessions = async (data: RecurringSessionData) => {
    const response = await evangelismApi.createRecurringSessions(data);
    setSessions((prev) => [...prev, ...response.data.sessions]);
    return response.data;
  };

  return {
    sessions,
    loading,
    error,
    fetchSessions,
    createSession,
    updateSession,
    deleteSession,
    createRecurringSessions,
  };
};

export const useEvangelismWeeklyReports = (groupId: number | string | null) => {
  const [reports, setReports] = useState<EvangelismWeeklyReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchReports = useCallback(
    async (params?: {
      year?: number;
      week_number?: number;
      gathering_type?: string;
    }) => {
      if (!groupId) return;
      try {
        setLoading(true);
        const response = await evangelismApi.listWeeklyReports({
          evangelism_group: groupId,
          ...params,
          page_size: 500,
        });
        const data = response.data;
        const rows = Array.isArray(data) ? data : data.results ?? [];
        setReports(rows);
        setError(null);
      } catch (err) {
        console.error(err);
        setError("Failed to load reports");
      } finally {
        setLoading(false);
      }
    },
    [groupId]
  );

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const createReport = async (data: Partial<EvangelismWeeklyReport>) => {
    const response = await evangelismApi.createWeeklyReport(data);
    setReports((prev) => [response.data, ...prev]);
    return response.data;
  };

  const updateReport = async (
    id: number | string,
    data: Partial<EvangelismWeeklyReport>
  ) => {
    const response = await evangelismApi.updateWeeklyReport(id, data);
    setReports((prev) =>
      prev.map((report) => (report.id === response.data.id ? response.data : report))
    );
    return response.data;
  };

  const deleteReport = async (id: number | string) => {
    await evangelismApi.deleteWeeklyReport(id);
    setReports((prev) => prev.filter((report) => report.id !== String(id)));
  };

  return {
    reports,
    loading,
    error,
    fetchReports,
    createReport,
    updateReport,
    deleteReport,
  };
};

export const useProspects = (filters?: {
  invited_by?: number | string;
  inviter_cluster?: number | string;
  evangelism_group?: number | string;
  pipeline_stage?: string;
  is_dropped_off?: boolean;
}) => {
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Extract individual filter values to use as dependencies
  // This prevents the callback from being recreated when the filters object reference changes
  const invited_by = filters?.invited_by;
  const inviter_cluster = filters?.inviter_cluster;
  const evangelism_group = filters?.evangelism_group;
  const pipeline_stage = filters?.pipeline_stage;
  const is_dropped_off = filters?.is_dropped_off;

  const fetchProspects = useCallback(async () => {
    try {
      setLoading(true);
      // Reconstruct filters object from individual values
      const apiFilters = { invited_by, inviter_cluster, evangelism_group, pipeline_stage, is_dropped_off };
      const response = await evangelismApi.listProspects(apiFilters);
      setProspects(response.data);
      setError(null);
    } catch (err) {
      console.error(err);
      setError("Failed to load prospects");
    } finally {
      setLoading(false);
    }
  }, [invited_by, inviter_cluster, evangelism_group, pipeline_stage, is_dropped_off]);

  useEffect(() => {
    fetchProspects();
  }, [fetchProspects]);

  const createProspect = async (data: Partial<Prospect>) => {
    const response = await evangelismApi.createProspect(data);
    setProspects((prev) => [...prev, response.data]);
    return response.data;
  };

  const updateProspect = async (id: number | string, data: Partial<Prospect>) => {
    const response = await evangelismApi.updateProspect(id, data);
    setProspects((prev) =>
      prev.map((prospect) => (prospect.id === response.data.id ? response.data : prospect))
    );
    return response.data;
  };

  const deleteProspect = async (id: number | string) => {
    await evangelismApi.deleteProspect(id);
    setProspects((prev) => prev.filter((prospect) => prospect.id !== String(id)));
  };

  const markAttended = async (id: number | string, data?: { first_name?: string; last_name?: string }) => {
    const response = await evangelismApi.markAttended(id, data);
    setProspects((prev) =>
      prev.map((prospect) => (prospect.id === response.data.id ? response.data : prospect))
    );
    return response.data;
  };

  const updateProgress = async (
    id: number | string,
    data: { pipeline_stage?: string; last_activity_date?: string }
  ) => {
    const response = await evangelismApi.updateProgress(id, data);
    setProspects((prev) =>
      prev.map((prospect) => (prospect.id === response.data.id ? response.data : prospect))
    );
    return response.data;
  };

  return {
    prospects,
    loading,
    error,
    fetchProspects,
    createProspect,
    updateProspect,
    deleteProspect,
    markAttended,
    updateProgress,
  };
};

export const useConversions = (filters?: {
  converted_by?: number | string;
  cluster?: number | string;
  evangelism_group?: number | string;
  year?: number;
}) => {
  const [conversions, setConversions] = useState<Conversion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Extract individual filter values to use as dependencies
  // This prevents the callback from being recreated when the filters object reference changes
  const converted_by = filters?.converted_by;
  const cluster = filters?.cluster;
  const evangelism_group = filters?.evangelism_group;
  const year = filters?.year;

  const fetchConversions = useCallback(async () => {
    try {
      setLoading(true);
      // Reconstruct filters object from individual values
      const apiFilters = { converted_by, cluster, evangelism_group, year };
      const response = await evangelismApi.listConversions(apiFilters);
      setConversions(response.data);
      setError(null);
    } catch (err) {
      console.error(err);
      setError("Failed to load conversions");
    } finally {
      setLoading(false);
    }
  }, [converted_by, cluster, evangelism_group, year]);

  useEffect(() => {
    fetchConversions();
  }, [fetchConversions]);

  const createConversion = async (data: Partial<Conversion>) => {
    const response = await evangelismApi.createConversion(data);
    setConversions((prev) => [...prev, response.data]);
    return response.data;
  };

  const updateConversion = async (id: number | string, data: Partial<Conversion>) => {
    const response = await evangelismApi.updateConversion(id, data);
    setConversions((prev) =>
      prev.map((conversion) => (conversion.id === response.data.id ? response.data : conversion))
    );
    return response.data;
  };

  const deleteConversion = async (id: number | string) => {
    await evangelismApi.deleteConversion(id);
    setConversions((prev) => prev.filter((conversion) => conversion.id !== String(id)));
  };

  return {
    conversions,
    loading,
    error,
    fetchConversions,
    createConversion,
    updateConversion,
    deleteConversion,
  };
};

export const useEach1Reach1Goals = (filters?: {
  cluster?: number | string;
  cluster__branch?: number | string;
  year?: number;
  status?: string;
  search?: string;
  page_size?: number;
}) => {
  const [goals, setGoals] = useState<Each1Reach1Goal[]>([]);
  const [loading, setLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const requestSeqRef = useRef(0);
  const loadingMoreLockRef = useRef(false);

  // Extract individual filter values to use as dependencies
  // This prevents the callback from being recreated when the filters object reference changes
  const cluster = filters?.cluster;
  const clusterBranch = filters?.cluster__branch;
  const year = filters?.year;
  const status = filters?.status;
  const search = filters?.search;
  const pageSize = filters?.page_size ?? 20;

  const fetchPage = useCallback(
    async (targetPage: number, append: boolean) => {
      const requestSeq = ++requestSeqRef.current;
      try {
        if (append) {
          setIsLoadingMore(true);
        } else {
          setLoading(true);
          setError(null);
        }

        const apiFilters = {
          cluster,
          cluster__branch: clusterBranch,
          year,
          status,
          search,
          page: targetPage,
          page_size: pageSize,
        };
        const response = await evangelismApi.listGoals(apiFilters);
        if (requestSeq !== requestSeqRef.current) {
          return;
        }

        const rows = response.data.results || [];
        setGoals((prev) => (append ? [...prev, ...rows] : rows));
        setPage(targetPage);
        setHasMore(Boolean(response.data.next));
        setError(null);
      } catch (err) {
        if (requestSeq === requestSeqRef.current) {
          console.error(err);
          setError("Failed to load goals");
        }
      } finally {
        if (requestSeq === requestSeqRef.current) {
          setLoading(false);
          setIsLoadingMore(false);
        }
      }
    },
    [cluster, clusterBranch, year, status, search, pageSize]
  );

  const fetchGoals = useCallback(async () => {
    setGoals([]);
    setPage(1);
    setHasMore(false);
    await fetchPage(1, false);
  }, [fetchPage]);

  useEffect(() => {
    fetchGoals();
  }, [fetchGoals]);

  const loadMore = useCallback(async () => {
    if (loading || isLoadingMore || !hasMore || loadingMoreLockRef.current) {
      return;
    }
    loadingMoreLockRef.current = true;
    try {
      await fetchPage(page + 1, true);
    } finally {
      loadingMoreLockRef.current = false;
    }
  }, [fetchPage, hasMore, isLoadingMore, loading, page]);

  const createGoal = async (data: Partial<Each1Reach1Goal>) => {
    const response = await evangelismApi.createGoal(data);
    setGoals((prev) => [...prev, response.data]);
    return response.data;
  };

  const updateGoal = async (id: number | string, data: Partial<Each1Reach1Goal>) => {
    const response = await evangelismApi.updateGoal(id, data);
    setGoals((prev) =>
      prev.map((goal) => (goal.id === response.data.id ? response.data : goal))
    );
    return response.data;
  };

  const deleteGoal = async (id: number | string) => {
    await evangelismApi.deleteGoal(id);
    setGoals((prev) => prev.filter((goal) => goal.id !== String(id)));
  };

  return {
    goals,
    loading,
    isLoadingMore,
    hasMore,
    error,
    page,
    fetchGoals,
    loadMore,
    createGoal,
    updateGoal,
    deleteGoal,
  };
};

export const useEvangelismSummary = (year?: number) => {
  const [summary, setSummary] = useState<EvangelismSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const statsYear = year ?? new Date().getFullYear();

  const fetchSummary = useCallback(async () => {
    try {
      setLoading(true);
      const response = await evangelismApi.getDashboardStats({ year: statsYear });
      setSummary(response.data);
      setError(null);
    } catch (err) {
      console.error(err);
      setError("Failed to load summary");
    } finally {
      setLoading(false);
    }
  }, [statsYear]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  return { summary, loading, error, fetchSummary };
};

export const useMonthlyStatistics = (params?: {
  cluster?: number | string;
  year?: number;
  month?: number;
}) => {
  const [statistics, setStatistics] = useState<MonthlyStatistics[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Extract individual filter values to use as dependencies
  // This prevents the callback from being recreated when the params object reference changes
  const cluster = params?.cluster;
  const year = params?.year;
  const month = params?.month;

  const fetchStatistics = useCallback(async () => {
    try {
      setLoading(true);
      // Reconstruct params object from individual values
      const apiParams = { cluster, year, month };
      const response = await evangelismApi.getMonthlyStatistics(apiParams);
      setStatistics(response.data);
      setError(null);
    } catch (err) {
      console.error(err);
      setError("Failed to load monthly statistics");
    } finally {
      setLoading(false);
    }
  }, [cluster, year, month]);

  useEffect(() => {
    fetchStatistics();
  }, [fetchStatistics]);

  return { statistics, loading, error, fetchStatistics };
};

export const useEvangelismTally = (params?: {
  cluster?: number | string;
  year?: number;
  week_number?: number;
}) => {
  const [rows, setRows] = useState<EvangelismTallyRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cluster = params?.cluster;
  const year = params?.year;
  const week_number = params?.week_number;

  const fetchTally = useCallback(async () => {
    try {
      setLoading(true);
      const response = await evangelismApi.getTally({ cluster, year, week_number });
      setRows(response.data);
      setError(null);
    } catch (err) {
      console.error(err);
      setError("Failed to load tally data");
    } finally {
      setLoading(false);
    }
  }, [cluster, year, week_number]);

  useEffect(() => {
    fetchTally();
  }, [fetchTally]);

  return { rows, loading, error, fetchTally };
};

export const useEvangelismPeopleTally = (params?: {
  year?: number;
  branch?: number | string;
  cluster?: number | string;
  evangelism_group?: number | string;
}) => {
  const [rows, setRows] = useState<EvangelismPeopleTallyRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const year = params?.year;
  const branch = params?.branch;
  const cluster = params?.cluster;
  const evangelism_group = params?.evangelism_group;

  const fetchPeopleTally = useCallback(async () => {
    try {
      setLoading(true);
      const response = await evangelismApi.getPeopleTally({
        year,
        branch,
        cluster,
        evangelism_group,
      });
      setRows(response.data);
      setError(null);
    } catch (err) {
      console.error(err);
      setError("Failed to load people tally");
    } finally {
      setLoading(false);
    }
  }, [year, branch, cluster, evangelism_group]);

  useEffect(() => {
    fetchPeopleTally();
  }, [fetchPeopleTally]);

  return { rows, loading, error, fetchPeopleTally };
};

export const useFollowUpTasks = (filters?: {
  prospect?: number | string;
  assigned_to?: number | string;
  status?: string;
  priority?: string;
}) => {
  const [tasks, setTasks] = useState<FollowUpTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTasks = useCallback(async () => {
    try {
      setLoading(true);
      const response = await evangelismApi.listFollowUpTasks(filters);
      setTasks(response.data);
      setError(null);
    } catch (err) {
      console.error(err);
      setError("Failed to load follow-up tasks");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const createTask = async (data: Partial<FollowUpTask>) => {
    const response = await evangelismApi.createFollowUpTask(data);
    setTasks((prev) => [...prev, response.data]);
    return response.data;
  };

  const updateTask = async (id: number | string, data: Partial<FollowUpTask>) => {
    const response = await evangelismApi.updateFollowUpTask(id, data);
    setTasks((prev) =>
      prev.map((task) => (task.id === response.data.id ? response.data : task))
    );
    return response.data;
  };

  const completeTask = async (id: number | string) => {
    const response = await evangelismApi.completeTask(id);
    setTasks((prev) =>
      prev.map((task) => (task.id === response.data.id ? response.data : task))
    );
    return response.data;
  };

  return {
    tasks,
    loading,
    error,
    fetchTasks,
    createTask,
    updateTask,
    completeTask,
  };
};

export const useDropOffs = (filters?: {
  drop_off_stage?: string;
  reason?: string;
  recovered?: boolean;
}) => {
  const [dropOffs, setDropOffs] = useState<DropOff[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDropOffs = useCallback(async () => {
    try {
      setLoading(true);
      const response = await evangelismApi.listDropOffs(filters);
      setDropOffs(response.data);
      setError(null);
    } catch (err) {
      console.error(err);
      setError("Failed to load drop-offs");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchDropOffs();
  }, [fetchDropOffs]);

  return { dropOffs, loading, error, fetchDropOffs };
};

