"use client";

import { useState, useEffect, useRef } from "react";
import Modal from "@/src/components/ui/Modal";
import Button from "@/src/components/ui/Button";
import ErrorMessage from "@/src/components/ui/ErrorMessage";
import LoadingSpinner from "@/src/components/ui/LoadingSpinner";
import { ClassMemberRole } from "@/src/types/sundaySchool";
import { formatPersonName } from "@/src/lib/name";
import { peopleApi } from "@/src/lib/api";
import { Person } from "@/src/types/person";

interface BulkEnrollModalProps {
  isOpen: boolean;
  onClose: () => void;
  onEnroll: (personIds: number[], role: ClassMemberRole) => Promise<void>;
  isSubmitting?: boolean;
}

export default function BulkEnrollModal({
  isOpen,
  onClose,
  onEnroll,
  isSubmitting = false,
}: BulkEnrollModalProps) {
  const [selectedPersonIds, setSelectedPersonIds] = useState<Set<number>>(new Set());
  const [role, setRole] = useState<ClassMemberRole>("STUDENT");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Debounce search query
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery]);

  // Fetch people when search query changes
  useEffect(() => {
    const fetchPeople = async () => {
      if (!debouncedSearchQuery.trim()) {
        setPeople([]);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const response = await peopleApi.search({ search: debouncedSearchQuery });
        setPeople(response.data);
      } catch (err) {
        setError("Failed to search people");
        setPeople([]);
      } finally {
        setLoading(false);
      }
    };

    fetchPeople();
  }, [debouncedSearchQuery]);

  // Reset when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setSearchQuery("");
      setDebouncedSearchQuery("");
      setSelectedPersonIds(new Set());
      setError(null);
      setPeople([]);
    }
  }, [isOpen]);

  const handleTogglePerson = (personId: number) => {
    const newSelected = new Set(selectedPersonIds);
    if (newSelected.has(personId)) {
      newSelected.delete(personId);
    } else {
      newSelected.add(personId);
    }
    setSelectedPersonIds(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedPersonIds.size === people.length && people.length > 0) {
      // Deselect all visible
      const visibleIds = new Set(people.map((p) => Number(p.id)));
      setSelectedPersonIds((prev) => {
        const newSet = new Set(prev);
        visibleIds.forEach((id) => newSet.delete(id));
        return newSet;
      });
    } else {
      // Select all visible
      const visibleIds = new Set(people.map((p) => Number(p.id)));
      setSelectedPersonIds((prev) => {
        const newSet = new Set(prev);
        visibleIds.forEach((id) => newSet.add(id));
        return newSet;
      });
    }
  };

  const visibleSelectedCount = people.filter((p) => selectedPersonIds.has(Number(p.id))).length;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedPersonIds.size === 0) {
      setError("Please select at least one person");
      return;
    }

    try {
      setError(null);
      await onEnroll(Array.from(selectedPersonIds), role);
      setSelectedPersonIds(new Set());
      setSearchQuery("");
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to enroll people");
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setSelectedPersonIds(new Set());
      setSearchQuery("");
      setError(null);
      onClose();
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Bulk Enroll">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <ErrorMessage message={error} />}

        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700">
            Role <span className="text-red-500">*</span>
          </label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as ClassMemberRole)}
            required
            className="w-full rounded-md border border-gray-200 px-3 py-2 min-h-[44px] text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="STUDENT">Student</option>
            <option value="TEACHER">Teacher</option>
            <option value="ASSISTANT_TEACHER">Assistant Teacher</option>
          </select>
        </div>

        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700">Search People</label>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, email, or username..."
            className="w-full rounded-md border border-gray-200 px-3 py-2 min-h-[44px] text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          {searchQuery && !loading && (
            <p className="text-xs text-gray-500">
              {people.length > 0 ? `Found ${people.length} ${people.length === 1 ? "person" : "people"}` : "No results"}
            </p>
          )}
        </div>

        <div className="border border-gray-200 rounded-lg max-h-96 overflow-y-auto">
          <div className="sticky top-0 bg-gray-50 border-b border-gray-200 p-2 flex items-center justify-between z-10">
            <span className="text-sm font-medium text-gray-700">
              {selectedPersonIds.size} selected {people.length > 0 && `(${visibleSelectedCount} visible)`}
            </span>
            <button
              type="button"
              onClick={handleSelectAll}
              disabled={people.length === 0}
              className="text-sm text-blue-600 hover:text-blue-800 disabled:text-gray-400 disabled:cursor-not-allowed"
            >
              {visibleSelectedCount === people.length && people.length > 0 ? "Deselect Visible" : "Select Visible"}
            </button>
          </div>
          {loading && people.length === 0 ? (
            <div className="py-8 text-center">
              <LoadingSpinner />
              <p className="text-sm text-gray-500 mt-2">Searching people...</p>
            </div>
          ) : error ? (
            <div className="py-8 text-center text-red-600 text-sm">
              {error}
            </div>
          ) : people.length === 0 ? (
            <div className="py-8 text-center text-gray-500 text-sm">
              {searchQuery ? "No people found. Try a different search." : "Start typing to search for people..."}
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {people.map((person) => {
                const personId = Number(person.id);
                const isSelected = selectedPersonIds.has(personId);
                const fullName = formatPersonName(person);

                return (
                  <label
                    key={person.id}
                    className="flex items-center p-3 hover:bg-gray-50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleTogglePerson(personId)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <div className="ml-3 flex-1">
                      <p className="text-sm font-medium text-gray-900">{fullName}</p>
                      {person.email && (
                        <p className="text-xs text-gray-500">{person.email}</p>
                      )}
                    </div>
                  </label>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex flex-col-reverse sm:flex-row gap-3 pt-4">
          <Button 
            type="button" 
            variant="tertiary" 
            className="w-full sm:w-auto min-h-[44px]"
            onClick={handleClose} 
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button 
            type="submit" 
            variant="primary" 
            className="w-full sm:w-auto min-h-[44px]"
            disabled={isSubmitting || selectedPersonIds.size === 0}
          >
            {isSubmitting ? "Enrolling..." : `Enroll ${selectedPersonIds.size} ${selectedPersonIds.size === 1 ? "Person" : "People"}`}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

