"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BellIcon } from "@heroicons/react/24/outline";
import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
} from "@heroicons/react/24/solid";
import { useNotifications } from "@/src/hooks/useNotifications";
import {
  NotificationItem,
  NotificationSeverity,
} from "@/src/types/notifications";

function formatRelativeTime(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffMinutes = Math.round(diffMs / 60_000);
  const diffHours = Math.round(diffMinutes / 60);
  const diffDays = Math.round(diffHours / 24);

  if (Math.abs(diffMinutes) < 1) {
    return "Just now";
  }
  if (Math.abs(diffMinutes) < 60) {
    return new Intl.RelativeTimeFormat(undefined, { numeric: "auto" }).format(
      diffMinutes,
      "minute",
    );
  }
  if (Math.abs(diffHours) < 24) {
    return new Intl.RelativeTimeFormat(undefined, { numeric: "auto" }).format(
      diffHours,
      "hour",
    );
  }
  return new Intl.RelativeTimeFormat(undefined, { numeric: "auto" }).format(
    diffDays,
    "day",
  );
}

function SeverityIcon({ severity }: { severity: NotificationSeverity }) {
  if (severity === "success") {
    return <CheckCircleIcon className="h-5 w-5 text-green-500 shrink-0" />;
  }
  if (severity === "warning") {
    return (
      <ExclamationTriangleIcon className="h-5 w-5 text-amber-500 shrink-0" />
    );
  }
  return <InformationCircleIcon className="h-5 w-5 text-primary shrink-0" />;
}

function NotificationRow({
  item,
  onSelect,
}: {
  item: NotificationItem;
  onSelect: (item: NotificationItem) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(item)}
      className="w-full text-left px-4 py-3 hover:bg-gray-50 min-h-[44px] flex gap-3 items-start"
    >
      <SeverityIcon severity={item.severity} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-gray-900">{item.title}</p>
        <p className="text-xs text-gray-600 mt-0.5">{item.body}</p>
        <p className="text-xs text-gray-400 mt-1">
          {formatRelativeTime(item.occurred_at)}
        </p>
      </div>
    </button>
  );
}

function NotificationSection({
  title,
  items,
  emptyMessage,
  onSelect,
}: {
  title: string;
  items: NotificationItem[];
  emptyMessage: string;
  onSelect: (item: NotificationItem) => void;
}) {
  if (items.length === 0) {
    return (
      <div className="px-4 py-3 text-sm text-gray-500">{emptyMessage}</div>
    );
  }

  return (
    <div>
      <p className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
        {title}
      </p>
      {items.map((item) => (
        <NotificationRow key={item.key} item={item} onSelect={onSelect} />
      ))}
    </div>
  );
}

export default function NotificationBell() {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const {
    enabled,
    items,
    unreadCount,
    loading,
    error,
    refetch,
    dismiss,
    dismissAll,
  } = useNotifications();

  const { alerts, activities } = useMemo(() => {
    const alertItems: NotificationItem[] = [];
    const activityItems: NotificationItem[] = [];
    for (const item of items) {
      if (item.category === "activity") {
        activityItems.push(item);
      } else {
        alertItems.push(item);
      }
    }
    return { alerts: alertItems, activities: activityItems };
  }, [items]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (open) {
      refetch();
    }
  }, [open, refetch]);

  if (!enabled) {
    return null;
  }

  const handleSelect = async (item: NotificationItem) => {
    setOpen(false);
    if (item.category === "alert") {
      await dismiss(item.key);
    }
    router.push(item.href);
  };

  const handleDismissAll = async () => {
    await dismissAll();
  };

  const badgeLabel =
    unreadCount > 99 ? "99+" : unreadCount > 0 ? String(unreadCount) : undefined;

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="p-2 rounded-full hover:bg-gray-100 relative min-w-[44px] min-h-[44px] flex items-center justify-center"
        aria-label="Notifications"
        aria-expanded={open}
        aria-haspopup="true"
      >
        <BellIcon className="h-6 w-6 text-gray-600" />
        {badgeLabel && (
          <span
            className="absolute top-0.5 right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-semibold flex items-center justify-center"
            aria-live="polite"
          >
            {badgeLabel}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-2rem)] bg-white rounded-lg shadow-lg border z-50 flex flex-col max-h-[min(24rem,70vh)]">
          <div className="px-4 py-2 border-b flex items-center justify-between gap-2">
            <h3 className="font-semibold text-gray-900">Notifications</h3>
            {items.length > 0 && (
              <button
                type="button"
                onClick={handleDismissAll}
                className="text-xs text-primary hover:text-primary whitespace-nowrap"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="overflow-y-auto flex-1">
            {loading && items.length === 0 && (
              <div className="px-4 py-6 text-sm text-gray-500 text-center">
                Loading…
              </div>
            )}
            {error && (
              <div className="px-4 py-3 text-sm text-red-600">{error}</div>
            )}
            {!loading && items.length === 0 && !error && (
              <div className="px-4 py-6 text-sm text-gray-500 text-center">
                You&apos;re all caught up
              </div>
            )}
            {(alerts.length > 0 || activities.length > 0) && (
              <NotificationSection
                title="Needs attention"
                items={alerts}
                emptyMessage="Nothing needs your attention"
                onSelect={handleSelect}
              />
            )}
            {activities.length > 0 && (
              <>
                <hr className="border-gray-100" />
                <NotificationSection
                  title="Recent activity"
                  items={activities}
                  emptyMessage="No recent activity"
                  onSelect={handleSelect}
                />
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
