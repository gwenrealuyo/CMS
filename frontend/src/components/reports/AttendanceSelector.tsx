import { useState, useEffect, useRef } from "react";
import { Person, PersonUI } from "@/src/types/person";
import { X } from "lucide-react";

interface AttendanceSelectorProps {
  label: string;
  selectedIds: string[];
  availablePeople: PersonUI[];
  filterRole: "MEMBER" | "VISITOR";
  onSelectionChange: (ids: string[]) => void;
  className?: string;
}

export default function AttendanceSelector({
  label,
  selectedIds,
  availablePeople,
  filterRole,
  onSelectionChange,
  className = "",
}: AttendanceSelectorProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Filter people by role and search term
  const filteredPeople = availablePeople.filter((person) => {
    if (person.role !== filterRole) return false;
    if (searchTerm.trim().length === 0) return false;
    return person.name.toLowerCase().includes(searchTerm.toLowerCase());
  });

  // Get selected people objects
  const selectedPeople = availablePeople.filter((p) =>
    selectedIds.includes(p.id)
  );

  const togglePerson = (personId: string) => {
    if (selectedIds.includes(personId)) {
      onSelectionChange(selectedIds.filter((id) => id !== personId));
    } else {
      onSelectionChange([...selectedIds, personId]);
    }
    setSearchTerm(""); // Clear search after selection
  };

  const removePerson = (personId: string) => {
    onSelectionChange(selectedIds.filter((id) => id !== personId));
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
        setSearchTerm("");
      }
    };

    if (isDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isDropdownOpen]);

  return (
    <div className={`mb-6 ${className}`}>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        {label}
        <span className="text-gray-500 font-normal ml-2">
          ({selectedIds.length} selected)
        </span>
      </label>

      {/* Selected People Chips */}
      {selectedPeople.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2 p-2 bg-gray-50 rounded-lg border border-gray-200 min-h-[60px]">
          {selectedPeople.map((person) => (
            <span
              key={person.id}
              className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium"
            >
              {person.name}
              <button
                type="button"
                onClick={() => removePerson(person.id)}
                className="hover:bg-blue-200 rounded-full p-0.5 transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Search Input */}
      <div className="relative" ref={dropdownRef}>
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setIsDropdownOpen(e.target.value.trim().length >= 1);
          }}
          onFocus={() => {
            // Do not open on focus; only open after user types at least one character
            if (searchTerm.trim().length >= 1) setIsDropdownOpen(true);
          }}
          placeholder={`Search ${filterRole.toLowerCase()}s...`}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />

        {/* Dropdown */}
        {isDropdownOpen && searchTerm.trim().length >= 1 && (
          <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
            {filteredPeople.length > 0 ? (
              filteredPeople.map((person) => {
                const isSelected = selectedIds.includes(person.id);
                return (
                  <button
                    key={person.id}
                    type="button"
                    onClick={() => togglePerson(person.id)}
                    className={`w-full px-3 py-2 text-left hover:bg-gray-100 focus:bg-gray-100 focus:outline-none transition-colors ${
                      isSelected ? "bg-blue-50" : ""
                    }`}
                  >
                    <div className="font-medium text-gray-900">
                      {person.name}
                    </div>
                    {filterRole === "VISITOR" ? (
                      <div className="text-sm text-gray-500">
                        {(() => {
                          const inviter = person.inviter
                            ? availablePeople.find(
                                (p) => p.id === person.inviter
                              )
                            : undefined;
                          const inviterName = inviter
                            ? inviter.name
                            : "Unknown";
                          const statusLabel = person.status
                            ? person.status.toLowerCase()
                            : "";
                          return `invited by ${inviterName} • ${statusLabel}`;
                        })()}
                      </div>
                    ) : (
                      person.phone && (
                        <div className="text-sm text-gray-500">
                          {person.phone}
                        </div>
                      )
                    )}
                  </button>
                );
              })
            ) : (
              <div className="px-3 py-2 text-gray-500 text-sm">
                No {filterRole.toLowerCase()}s found
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
