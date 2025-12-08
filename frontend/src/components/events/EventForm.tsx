import { useState, useEffect, useMemo } from "react";
import { Event, WeeklyRecurrencePattern } from "@/src/types/event";
import Button from "../ui/Button";

interface EventFormProps {
  onSubmit: (event: Partial<Event>) => Promise<Event | void>;
  initialData?: Partial<Event>;
  onClose?: () => void;
}

type EventType =
  | "SUNDAY_SERVICE"
  | "BIBLE_STUDY"
  | "PRAYER_MEETING"
  | "CLUSTER_BS_EVANGELISM"
  | "CLUSTERING"
  | "DOCTRINAL_CLASS"
  | "CYM_CLASS"
  | "MINI_WORSHIP"
  | "GOLDEN_WARRIORS"
  | "CAMPING"
  | "AWTA"
  | "CONFERENCE"
  | "OTHER";

const eventTypeOptions: { value: EventType; label: string }[] = [
  { value: "SUNDAY_SERVICE", label: "Sunday Service" },
  { value: "BIBLE_STUDY", label: "Bible Study" },
  { value: "PRAYER_MEETING", label: "Prayer Meeting" },
  { value: "CLUSTER_BS_EVANGELISM", label: "Cluster/BS Evangelism" },
  { value: "CLUSTERING", label: "Clustering" },
  { value: "DOCTRINAL_CLASS", label: "Doctrinal Class" },
  { value: "CYM_CLASS", label: "CYM Class" },
  { value: "MINI_WORSHIP", label: "Mini Worship" },
  { value: "GOLDEN_WARRIORS", label: "Golden Warriors" },
  { value: "CAMPING", label: "Camping" },
  { value: "AWTA", label: "AWTA" },
  { value: "CONFERENCE", label: "Conference" },
  { value: "OTHER", label: "Others" },
];

const parseLocalDateTime = (value: string) => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const toPythonWeekday = (jsWeekday: number) => {
  return jsWeekday === 0 ? 6 : jsWeekday - 1;
};

const formatDateOnly = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getNextSundayAt9AM = () => {
  const today = new Date();
  const nextSunday = new Date(today);
  const currentDay = today.getDay();

  if (currentDay === 0) {
    nextSunday.setHours(9, 0, 0, 0);
    return nextSunday;
  }

  const daysUntilSunday = 7 - currentDay;
  nextSunday.setDate(today.getDate() + daysUntilSunday);
  nextSunday.setHours(9, 0, 0, 0);
  return nextSunday;
};

const getNextSundayAt11AM = () => {
  const nextSunday = getNextSundayAt9AM();
  nextSunday.setHours(11, 0, 0, 0);
  return nextSunday;
};

const formatDateForInput = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

const getMaxThroughDate = (start: Date) => {
  const endOfYear = new Date(start.getFullYear(), 11, 31);
  const maxRange = new Date(start);
  maxRange.setDate(maxRange.getDate() + 366);
  return new Date(Math.min(endOfYear.getTime(), maxRange.getTime()));
};

const clampThroughDate = (start: Date, candidate?: Date | null) => {
  const minDate = new Date(start);
  minDate.setHours(0, 0, 0, 0);
  const maxDate = getMaxThroughDate(start);

  if (!candidate) {
    return maxDate;
  }

  const normalized = new Date(candidate);
  normalized.setHours(0, 0, 0, 0);

  if (normalized < minDate) {
    return minDate;
  }

  if (normalized > maxDate) {
    return maxDate;
  }

  return normalized;
};

const buildWeeklyPattern = (
  startValue: string,
  existing?: WeeklyRecurrencePattern | null
): WeeklyRecurrencePattern => {
  const startDate = parseLocalDateTime(startValue) ?? new Date();

  const throughCandidate = existing?.through
    ? parseLocalDateTime(`${existing.through}T00:00:00`)
    : null;

  const throughDate = clampThroughDate(startDate, throughCandidate);

  return {
    frequency: "weekly",
    weekdays: [toPythonWeekday(startDate.getDay())],
    through: formatDateOnly(throughDate),
    excluded_dates: existing?.excluded_dates ?? [],
  };
};

const toUtcISOString = (value?: string | null) => {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return undefined;
  }
  return date.toISOString();
};

export default function EventForm({
  onSubmit,
  initialData,
  onClose,
}: EventFormProps) {
  const defaultFormData = useMemo(() => {
    if (initialData) {
      return {
        title: initialData.title || "",
        description: initialData.description || "",
        type: initialData.type || "SUNDAY_SERVICE",
        location: initialData.location || "",
        is_recurring: initialData.is_recurring || false,
        start_date: initialData.start_date || "",
        end_date: initialData.end_date || "",
      };
    }

    const startDate = formatDateForInput(getNextSundayAt9AM());
    const endDate = formatDateForInput(getNextSundayAt11AM());

    return {
      title: "Sunday Service",
      description: "",
      type: "SUNDAY_SERVICE" as EventType,
      location: "HQ Muntinlupa",
      is_recurring: false,
      start_date: startDate,
      end_date: endDate,
    };
  }, [initialData]);
  const [formData, setFormData] = useState(defaultFormData);

  const initialRecurrence = useMemo<WeeklyRecurrencePattern | null>(
    () =>
      initialData?.is_recurring
        ? buildWeeklyPattern(
            initialData.start_date || defaultFormData.start_date,
            initialData.recurrence_pattern || null
          )
        : null,
    [initialData, defaultFormData.start_date]
  );

  const [recurrencePattern, setRecurrencePattern] =
    useState<WeeklyRecurrencePattern | null>(initialRecurrence);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setFormData(defaultFormData);
    if (initialData?.is_recurring) {
      setRecurrencePattern(
        buildWeeklyPattern(
          initialData.start_date || defaultFormData.start_date,
          initialData.recurrence_pattern || null
        )
      );
    } else {
      setRecurrencePattern(null);
    }
  }, [defaultFormData, initialData]);

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;

    if (name === "is_recurring") {
      const nextIsRecurring = type === "checkbox" ? checked : value === "true";
      setFormData((prev) => ({ ...prev, is_recurring: nextIsRecurring }));

      if (nextIsRecurring) {
        const sourceStart = formData.start_date || defaultFormData.start_date;
        setRecurrencePattern((current) =>
          buildWeeklyPattern(sourceStart, current)
        );
      } else {
        setRecurrencePattern(null);
      }

      return;
    }

    let nextStartDate: string | null = null;

    setFormData((prev) => {
      const nextState = {
        ...prev,
        [name]: type === "checkbox" ? checked : value,
      };

      if (name === "type" && value === "SUNDAY_SERVICE") {
        const startDate =
          parseLocalDateTime(prev.start_date) || getNextSundayAt9AM();
        startDate.setHours(9, 0, 0, 0);

        const endDate =
          parseLocalDateTime(prev.end_date) || getNextSundayAt11AM();
        endDate.setHours(11, 0, 0, 0);

        nextState.start_date = formatDateForInput(startDate);
        nextState.end_date = formatDateForInput(endDate);
      }

      if (name === "type") {
        const optionLabel =
          eventTypeOptions.find((option) => option.value === value)?.label ||
          value;
        nextState.title = optionLabel;
      }

      nextStartDate = nextState.start_date;

      return nextState;
    });

    if (
      name === "type" &&
      (formData.is_recurring || recurrencePattern) &&
      nextStartDate
    ) {
      setRecurrencePattern((current) =>
        buildWeeklyPattern(nextStartDate as string, current)
      );
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      let patternToSend = recurrencePattern;

      if (formData.is_recurring) {
        const baseStart = formData.start_date || defaultFormData.start_date;
        if (!patternToSend) {
          patternToSend = buildWeeklyPattern(baseStart, null);
          setRecurrencePattern(patternToSend);
        } else {
          patternToSend = buildWeeklyPattern(baseStart, patternToSend);
          setRecurrencePattern(patternToSend);
        }
      }

      const startSource = formData.start_date || defaultFormData.start_date;
      const endSource = formData.end_date || defaultFormData.end_date;

      const startIso = toUtcISOString(startSource) ?? startSource;
      const endIso = toUtcISOString(endSource) ?? endSource;

      const payload: Partial<Event> = {
        ...formData,
        start_date: startIso,
        end_date: endIso,
        recurrence_pattern: formData.is_recurring ? patternToSend : null,
      };

      await onSubmit(payload);
    } finally {
      setLoading(false);
    }
  };

  const activeStartDate = formData.start_date || defaultFormData.start_date;
  const parsedStartDate = parseLocalDateTime(activeStartDate);
  const activeStartDateObj =
    parsedStartDate && !Number.isNaN(parsedStartDate.getTime())
      ? parsedStartDate
      : (() => {
          const fallback = activeStartDate
            ? new Date(activeStartDate)
            : new Date();
          return Number.isNaN(fallback.getTime()) ? new Date() : fallback;
        })();
  const recurrenceWeekdayLabel = activeStartDateObj.toLocaleDateString(
    "en-US",
    { weekday: "long" }
  );

  const recurrenceMaxThroughDate = getMaxThroughDate(activeStartDateObj);
  const currentThroughDate = recurrencePattern?.through
    ? parseLocalDateTime(`${recurrencePattern.through}T00:00:00`)
    : null;
  const clampedThroughDate = clampThroughDate(
    activeStartDateObj,
    currentThroughDate
  );
  const recurrenceThroughValue = formatDateOnly(clampedThroughDate);
  const recurrenceMinThroughValue = formatDateOnly(activeStartDateObj);
  const recurrenceMaxThroughValue = formatDateOnly(recurrenceMaxThroughDate);

  const handleRecurrenceThroughChange = (value: string) => {
    if (!value) return;
    const selectedDate =
      parseLocalDateTime(`${value}T00:00:00`) ?? new Date(`${value}T00:00:00`);
    const clamped = clampThroughDate(activeStartDateObj, selectedDate);

    setRecurrencePattern((current) => {
      const base = current
        ? { ...current }
        : buildWeeklyPattern(activeStartDate, null);
      return {
        ...base,
        weekdays: [toPythonWeekday(activeStartDateObj.getDay())],
        through: formatDateOnly(clamped),
      };
    });
  };

  const formatDateTimeLocal = (dateString: string) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    // Adjust for local timezone
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="max-h-[85vh] overflow-y-auto space-y-6 text-sm max-w-3xl"
    >
      <div className="space-y-6 pr-1">
        <div>
          <div className="p-0">
            <h3 className="text-sm font-semibold text-gray-900 mb-2">
              Event Details
            </h3>
            <p className="text-xs text-gray-500 mb-4">
              Basic information about the event.
            </p>
            <div className="space-y-4">
              {/* Event Title */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Event Title *
                </label>
                <input
                  type="text"
                  name="title"
                  required
                  value={formData.title}
                  onChange={handleChange}
                  className="w-full px-3 py-2 min-h-[44px] border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., Sunday Worship Service"
                />
              </div>

              {/* Event Type and Location */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Event Type *
                  </label>
                  <select
                    name="type"
                    value={formData.type}
                    onChange={handleChange}
                    className="w-full px-3 py-2 min-h-[44px] border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    {eventTypeOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Location *
                  </label>
                  <input
                    type="text"
                    name="location"
                    required
                    value={formData.location}
                    onChange={handleChange}
                    className="w-full px-3 py-2 min-h-[44px] border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="e.g., Main Sanctuary"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  rows={3}
                  className="w-full px-3 py-2 min-h-[44px] border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Add any additional details about the event..."
                />
              </div>
            </div>
          </div>
        </div>

        {/* Schedule Section */}
        <div>
          <div className="p-0">
            <h3 className="text-sm font-semibold text-gray-900 mb-2">
              Schedule
            </h3>
            <p className="text-xs text-gray-500 mb-4">
              When the event will take place.
            </p>
            <div className="space-y-4">
              {/* Date and Time */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Start Date & Time *
                  </label>
                  <input
                    type="datetime-local"
                    name="start_date"
                    required
                    value={formatDateTimeLocal(formData.start_date)}
                    onChange={(e) => {
                      const value = e.target.value;
                      setFormData((prev) => {
                        const nextState = { ...prev, start_date: value };
                        if (prev.is_recurring || recurrencePattern) {
                          setRecurrencePattern((current) =>
                            buildWeeklyPattern(value, current)
                          );
                        }
                        return nextState;
                      });
                    }}
                    className="w-full px-3 py-2 min-h-[44px] border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    End Date & Time *
                  </label>
                  <input
                    type="datetime-local"
                    name="end_date"
                    required
                    value={formatDateTimeLocal(formData.end_date)}
                    onChange={(e) => {
                      const value = e.target.value;
                      setFormData((prev) => ({ ...prev, end_date: value }));
                    }}
                    className="w-full px-3 py-2 min-h-[44px] border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Recurring Event */}
              <div className="flex items-center">
                <input
                  id="is_recurring"
                  type="checkbox"
                  name="is_recurring"
                  checked={formData.is_recurring}
                  onChange={handleChange}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label
                  htmlFor="is_recurring"
                  className="ml-2 block text-sm text-gray-700"
                >
                  This is a recurring event
                </label>
              </div>

              {formData.is_recurring && (
                <div className="ml-6 mt-3 space-y-3 border-l border-gray-200 pl-4">
                  <p className="text-xs text-gray-500">
                    Repeats weekly every {recurrenceWeekdayLabel} through{" "}
                    {new Date(
                      `${recurrenceThroughValue}T00:00:00`
                    ).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                    .
                  </p>

                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Repeat until
                    </label>
                    <input
                      type="date"
                      value={recurrenceThroughValue}
                      min={recurrenceMinThroughValue}
                      max={recurrenceMaxThroughValue}
                      onChange={(e) =>
                        handleRecurrenceThroughChange(e.target.value)
                      }
                      className="w-full md:w-64 px-3 py-2 min-h-[44px] border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    />
                    <p className="text-[11px] text-gray-400 mt-1">
                      Weekly schedule can be adjusted anytime. You can skip an
                      individual week later without removing the series.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex flex-col-reverse sm:flex-row gap-3 pt-4">
        <Button
          variant="tertiary"
          className="w-full sm:flex-1 min-h-[44px]"
          onClick={onClose}
          disabled={loading}
        >
          Cancel
        </Button>
        <Button 
          className="w-full sm:flex-1 min-h-[44px]" 
          disabled={loading} 
          type="submit"
        >
          {loading
            ? "Saving..."
            : initialData
            ? "Update Event"
            : "Create Event"}
        </Button>
      </div>
    </form>
  );
}
