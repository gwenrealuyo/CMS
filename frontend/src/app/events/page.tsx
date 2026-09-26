"use client";

import React, {
  useState,
  useMemo,
  useCallback,
  useRef,
  useEffect,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import toast from "react-hot-toast";
import DashboardLayout from "@/src/components/layout/DashboardLayout";
import Button from "@/src/components/ui/Button";
import Modal from "@/src/components/ui/Modal";
import EventCalendar from "@/src/components/events/EventCalendar";
import EventForm from "@/src/components/events/EventForm";
import EventView from "@/src/components/events/EventView";
import EventDeleteModal, {
  EventDeleteScope,
} from "@/src/components/events/EventDeleteModal";
import {
  RecurrenceScope,
  buildScopedEventDraft,
  occurrenceCalendarDate,
  toDateKey,
} from "@/src/lib/events/recurrenceScope";
import EventsFilterToolbar from "@/src/components/events/EventsFilterToolbar";
import EventAgendaPanel from "@/src/components/events/EventAgendaPanel";
import EventTypesManager from "@/src/components/events/EventTypesManager";
import EventRoomsManager from "@/src/components/events/EventRoomsManager";
import { EventTypeStylesProvider } from "@/src/contexts/EventTypeStylesContext";
import { useAuth } from "@/src/contexts/AuthContext";
import { canHardDelete } from "@/src/lib/canHardDelete";
import { Event } from "@/src/types/event";
import { useEvents } from "@/src/hooks/useEvents";
import { useModuleSettings } from "@/src/hooks/useModuleSettings";
import { canManageEventRooms, canWriteEvents, canRequestEventBooking, canApproveEventBooking, canCreateEvent } from "@/src/lib/events/eventPermissions";
import { viewerAttendanceForOccurrence } from "@/src/lib/events/viewerAttendance";
import { formatApiErrorMessage } from "@/src/lib/apiErrors";
import { requestNotificationsRefetch } from "@/src/lib/notificationsEvents";
import {
  buildAgendaGroups,
  EventCardItem,
} from "@/src/lib/events/agenda";

function toLocalDayKey(value?: string | null): string | null {
  if (!value) return null;
  return toDateKey(value);
}

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export default function EventsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const action = searchParams.get("action");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [viewEditEvent, setViewEditEvent] = useState<Event | null>(null);
  const [viewOccurrenceDate, setViewOccurrenceDate] = useState<string | null>(
    null
  );
  const [viewMode, setViewMode] = useState<"view" | "edit">("edit");
  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    isOpen: boolean;
    event: Event | null;
    occurrenceDate: string | null;
    loading: boolean;
  }>({
    isOpen: false,
    event: null,
    occurrenceDate: null,
    loading: false,
  });
  const [editChooser, setEditChooser] = useState<{
    isOpen: boolean;
    event: Event | null;
    occurrenceDate: string | null;
  }>({
    isOpen: false,
    event: null,
    occurrenceDate: null,
  });
  const [editScope, setEditScope] = useState<RecurrenceScope | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [calendarMonthDate, setCalendarMonthDate] = useState<Date>(
    () => new Date()
  );
  const [showCalendar, setShowCalendar] = useState(true);
  const [filterType, setFilterType] = useState<string>("all");
  const [filterMonth, setFilterMonth] = useState<string>(() =>
    new Date().getMonth().toString()
  );
  const [filterYear, setFilterYear] = useState<string>(() =>
    new Date().getFullYear().toString()
  );
  const [yearFilterInitialized, setYearFilterInitialized] = useState(false);
  const [isTypesManagerOpen, setIsTypesManagerOpen] = useState(false);
  const [isRoomsManagerOpen, setIsRoomsManagerOpen] = useState(false);
  const currentYear = new Date().getFullYear().toString();
  const { user, isModuleCoordinator, isSeniorCoordinator } = useAuth();
  const userCanHardDelete = canHardDelete(user);
  const { moduleEnabled } = useModuleSettings();

  const {
    events,
    eventTypes,
    loading,
    error,
    createEvent,
    updateEvent,
    deleteEvent,
    excludeOccurrence,
    endRecurrence,
    splitEdit,
    approveEvent,
    rejectEvent,
    getEvent,
    listAttendance,
    addAttendance,
    removeAttendance,
    createEventType,
    updateEventType,
    deleteEventType,
  } = useEvents();

  const canWriteEventsAccess = useMemo(
    () => canWriteEvents({ user, moduleEnabled }),
    [user, moduleEnabled]
  );
  const canRequestBooking = useMemo(
    () => canRequestEventBooking({ user, moduleEnabled }),
    [user, moduleEnabled]
  );
  const canApproveBookings = useMemo(
    () => canApproveEventBooking({ user, moduleEnabled }),
    [user, moduleEnabled]
  );
  const canCreateEventsAccess = useMemo(
    () => canCreateEvent({ user, moduleEnabled }),
    [user, moduleEnabled]
  );

  const canManageEventTypes = canWriteEventsAccess;
  const canManageRooms = useMemo(
    () => canManageEventRooms({ user, moduleEnabled }),
    [user, moduleEnabled]
  );
  const [filterBooking, setFilterBooking] = useState<string>("all");
  const [reviewLoading, setReviewLoading] = useState(false);

  useEffect(() => {
    if (action === "create" && canCreateEventsAccess) {
      setViewEditEvent(null);
      setViewMode("edit");
      setIsModalOpen(true);
      router.replace(pathname);
    }
  }, [action, pathname, router, canCreateEventsAccess]);

  const pendingBookingCount = useMemo(() => {
    const ids = new Set(
      events
        .filter((event) => event.booking_status === "pending")
        .map((event) => String(event.id))
    );
    return ids.size;
  }, [events]);

  const syncBookingQuery = useCallback(
    (enabled: boolean) => {
      const params = new URLSearchParams(searchParams.toString());
      if (enabled) {
        params.set("booking", "pending");
      } else {
        params.delete("booking");
      }
      const query = params.toString();
      const next = query ? `${pathname}?${query}` : pathname;
      const current = searchParams.toString()
        ? `${pathname}?${searchParams.toString()}`
        : pathname;
      if (next !== current) {
        router.replace(next);
      }
    },
    [pathname, router, searchParams]
  );

  const setPendingQueue = useCallback(
    (enabled: boolean) => {
      setFilterBooking(enabled ? "pending" : "all");
      if (enabled) {
        setSelectedDate(null);
        setFilterMonth("all");
      } else {
        const now = new Date();
        setFilterMonth(now.getMonth().toString());
        setFilterYear(now.getFullYear().toString());
        setCalendarMonthDate(new Date(now.getFullYear(), now.getMonth(), 1));
      }
      syncBookingQuery(enabled);
    },
    [syncBookingQuery]
  );

  useEffect(() => {
    if (searchParams.get("booking") === "pending" && canApproveBookings) {
      setFilterBooking("pending");
      setSelectedDate(null);
      setFilterMonth("all");
    }
  }, [searchParams, canApproveBookings]);

  const handleSearchChange = useCallback((query: string) => {
    setSearchQuery(query);
    setIsSearching(true);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedSearchQuery(query);
      setIsSearching(false);
    }, 300);
  }, []);

  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  const eventCardItems = useMemo<EventCardItem[]>(() => {
    return events.flatMap((event) => {
      if (event.occurrences && event.occurrences.length > 0) {
        return event.occurrences.map((occurrence) => {
          const occurrenceId =
            occurrence.occurrence_id || `${event.id}:${occurrence.start_date}`;
          return {
            id: occurrenceId,
            event,
            occurrence: {
              ...occurrence,
              occurrence_id: occurrenceId,
              event_id: occurrence.event_id ?? event.id,
            },
          };
        });
      }

      const occurrenceId = `${event.id}:${event.start_date}`;
      return [
        {
          id: occurrenceId,
          event,
          occurrence: {
            event_id: event.id,
            occurrence_id: occurrenceId,
            start_date: event.start_date,
            end_date: event.end_date,
            occurrence_date: toDateKey(event.start_date),
            is_base_occurrence: true,
          },
        },
      ];
    });
  }, [events]);

  const baseFilteredItems = useMemo(() => {
    let filtered = eventCardItems;

    if (debouncedSearchQuery) {
      const lowerQuery = debouncedSearchQuery.toLowerCase();
      filtered = filtered.filter((item) => {
        const searchableText = [
          item.event.title,
          item.event.description,
          item.event.location,
          item.event.type_display,
        ]
          .join(" ")
          .toLowerCase();
        return searchableText.includes(lowerQuery);
      });
    }

    if (filterType !== "all") {
      filtered = filtered.filter((item) => item.event.type === filterType);
    }

    if (filterBooking === "pending") {
      filtered = filtered.filter(
        (item) => item.event.booking_status === "pending"
      );
    }

    const yearValue = Number(filterYear);
    if (!Number.isNaN(yearValue)) {
      filtered = filtered.filter((item) => {
        const start = new Date(item.occurrence.start_date);
        const end = new Date(item.occurrence.end_date || item.occurrence.start_date);
        const yearStart = new Date(yearValue, 0, 1);
        const yearEnd = new Date(yearValue + 1, 0, 1);
        return start < yearEnd && end > yearStart;
      });
    }

    if (filterMonth !== "all") {
      const month = Number(filterMonth);
      if (!Number.isNaN(month)) {
        filtered = filtered.filter((item) => {
          const start = new Date(item.occurrence.start_date);
          const end = new Date(
            item.occurrence.end_date || item.occurrence.start_date
          );
          const monthStart = new Date(yearValue, month, 1);
          const monthEnd = new Date(yearValue, month + 1, 1);
          return start < monthEnd && end > monthStart;
        });
      }
    }

    return filtered.sort((a, b) => {
      const dateA = new Date(a.occurrence.start_date).getTime();
      const dateB = new Date(b.occurrence.start_date).getTime();
      return dateA - dateB;
    });
  }, [debouncedSearchQuery, eventCardItems, filterType, filterBooking, filterMonth, filterYear]);

  const filteredCalendarEvents = useMemo(
    () =>
      baseFilteredItems.map((item) => ({
        start_date: item.occurrence.start_date,
        end_date: item.occurrence.end_date,
        type: item.event.type,
        type_display: item.event.type_display,
        viewerPresent: viewerAttendanceForOccurrence(
          item.event,
          user?.id,
          item.occurrence.start_date,
        ).present,
      })),
    [baseFilteredItems, user?.id]
  );

  const agendaGroups = useMemo(() => {
    const yearValue = Number(filterYear);
    const monthDate =
      filterMonth === "all"
        ? null
        : new Date(yearValue, Number(filterMonth), 1);

    return buildAgendaGroups(baseFilteredItems, {
      selectedDate,
      monthDate: selectedDate ? null : monthDate,
      yearOnly:
        selectedDate || filterMonth !== "all" || Number.isNaN(yearValue)
          ? null
          : yearValue,
    });
  }, [baseFilteredItems, selectedDate, filterMonth, filterYear]);

  const isDefaultDateFilter =
    filterMonth === new Date().getMonth().toString() &&
    filterYear === currentYear &&
    filterMonth !== "all";

  const hasActiveFilters =
    Boolean(searchQuery) ||
    filterType !== "all" ||
    filterBooking === "pending" ||
    selectedDate !== null ||
    filterMonth === "all" ||
    filterYear !== currentYear ||
    !isDefaultDateFilter;

  useEffect(() => {
    if (!viewEditEvent) return;
    const updated = events.find((evt) => evt.id === viewEditEvent.id);
    if (updated && updated !== viewEditEvent) {
      setViewEditEvent(updated);
    }
  }, [events, viewEditEvent]);

  const getErrorMessage = (error: unknown, fallback: string) =>
    formatApiErrorMessage(error, fallback);

  const handleCreateEvent = async (eventData: Partial<Event>) => {
    try {
      const result = await createEvent(eventData);
      setIsModalOpen(false);
      setViewEditEvent(null);
      setViewOccurrenceDate(null);
      const title = result?.title || eventData.title;
      toast.success(
        result?.booking_status === "pending"
          ? title
            ? `Booking "${title}" submitted for approval.`
            : "Booking submitted for Events Coordinator approval."
          : title
            ? `Event "${title}" has been created.`
            : "Event created successfully."
      );
      requestNotificationsRefetch();
      return result;
    } catch (err) {
      console.error(err);
      toast.error(getErrorMessage(err, "Failed to create event. Please try again."));
      throw err;
    }
  };

  const handleUpdateEvent = async (eventData: Partial<Event>) => {
    if (!viewEditEvent) return;
    try {
      const occurrenceDate = toLocalDayKey(viewOccurrenceDate);
      let result: Event | { event: Event; created_event: Event } | void;
      if (
        viewEditEvent.is_recurring &&
        (editScope === "occurrence" || editScope === "following")
      ) {
        if (!occurrenceDate) {
          throw new Error("Missing occurrence date");
        }
        result = await splitEdit(viewEditEvent.id, {
          ...eventData,
          scope: editScope,
          date: occurrenceDate,
        });
      } else {
        result = await updateEvent(viewEditEvent.id, eventData);
      }
      setIsModalOpen(false);
      setViewEditEvent(null);
      setViewOccurrenceDate(null);
      setViewMode("edit");
      setEditScope(null);
      const previousStatus = viewEditEvent.booking_status;
      const title =
        (result && "created_event" in result
          ? result.created_event.title
          : result && "title" in result
            ? result.title
            : null) ||
        eventData.title ||
        viewEditEvent.title;
      const updated =
        result && "created_event" in result ? result.created_event : result;
      const nowPending =
        updated &&
        "booking_status" in updated &&
        updated.booking_status === "pending" &&
        previousStatus === "approved";
      toast.success(
        nowPending
          ? title
            ? `Booking "${title}" submitted for approval.`
            : "Booking submitted for Events Coordinator approval."
          : title
            ? `Event "${title}" has been updated.`
            : "Event updated successfully."
      );
      requestNotificationsRefetch();
      return result && "created_event" in result ? result.created_event : result;
    } catch (err) {
      console.error(err);
      toast.error(getErrorMessage(err, "Failed to update event. Please try again."));
      throw err;
    }
  };

  const closeEventModal = () => {
    setIsModalOpen(false);
    setViewEditEvent(null);
    setViewOccurrenceDate(null);
    setViewMode("edit");
    setEditScope(null);
  };

  const handleApproveBooking = async () => {
    if (!viewEditEvent) return;
    try {
      setReviewLoading(true);
      const result = await approveEvent(viewEditEvent.id);
      closeEventModal();
      toast.success(
        result?.title
          ? `Booking "${result.title}" approved.`
          : "Booking approved."
      );
      requestNotificationsRefetch();
    } catch (err) {
      console.error(err);
      toast.error(getErrorMessage(err, "Failed to approve booking."));
    } finally {
      setReviewLoading(false);
    }
  };

  const handleRejectBooking = async () => {
    if (!viewEditEvent) return;
    try {
      setReviewLoading(true);
      const result = await rejectEvent(viewEditEvent.id);
      closeEventModal();
      toast.success(
        result?.title
          ? `Booking "${result.title}" rejected.`
          : "Booking rejected."
      );
      requestNotificationsRefetch();
    } catch (err) {
      console.error(err);
      toast.error(getErrorMessage(err, "Failed to reject booking."));
    } finally {
      setReviewLoading(false);
    }
  };

  const viewedEvent = useMemo(() => {
    if (!viewEditEvent) return null;
    return (
      events.find((event) => String(event.id) === String(viewEditEvent.id)) ??
      viewEditEvent
    );
  }, [events, viewEditEvent]);

  const isOwnViewEvent = Boolean(
    viewedEvent && user && viewedEvent.created_by === user.id
  );
  const canEditViewEvent =
    Boolean(viewEditEvent) &&
    (canWriteEventsAccess || (canRequestBooking && isOwnViewEvent));
  const canDeleteViewEvent =
    Boolean(viewEditEvent) &&
    (userCanHardDelete ||
      (Boolean(viewEditEvent?.is_recurring) && canWriteEventsAccess) ||
      (canRequestBooking &&
        isOwnViewEvent &&
        viewEditEvent?.booking_status === "pending"));

  const handleConfirmDelete = async (scope: EventDeleteScope) => {
    if (!deleteConfirmation.event) return;

    const target = deleteConfirmation.event;
    const eventTitle = target.title;
    const occurrenceDate =
      toLocalDayKey(deleteConfirmation.occurrenceDate);

    try {
      setDeleteConfirmation((prev) => ({ ...prev, loading: true }));
      if (scope === "occurrence") {
        if (!occurrenceDate) {
          throw new Error("Missing occurrence date");
        }
        await excludeOccurrence(target.id, occurrenceDate);
        toast.success(
          eventTitle
            ? `Removed "${eventTitle}" for that date.`
            : "Occurrence removed."
        );
      } else if (scope === "following") {
        if (!occurrenceDate) {
          throw new Error("Missing occurrence date");
        }
        await endRecurrence(target.id, occurrenceDate);
        toast.success(
          eventTitle
            ? `Ended "${eventTitle}" from that date.`
            : "Series ended from this date."
        );
      } else {
        await deleteEvent(target.id);
        toast.success(
          eventTitle
            ? `Event "${eventTitle}" has been deleted.`
            : "Event deleted successfully."
        );
      }
      setDeleteConfirmation({
        isOpen: false,
        event: null,
        occurrenceDate: null,
        loading: false,
      });
      setIsModalOpen(false);
      setViewEditEvent(null);
      setViewOccurrenceDate(null);
    } catch (error) {
      console.error("Error deleting event:", error);
      toast.error(
        getErrorMessage(error, "Failed to delete event. Please try again.")
      );
      setDeleteConfirmation((prev) => ({ ...prev, loading: false }));
    }
  };

  const closeDeleteConfirmation = () => {
    setDeleteConfirmation({
      isOpen: false,
      event: null,
      occurrenceDate: null,
      loading: false,
    });
  };

  const handleViewItem = useCallback(
    async (item: EventCardItem) => {
      setViewEditEvent(item.event);
      setViewOccurrenceDate(
        occurrenceCalendarDate(item.occurrence) ||
          item.occurrence.start_date
      );
      setViewMode("view");
      setIsModalOpen(true);
      try {
        const fresh = await getEvent(item.event.id, {
          include_attendance: true,
        });
        setViewEditEvent(fresh);
      } catch (error) {
        console.error("Failed to load event details", error);
      }
    },
    [getEvent]
  );

  const handleDateClick = (date: Date) => {
    if (
      selectedDate &&
      selectedDate.getDate() === date.getDate() &&
      selectedDate.getMonth() === date.getMonth() &&
      selectedDate.getFullYear() === date.getFullYear()
    ) {
      setSelectedDate(null);
    } else {
      setSelectedDate(date);
    }
  };

  const handleMonthChange = useCallback(
    (date: Date) => {
      const nextMonth = date.getMonth();
      const nextYear = date.getFullYear();
      if (
        calendarMonthDate.getMonth() === nextMonth &&
        calendarMonthDate.getFullYear() === nextYear
      ) {
        return;
      }

      setCalendarMonthDate(date);
      setSelectedDate(null);
      setFilterYear(date.getFullYear().toString());
      if (filterMonth !== "all") {
        setFilterMonth(date.getMonth().toString());
      }
    },
    [calendarMonthDate, filterMonth]
  );

  const handleMonthFilterChange = (monthValue: string) => {
    if (monthValue === "all") {
      setFilterMonth("all");
      setSelectedDate(null);
      return;
    }
    const month = Number(monthValue);
    if (Number.isNaN(month)) return;
    setFilterMonth(monthValue);
    setCalendarMonthDate(new Date(Number(filterYear), month, 1));
    setSelectedDate(null);
  };

  const handleYearFilterChange = (yearValue: string) => {
    const year = Number(yearValue);
    if (Number.isNaN(year)) return;
    setFilterYear(yearValue);
    const month =
      filterMonth !== "all" ? Number(filterMonth) : calendarMonthDate.getMonth();
    setCalendarMonthDate(new Date(year, month, 1));
    setSelectedDate(null);
  };

  const clearMonthFilter = () => {
    const now = new Date();
    setFilterMonth(now.getMonth().toString());
    setFilterYear(now.getFullYear().toString());
    setCalendarMonthDate(new Date(now.getFullYear(), now.getMonth(), 1));
    setSelectedDate(null);
  };

  const clearYearFilter = () => {
    const now = new Date();
    setFilterYear(now.getFullYear().toString());
    const month =
      filterMonth !== "all" ? Number(filterMonth) : calendarMonthDate.getMonth();
    setCalendarMonthDate(
      new Date(now.getFullYear(), month, 1)
    );
    setSelectedDate(null);
  };

  const clearDateFilter = () => {
    setSelectedDate(null);
  };

  const clearTypeFilter = () => {
    setFilterType("all");
  };

  const clearAllFilters = () => {
    setSearchQuery("");
    setDebouncedSearchQuery("");
    setFilterType("all");
    setSelectedDate(null);
    const now = new Date();
    setFilterMonth(now.getMonth().toString());
    setFilterYear(now.getFullYear().toString());
    setCalendarMonthDate(new Date(now.getFullYear(), now.getMonth(), 1));
    if (filterBooking === "pending") {
      setPendingQueue(false);
    } else {
      setFilterBooking("all");
    }
  };

  const openCreateModal = () => {
    setViewEditEvent(null);
    setEditScope(null);
    setViewMode("edit");
    setIsModalOpen(true);
  };

  const eventTypeFilterOptions = useMemo(
    () => [
      { value: "all", label: "All Events" },
      ...eventTypes.map((t) => ({ value: t.code, label: t.label })),
    ],
    [eventTypes]
  );

  const eventFormTypeOptions = useMemo(
    () =>
      eventTypes.map((t) => ({
        value: t.code,
        label: t.label,
        counts_as_activity: t.counts_as_activity,
      })),
    [eventTypes]
  );

  const availableYears = useMemo(() => {
    const years = new Set<number>();

    eventCardItems.forEach((item) => {
      const year = new Date(item.occurrence.start_date).getFullYear();
      if (!Number.isNaN(year)) {
        years.add(year);
      }
    });

    if (years.size === 0) {
      return [Number(currentYear)];
    }

    return Array.from(years).sort((a, b) => b - a);
  }, [eventCardItems, currentYear]);

  useEffect(() => {
    if (!yearFilterInitialized) {
      if (availableYears.includes(Number(currentYear))) {
        setFilterYear(currentYear);
        setYearFilterInitialized(true);
      } else if (availableYears.length > 0) {
        setFilterYear(availableYears[0].toString());
        setYearFilterInitialized(true);
      }
    } else if (
      !availableYears.includes(Number(filterYear)) &&
      availableYears.length > 0
    ) {
      const nextYear = availableYears.includes(Number(currentYear))
        ? Number(currentYear)
        : availableYears[0];
      setFilterYear(nextYear.toString());
    }
  }, [availableYears, currentYear, filterYear, yearFilterInitialized]);

  useEffect(() => {
    const year = Number(filterYear);
    if (Number.isNaN(year)) return;
    if (calendarMonthDate.getFullYear() !== year) {
      const month =
        filterMonth !== "all"
          ? Number(filterMonth)
          : calendarMonthDate.getMonth();
      setCalendarMonthDate(new Date(year, month, 1));
    }
  }, [calendarMonthDate, filterMonth, filterYear]);

  const monthFilterOptions = useMemo(
    () => [
      { value: "all", label: "All Months" },
      ...MONTH_NAMES.map((label, index) => ({
        value: index.toString(),
        label,
      })),
    ],
    []
  );

  const yearFilterOptions = useMemo(
    () =>
      availableYears.map((year) => ({
        value: year.toString(),
        label: year.toString(),
      })),
    [availableYears]
  );

  const filterChips = useMemo(() => {
    const chips: { id: string; label: string; onRemove: () => void }[] = [];

    if (searchQuery) {
      chips.push({
        id: "search",
        label: `Search: ${searchQuery}`,
        onRemove: () => handleSearchChange(""),
      });
    }

    if (filterType !== "all") {
      chips.push({
        id: "type",
        label: `Type: ${
          eventTypeFilterOptions.find((opt) => opt.value === filterType)
            ?.label ?? filterType
        }`,
        onRemove: clearTypeFilter,
      });
    }

    if (filterBooking === "pending") {
      chips.push({
        id: "booking",
        label: "Pending approval",
        onRemove: () => setPendingQueue(false),
      });
    }

    if (filterMonth === "all") {
      chips.push({
        id: "month",
        label: "Month: All Months",
        onRemove: clearMonthFilter,
      });
    } else if (filterMonth !== "all" && !isDefaultDateFilter) {
      chips.push({
        id: "month",
        label: `Month: ${MONTH_NAMES[Number(filterMonth)]}`,
        onRemove: clearMonthFilter,
      });
    }

    if (filterYear !== currentYear) {
      chips.push({
        id: "year",
        label: `Year: ${filterYear}`,
        onRemove: clearYearFilter,
      });
    }

    if (selectedDate) {
      chips.push({
        id: "date",
        label: `Date: ${selectedDate.toLocaleDateString()}`,
        onRemove: clearDateFilter,
      });
    }

    return chips;
  }, [
    searchQuery,
    filterType,
    filterBooking,
    filterMonth,
    filterYear,
    selectedDate,
    isDefaultDateFilter,
    currentYear,
    eventTypeFilterOptions,
    handleSearchChange,
    setPendingQueue,
  ]);

  const showClearAll =
    Boolean(searchQuery) ||
    filterType !== "all" ||
    filterBooking !== "all" ||
    selectedDate !== null ||
    filterMonth === "all" ||
    filterYear !== currentYear ||
    !isDefaultDateFilter;

  return (
    <EventTypeStylesProvider types={eventTypes}>
      <DashboardLayout>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold text-foreground">Church Events</h1>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          {canApproveBookings && (
            <Button
              variant={filterBooking === "pending" ? "primary" : "tertiary"}
              onClick={() => setPendingQueue(filterBooking !== "pending")}
              aria-pressed={filterBooking === "pending"}
              className="w-full sm:w-auto min-h-[44px]"
            >
              {pendingBookingCount > 0
                ? `Manage Pending (${pendingBookingCount})`
                : "Manage Pending"}
            </Button>
          )}
          {canManageRooms && (
            <Button
              variant="tertiary"
              onClick={() => setIsRoomsManagerOpen(true)}
              className="w-full sm:w-auto min-h-[44px]"
            >
              Manage Rooms
            </Button>
          )}
          {canManageEventTypes && (
            <Button
              variant="tertiary"
              onClick={() => setIsTypesManagerOpen(true)}
              className="w-full sm:w-auto min-h-[44px]"
            >
              Manage Types
            </Button>
          )}
          {canCreateEventsAccess && (
            <Button onClick={openCreateModal} className="w-full sm:w-auto min-h-[44px]">
              Add Event
            </Button>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg mb-6">
          {error}
        </div>
      )}

      <EventsFilterToolbar
        searchQuery={searchQuery}
        onSearchChange={handleSearchChange}
        filterType={filterType}
        typeOptions={eventTypeFilterOptions}
        onTypeChange={setFilterType}
        filterBooking={filterBooking}
        filterMonth={filterMonth}
        monthOptions={monthFilterOptions}
        onMonthChange={handleMonthFilterChange}
        filterYear={filterYear}
        yearOptions={yearFilterOptions}
        onYearChange={handleYearFilterChange}
        chips={filterChips}
        onClearAll={clearAllFilters}
        isSearching={isSearching}
        showClearAll={showClearAll}
        resultCount={baseFilteredItems.length}
        totalCount={eventCardItems.length}
      />

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(320px,420px)] xl:grid-cols-[minmax(0,1fr)_minmax(340px,480px)] gap-4 lg:gap-6 lg:items-start">
        <div className="min-w-0">
          <div className="flex items-center mb-3 gap-2 lg:hidden">
            <h2 className="text-lg font-semibold text-gray-700">Calendar</h2>
            <Button
              variant="tertiary"
              onClick={() => setShowCalendar((prev) => !prev)}
              className="flex items-center gap-1 text-xs !px-2 !py-1 min-h-[44px]"
              aria-expanded={showCalendar}
            >
              <svg
                className={`w-4 h-4 transition-transform ${
                  showCalendar ? "rotate-90" : "rotate-0"
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </Button>
          </div>
          {!showCalendar && (
            <div className="lg:hidden mb-3 text-xs text-gray-500">
              Calendar hidden. Tap the arrow to show it.
            </div>
          )}
          <div className={showCalendar ? "block" : "hidden lg:block"}>
            <EventCalendar
              events={filteredCalendarEvents}
              currentMonthDate={calendarMonthDate}
              onDateClick={handleDateClick}
              onMonthChange={handleMonthChange}
              selectedDate={selectedDate}
            />
          </div>
        </div>

        <EventAgendaPanel
          groups={agendaGroups}
          loading={loading}
          hasActiveFilters={hasActiveFilters}
          selectedDate={selectedDate}
          onView={handleViewItem}
          onClearDate={clearDateFilter}
          onCreateEvent={canCreateEventsAccess ? openCreateModal : undefined}
        />
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setViewEditEvent(null);
          setViewOccurrenceDate(null);
          setViewMode("edit");
          setEditScope(null);
        }}
        title={
          viewMode === "view"
            ? "Event Details"
            : viewEditEvent
              ? "Edit Event"
              : "Create New Event"
        }
        hideHeader={viewMode === "view"}
        closeOnOutsideClick={viewMode === "view"}
      >
        {viewMode === "view" && viewedEvent ? (
          <EventView
            event={viewedEvent}
            initialOccurrenceDate={viewOccurrenceDate}
            showAuditMetadata={canWriteEventsAccess}
            canManageAttendance={canWriteEventsAccess}
            canManageRegistration={user?.role === "ADMIN"}
            onEdit={
              canEditViewEvent
                ? ({ occurrenceDate }) => {
                    if (viewedEvent.is_recurring && canWriteEventsAccess) {
                      setViewOccurrenceDate(occurrenceDate);
                      setEditChooser({
                        isOpen: true,
                        event: viewedEvent,
                        occurrenceDate,
                      });
                      return;
                    }
                    setEditScope(null);
                    setViewOccurrenceDate(occurrenceDate);
                    setViewMode("edit");
                  }
                : undefined
            }
            onDelete={
              canDeleteViewEvent
                ? ({ occurrenceDate }) => {
                    setDeleteConfirmation({
                      isOpen: true,
                      event: viewedEvent,
                      occurrenceDate,
                      loading: false,
                    });
                  }
                : undefined
            }
            onApprove={
              canApproveBookings && viewedEvent.booking_status === "pending"
                ? handleApproveBooking
                : undefined
            }
            onReject={
              canApproveBookings && viewedEvent.booking_status === "pending"
                ? handleRejectBooking
                : undefined
            }
            reviewLoading={reviewLoading}
            onCancel={() => {
              setIsModalOpen(false);
              setViewEditEvent(null);
              setViewOccurrenceDate(null);
              setViewMode("edit");
            }}
            onClose={() => {
              setIsModalOpen(false);
              setViewEditEvent(null);
              setViewOccurrenceDate(null);
              setViewMode("edit");
            }}
            listAttendance={listAttendance}
            addAttendance={addAttendance}
            removeAttendance={removeAttendance}
          />
        ) : (
          <EventForm
            eventTypeOptions={eventFormTypeOptions}
            onSubmit={viewEditEvent ? handleUpdateEvent : handleCreateEvent}
            initialData={
              viewEditEvent
                ? editScope && viewEditEvent.is_recurring
                  ? buildScopedEventDraft(
                      viewEditEvent,
                      editScope,
                      viewOccurrenceDate
                    )
                  : viewEditEvent
                : undefined
            }
            presetDate={viewEditEvent ? null : selectedDate}
            lockRecurrence={editScope === "occurrence"}
            scopeHint={
              editScope === "occurrence"
                ? "Editing this occurrence only. Other weeks of the series will not change."
                : editScope === "following"
                  ? "Editing this date and later weeks. Earlier weeks stay as they are."
                  : editScope === "series"
                    ? "Editing the entire series."
                    : undefined
            }
            existingEvents={events}
            ignoreOccurrenceDate={
              editScope === "occurrence"
                ? toLocalDayKey(viewOccurrenceDate)
                : null
            }
            ignoreDatesGte={
              editScope === "following"
                ? toLocalDayKey(viewOccurrenceDate)
                : null
            }
            isBookingRequest={canRequestBooking && !canWriteEventsAccess}
            onClose={() => {
              setIsModalOpen(false);
              setViewEditEvent(null);
              setViewOccurrenceDate(null);
              setViewMode("edit");
              setEditScope(null);
            }}
          />
        )}
      </Modal>

      <EventDeleteModal
        isOpen={deleteConfirmation.isOpen}
        event={deleteConfirmation.event}
        occurrenceDate={deleteConfirmation.occurrenceDate}
        canDeleteSeries={canWriteEventsAccess || userCanHardDelete}
        canEditSeries={canWriteEventsAccess}
        onClose={closeDeleteConfirmation}
        onConfirm={handleConfirmDelete}
        loading={deleteConfirmation.loading}
      />

      <EventDeleteModal
        mode="edit"
        isOpen={editChooser.isOpen}
        event={editChooser.event}
        occurrenceDate={editChooser.occurrenceDate}
        canDeleteSeries={false}
        canEditSeries={canWriteEventsAccess}
        onClose={() =>
          setEditChooser({
            isOpen: false,
            event: null,
            occurrenceDate: null,
          })
        }
        onConfirm={(scope: RecurrenceScope) => {
          setEditScope(scope);
          setViewOccurrenceDate(editChooser.occurrenceDate);
          setEditChooser({
            isOpen: false,
            event: null,
            occurrenceDate: null,
          });
          setViewMode("edit");
        }}
      />

      {canManageEventTypes && (
        <EventTypesManager
          isOpen={isTypesManagerOpen}
          onClose={() => setIsTypesManagerOpen(false)}
          onCreate={createEventType}
          onUpdate={updateEventType}
          onDelete={userCanHardDelete ? deleteEventType : undefined}
        />
      )}
      {canManageRooms && (
        <EventRoomsManager
          isOpen={isRoomsManagerOpen}
          onClose={() => setIsRoomsManagerOpen(false)}
        />
      )}
    </DashboardLayout>
    </EventTypeStylesProvider>
  );
}
