import { useCallback, useEffect, useMemo, useState } from "react";
import { ministriesApi, ministryMembersApi } from "@/src/lib/api";
import {
  Ministry,
  MinistryCadence,
  MinistryCategory,
  MinistryCreateInput,
  MinistryMember,
  MinistryRole,
  MinistryScope,
} from "@/src/types/ministry";

export interface MinistryFilters {
  activity_cadence?: MinistryCadence | "all";
  category?: MinistryCategory | "all";
  scope?: MinistryScope | "all";
  /** `null` while waiting for auth/branch default to resolve. */
  branch?: number | "all" | null;
  is_active?: boolean | "all";
}

export const useMinistries = () => {
  const [ministries, setMinistries] = useState<Ministry[]>([]);
  const [filters, setFilters] = useState<MinistryFilters>({
    activity_cadence: "all",
    category: "all",
    scope: "all",
    branch: null,
    is_active: true,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMinistries = useCallback(async () => {
    if (filters.branch === null) {
      return;
    }
    try {
      setLoading(true);
      const params: Record<string, unknown> = {};
      if (filters.activity_cadence && filters.activity_cadence !== "all") {
        params.activity_cadence = filters.activity_cadence;
      }
      if (filters.category && filters.category !== "all") {
        params.category = filters.category;
      }
      if (filters.scope && filters.scope !== "all") {
        params.scope = filters.scope;
      }
      if (filters.branch !== "all") {
        params.branch = filters.branch;
      }
      if (filters.is_active !== "all") {
        params.is_active = filters.is_active ?? undefined;
      }

      const response = await ministriesApi.list(params);
      setMinistries(response.data);
      setError(null);
    } catch (err) {
      console.error(err);
      setError("Failed to load ministries");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  const createMinistry = async (payload: MinistryCreateInput) => {
    const response = await ministriesApi.create(payload);
    setMinistries((prev) =>
      [...prev, response.data].sort((a, b) => a.name.localeCompare(b.name))
    );
    return response.data;
  };

  const updateMinistry = async (
    id: number | string,
    payload: Partial<Ministry>
  ) => {
    const response = await ministriesApi.patch(id, payload);
    setMinistries((prev) =>
      prev.map((ministry) =>
        ministry.id === response.data.id ? response.data : ministry
      )
    );
    return response.data;
  };

  const deleteMinistry = async (id: number | string) => {
    await ministriesApi.delete(id);
    setMinistries((prev) =>
      prev.filter((ministry) => ministry.id !== Number(id))
    );
  };

  const addMember = async (payload: Partial<MinistryMember>) => {
    const response = await ministryMembersApi.create(payload);
    setMinistries((prev) =>
      prev.map((ministry) => {
        if (ministry.id !== response.data.ministry) {
          return ministry;
        }
        const memberships = ministry.memberships;
        return {
          ...ministry,
          memberships: memberships
            ? [...memberships, response.data]
            : memberships,
          member_count:
            (ministry.member_count ?? memberships?.length ?? 0) + 1,
        };
      })
    );
    return response.data;
  };

  const updateMember = async (
    id: number | string,
    payload: Partial<MinistryMember>
  ) => {
    const response = await ministryMembersApi.update(id, payload);
    setMinistries((prev) =>
      prev.map((ministry) => {
        if (ministry.id !== response.data.ministry) {
          return ministry;
        }
        const memberships = ministry.memberships;
        return {
          ...ministry,
          memberships: memberships
            ? memberships.map((member) =>
                member.id === response.data.id ? response.data : member
              )
            : memberships,
        };
      })
    );
    return response.data;
  };

  const removeMember = async (id: number | string) => {
    await ministryMembersApi.delete(id);
    const membershipId = Number(id);
    setMinistries((prev) =>
      prev.map((ministry) => {
        const memberships = ministry.memberships;
        if (!memberships?.some((member) => member.id === membershipId)) {
          return ministry;
        }
        return {
          ...ministry,
          memberships: memberships.filter(
            (member) => member.id !== membershipId
          ),
          member_count: Math.max(
            0,
            (ministry.member_count ?? memberships.length) - 1
          ),
        };
      })
    );
  };

  useEffect(() => {
    fetchMinistries();
  }, [fetchMinistries]);

  const setFilter = useCallback(
    <K extends keyof MinistryFilters>(key: K, value: MinistryFilters[K]) => {
      setFilters((prev) => ({
        ...prev,
        [key]: value,
      }));
    },
    [],
  );

  const cadenceOptions = useMemo(
    () => [
      { label: "All cadences", value: "all" },
      { label: "Weekly", value: "weekly" },
      { label: "Monthly", value: "monthly" },
      { label: "Seasonal", value: "seasonal" },
      { label: "Event Driven", value: "event_driven" },
      { label: "Holiday", value: "holiday" },
      { label: "Ad Hoc", value: "ad_hoc" },
    ],
    []
  );

  const categoryOptions = useMemo(
    () => [
      { label: "All categories", value: "all" },
      { label: "Worship", value: "worship" },
      { label: "Outreach", value: "outreach" },
      { label: "Care", value: "care" },
      { label: "Logistics", value: "logistics" },
      { label: "Other", value: "other" },
    ],
    []
  );

  return {
    ministries,
    loading,
    error,
    filters,
    setFilter,
    cadenceOptions,
    categoryOptions,
    fetchMinistries,
    createMinistry,
    updateMinistry,
    deleteMinistry,
    addMember,
    updateMember,
    removeMember,
  };
};
