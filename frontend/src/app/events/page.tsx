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
import ConfirmationModal from "@/src/components/ui/ConfirmationModal";
import EventCalendar from "@/src/components/events/EventCalendar";
import EventForm from "@/src/components/events/EventForm";
import EventView from "@/src/components/events/EventView";
import EventsFilterToolbar from "@/src/components/events/EventsFilterToolbar";
import EventAgendaPanel from "@/src/components/events/EventAgendaPanel";
import { Event } from "@/src/types/event";
import { useEvents } from "@/src/hooks/useEvents";
import {
  buildAgendaGroups,
  EventCardItem,
} from "@/src/lib/events/agenda";

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
    loading: boolean;
  }>({
    isOpen: false,
    event: null,
    loading: false,
  });
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
  const currentYear = new Date().getFullYear().toString();

  const {
    events,
    eventTypes,
    loading,
    error,
    createEvent,
    updateEvent,
    deleteEvent,
    getEvent,
    listAttendance,
    addAttendance,
    removeAttendance,
  } = useEvents();

  useEffect(() => {
    if (action === "create") {
      setViewEditEvent(null);
      setViewMode("edit");
      setIsModalOpen(true);
      router.replace(pathname);
    }
  }, [action, pathname, router]);

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

    const yearValue = Number(filterYear);
    if (!Number.isNaN(yearValue)) {
      filtered = filtered.filter((item) => {
        const occurrenceDate = new Date(item.occurrence.start_date);
        return occurrenceDate.getFullYear() === yearValue;
      });
    }

    if (filterMonth !== "all") {
      const month = Number(filterMonth);
      if (!Number.isNaN(month)) {
        filtered = filtered.filter((item) => {
          const occurrenceDate = new Date(item.occurrence.start_date);
          return occurrenceDate.getMonth() === month;
        });
      }
    }

    return filtered.sort((a, b) => {
      const dateA = new Date(a.occurrence.start_date).getTime();
      const dateB = new Date(b.occurrence.start_date).getTime();
      return dateA - dateB;
    });
  }, [debouncedSearchQuery, eventCardItems, filterType, filterMonth, filterYear]);

  const filteredCalendarEvents = useMemo(
    () =>
      baseFilteredItems.map((item) => ({
        start_date: item.occurrence.start_date,
        type: item.event.type,
        type_display: item.event.type_display,
      })),
    [baseFilteredItems]
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
    (error as { response?: { data?: { message?: string } } })?.response?.data
      ?.message || fallback;

  const handleCreateEvent = async (eventData: Partial<Event>) => {
    try {
      const result = await createEvent(eventData);
      setIsModalOpen(false);
      setViewEditEvent(null);
      setViewOccurrenceDate(null);
      const title = result?.title || eventData.title;
      toast.success(
        title ? `Event "${title}" has been created.` : "Event created successfully."
      );
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
      const result = await updateEvent(viewEditEvent.id, eventData);
      setIsModalOpen(false);
      setViewEditEvent(null);
      setViewOccurrenceDate(null);
      setViewMode("edit");
      const title = result?.title || eventData.title || viewEditEvent.title;
      toast.success(
        title ? `Event "${title}" has been updated.` : "Event updated successfully."
      );
      return result;
    } catch (err) {
      console.error(err);
      toast.error(getErrorMessage(err, "Failed to update event. Please try again."));
      throw err;
    }
  };

  const handleDeleteEvent = async () => {
    if (!deleteConfirmation.event) return;

    const eventTitle = deleteConfirmation.event.title;

    try {
      setDeleteConfirmation((prev) => ({ ...prev, loading: true }));
      await deleteEvent(deleteConfirmation.event.id);
      setDeleteConfirmation({
        isOpen: false,
        event: null,
        loading: false,
      });
      setIsModalOpen(false);
      setViewEditEvent(null);
      setViewOccurrenceDate(null);
      toast.success(
        eventTitle
          ? `Event "${eventTitle}" has been deleted.`
          : "Event deleted successfully."
      );
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
      loading: false,
    });
  };

  const handleViewItem = useCallback(
    async (item: EventCardItem) => {
      setViewEditEvent(item.event);
      setViewOccurrenceDate(item.occurrence.start_date);
      setViewMode("view");
      setIsModalOpen(true);
      try {
        await getEvent(item.event.id, { include_attendance: true });
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
  };

  const openCreateModal = () => {
    setViewEditEvent(null);
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
    () => eventTypes.map((t) => ({ value: t.code, label: t.label })),
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
    filterMonth,
    filterYear,
    selectedDate,
    isDefaultDateFilter,
    currentYear,
    eventTypeFilterOptions,
    handleSearchChange,
  ]);

  const showClearAll =
    Boolean(searchQuery) ||
    filterType !== "all" ||
    selectedDate !== null ||
    filterMonth === "all" ||
    filterYear !== currentYear ||
    !isDefaultDateFilter;

  return (
    <DashboardLayout>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold text-foreground">Church Events</h1>
        <Button onClick={openCreateModal} className="w-full sm:w-auto min-h-[44px]">
          Add Event
        </Button>
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
          onCreateEvent={openCreateModal}
        />
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setViewEditEvent(null);
          setViewOccurrenceDate(null);
          setViewMode("edit");
        }}
        title={
          viewMode === "view"
            ? "Event Details"
            : viewEditEvent
              ? "Edit Event"
              : "Create New Event"
        }
        hideHeader={viewMode === "view"}
      >
        {viewMode === "view" && viewEditEvent ? (
          <EventView
            event={viewEditEvent}
            initialOccurrenceDate={viewOccurrenceDate}
            onEdit={() => {
              setViewOccurrenceDate(null);
              setViewMode("edit");
            }}
            onDelete={() => {
              setDeleteConfirmation({
                isOpen: true,
                event: viewEditEvent,
                loading: false,
              });
            }}
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
            initialData={viewEditEvent || undefined}
            presetDate={viewEditEvent ? null : selectedDate}
            onClose={() => {
              setIsModalOpen(false);
              setViewEditEvent(null);
              setViewOccurrenceDate(null);
              setViewMode("edit");
            }}
          />
        )}
      </Modal>

      <ConfirmationModal
        isOpen={deleteConfirmation.isOpen}
        onClose={closeDeleteConfirmation}
        onConfirm={handleDeleteEvent}
        title="Delete Event"
        message={`Are you sure you want to delete "${deleteConfirmation.event?.title}"? This action cannot be undone.`}
        confirmText="Delete Event"
        cancelText="Cancel"
        variant="danger"
        loading={deleteConfirmation.loading}
      />
    </DashboardLayout>
  );
}
