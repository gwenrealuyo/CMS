import { useCallback, useEffect, useState } from "react";
import { eventRoomsApi, EventRoomWrite } from "@/src/lib/api";
import { EventRoom } from "@/src/types/event";

type UseEventRoomsOptions = {
  branchId?: number | null;
  isActive?: boolean;
  enabled?: boolean;
};

function sortRooms(rooms: EventRoom[]) {
  return [...rooms].sort(
    (a, b) =>
      a.sort_order - b.sort_order || a.name.localeCompare(b.name)
  );
}

export function useEventRooms(options: UseEventRoomsOptions = {}) {
  const { branchId, isActive, enabled = true } = options;
  const [rooms, setRooms] = useState<EventRoom[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRooms = useCallback(async () => {
    if (!enabled) {
      setRooms([]);
      return [] as EventRoom[];
    }
    setLoading(true);
    try {
      const params: { branch?: number; is_active?: boolean } = {};
      if (branchId != null) params.branch = branchId;
      if (isActive !== undefined) params.is_active = isActive;
      const response = await eventRoomsApi.list(params);
      const next = sortRooms(response.data);
      setRooms(next);
      setError(null);
      return next;
    } catch (err) {
      console.error("Failed to fetch event rooms:", err);
      setError("Failed to load rooms");
      setRooms([]);
      return [] as EventRoom[];
    } finally {
      setLoading(false);
    }
  }, [branchId, enabled, isActive]);

  const createRoom = useCallback(async (data: EventRoomWrite) => {
    const response = await eventRoomsApi.create(data);
    setRooms((current) => sortRooms([...current, response.data]));
    return response.data;
  }, []);

  const updateRoom = useCallback(
    async (id: number, data: Partial<EventRoomWrite>) => {
      const response = await eventRoomsApi.update(id, data);
      setRooms((current) =>
        sortRooms(
          current.map((room) => (room.id === id ? response.data : room))
        )
      );
      return response.data;
    },
    []
  );

  const deleteRoom = useCallback(async (id: number) => {
    await eventRoomsApi.delete(id);
    setRooms((current) => current.filter((room) => room.id !== id));
  }, []);

  useEffect(() => {
    fetchRooms();
  }, [fetchRooms]);

  return {
    rooms,
    loading,
    error,
    refreshRooms: fetchRooms,
    createRoom,
    updateRoom,
    deleteRoom,
  };
}
