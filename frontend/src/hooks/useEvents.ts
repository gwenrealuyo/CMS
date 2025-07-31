import { useState, useEffect } from "react";
import { Event } from "@/src/types/event";
import { eventsApi } from "@/src/lib/api";

export const useEvents = () => {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEvents = async () => {
    try {
      setLoading(true);
      const response = await eventsApi.getAll();
      setEvents(response.data);
      setError(null);
    } catch (err) {
      setError("Failed to fetch events");
    } finally {
      setLoading(false);
    }
  };

  const createEvent = async (eventData: Partial<Event>) => {
    try {
      const response = await eventsApi.create(eventData);
      setEvents([...events, response.data]);
      return response.data;
    } catch (err) {
      throw new Error("Failed to create event");
    }
  };

  const updateEvent = async (id: string, eventData: Partial<Event>) => {
    try {
      const response = await eventsApi.update(id, eventData);
      setEvents(
        events.map((event) => (event.id === id ? response.data : event))
      );
      return response.data;
    } catch (err) {
      throw new Error("Failed to update event");
    }
  };

  const deleteEvent = async (id: string) => {
    try {
      await eventsApi.delete(id);
      setEvents(events.filter((event) => event.id !== id));
    } catch (err) {
      throw new Error("Failed to delete event");
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  return {
    events,
    loading,
    error,
    createEvent,
    updateEvent,
    deleteEvent,
    refreshEvents: fetchEvents,
  };
};
