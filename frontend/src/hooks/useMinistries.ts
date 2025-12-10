import { useCallback, useEffect, useMemo, useState } from "react";
import { ministriesApi, ministryMembersApi } from "@/src/lib/api";
import {
  Ministry,
  MinistryCadence,
  MinistryCategory,
  MinistryCreateInput,
  MinistryMember,
  MinistryRole,
} from "@/src/types/ministry";

export interface MinistryFilters {
  search?: string;
  activity_cadence?: MinistryCadence | "all";
  category?: MinistryCategory | "all";
  is_active?: boolean | "all";
}

export const useMinistries = () => {
  const [ministries, setMinistries] = useState<Ministry[]>([]);
  const [filters, setFilters] = useState<MinistryFilters>({
    search: "",
    activity_cadence: "all",
    category: "all",
    is_active: true,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMinistries = useCallback(async () => {
    try {
      setLoading(true);
      const params: Record<string, unknown> = {};
      if (filters.search) params.search = filters.search;
      if (filters.activity_cadence && filters.activity_cadence !== "all") {
        params.activity_cadence = filters.activity_cadence;
      }
      if (filters.category && filters.category !== "all") {
        params.category = filters.category;
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
      prev.map((ministry) =>
        ministry.id === response.data.ministry
          ? {
              ...ministry,
              memberships: [...ministry.memberships, response.data],
            }
          : ministry
      )
    );
    return response.data;
  };

  const updateMember = async (
    id: number | string,
    payload: Partial<MinistryMember>
  ) => {
    const response = await ministryMembersApi.update(id, payload);
    setMinistries((prev) =>
      prev.map((ministry) =>
        ministry.id === response.data.ministry
          ? {
              ...ministry,
              memberships: ministry.memberships.map((member) =>
                member.id === response.data.id ? response.data : member
              ),
            }
          : ministry
      )
    );
    return response.data;
  };

  const removeMember = async (id: number | string) => {
    const existing = ministries
      .flatMap((ministry) =>
        ministry.memberships.map((member) => ({ ministry, member }))
      )
      .find(({ member }) => member.id === Number(id));

    await ministryMembersApi.delete(id);

    if (existing) {
      setMinistries((prev) =>
        prev.map((ministry) =>
          ministry.id === existing.ministry.id
            ? {
                ...ministry,
                memberships: ministry.memberships.filter(
                  (member) => member.id !== existing.member.id
                ),
              }
            : ministry
        )
      );
    }
  };

  useEffect(() => {
    fetchMinistries();
  }, [fetchMinistries]);

  const setFilter = <K extends keyof MinistryFilters>(
    key: K,
    value: MinistryFilters[K]
  ) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

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
