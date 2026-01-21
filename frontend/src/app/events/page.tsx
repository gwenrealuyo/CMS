"use client";

import React, {
  useState,
  useMemo,
  useCallback,
  useRef,
  useEffect,
} from "react";
import DashboardLayout from "@/src/components/layout/DashboardLayout";
import Button from "@/src/components/ui/Button";
import Modal from "@/src/components/ui/Modal";
import ConfirmationModal from "@/src/components/ui/ConfirmationModal";
import EventCalendar from "@/src/components/events/EventCalendar";
import EventCard from "@/src/components/events/EventCard";
import EventForm from "@/src/components/events/EventForm";
import EventView from "@/src/components/events/EventView";
import { Event, EventOccurrence } from "@/src/types/event";
import { useEvents } from "@/src/hooks/useEvents";

type EventCardItem = {
  id: string;
  event: Event;
  occurrence: EventOccurrence;
};

export default function EventsPage() {
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
  const [filterMonth, setFilterMonth] = useState<string>(
    () => new Date().getMonth().toString()
  );
  const [showCalendar, setShowCalendar] = useState(true);
  const [filterType, setFilterType] = useState<string>("all");
  const [filterYear, setFilterYear] = useState<string>("all");
  const [yearFilterInitialized, setYearFilterInitialized] = useState(false);
  const currentYear = new Date().getFullYear().toString();
  const isMonthFilterDefault =
    filterMonth !== "all" &&
    Number(filterMonth) === calendarMonthDate.getMonth();
  const shouldShowMonthBadge = filterMonth !== "all";
  const monthNames = [
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

  const {
    events,
    calendarEvents,
    loading,
    error,
    createEvent,
    updateEvent,
    deleteEvent,
    refreshEvents,
    getEvent,
    listAttendance,
    addAttendance,
    removeAttendance,
  } = useEvents();

  // Debounced search for better performance
  const handleSearchChange = useCallback((query: string) => {
    setSearchQuery(query);
    setIsSearching(true);

    // Clear existing timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // Set new timeout for debounced search
    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedSearchQuery(query);
      setIsSearching(false);
    }, 300); // 300ms delay
  }, []);

  // Cleanup timeout on unmount
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

  // Memoized search and filter function
  const filteredEventCards = useMemo(() => {
    let filtered = eventCardItems;

    // Apply search query filter
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

    // Apply type filter
    if (filterType !== "all") {
      filtered = filtered.filter((item) => item.event.type === filterType);
    }

    if (filterYear !== "all") {
      filtered = filtered.filter((item) => {
        const year = new Date(item.occurrence.start_date).getFullYear();
        if (Number.isNaN(year)) return false;
        return year.toString() === filterYear;
      });
    }

    if (filterMonth !== "all") {
      const monthValue = Number(filterMonth);
      if (!Number.isNaN(monthValue)) {
        const yearValue =
          filterYear !== "all"
            ? Number(filterYear)
            : calendarMonthDate.getFullYear();
        filtered = filtered.filter((item) => {
          const occurrenceDate = new Date(item.occurrence.start_date);
          return (
            occurrenceDate.getMonth() === monthValue &&
            occurrenceDate.getFullYear() === yearValue
          );
        });
      }
    }

    // Apply date filter
    if (selectedDate) {
      filtered = filtered.filter((item) => {
        const occurrenceDate = new Date(item.occurrence.start_date);
        return (
          occurrenceDate.getDate() === selectedDate.getDate() &&
          occurrenceDate.getMonth() === selectedDate.getMonth() &&
          occurrenceDate.getFullYear() === selectedDate.getFullYear()
        );
      });
    }

    // Sort by start date (most recent first)
    return filtered.sort((a, b) => {
      const dateA = new Date(a.occurrence.start_date).getTime();
      const dateB = new Date(b.occurrence.start_date).getTime();
      return dateB - dateA;
    });
  }, [
    debouncedSearchQuery,
    eventCardItems,
    filterMonth,
    filterType,
    filterYear,
    selectedDate,
  ]);

  useEffect(() => {
    if (!viewEditEvent) return;
    const updated = events.find((evt) => evt.id === viewEditEvent.id);
    if (updated && updated !== viewEditEvent) {
      setViewEditEvent(updated);
    }
  }, [events, viewEditEvent]);

  const handleCreateEvent = async (eventData: Partial<Event>) => {
    try {
      const result = await createEvent(eventData);
      setIsModalOpen(false);
      setViewEditEvent(null);
      setViewOccurrenceDate(null);
      return result;
    } catch (err) {
      console.error(err);
      alert("Failed to create event. Please try again.");
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
      return result;
    } catch (err) {
      console.error(err);
      alert("Failed to update event. Please try again.");
      throw err;
    }
  };

  const handleDeleteEvent = async () => {
    if (!deleteConfirmation.event) return;

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
    } catch (error) {
      console.error("Error deleting event:", error);
      alert("Failed to delete event. Please try again.");
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

  const handleViewEvent = useCallback(
    async (selected: Event, occurrenceStartDate?: string) => {
      setViewEditEvent(selected);
      setViewOccurrenceDate(occurrenceStartDate ?? null);
      setViewMode("view");
      setIsModalOpen(true);
      try {
        await getEvent(selected.id, { include_attendance: true });
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
      // Clicking the same date clears the filter
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
    },
    [calendarMonthDate]
  );

  const handleMonthFilterChange = (nextMonth: string) => {
    setFilterMonth(nextMonth);
    if (nextMonth !== "all") {
      const monthValue = Number(nextMonth);
      if (!Number.isNaN(monthValue)) {
        const nextYear =
          filterYear !== "all"
            ? Number(filterYear)
            : calendarMonthDate.getFullYear();
        setCalendarMonthDate(new Date(nextYear, monthValue, 1));
      }
    } else if (filterYear === "all") {
      setFilterYear(calendarMonthDate.getFullYear().toString());
    }
    setSelectedDate(null);
  };

  const clearDateFilter = () => {
    setSelectedDate(null);
  };

  const clearMonthFilter = () => {
    setFilterMonth(calendarMonthDate.getMonth().toString());
    setSelectedDate(null);
  };

  const clearTypeFilter = () => {
    setFilterType("all");
  };

  const clearYearFilter = () => {
    setFilterYear("all");
  };

  const clearAllFilters = () => {
    setSearchQuery("");
    setDebouncedSearchQuery("");
    setFilterType("all");
    setFilterYear("all");
    setSelectedDate(null);
    const now = new Date();
    setFilterMonth(now.getMonth().toString());
    setCalendarMonthDate(now);
  };

  const eventTypeOptions = [
    { value: "all", label: "All Events" },
    { value: "AWTA", label: "AWTA" },
    { value: "BIBLE_STUDY", label: "Bible Study" },
    { value: "CAMPING", label: "Camping" },
    { value: "CLUSTER_BS_EVANGELISM", label: "Cluster/BS Evangelism" },
    { value: "CLUSTERING", label: "Clustering" },
    { value: "CONFERENCE", label: "Conference" },
    { value: "CYM_CLASS", label: "CYM Class" },
    { value: "DOCTRINAL_CLASS", label: "Doctrinal Class" },
    { value: "GOLDEN_WARRIORS", label: "Golden Warriors" },
    { value: "MINI_WORSHIP", label: "Mini Worship" },
    { value: "OTHER", label: "Others" },
    { value: "PRAYER_MEETING", label: "Prayer Meeting" },
    { value: "SUNDAY_SERVICE", label: "Sunday Service" },
  ];

  const availableYears = useMemo(() => {
    const years = new Set<string>();

    events.forEach((event) => {
      if (event.start_date) {
        const year = new Date(event.start_date).getFullYear();
        if (!Number.isNaN(year)) years.add(year.toString());
      }

      if (event.next_occurrence?.start_date) {
        const year = new Date(event.next_occurrence.start_date).getFullYear();
        if (!Number.isNaN(year)) years.add(year.toString());
      }

      if (event.occurrences && event.occurrences.length > 0) {
        event.occurrences.forEach((occurrence) => {
          const occurrenceYear = new Date(occurrence.start_date).getFullYear();
          if (!Number.isNaN(occurrenceYear)) {
            years.add(occurrenceYear.toString());
          }
        });
      }
    });

    return Array.from(years).sort((a, b) => Number(b) - Number(a));
  }, [events]);

  useEffect(() => {
    if (!yearFilterInitialized) {
      if (availableYears.includes(currentYear)) {
        setFilterYear(currentYear);
        setYearFilterInitialized(true);
      } else if (availableYears.length > 0) {
        setFilterYear(availableYears[0]);
        setYearFilterInitialized(true);
      }
    } else if (filterYear !== "all" && !availableYears.includes(filterYear)) {
      if (availableYears.includes(currentYear)) {
        setFilterYear(currentYear);
      } else if (availableYears.length > 0) {
        setFilterYear(availableYears[0]);
      } else {
        setFilterYear("all");
      }
    }
  }, [availableYears, currentYear, filterYear, yearFilterInitialized]);

  useEffect(() => {
    if (filterYear === "all") return;
    const nextYear = Number(filterYear);
    if (Number.isNaN(nextYear)) return;
    if (calendarMonthDate.getFullYear() !== nextYear) {
      const monthValue =
        filterMonth !== "all" && !Number.isNaN(Number(filterMonth))
          ? Number(filterMonth)
          : calendarMonthDate.getMonth();
      setCalendarMonthDate(new Date(nextYear, monthValue, 1));
    }
  }, [calendarMonthDate, filterMonth, filterYear]);

  return (
    <DashboardLayout>
      {/* Page header with Add Event */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold text-[#2D3748]">Church Events</h1>
        <Button
          onClick={() => {
            setViewEditEvent(null);
            setViewMode("edit");
            setIsModalOpen(true);
          }}
          className="w-full sm:w-auto min-h-[44px]"
        >
          Add Event
        </Button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg mb-6">
          {error}
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-6">
        <div className="flex-1 min-w-0">
          {/* Calendar View */}
          <div className="mb-6 lg:mb-0">
            <div className="flex items-center mb-3 gap-2">
              <h2 className="text-lg font-semibold text-gray-700">Calendar</h2>
              <Button
                variant="tertiary"
                onClick={() => setShowCalendar((prev) => !prev)}
                className="flex items-center gap-1 text-xs !px-2 !py-1 min-h-[44px] lg:hidden"
              >
                <svg
                  className={`w-4 h-4 transition-transform ${
                    showCalendar ? "rotate-90" : "rotate-0"
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
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
                events={calendarEvents}
                currentMonthDate={calendarMonthDate}
                onDateClick={handleDateClick}
                onMonthChange={handleMonthChange}
                selectedDate={selectedDate}
              />
            </div>
          </div>
        </div>

        <div className="w-full lg:w-96 shrink-0 space-y-6 lg:sticky lg:top-6 self-start">
          {/* Filters */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 md:p-6 shadow-sm">
            <div className="flex flex-col gap-4">
              {/* Search */}
              <div className="w-full">
                <div className="relative">
                  <svg
                    className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                  <input
                    type="text"
                    placeholder="Search events..."
                    value={searchQuery}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    className={`w-full pl-10 pr-10 py-2.5 md:py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base md:text-sm min-h-[44px] md:min-h-0 ${
                      searchQuery ? "pr-10" : "pr-4"
                    }`}
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => handleSearchChange("")}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  )}
                </div>
              </div>

              {/* Type, Month, and Year Filters */}
              <div className="flex flex-col gap-3">
                {/* Type Filter */}
                <div className="w-full">
                  <select
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value)}
                    className="w-full py-2.5 md:py-2 px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base md:text-sm min-h-[44px] md:min-h-0"
                  >
                    {eventTypeOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Month Filter */}
                  <div className="w-full">
                    <select
                      value={filterMonth}
                      onChange={(e) => handleMonthFilterChange(e.target.value)}
                      className="w-full py-2.5 md:py-2 px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base md:text-sm min-h-[44px] md:min-h-0"
                    >
                      <option value="all">All Months</option>
                      {monthNames.map((label, index) => (
                        <option key={label} value={index.toString()}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Year Filter */}
                  <div className="w-full">
                    <select
                      value={filterYear}
                      onChange={(e) => setFilterYear(e.target.value)}
                      className="w-full py-2.5 md:py-2 px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base md:text-sm min-h-[44px] md:min-h-0"
                    >
                      <option value="all">All Years</option>
                      {availableYears.map((year) => (
                        <option key={year} value={year}>
                          {year}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Clear Filters */}
                {(searchQuery ||
                  filterType !== "all" ||
                  filterYear !== "all" ||
                  !isMonthFilterDefault ||
                  selectedDate) && (
                  <button
                    onClick={clearAllFilters}
                    className="px-4 py-2.5 md:py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg border border-gray-300 transition-colors min-h-[44px] md:min-h-0 w-full"
                  >
                    Clear All
                  </button>
                )}
              </div>
            </div>

            {/* Active Filters Display */}
            {(searchQuery ||
              filterType !== "all" ||
              filterYear !== "all" ||
              shouldShowMonthBadge ||
              selectedDate) && (
              <div className="flex flex-wrap items-center gap-2 mt-4">
                {searchQuery && (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200">
                    <span className="mr-1">Search:</span>
                    <span className="font-medium">{searchQuery}</span>
                    <button
                      onClick={() => handleSearchChange("")}
                      className="ml-2 text-blue-600 hover:text-blue-800"
                    >
                      <svg
                        className="w-3 h-3"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </span>
                )}
                {filterType !== "all" && (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200">
                    Type:{" "}
                    {
                      eventTypeOptions.find((opt) => opt.value === filterType)
                        ?.label
                    }
                    <button
                      onClick={clearTypeFilter}
                      className="ml-2 text-blue-600 hover:text-blue-800"
                    >
                      <svg
                        className="w-3 h-3"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </span>
                )}
                {filterYear !== "all" && (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200">
                    Year: {filterYear}
                    <button
                      onClick={clearYearFilter}
                      className="ml-2 text-blue-600 hover:text-blue-800"
                    >
                      <svg
                        className="w-3 h-3"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </span>
                )}
                {shouldShowMonthBadge && (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200">
                    Month: {monthNames[Number(filterMonth)]}
                    <button
                      onClick={clearMonthFilter}
                      className="ml-2 text-blue-600 hover:text-blue-800"
                    >
                      <svg
                        className="w-3 h-3"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </span>
                )}
                {selectedDate && (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200">
                    Date: {selectedDate.toLocaleDateString()}
                    <button
                      onClick={clearDateFilter}
                      className="ml-2 text-blue-600 hover:text-blue-800"
                    >
                      <svg
                        className="w-3 h-3"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Search Results Count */}
          {(searchQuery || filterType !== "all" || selectedDate) && (
            <div className="flex items-center justify-between text-sm text-gray-600">
              <div className="flex items-center gap-2">
                <span>
                  {isSearching
                    ? "Searching..."
                    : `${filteredEventCards.length} event${
                        filteredEventCards.length !== 1 ? "s" : ""
                      } found`}
                </span>
                {filteredEventCards.length !== eventCardItems.length && (
                  <span className="text-gray-400">
                    (of {eventCardItems.length} total)
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Events Grid */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="flex items-center gap-2 text-gray-500">
                <svg
                  className="animate-spin h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                <span>Loading events...</span>
              </div>
            </div>
          ) : filteredEventCards.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-6 text-center">
              <svg
                className="w-12 h-12 text-gray-400 mx-auto mb-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              <p className="text-lg font-medium text-gray-900 mb-2">
                No events found
              </p>
              <p className="text-gray-500 mb-6">
                {searchQuery || filterType !== "all" || selectedDate
                  ? "Try adjusting your filters"
                  : "Get started by creating your first church event"}
              </p>
              {!(searchQuery || filterType !== "all" || selectedDate) && (
                <Button
                  onClick={() => {
                    setViewEditEvent(null);
                    setViewMode("edit");
                    setIsModalOpen(true);
                  }}
                  className="w-full min-h-[44px]"
                >
                  Create Event
                </Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {filteredEventCards.map((item) => (
                <EventCard
                  key={item.id}
                  event={item.event}
                  occurrenceStartDate={item.occurrence.start_date}
                  occurrenceEndDate={item.occurrence.end_date}
                  onView={() =>
                    handleViewEvent(item.event, item.occurrence.start_date)
                  }
                  onEdit={() => {
                    setViewEditEvent(item.event);
                    setViewOccurrenceDate(null);
                    setViewMode("edit");
                    setIsModalOpen(true);
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal for View/Create/Edit Event */}
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
            onSubmit={viewEditEvent ? handleUpdateEvent : handleCreateEvent}
            initialData={viewEditEvent || undefined}
            onClose={() => {
              setIsModalOpen(false);
              setViewEditEvent(null);
              setViewOccurrenceDate(null);
              setViewMode("edit");
            }}
          />
        )}
      </Modal>

      {/* Delete Confirmation Modal */}
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
