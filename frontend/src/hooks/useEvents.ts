import { useState, useEffect, useCallback } from "react";
import {
  Event,
  EventAttendanceRecord,
  AttendanceStatus,
} from "@/src/types/event";
import { eventsApi } from "@/src/lib/api";

interface CalendarOccurrence {
  occurrence_id: string;
  event_id: string;
  start_date: string;
  end_date: string;
  is_base_occurrence: boolean;
  title: string;
  description: string;
  type: Event["type"];
  type_display: string;
  location: string;
  is_recurring: boolean;
}

export const useEvents = () => {
  const [events, setEvents] = useState<Event[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<CalendarOccurrence[]>(
    []
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const buildCalendarOccurrences = useCallback(
    (items: Event[]): CalendarOccurrence[] => {
      return items.flatMap((event) => {
        if (!event.occurrences || event.occurrences.length === 0) {
          return [
            {
              occurrence_id: `${event.id}:${event.start_date}`,
              event_id: event.id,
              start_date: event.start_date,
              end_date: event.end_date,
              is_base_occurrence: true,
              title: event.title,
              description: event.description,
              type: event.type,
              type_display: event.type_display,
              location: event.location,
              is_recurring: event.is_recurring,
            },
          ];
        }

        return event.occurrences.map((occurrence) => ({
          occurrence_id: occurrence.occurrence_id,
          event_id: String(occurrence.event_id ?? event.id),
          start_date: occurrence.start_date,
          end_date: occurrence.end_date,
          is_base_occurrence: occurrence.is_base_occurrence,
          title: event.title,
          description: event.description,
          type: event.type,
          type_display: event.type_display,
          location: event.location,
          is_recurring: event.is_recurring,
        }));
      });
    },
    []
  );

  const applyEvents = useCallback(
    (items: Event[]) => {
      setEvents(items);
      setCalendarEvents(buildCalendarOccurrences(items));
    },
    [buildCalendarOccurrences]
  );

  const fetchEvents = useCallback(
    async (params?: Parameters<typeof eventsApi.getAll>[0]) => {
      try {
        setLoading(true);
        const response = await eventsApi.getAll(params);
        applyEvents(response.data);
        setError(null);
      } catch (err) {
        console.error("Error fetching events:", err);
        setError("Failed to fetch events");
      } finally {
        setLoading(false);
      }
    },
    [applyEvents]
  );

  const findAndReplaceEvent = useCallback(
    (next: Event) => {
      setEvents((current) => {
        const updated = current.some((event) => event.id === next.id)
          ? current.map((event) => (event.id === next.id ? next : event))
          : [...current, next];
        setCalendarEvents(buildCalendarOccurrences(updated));
        return updated;
      });
    },
    [buildCalendarOccurrences]
  );

  const createEvent = useCallback(
    async (eventData: Partial<Event>) => {
      try {
        const response = await eventsApi.create(eventData);
        findAndReplaceEvent(response.data);
        return response.data;
      } catch (err) {
        throw new Error("Failed to create event");
      }
    },
    [findAndReplaceEvent]
  );

  const updateEvent = useCallback(
    async (id: string, eventData: Partial<Event>) => {
      try {
        const response = await eventsApi.update(id, eventData);
        findAndReplaceEvent(response.data);
        return response.data;
      } catch (err) {
        throw new Error("Failed to update event");
      }
    },
    [findAndReplaceEvent]
  );

  const deleteEvent = useCallback(
    async (id: string) => {
      try {
        await eventsApi.delete(id);
        setEvents((current) => {
          const remaining = current.filter((event) => event.id !== id);
          setCalendarEvents(buildCalendarOccurrences(remaining));
          return remaining;
        });
      } catch (err) {
        throw new Error("Failed to delete event");
      }
    },
    [buildCalendarOccurrences]
  );

  const excludeOccurrence = useCallback(
    async (id: string, date: string) => {
      try {
        const response = await eventsApi.excludeOccurrence(id, { date });
        findAndReplaceEvent(response.data);
        return response.data;
      } catch (err) {
        throw new Error("Failed to exclude occurrence");
      }
    },
    [findAndReplaceEvent]
  );

  const getEvent = useCallback(
    async (
      id: string,
      params?: { include_attendance?: boolean; attendance_date?: string }
    ) => {
      try {
        const response = await eventsApi.getById(id, params);
        findAndReplaceEvent(response.data);
        return response.data;
      } catch (err) {
        throw new Error("Failed to fetch event details");
      }
    },
    [findAndReplaceEvent]
  );

  const listAttendance = useCallback(
    async (id: string, params?: { occurrence_date?: string }) => {
      const response = await eventsApi.listAttendance(id, params);
      return response.data;
    },
    []
  );

  const addAttendance = useCallback(
    async (
      id: string,
      payload: {
        person_id: string;
        occurrence_date: string;
        status?: AttendanceStatus;
        notes?: string;
      }
    ) => {
      const response = await eventsApi.addAttendance(id, payload);
      const { event } = response.data;
      findAndReplaceEvent(event);
      return response.data;
    },
    [findAndReplaceEvent]
  );

  const removeAttendance = useCallback(
    async (id: string, attendanceId: number | string) => {
      const response = await eventsApi.removeAttendance(id, attendanceId);
      findAndReplaceEvent(response.data.event);
      return response.data;
    },
    [findAndReplaceEvent]
  );

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  return {
    events,
    calendarEvents,
    loading,
    error,
    createEvent,
    updateEvent,
    deleteEvent,
    excludeOccurrence,
    getEvent,
    listAttendance,
    addAttendance,
    removeAttendance,
    refreshEvents: fetchEvents,
  };
};
