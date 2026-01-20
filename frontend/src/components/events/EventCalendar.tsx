"use client";

import { useEffect, useRef, useState } from "react";
interface EventCalendarProps {
  events: Array<{
    start_date: string;
  }>;
  currentMonthDate?: Date | null;
  onDateClick?: (date: Date) => void;
  onMonthChange?: (date: Date) => void;
  selectedDate?: Date | null;
}

export default function EventCalendar({
  events,
  currentMonthDate,
  onDateClick,
  onMonthChange,
  selectedDate,
}: EventCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const isSyncingRef = useRef(false);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);
  const startingDayOfWeek = firstDayOfMonth.getDay();
  const daysInMonth = lastDayOfMonth.getDate();

  const days = [];

  // Add empty cells for days before the first day of the month
  for (let i = 0; i < startingDayOfWeek; i++) {
    days.push(null);
  }

  // Add all days of the month
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(new Date(year, month, i));
  }

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

  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const getEventCountForDate = (date: Date | null): number => {
    if (!date) return 0;
    return events.filter((event) => {
      const eventDate = new Date(event.start_date);
      return (
        eventDate.getDate() === date.getDate() &&
        eventDate.getMonth() === date.getMonth() &&
        eventDate.getFullYear() === date.getFullYear()
      );
    }).length;
  };

  const isToday = (date: Date | null): boolean => {
    if (!date) return false;
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  const isSelected = (date: Date | null): boolean => {
    if (!date || !selectedDate) return false;
    return (
      date.getDate() === selectedDate.getDate() &&
      date.getMonth() === selectedDate.getMonth() &&
      date.getFullYear() === selectedDate.getFullYear()
    );
  };

  const goToPreviousMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
    if (onDateClick) {
      onDateClick(new Date());
    }
  };

  useEffect(() => {
    if (!onMonthChange) return;
    if (isSyncingRef.current) {
      isSyncingRef.current = false;
      return;
    }
    onMonthChange(currentDate);
  }, [currentDate, onMonthChange]);

  useEffect(() => {
    if (!currentMonthDate) return;
    const nextYear = currentMonthDate.getFullYear();
    const nextMonth = currentMonthDate.getMonth();
    if (nextYear !== year || nextMonth !== month) {
      isSyncingRef.current = true;
      setCurrentDate(new Date(nextYear, nextMonth, 1));
    }
  }, [currentMonthDate, month, year]);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 md:p-6 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4 md:mb-6">
        <h2 className="text-base md:text-lg font-semibold text-[#2D3748]">
          {monthNames[month]} {year}
        </h2>
        <div className="flex items-center gap-2">
          <button
            onClick={goToToday}
            className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors min-h-[44px] md:min-h-0"
          >
            Today
          </button>
          <div className="flex items-center gap-1">
            <button
              onClick={goToPreviousMonth}
              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors min-w-[44px] min-h-[44px] md:min-w-0 md:min-h-0 flex items-center justify-center"
              aria-label="Previous month"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </button>
            <button
              onClick={goToNextMonth}
              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors min-w-[44px] min-h-[44px] md:min-w-0 md:min-h-0 flex items-center justify-center"
              aria-label="Next month"
            >
              <svg
                className="w-5 h-5"
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
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {dayNames.map((day) => (
          <div
            key={day}
            className="text-center text-xs md:text-sm font-medium text-gray-500 py-2"
          >
            {day}
          </div>
        ))}

        {days.map((date, index) => {
          const eventCount = getEventCountForDate(date);
          const isCurrentDate = isToday(date);
          const isSelectedDate = isSelected(date);

          return (
            <div
              key={index}
              className={`
                aspect-square flex flex-col items-center justify-start p-1 md:p-2 rounded-md min-h-[44px] md:min-h-0
                ${date ? "hover:bg-gray-50 cursor-pointer active:bg-gray-100" : ""}
                ${isCurrentDate ? "bg-blue-50 font-semibold" : ""}
                ${isSelectedDate ? "bg-blue-100 ring-2 ring-blue-500" : ""}
                transition-colors
              `}
              onClick={() => date && onDateClick && onDateClick(date)}
            >
              {date && (
                <>
                  <span
                    className={`text-xs md:text-sm ${
                      isCurrentDate ? "text-blue-600" : "text-gray-900"
                    }`}
                  >
                    {date.getDate()}
                  </span>
                  {eventCount > 0 && (
                    <span className="inline-flex items-center justify-center w-4 h-4 md:w-5 md:h-5 rounded-full bg-blue-600 text-white text-[10px] md:text-xs font-semibold mt-0.5">
                      {eventCount}
                    </span>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
