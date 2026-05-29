import { useCallback, useEffect, useRef, useState } from "react";
import { notificationsApi } from "@/src/lib/api";
import { NOTIFICATIONS_REFETCH_EVENT } from "@/src/lib/notificationsEvents";
import { useAuth } from "@/src/contexts/AuthContext";
import { NotificationItem } from "@/src/types/notifications";

const POLL_INTERVAL_MS = 60_000;

export function useNotifications() {
  const { user } = useAuth();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [alertCount, setAlertCount] = useState(0);
  const [activityCount, setActivityCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const enabled = Boolean(user && user.role !== "VISITOR");

  const fetchFeed = useCallback(async () => {
    if (!enabled) {
      setItems([]);
      setUnreadCount(0);
      setAlertCount(0);
      setActivityCount(0);
      return;
    }

    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError(null);

    try {
      const response = await notificationsApi.list();
      if (requestId !== requestIdRef.current) {
        return;
      }
      setItems(response.data.items);
      setUnreadCount(response.data.unread_count);
      setAlertCount(response.data.alert_count);
      setActivityCount(response.data.activity_count);
    } catch {
      if (requestId !== requestIdRef.current) {
        return;
      }
      setError("Failed to load notifications");
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, [enabled]);

  useEffect(() => {
    fetchFeed();
  }, [fetchFeed]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const onRefetch = () => {
      fetchFeed();
    };
    window.addEventListener(NOTIFICATIONS_REFETCH_EVENT, onRefetch);

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        fetchFeed();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        fetchFeed();
      }
    }, POLL_INTERVAL_MS);

    return () => {
      window.removeEventListener(NOTIFICATIONS_REFETCH_EVENT, onRefetch);
      document.removeEventListener("visibilitychange", onVisibility);
      window.clearInterval(interval);
    };
  }, [enabled, fetchFeed]);

  const dismiss = useCallback(
    async (key: string) => {
      try {
        const response = await notificationsApi.dismiss(key);
        setItems(response.data.items);
        setUnreadCount(response.data.unread_count);
        setAlertCount(response.data.alert_count);
        setActivityCount(response.data.activity_count);
      } catch {
        setError("Failed to dismiss notification");
      }
    },
    [],
  );

  const dismissAll = useCallback(async () => {
    try {
      const response = await notificationsApi.dismissAll();
      setItems(response.data.items);
      setUnreadCount(response.data.unread_count);
      setAlertCount(response.data.alert_count);
      setActivityCount(response.data.activity_count);
    } catch {
      setError("Failed to mark notifications as read");
    }
  }, []);

  return {
    enabled,
    items,
    unreadCount,
    alertCount,
    activityCount,
    loading,
    error,
    refetch: fetchFeed,
    dismiss,
    dismissAll,
  };
}
