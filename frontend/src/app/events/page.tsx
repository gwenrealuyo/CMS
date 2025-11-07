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
import { Event } from "@/src/types/event";
import { useEvents } from "@/src/hooks/useEvents";

export default function EventsPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [viewEditEvent, setViewEditEvent] = useState<Event | null>(null);
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
  const [showCalendar, setShowCalendar] = useState(true);
  const [filterType, setFilterType] = useState<string>("all");
  const [filterYear, setFilterYear] = useState<string>("all");
  const [yearFilterInitialized, setYearFilterInitialized] = useState(false);
  const currentYear = new Date().getFullYear().toString();

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

  // Memoized search and filter function
  const filteredEvents = useMemo(() => {
    let filtered = events;

    // Apply search query filter
    if (debouncedSearchQuery) {
      const lowerQuery = debouncedSearchQuery.toLowerCase();
      filtered = filtered.filter((event) => {
        const searchableText = [
          event.title,
          event.description,
          event.location,
          event.type_display,
        ]
          .join(" ")
          .toLowerCase();
        return searchableText.includes(lowerQuery);
      });
    }

    // Apply type filter
    if (filterType !== "all") {
      filtered = filtered.filter((event) => event.type === filterType);
    }

    if (filterYear !== "all") {
      filtered = filtered.filter((event) => {
        const years = new Set<string>();
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
            if (!occurrence?.start_date) return;
            const year = new Date(occurrence.start_date).getFullYear();
            if (!Number.isNaN(year)) years.add(year.toString());
          });
        }

        return years.has(filterYear);
      });
    }

    // Apply date filter
    if (selectedDate) {
      filtered = filtered.filter((event) => {
        const matchesBaseDate = (() => {
          const eventDate = new Date(event.start_date);
          return (
            eventDate.getDate() === selectedDate.getDate() &&
            eventDate.getMonth() === selectedDate.getMonth() &&
            eventDate.getFullYear() === selectedDate.getFullYear()
          );
        })();

        if (matchesBaseDate) return true;

        if (!event.occurrences || event.occurrences.length === 0) {
          return false;
        }

        return event.occurrences.some((occurrence) => {
          const occurrenceDate = new Date(occurrence.start_date);
          return (
            occurrenceDate.getDate() === selectedDate.getDate() &&
            occurrenceDate.getMonth() === selectedDate.getMonth() &&
            occurrenceDate.getFullYear() === selectedDate.getFullYear()
          );
        });
      });
    }

    // Sort by start date (most recent first)
    return filtered.sort((a, b) => {
      const nextA = a.next_occurrence?.start_date || a.start_date;
      const nextB = b.next_occurrence?.start_date || b.start_date;
      const dateA = new Date(nextA).getTime();
      const dateB = new Date(nextB).getTime();
      return dateB - dateA;
    });
  }, [events, debouncedSearchQuery, filterType, filterYear, selectedDate]);

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
    async (selected: Event) => {
      setViewEditEvent(selected);
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

  const clearDateFilter = () => {
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

  return (
    <DashboardLayout>
      {/* Page header with Add Event */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-[#2D3748]">Church Events</h1>
        <Button
          onClick={() => {
            setViewEditEvent(null);
            setViewMode("edit");
            setIsModalOpen(true);
          }}
        >
          Add Event
        </Button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg mb-6">
          {error}
        </div>
      )}

      {/* Calendar View */}
      <div className="mb-6">
        <div className="flex items-center mb-3 gap-2">
          <h2 className="text-lg font-semibold text-gray-700">Calendar</h2>
          <Button
            variant="tertiary"
            onClick={() => setShowCalendar((prev) => !prev)}
            className="flex items-center gap-1 text-xs !px-2 !py-1"
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
        {showCalendar && (
          <EventCalendar
            events={calendarEvents}
            onDateClick={handleDateClick}
            selectedDate={selectedDate}
          />
        )}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm mb-6">
        <div className="flex flex-wrap items-center gap-4">
          {/* Search */}
          <div className="flex-1 min-w-[200px]">
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
                className={`w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm ${
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

          {/* Type Filter */}
          <div className="w-[200px]">
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="w-full py-2 px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            >
              {eventTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* Year Filter */}
          <div className="w-[160px]">
            <select
              value={filterYear}
              onChange={(e) => setFilterYear(e.target.value)}
              className="w-full py-2 px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            >
              <option value="all">All Years</option>
              {availableYears.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>

          {/* Clear Filters */}
          {(searchQuery ||
            filterType !== "all" ||
            filterYear !== "all" ||
            selectedDate) && (
            <button
              onClick={clearAllFilters}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg border border-gray-300 transition-colors"
            >
              Clear All
            </button>
          )}
        </div>

        {/* Active Filters Display */}
        {(searchQuery ||
          filterType !== "all" ||
          filterYear !== "all" ||
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
        <div className="flex items-center justify-between text-sm text-gray-600 mb-4">
          <div className="flex items-center gap-2">
            <span>
              {isSearching
                ? "Searching..."
                : `${filteredEvents.length} event${
                    filteredEvents.length !== 1 ? "s" : ""
                  } found`}
            </span>
            {filteredEvents.length !== events.length && (
              <span className="text-gray-400">(of {events.length} total)</span>
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
      ) : filteredEvents.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <svg
            className="w-16 h-16 text-gray-400 mx-auto mb-4"
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
            >
              Create Event
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredEvents.map((event) => (
            <EventCard
              key={event.id}
              event={event}
              onView={() => handleViewEvent(event)}
              onEdit={() => {
                setViewEditEvent(event);
                setViewMode("edit");
                setIsModalOpen(true);
              }}
              onDelete={() => {
                setDeleteConfirmation({
                  isOpen: true,
                  event,
                  loading: false,
                });
              }}
            />
          ))}
        </div>
      )}

      {/* Modal for View/Create/Edit Event */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setViewEditEvent(null);
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
            onEdit={() => setViewMode("edit")}
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
              setViewMode("edit");
            }}
            onClose={() => {
              setIsModalOpen(false);
              setViewEditEvent(null);
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
