import React, { useState, useMemo, useRef, useEffect } from "react";
import ReactDOM from "react-dom";
import { Person } from "@/src/types/person";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import ExportPreviewModal from "./ExportPreviewModal";
import ImportModal from "./ImportModal";
import BulkActionsMenu from "./BulkActionsMenu";
import SelectedPeoplePreview from "./SelectedPeoplePreview";
import {
  ChevronUpIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  DocumentArrowDownIcon,
} from "@heroicons/react/24/outline";

interface DataTableProps {
  people: Person[];
  onView?: (person: Person) => void;
  onEdit?: (person: Person) => void;
  onDelete?: (person: Person) => void;
  onBulkDelete?: (people: Person[]) => void;
  onBulkExport?: (people: Person[], format: "excel" | "pdf" | "csv") => void;
}

export default function DataTable({
  people,
  onView,
  onEdit,
  onDelete,
  onBulkDelete,
  onBulkExport,
}: DataTableProps) {
  type DisplayPerson = Person & {
    name: string;
    dateFirstAttended?: string;
    waterBaptismDate?: string;
    spiritBaptismDate?: string;
  };

  // Normalize backend fields and hide admin/blank-name entries from the table
  const displayPeople: DisplayPerson[] = people
    .filter(
      (p) =>
        p.username !== "admin" &&
        ((p.first_name ?? "") !== "" || (p.last_name ?? "") !== "")
    )
    .map((p) => ({
      ...p,
      name: `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim(),
      dateFirstAttended: p.date_first_attended,
      waterBaptismDate: (p as any).water_baptism_date,
      spiritBaptismDate: (p as any).spirit_baptism_date,
    }));

  const [sortField, setSortField] = useState<keyof DisplayPerson>("last_name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [currentPage, setCurrentPage] = useState(1);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedPeople, setSelectedPeople] = useState<Set<string>>(new Set());
  const itemsPerPage = 10;

  const handleSort = (field: keyof DisplayPerson) => {
    if (field === sortField) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const handleSelectAll = () => {
    if (selectedPeople.size === paginatedPeople.length) {
      setSelectedPeople(new Set());
    } else {
      setSelectedPeople(new Set(paginatedPeople.map((p) => p.id)));
    }
  };

  const handleSelectPerson = (personId: string) => {
    const newSelected = new Set(selectedPeople);
    if (newSelected.has(personId)) {
      newSelected.delete(personId);
    } else {
      newSelected.add(personId);
    }
    setSelectedPeople(newSelected);
  };

  const getSelectedPeopleObjects = (): Person[] => {
    return displayPeople.filter((p) => selectedPeople.has(p.id));
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return "bg-green-100 text-green-800";
      case "SEMIACTIVE":
        return "bg-yellow-100 text-yellow-800";
      case "INVITED":
        return "bg-yellow-100 text-yellow-800";
      case "ATTENDED":
        return "bg-green-100 text-green-800";
      case "INACTIVE":
        return "bg-red-100 text-red-800";
      case "DECEASED":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case "PASTOR":
        return "bg-purple-100 text-purple-800";
      case "COORDINATOR":
        return "bg-blue-100 text-blue-800";
      case "MEMBER":
        return "bg-green-100 text-green-800";
      case "VISITOR":
        return "bg-orange-100 text-orange-800";
      case "ADMIN":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const handleBulkDelete = () => {
    const selectedPeopleObjects = getSelectedPeopleObjects();
    if (onBulkDelete) {
      onBulkDelete(selectedPeopleObjects);
    }
    setSelectedPeople(new Set());
  };

  const handleBulkExport = (format: "excel" | "pdf" | "csv") => {
    const selectedPeopleObjects = getSelectedPeopleObjects();
    if (onBulkExport) {
      onBulkExport(selectedPeopleObjects, format);
    } else {
      // Fallback to local export
      switch (format) {
        case "excel":
          exportToExcel(selectedPeopleObjects as DisplayPerson[]);
          break;
        case "pdf":
          exportToPDF(selectedPeopleObjects as DisplayPerson[]);
          break;
        case "csv":
          exportToCSV(selectedPeopleObjects as DisplayPerson[]);
          break;
      }
    }
    setSelectedPeople(new Set());
  };

  const exportToExcel = (peopleToExport: any[] = displayPeople) => {
    const worksheet = XLSX.utils.json_to_sheet(
      peopleToExport.map((person) => ({
        Name: person.name,
        Email: person.email,
        Phone: person.phone,
        Role: person.role,
        Status: person.status,
        "Join Date": person.dateFirstAttended
          ? new Date(person.dateFirstAttended).toLocaleDateString()
          : "",
      }))
    );

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "People");
    XLSX.writeFile(workbook, "people_data.xlsx");
  };

  const exportToPDF = (peopleToExport: any[] = displayPeople) => {
    const doc = new jsPDF();

    const tableColumn = [
      "Name",
      "Email",
      "Phone",
      "Role",
      "Status",
      "Join Date",
    ];
    const tableRows = peopleToExport.map((person) => [
      person.name,
      person.email,
      person.phone ?? "",
      person.role,
      person.status,
      person.dateFirstAttended
        ? new Date(person.dateFirstAttended).toLocaleDateString()
        : "",
    ]);

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 20,
      theme: "grid",
      styles: { fontSize: 8 },
    });

    doc.save("people_data.pdf");
  };

  const exportToCSV = (peopleToExport: any[] = displayPeople) => {
    const csvContent = peopleToExport
      .map((person) =>
        [
          person.name,
          person.email,
          person.phone ?? "",
          person.role,
          person.status,
          person.dateFirstAttended
            ? new Date(person.dateFirstAttended).toLocaleDateString()
            : "",
        ].join(",")
      )
      .join("\n");

    const blob = new Blob(
      [`Name,Email,Phone,Role,Status,Join Date\n${csvContent}`],
      {
        type: "text/csv;charset=utf-8;",
      }
    );
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "people_data.csv";
    link.click();
  };

  const handleExport = (format: "excel" | "pdf" | "csv", fields?: string[]) => {
    setShowExportModal(false);
    // Build a projection of current people using selected fields
    const selected = fields && fields.length > 0 ? fields : undefined;
    const project = (list: DisplayPerson[]) =>
      list.map((p) => {
        const row: Record<string, any> = {};
        const source: any = p as any;
        const add = (k: string, v: any) => {
          row[k] = v ?? "";
        };
        const wanted = selected || [
          "first_name",
          "middle_name",
          "last_name",
          "email",
          "phone",
          "role",
          "status",
          "country",
          "address",
          "date_of_birth",
          "date_first_attended",
          "first_activity_attended",
          "water_baptism_date",
          "spirit_baptism_date",
          "member_id",
        ];
        for (const key of wanted) {
          switch (key) {
            case "date_first_attended":
              add(key, source.dateFirstAttended);
              break;
            case "first_activity_attended":
              add(key, source.first_activity_attended);
              break;
            case "water_baptism_date":
              add(key, source.waterBaptismDate);
              break;
            case "spirit_baptism_date":
              add(key, source.spiritBaptismDate);
              break;
            default:
              add(key, source[key]);
          }
        }
        return row;
      });

    switch (format) {
      case "excel":
        exportToExcel(project(displayPeople));
        break;
      case "pdf":
        exportToPDF(project(displayPeople));
        break;
      case "csv":
        exportToCSV(project(displayPeople));
        break;
    }
  };

  const SortIcon = ({ field }: { field: keyof DisplayPerson }) => {
    if (field !== sortField) return null;
    return sortDirection === "asc" ? (
      <ChevronUpIcon className="w-4 h-4 inline-block" />
    ) : (
      <ChevronDownIcon className="w-4 h-4 inline-block" />
    );
  };

  // Action Menu Component for each row
  const ActionMenu = ({ person }: { person: DisplayPerson }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [dropdownPosition, setDropdownPosition] = useState<"below" | "above">(
      "below"
    );
    const menuRef = useRef<HTMLDivElement>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const portalMenuRef = useRef<HTMLDivElement>(null);
    const [mounted, setMounted] = useState(false);
    const [coords, setCoords] = useState<{ top: number; left: number }>({
      top: 0,
      left: 0,
    });

    useEffect(() => {
      setMounted(true);
    }, []);

    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        const target = event.target as Node;
        const clickedInsideAnchor = menuRef.current?.contains(target);
        const clickedInsidePortal = portalMenuRef.current?.contains(target);
        if (!clickedInsideAnchor && !clickedInsidePortal) {
          setIsOpen(false);
        }
      };

      const recalc = () => {
        // Recalculate position on window resize
        if (isOpen && buttonRef.current) {
          const buttonRect = buttonRef.current.getBoundingClientRect();
          const viewportHeight = window.innerHeight;
          const dropdownHeight = 200;

          const spaceBelow = viewportHeight - buttonRect.bottom;
          const spaceAbove = buttonRect.top;

          let verticalPosition: "below" | "above" = "below";

          // Use the same improved logic
          if (spaceBelow < dropdownHeight) {
            if (spaceAbove > 30) {
              verticalPosition = "above";
            }
          }

          const viewportBottom60 = viewportHeight * 0.6;
          if (buttonRect.top > viewportBottom60 && spaceAbove > 30) {
            verticalPosition = "above";
          }

          if (spaceBelow < 150 && spaceAbove > 30) {
            verticalPosition = "above";
          }

          setDropdownPosition(verticalPosition);

          const dropdownWidth = 192; // w-48
          const top =
            verticalPosition === "above"
              ? window.scrollY + buttonRect.top - dropdownHeight - 8
              : window.scrollY + buttonRect.bottom + 8;
          const left = window.scrollX + buttonRect.right - dropdownWidth;
          setCoords({ top, left });
        }
      };

      document.addEventListener("mousedown", handleClickOutside);
      window.addEventListener("resize", recalc);
      window.addEventListener("scroll", recalc, { passive: true });

      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
        window.removeEventListener("resize", recalc);
        window.removeEventListener("scroll", recalc as any);
      };
    }, [isOpen]);

    const handleToggle = () => {
      if (!isOpen && buttonRef.current) {
        // Calculate position when opening
        const buttonRect = buttonRef.current.getBoundingClientRect();
        const viewportHeight = window.innerHeight;
        const viewportWidth = window.innerWidth;
        const dropdownHeight = 200; // Approximate height of dropdown
        const dropdownWidth = 192; // w-48 = 12rem = 192px

        // Check if there's enough space below
        const spaceBelow = viewportHeight - buttonRect.bottom;
        const spaceAbove = buttonRect.top;

        // Check horizontal space (for right alignment)
        const spaceRight = viewportWidth - buttonRect.right;
        const spaceLeft = buttonRect.left;

        // Determine vertical position
        let verticalPosition: "below" | "above" = "below";

        // More aggressive positioning logic
        // If there's not enough space below (less than dropdown height), prefer above
        if (spaceBelow < dropdownHeight) {
          // Position above if there's any reasonable space above
          if (spaceAbove > 30) {
            // Reduced threshold to 30px
            verticalPosition = "above";
          }
        }

        // Additional check: if we're in the bottom 60% of the viewport, prefer above
        const viewportBottom60 = viewportHeight * 0.6;
        if (buttonRect.top > viewportBottom60 && spaceAbove > 30) {
          verticalPosition = "above";
        }

        // Even more aggressive: if space below is less than 150px, prefer above
        if (spaceBelow < 150 && spaceAbove > 30) {
          verticalPosition = "above";
        }

        setDropdownPosition(verticalPosition);

        const top =
          verticalPosition === "above"
            ? window.scrollY + buttonRect.top - dropdownHeight - 8
            : window.scrollY + buttonRect.bottom + 8;
        const left = window.scrollX + buttonRect.right - dropdownWidth;
        setCoords({ top, left });
      }
      setIsOpen(!isOpen);
    };

    return (
      <div className="relative" ref={menuRef}>
        <button
          ref={buttonRef}
          onClick={handleToggle}
          className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          title="Actions"
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
              d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"
            />
          </svg>
        </button>

        {isOpen &&
          mounted &&
          ReactDOM.createPortal(
            <div
              ref={portalMenuRef}
              className="fixed w-48 bg-white rounded-md shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-[1000]"
              style={{ top: coords.top, left: coords.left }}
            >
              <div className="py-1">
                {onView && (
                  <button
                    onClick={() => {
                      onView(person as Person);
                      setIsOpen(false);
                    }}
                    className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-gray-900"
                  >
                    <svg
                      className="w-4 h-4 mr-2 text-blue-500"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                      />
                    </svg>
                    View
                  </button>
                )}
                {onEdit && (
                  <button
                    onClick={() => {
                      onEdit(person as Person);
                      setIsOpen(false);
                    }}
                    className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-gray-900"
                  >
                    <svg
                      className="w-4 h-4 mr-2 text-green-500"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                      />
                    </svg>
                    Edit
                  </button>
                )}
                {onDelete && (
                  <button
                    onClick={() => {
                      onDelete(person as Person);
                      setIsOpen(false);
                    }}
                    className="flex items-center w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50 hover:text-red-700"
                  >
                    <svg
                      className="w-4 h-4 mr-2"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                    Delete
                  </button>
                )}
              </div>
            </div>,
            document.body
          )}
      </div>
    );
  };

  const sortedPeople = [...displayPeople].sort((a, b) => {
    const aValue = a[sortField];
    const bValue = b[sortField];

    if (aValue === undefined && bValue === undefined) return 0;
    if (aValue === undefined) return sortDirection === "asc" ? 1 : -1;
    if (bValue === undefined) return sortDirection === "asc" ? -1 : 1;

    if (aValue < bValue) return sortDirection === "asc" ? -1 : 1;
    if (aValue > bValue) return sortDirection === "asc" ? 1 : -1;
    return 0;
  });

  const totalPages = Math.ceil(sortedPeople.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedPeople = sortedPeople.slice(startIndex, endIndex);

  return (
    <div className="space-y-6">
      <SelectedPeoplePreview
        selectedPeople={getSelectedPeopleObjects()}
        onClearSelection={() => setSelectedPeople(new Set())}
      />

      {/* Table Header with Actions */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              {selectedPeople.size > 0 && (
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-600">
                    {selectedPeople.size} selected
                  </span>
                  <BulkActionsMenu
                    onBulkDelete={handleBulkDelete}
                    onBulkExport={handleBulkExport}
                    selectedCount={selectedPeople.size}
                  />
                </div>
              )}
            </div>
            <div className="flex items-center space-x-2">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowExportModal(true)}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  <DocumentArrowDownIcon className="w-4 h-4 mr-2" />
                  Export All
                </button>
                <button
                  onClick={() => setShowImportModal(true)}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  <svg
                    className="w-4 h-4 mr-2"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 4v16h16M12 4v12m0 0l-3-3m3 3l3-3"
                    />
                  </svg>
                  Import
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={
                      selectedPeople.size === paginatedPeople.length &&
                      paginatedPeople.length > 0
                    }
                    onChange={handleSelectAll}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                </th>
                {[
                  "name",
                  "role",
                  "status",
                  "dateFirstAttended",
                  "waterBaptismDate",
                  "spiritBaptismDate",
                ].map((field) => (
                  <th
                    key={field}
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                    onClick={() => handleSort(field as keyof DisplayPerson)}
                  >
                    <div className="flex items-center space-x-1">
                      <span>
                        {(() => {
                          if (field === "dateFirstAttended")
                            return "FIRST ATTENDED";
                          if (field === "waterBaptismDate")
                            return "WATER BAPTISM";
                          if (field === "spiritBaptismDate")
                            return "SPIRIT BAPTISM";
                          return field.charAt(0).toUpperCase() + field.slice(1);
                        })()}
                      </span>
                      <SortIcon field={field as keyof DisplayPerson} />
                    </div>
                  </th>
                ))}
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"></th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {paginatedPeople.map((person) => (
                <tr
                  key={person.id}
                  className="hover:bg-gray-50 transition-colors"
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={selectedPeople.has(person.id)}
                      onChange={() => handleSelectPerson(person.id)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-full flex items-center justify-center text-white font-semibold text-sm mr-3">
                        {`${person.first_name?.[0] || ""}${
                          person.last_name?.[0] || ""
                        }`.toUpperCase()}
                      </div>
                      <button
                        type="button"
                        onClick={() => onView && onView(person as Person)}
                        className="text-left"
                        title="View profile"
                      >
                        <div className="text-sm font-medium text-blue-700 hover:underline">
                          {person.name}
                        </div>
                      </button>
                    </div>
                  </td>

                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${getRoleColor(
                        person.role
                      )}`}
                    >
                      {person.role.toLowerCase()}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(
                        person.status
                      )}`}
                    >
                      {person.status.toLowerCase()}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {person.dateFirstAttended
                      ? new Date(person.dateFirstAttended).toLocaleDateString()
                      : "-"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {person.waterBaptismDate
                      ? new Date(person.waterBaptismDate).toLocaleDateString()
                      : "-"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {person.spiritBaptismDate
                      ? new Date(person.spiritBaptismDate).toLocaleDateString()
                      : "-"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <ActionMenu person={person} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="bg-white px-6 py-3 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-700">
              Showing {startIndex + 1} to{" "}
              {Math.min(endIndex, sortedPeople.length)} of {sortedPeople.length}{" "}
              results
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeftIcon className="w-4 h-4" />
              </button>
              <span className="px-3 py-1 text-sm text-gray-700">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() =>
                  setCurrentPage(Math.min(totalPages, currentPage + 1))
                }
                disabled={currentPage === totalPages}
                className="px-3 py-1 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRightIcon className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <ExportPreviewModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        data={sortedPeople}
        onExport={handleExport}
      />
      <ImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImport={async (rows) => {
          // Minimal import passthrough: user can refine later
          // Here we just log; integrating with createPerson API can be added
          console.log("Import rows:", rows.length);
        }}
      />
    </div>
  );
}
