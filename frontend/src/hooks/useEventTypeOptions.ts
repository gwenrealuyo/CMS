import { useCallback, useEffect, useState } from "react";
import { EventTypeOption } from "@/src/types/event";
import { eventTypesApi, eventsApi } from "@/src/lib/api";

export function useEventTypeOptions() {
  const [eventTypes, setEventTypes] = useState<EventTypeOption[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchEventTypes = useCallback(async () => {
    try {
      setLoading(true);
      const response = await eventTypesApi
        .list()
        .catch(() =>
          eventsApi.listTypes().catch(() => ({ data: [] as EventTypeOption[] }))
        );
      setEventTypes(response.data);
      return response.data;
    } catch (error) {
      console.error("Error fetching event types:", error);
      setEventTypes([]);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEventTypes();
  }, [fetchEventTypes]);

  const getLabel = useCallback(
    (code?: string | null) => {
      if (!code) return "";
      return eventTypes.find((type) => type.code === code)?.label ?? code;
    },
    [eventTypes]
  );

  return { eventTypes, loading, getLabel, refresh: fetchEventTypes };
}
