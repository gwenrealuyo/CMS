import { useState, useEffect } from "react";
import { Event } from "@/src/types/event";
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

  const buildCalendarOccurrences = (items: Event[]): CalendarOccurrence[] => {
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
  };

  const applyEvents = (items: Event[]) => {
    setEvents(items);
    setCalendarEvents(buildCalendarOccurrences(items));
  };

  const fetchEvents = async () => {
    try {
      setLoading(true);
      const response = await eventsApi.getAll();
      applyEvents(response.data);
      setError(null);
    } catch (err) {
      console.error("Error fetching events:", err);
      setError("Failed to fetch events");
    } finally {
      setLoading(false);
    }
  };

  const createEvent = async (eventData: Partial<Event>) => {
    try {
      const response = await eventsApi.create(eventData);
      applyEvents([...events, response.data]);
      return response.data;
    } catch (err) {
      throw new Error("Failed to create event");
    }
  };

  const updateEvent = async (id: string, eventData: Partial<Event>) => {
    try {
      const response = await eventsApi.update(id, eventData);
      const updated = events.map((event) =>
        event.id === id ? response.data : event
      );
      applyEvents(updated);
      return response.data;
    } catch (err) {
      throw new Error("Failed to update event");
    }
  };

  const deleteEvent = async (id: string) => {
    try {
      await eventsApi.delete(id);
      const remaining = events.filter((event) => event.id !== id);
      applyEvents(remaining);
    } catch (err) {
      throw new Error("Failed to delete event");
    }
  };

  const excludeOccurrence = async (id: string, date: string) => {
    try {
      const response = await eventsApi.excludeOccurrence(id, { date });
      const updated = events.map((event) =>
        event.id === id ? response.data : event
      );
      applyEvents(updated);
      return response.data;
    } catch (err) {
      throw new Error("Failed to exclude occurrence");
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  return {
    events,
    calendarEvents,
    loading,
    error,
    createEvent,
    updateEvent,
    deleteEvent,
    excludeOccurrence,
    refreshEvents: fetchEvents,
  };
};
