"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import Button from "@/src/components/ui/Button";
import ErrorMessage from "@/src/components/ui/ErrorMessage";
import LoadingSpinner from "@/src/components/ui/LoadingSpinner";
import { Lesson } from "@/src/types/lesson";
import { Person } from "@/src/types/person";
import { formatPersonName } from "@/src/lib/name";

interface AssignLessonsDropdownProps {
  allLessons: Lesson[];
  people: Person[];
  peopleLoading: boolean;
  peopleError: string | null;
  assigning: boolean;
  assignError: string | null;
  onAssignLessons: (personIds: string[], lessonIds: number[]) => void;
}

export default function AssignLessonsDropdown({
  allLessons,
  people,
  peopleLoading,
  peopleError,
  assigning,
  assignError,
  onAssignLessons,
}: AssignLessonsDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
  const [selectedLessonIds, setSelectedLessonIds] = useState<Set<number>>(
    new Set()
  );
  const containerRef = useRef<HTMLDivElement>(null);

  // Filter people by has_finished_lessons === false
  const eligiblePeople = useMemo(() => {
    return people.filter((person) => !person.has_finished_lessons);
  }, [people]);

  // Filter people by search query (name including nickname, member_id, NOT username)
  const filteredPeople = useMemo(() => {
    if (!searchQuery.trim()) {
      return eligiblePeople;
    }
    const query = searchQuery.toLowerCase();
    return eligiblePeople.filter((person) => {
      const name = formatPersonName(person).toLowerCase();
      const nickname = (person.nickname || "").toLowerCase();
      const memberId = (person.member_id || "").toLowerCase();
      return (
        name.includes(query) ||
        nickname.includes(query) ||
        memberId.includes(query)
      );
    });
  }, [eligiblePeople, searchQuery]);

  // Initialize selected lessons when person is selected
  useEffect(() => {
    if (selectedPersonId) {
      // All active latest lessons checked by default
      const defaultLessonIds = new Set(
        allLessons
          .filter((lesson) => lesson.is_latest && lesson.is_active)
          .map((lesson) => lesson.id)
      );
      setSelectedLessonIds(defaultLessonIds);
    }
  }, [selectedPersonId, allLessons]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setSearchQuery("");
        setSelectedPersonId(null);
        setSelectedLessonIds(new Set());
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const handlePersonSelect = (personId: string) => {
    setSelectedPersonId(personId);
  };

  const handleLessonToggle = (lessonId: number) => {
    setSelectedLessonIds((prev) => {
      const next = new Set(prev);
      if (next.has(lessonId)) {
        next.delete(lessonId);
      } else {
        next.add(lessonId);
      }
      return next;
    });
  };

  const handleSubmit = () => {
    if (!selectedPersonId || selectedLessonIds.size === 0) {
      return;
    }
    onAssignLessons([selectedPersonId], Array.from(selectedLessonIds));
    setIsOpen(false);
    setSearchQuery("");
    setSelectedPersonId(null);
    setSelectedLessonIds(new Set());
  };

  const handleCancel = () => {
    setIsOpen(false);
    setSearchQuery("");
    setSelectedPersonId(null);
    setSelectedLessonIds(new Set());
  };

  const selectedPerson = selectedPersonId
    ? eligiblePeople.find((p) => p.id === selectedPersonId)
    : null;

  const sortedLessons = useMemo(() => {
    return [...allLessons]
      .filter((lesson) => lesson.is_latest && lesson.is_active)
      .sort((a, b) => a.order - b.order);
  }, [allLessons]);

  return (
    <div className="relative" ref={containerRef}>
      <Button
        variant="primary"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full sm:w-auto min-h-[44px]"
      >
        Assign Lessons
      </Button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-96 bg-white border border-gray-300 rounded-lg shadow-lg z-50 max-h-[600px] flex flex-col">
          <div className="p-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">
              Assign Lessons
            </h3>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {!selectedPersonId ? (
              <>
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Search Person
                  </label>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by name, nickname, or member ID..."
                    className="w-full min-h-[44px] border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    autoFocus
                  />
                </div>

                {peopleError && <ErrorMessage message={peopleError} />}
                {assignError && <ErrorMessage message={assignError} />}

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Select Person
                  </label>
                  <div className="max-h-48 overflow-y-auto border rounded-lg divide-y divide-gray-200">
                    {peopleLoading ? (
                      <div className="p-4">
                        <LoadingSpinner />
                      </div>
                    ) : filteredPeople.length === 0 ? (
                      <div className="p-4 text-sm text-gray-500">
                        {eligiblePeople.length === 0
                          ? "No people available (all have finished lessons)."
                          : "No people match your search."}
                      </div>
                    ) : (
                      filteredPeople.map((person) => (
                        <button
                          key={person.id}
                          type="button"
                          onClick={() => handlePersonSelect(person.id)}
                          className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                        >
                          <div className="font-medium text-[#2D3748]">
                            {formatPersonName(person)}
                          </div>
                          {person.member_id && (
                            <div className="text-xs text-gray-500">
                              Member ID: {person.member_id}
                            </div>
                          )}
                        </button>
                      ))
                    )}
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-sm font-medium text-gray-700">
                      Selected: {formatPersonName(selectedPerson!)}
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedPersonId(null);
                        setSelectedLessonIds(new Set());
                      }}
                      className="text-sm text-blue-600 hover:text-blue-800"
                    >
                      Change
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Select Lessons (all checked by default)
                  </label>
                  <div className="max-h-64 overflow-y-auto border rounded-lg divide-y divide-gray-200">
                    {sortedLessons.map((lesson) => (
                      <label
                        key={lesson.id}
                        className="flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          checked={selectedLessonIds.has(lesson.id)}
                          onChange={() => handleLessonToggle(lesson.id)}
                        />
                        <div className="flex-1">
                          <div className="font-medium">
                            Lesson {lesson.order}: {lesson.title}
                          </div>
                          {lesson.version_label && (
                            <div className="text-xs text-gray-500">
                              {lesson.version_label}
                            </div>
                          )}
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="p-4 border-t border-gray-200 flex flex-col-reverse sm:flex-row justify-end gap-3">
            <Button
              variant="tertiary"
              onClick={handleCancel}
              disabled={assigning}
              className="w-full sm:w-auto min-h-[44px]"
            >
              Cancel
            </Button>
            {selectedPersonId && selectedLessonIds.size > 0 && (
              <Button 
                onClick={handleSubmit} 
                disabled={assigning}
                className="w-full sm:w-auto min-h-[44px]"
              >
                {assigning ? "Assigning..." : "Assign Selected Lessons"}
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
