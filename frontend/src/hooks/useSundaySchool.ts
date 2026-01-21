import { useCallback, useEffect, useMemo, useState } from "react";
import { sundaySchoolApi } from "@/src/lib/api";
import {
  SundaySchoolCategory,
  SundaySchoolClass,
  SundaySchoolClassMember,
  SundaySchoolSession,
  SundaySchoolSummary,
  UnenrolledByCategory,
  AttendanceReport,
  RecurringSessionData,
} from "@/src/types/sundaySchool";

export interface SundaySchoolFilters {
  search?: string;
  category?: number | string | "all";
  is_active?: boolean | "all";
}

export const useSundaySchoolCategories = () => {
  const [categories, setCategories] = useState<SundaySchoolCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCategories = useCallback(async () => {
    try {
      setLoading(true);
      const response = await sundaySchoolApi.listCategories({ is_active: true });
      setCategories(response.data);
      setError(null);
    } catch (err) {
      console.error(err);
      setError("Failed to load categories");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const createCategory = async (data: Partial<SundaySchoolCategory>) => {
    const response = await sundaySchoolApi.createCategory(data);
    setCategories((prev) => [...prev, response.data].sort((a, b) => a.order - b.order));
    return response.data;
  };

  const updateCategory = async (id: number | string, data: Partial<SundaySchoolCategory>) => {
    const response = await sundaySchoolApi.updateCategory(id, data);
    setCategories((prev) =>
      prev.map((cat) => (cat.id === response.data.id ? response.data : cat))
    );
    return response.data;
  };

  const deleteCategory = async (id: number | string) => {
    await sundaySchoolApi.deleteCategory(id);
    setCategories((prev) => prev.filter((cat) => cat.id !== Number(id)));
  };

  return {
    categories,
    loading,
    error,
    fetchCategories,
    createCategory,
    updateCategory,
    deleteCategory,
  };
};

export const useSundaySchoolClasses = () => {
  const [classes, setClasses] = useState<SundaySchoolClass[]>([]);
  const [filters, setFilters] = useState<SundaySchoolFilters>({
    search: "",
    category: "all",
    is_active: true,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchClasses = useCallback(async () => {
    try {
      setLoading(true);
      const params: Record<string, unknown> = {};
      if (filters.search) params.search = filters.search;
      if (filters.category && filters.category !== "all") {
        params.category = filters.category;
      }
      if (filters.is_active !== "all") {
        params.is_active = filters.is_active ?? undefined;
      }

      const response = await sundaySchoolApi.listClasses(params);
      setClasses(response.data);
      setError(null);
    } catch (err) {
      console.error(err);
      setError("Failed to load classes");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  const createClass = async (data: Partial<SundaySchoolClass>) => {
    const response = await sundaySchoolApi.createClass(data);
    setClasses((prev) => [...prev, response.data]);
    return response.data;
  };

  const updateClass = async (id: number | string, data: Partial<SundaySchoolClass>) => {
    const response = await sundaySchoolApi.updateClass(id, data);
    setClasses((prev) =>
      prev.map((cls) => (cls.id === response.data.id ? response.data : cls))
    );
    return response.data;
  };

  const deleteClass = async (id: number | string) => {
    await sundaySchoolApi.deleteClass(id);
    setClasses((prev) => prev.filter((cls) => cls.id !== Number(id)));
  };

  const bulkEnroll = async (
    classId: number | string,
    personIds: number[],
    role: string
  ) => {
    const response = await sundaySchoolApi.enroll(classId, {
      person_ids: personIds,
      role,
    });
    // Refresh the class to get updated members
    const updatedClass = await sundaySchoolApi.getClass(classId);
    setClasses((prev) =>
      prev.map((cls) => (cls.id === updatedClass.data.id ? updatedClass.data : cls))
    );
    return response.data;
  };

  useEffect(() => {
    fetchClasses();
  }, [fetchClasses]);

  const setFilter = <K extends keyof SundaySchoolFilters>(
    key: K,
    value: SundaySchoolFilters[K]
  ) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  return {
    classes,
    loading,
    error,
    filters,
    setFilter,
    fetchClasses,
    createClass,
    updateClass,
    deleteClass,
    bulkEnroll,
  };
};

export const useSundaySchoolClass = (id: number | string | null) => {
  const [classData, setClassData] = useState<SundaySchoolClass | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchClass = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      const response = await sundaySchoolApi.getClass(id);
      setClassData(response.data);
      setError(null);
    } catch (err) {
      console.error(err);
      setError("Failed to load class");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchClass();
  }, [fetchClass]);

  return { classData, loading, error, fetchClass };
};

export const useSundaySchoolSessions = (classId: number | string | null) => {
  const [sessions, setSessions] = useState<SundaySchoolSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSessions = useCallback(
    async (params?: { date_from?: string; date_to?: string }) => {
      if (!classId) return;
      try {
        setLoading(true);
        const response = await sundaySchoolApi.getClassSessions(classId, params);
        setSessions(response.data);
        setError(null);
      } catch (err) {
        console.error(err);
        setError("Failed to load sessions");
      } finally {
        setLoading(false);
      }
    },
    [classId]
  );

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const createSession = async (data: Partial<SundaySchoolSession>) => {
    const response = await sundaySchoolApi.createSession(data);
    setSessions((prev) => [...prev, response.data]);
    return response.data;
  };

  const updateSession = async (id: number | string, data: Partial<SundaySchoolSession>) => {
    const response = await sundaySchoolApi.updateSession(id, data);
    setSessions((prev) =>
      prev.map((session) => (session.id === response.data.id ? response.data : session))
    );
    return response.data;
  };

  const deleteSession = async (id: number | string) => {
    await sundaySchoolApi.deleteSession(id);
    setSessions((prev) => prev.filter((session) => session.id !== Number(id)));
  };

  return {
    sessions,
    loading,
    error,
    fetchSessions,
    createSession,
    updateSession,
    deleteSession,
  };
};

export const useSundaySchoolSummary = () => {
  const [summary, setSummary] = useState<SundaySchoolSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSummary = useCallback(async () => {
    try {
      setLoading(true);
      const response = await sundaySchoolApi.summary();
      setSummary(response.data);
      setError(null);
    } catch (err) {
      console.error(err);
      setError("Failed to load summary");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  return { summary, loading, error, fetchSummary };
};

export const useSundaySchoolUnenrolledByCategory = (filters?: {
  status?: string;
  role?: string;
}) => {
  const [unenrolled, setUnenrolled] = useState<UnenrolledByCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchUnenrolled = useCallback(async () => {
    try {
      setLoading(true);
      const response = await sundaySchoolApi.unenrolledByCategory(filters);
      setUnenrolled(response.data);
      setError(null);
    } catch (err) {
      console.error(err);
      setError("Failed to load unenrolled students");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchUnenrolled();
  }, [fetchUnenrolled]);

  return { unenrolled, loading, error, fetchUnenrolled };
};

export const useSundaySchoolAttendanceReport = (
  sessionId: number | string | null
) => {
  const [report, setReport] = useState<AttendanceReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchReport = useCallback(async () => {
    if (!sessionId) return;
    try {
      setLoading(true);
      const response = await sundaySchoolApi.getSessionAttendanceReport(sessionId);
      setReport(response.data);
      setError(null);
    } catch (err) {
      console.error(err);
      setError("Failed to load attendance report");
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  return { report, loading, error, fetchReport };
};

export const useCreateRecurringSessions = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createRecurring = async (data: RecurringSessionData) => {
    try {
      setLoading(true);
      const response = await sundaySchoolApi.createRecurringSessions(data);
      setError(null);
      return response.data;
    } catch (err) {
      console.error(err);
      setError("Failed to create recurring sessions");
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { createRecurring, loading, error };
};

