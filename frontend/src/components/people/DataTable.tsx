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
  Squares2X2Icon,
  TableCellsIcon,
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
    dateOfBirth?: string;
  };

  // Normalize backend fields and hide admin/blank-name entries from the table
  const displayPeople: DisplayPerson[] = people
    .filter(
      (p) =>
        p.role !== "ADMIN" && // Exclude ADMIN users
        p.username !== "admin" && // Keep the username check as backup
        ((p.first_name ?? "") !== "" || (p.last_name ?? "") !== "")
    )
    .map((p) => ({
      ...p,
      name: `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim(),
      dateFirstAttended: p.date_first_attended,
      waterBaptismDate: (p as any).water_baptism_date,
      spiritBaptismDate: (p as any).spirit_baptism_date,
      dateOfBirth: p.date_of_birth,
    }));

  const [sortField, setSortField] = useState<keyof DisplayPerson>("last_name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showColumnsModal, setShowColumnsModal] = useState(false);
  const [selectedPeople, setSelectedPeople] = useState<Set<string>>(new Set());
  const [openActionMenuId, setOpenActionMenuId] = useState<string | null>(null);
  const [openActionMenuView, setOpenActionMenuView] = useState<
    "mobile-card" | "mobile-table" | "desktop" | null
  >(null);
  const [mobileViewMode, setMobileViewMode] = useState<"cards" | "table">(
    "cards"
  );

  // Available columns with their config
  const availableColumns = [
    { key: "first_name", label: "First Name", default: true },
    { key: "middle_name", label: "Middle Name", default: false },
    { key: "last_name", label: "Last Name", default: true },
    { key: "suffix", label: "Suffix", default: false },
    { key: "username", label: "Username", default: false },
    { key: "email", label: "Email", default: false },
    { key: "phone", label: "Phone", default: false },
    { key: "gender", label: "Gender", default: false },
    { key: "address", label: "Address", default: false },
    { key: "country", label: "Country", default: false },
    { key: "role", label: "Role", default: true },
    { key: "status", label: "Status", default: true },
    { key: "branch", label: "Branch", default: false },
    { key: "dateOfBirth", label: "Date of Birth", default: false },
    { key: "dateFirstAttended", label: "First Attended", default: true },
    { key: "waterBaptismDate", label: "Water Baptism", default: false },
    { key: "spiritBaptismDate", label: "Spirit Baptism", default: false },
    { key: "first_activity_attended", label: "First Activity", default: false },
    { key: "member_id", label: "LAMP ID", default: false },
    { key: "facebook_name", label: "Facebook Name", default: false },
  ];

  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(
    new Set(availableColumns.filter((col) => col.default).map((col) => col.key))
  );

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
  const ActionMenu = ({
    person,
    isOpen,
    onOpen,
    onClose,
    currentOpenMenuId,
    viewType,
  }: {
    person: DisplayPerson;
    isOpen: boolean;
    onOpen: () => void;
    onClose: () => void;
    currentOpenMenuId: string | null;
    viewType: "mobile-card" | "mobile-table" | "desktop";
  }) => {
    const menuRef = useRef<HTMLDivElement>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const portalMenuRef = useRef<HTMLDivElement>(null);
    const [mounted, setMounted] = useState(false);
    const [coords, setCoords] = useState<{ top: number; left: number } | null>(
      null
    );

    useEffect(() => {
      setMounted(true);
    }, []);

    // Calculate position when menu opens
    useEffect(() => {
      // Only calculate if this menu is actually open, matches the global state, and matches the view type
      const isActiveView =
        (viewType === "mobile-card" && mobileViewMode === "cards") ||
        (viewType === "mobile-table" && mobileViewMode === "table") ||
        viewType === "desktop";

      if (
        isOpen &&
        currentOpenMenuId === person.id &&
        openActionMenuView === viewType &&
        isActiveView &&
        buttonRef.current
      ) {
        const buttonRect = buttonRef.current.getBoundingClientRect();
        const viewportHeight = window.innerHeight;
        const viewportWidth = window.innerWidth;
        const dropdownHeight = 200;
        const dropdownWidth = 192;
        const isMobile = viewportWidth < 768;

        // Calculate top position
        const minTop = 8;
        const maxTop = Math.max(minTop, viewportHeight - dropdownHeight - 8);
        const proposedTop = buttonRect.bottom + 4;
        const top = Math.max(minTop, Math.min(maxTop, proposedTop));

        // Calculate left position - on mobile, center it or align to button
        let left: number;
        if (isMobile) {
          // On mobile, try to align with button, but ensure it fits
          const proposedLeft = buttonRect.right - dropdownWidth;
          const minLeft = 8;
          const maxLeft = viewportWidth - dropdownWidth - 8;
          left = Math.max(minLeft, Math.min(maxLeft, proposedLeft));
        } else {
          // On desktop, align to right edge of button
          const proposedLeft = buttonRect.right - dropdownWidth;
          const minLeft = 8;
          const maxLeft = viewportWidth - dropdownWidth - 8;
          left = Math.max(minLeft, Math.min(maxLeft, proposedLeft));
        }

        setCoords({ top, left });
      } else if (
        !isOpen ||
        currentOpenMenuId !== person.id ||
        openActionMenuView !== viewType
      ) {
        setCoords(null);
      }
    }, [
      isOpen,
      currentOpenMenuId,
      person.id,
      openActionMenuView,
      viewType,
      mobileViewMode,
    ]);

    useEffect(() => {
      if (!isOpen) return;

      const handleClickOutside = (event: MouseEvent | TouchEvent) => {
        const target = event.target as Node;
        const clickedInsideButton = menuRef.current?.contains(target);
        const clickedInsidePortal = portalMenuRef.current?.contains(target);
        if (!clickedInsideButton && !clickedInsidePortal) {
          onClose();
        }
      };

      // Use mousedown for desktop and touchend for mobile
      // touchend fires after the user lifts their finger, allowing button actions to complete first
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("touchend", handleClickOutside);

      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
        document.removeEventListener("touchend", handleClickOutside);
      };
    }, [isOpen, onClose]);

    const handleToggle = (
      e:
        | React.MouseEvent<HTMLButtonElement>
        | React.TouchEvent<HTMLButtonElement>
    ) => {
      e.preventDefault();
      e.stopPropagation();
      if ("stopImmediatePropagation" in e.nativeEvent) {
        e.nativeEvent.stopImmediatePropagation();
      }

      if (!isOpen) {
        // Close any other open menu first
        if (currentOpenMenuId && currentOpenMenuId !== person.id) {
          onClose();
        }
        // Small delay to ensure state is cleared
        requestAnimationFrame(() => {
          onOpen();
        });
      } else {
        onClose();
      }
    };

    return (
      <div className="relative" ref={menuRef}>
        <button
          ref={buttonRef}
          onClick={handleToggle}
          onTouchEnd={handleToggle}
          type="button"
          className="p-2 min-h-[44px] min-w-[44px] text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors flex items-center justify-center"
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
              d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z"
            />
          </svg>
        </button>

        {isOpen &&
          mounted &&
          coords &&
          currentOpenMenuId === person.id &&
          openActionMenuView === viewType &&
          ReactDOM.createPortal(
            <div
              ref={portalMenuRef}
              className="fixed w-48 bg-white rounded-md shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-[9999]"
              style={{ top: `${coords.top}px`, left: `${coords.left}px` }}
              onClick={(e) => {
                // Only stop propagation to prevent outside click handler from firing
                // Don't prevent default so buttons inside can be clicked
                e.stopPropagation();
              }}
              onMouseDown={(e) => {
                // Prevent mousedown from bubbling to document (which would close menu)
                e.stopPropagation();
              }}
              onTouchStart={(e) => {
                // Prevent touchstart from bubbling to document (which would close menu on mobile)
                e.stopPropagation();
              }}
              onTouchEnd={(e) => {
                // Prevent touchend from bubbling to document (which would close menu on mobile)
                e.stopPropagation();
              }}
            >
              <div className="py-1">
                {onView && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onView(person as Person);
                      onClose();
                    }}
                    onTouchEnd={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onView(person as Person);
                      onClose();
                    }}
                    className="flex items-center w-full px-4 py-2 min-h-[44px] text-sm text-gray-700 hover:bg-gray-100 hover:text-gray-900 active:bg-gray-100 cursor-pointer"
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
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onEdit(person as Person);
                      onClose();
                    }}
                    onTouchEnd={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onEdit(person as Person);
                      onClose();
                    }}
                    className="flex items-center w-full px-4 py-2 min-h-[44px] text-sm text-gray-700 hover:bg-gray-100 hover:text-gray-900 active:bg-gray-100 cursor-pointer"
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
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onDelete(person as Person);
                      onClose();
                    }}
                    onTouchEnd={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onDelete(person as Person);
                      onClose();
                    }}
                    className="flex items-center w-full px-4 py-2 min-h-[44px] text-sm text-red-600 hover:bg-red-50 hover:text-red-700 active:bg-red-50 cursor-pointer"
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
        <div className="px-4 md:px-6 py-4 border-b border-gray-200">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-0 md:gap-4">
            {/* Selected People */}
            <div className="flex items-center justify-end md:justify-start space-x-4 mb-2 md:mb-0">
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
            <div className="flex items-center space-x-2 flex-wrap gap-2">
              {/* Mobile View Toggle - Only visible on mobile */}
              <div className="md:hidden flex items-center border border-gray-300 rounded-lg overflow-hidden">
                <button
                  onClick={() => setMobileViewMode("cards")}
                  className={`px-3 py-2 min-h-[44px] flex items-center justify-center transition-colors ${
                    mobileViewMode === "cards"
                      ? "bg-blue-500 text-white"
                      : "bg-white text-gray-700 hover:bg-gray-50"
                  }`}
                  title="Card View"
                >
                  <Squares2X2Icon className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setMobileViewMode("table")}
                  className={`px-3 py-2 min-h-[44px] flex items-center justify-center transition-colors ${
                    mobileViewMode === "table"
                      ? "bg-blue-500 text-white"
                      : "bg-white text-gray-700 hover:bg-gray-50"
                  }`}
                  title="Table View"
                >
                  <TableCellsIcon className="w-5 h-5" />
                </button>
              </div>

              <div className="flex items-center flex-wrap gap-2 md:gap-4 !ml-0 md:ml-2">
                <button
                  onClick={() => setShowColumnsModal(true)}
                  className="inline-flex items-center px-3 md:px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 min-h-[44px] md:min-h-0"
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
                      d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"
                    />
                  </svg>
                  Columns
                </button>
                <button
                  onClick={() => setShowExportModal(true)}
                  className="inline-flex items-center px-3 md:px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 min-h-[44px] md:min-h-0"
                >
                  <DocumentArrowDownIcon className="w-4 h-4 mr-2" />
                  <span className="hidden sm:inline">Export All</span>
                  <span className="sm:hidden">Export</span>
                </button>
                <button
                  onClick={() => setShowImportModal(true)}
                  className="inline-flex items-center px-3 md:px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 min-h-[44px] md:min-h-0"
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

        {/* Mobile Card View */}
        {mobileViewMode === "cards" && (
          <div className="md:hidden space-y-4 p-4">
            {paginatedPeople.map((person) => (
              <div
                key={person.id}
                className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center space-x-3 flex-1 min-w-0">
                    <input
                      type="checkbox"
                      checked={selectedPeople.has(person.id)}
                      onChange={() => handleSelectPerson(person.id)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 mt-1 flex-shrink-0"
                    />
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-full flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
                      {`${person.first_name?.[0] || ""}${
                        person.last_name?.[0] || ""
                      }`.toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <button
                        type="button"
                        onClick={() => onView && onView(person as Person)}
                        className="text-left w-full"
                      >
                        <div className="text-sm font-semibold text-blue-700 hover:underline truncate">
                          {person.first_name} {person.last_name}
                        </div>
                      </button>
                    </div>
                  </div>
                  <ActionMenu
                    person={person}
                    isOpen={openActionMenuId === person.id}
                    onOpen={() => {
                      setOpenActionMenuId(person.id);
                      setOpenActionMenuView("mobile-card");
                    }}
                    onClose={() => {
                      setOpenActionMenuId(null);
                      setOpenActionMenuView(null);
                    }}
                    currentOpenMenuId={openActionMenuId}
                    viewType="mobile-card"
                  />
                </div>
                <div className="space-y-2 pl-14">
                  {visibleColumns.has("email") && person.email && (
                    <div className="text-sm">
                      <span className="text-gray-500 font-medium">Email: </span>
                      <span className="text-gray-900">{person.email}</span>
                    </div>
                  )}
                  {visibleColumns.has("phone") && person.phone && (
                    <div className="text-sm">
                      <span className="text-gray-500 font-medium">Phone: </span>
                      <span className="text-gray-900">{person.phone}</span>
                    </div>
                  )}
                  {visibleColumns.has("role") && (
                    <div className="text-sm flex items-center gap-2">
                      <span className="text-gray-500 font-medium">Role: </span>
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${getRoleColor(
                          person.role
                        )}`}
                      >
                        {person.role}
                      </span>
                    </div>
                  )}
                  {visibleColumns.has("status") && (
                    <div className="text-sm flex items-center gap-2">
                      <span className="text-gray-500 font-medium">
                        Status:{" "}
                      </span>
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(
                          person.status
                        )}`}
                      >
                        {person.status}
                      </span>
                    </div>
                  )}
                  {visibleColumns.has("dateFirstAttended") &&
                    person.dateFirstAttended && (
                      <div className="text-sm">
                        <span className="text-gray-500 font-medium">
                          First Attended:{" "}
                        </span>
                        <span className="text-gray-900">
                          {new Date(
                            person.dateFirstAttended
                          ).toLocaleDateString()}
                        </span>
                      </div>
                    )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Mobile Table View */}
        {mobileViewMode === "table" && (
          <div className="md:hidden overflow-x-auto p-4">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left">
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
                  {availableColumns.map((col) => {
                    if (!visibleColumns.has(col.key)) return null;
                    const field = col.key;
                    return (
                      <th
                        key={field}
                        className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                        onClick={() => handleSort(field as keyof DisplayPerson)}
                      >
                        <div className="flex items-center space-x-1">
                          <span>{col.label}</span>
                          <SortIcon field={field as keyof DisplayPerson} />
                        </div>
                      </th>
                    );
                  })}
                  <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-12"></th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {paginatedPeople.map((person) => (
                  <tr
                    key={person.id}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-4 py-3 whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={selectedPeople.has(person.id)}
                        onChange={() => handleSelectPerson(person.id)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                    </td>
                    {availableColumns.map((col) => {
                      if (!visibleColumns.has(col.key)) return null;
                      const field = col.key;
                      return (
                        <td key={field} className="px-4 py-3 whitespace-nowrap">
                          {field === "first_name" && (
                            <div className="flex items-center">
                              <div className="w-8 h-8 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-full flex items-center justify-center text-white font-semibold text-xs mr-2">
                                {`${person.first_name?.[0] || ""}${
                                  person.last_name?.[0] || ""
                                }`.toUpperCase()}
                              </div>
                              <button
                                type="button"
                                onClick={() =>
                                  onView && onView(person as Person)
                                }
                                className="text-left"
                                title="View profile"
                              >
                                <div className="text-sm font-medium text-blue-700 hover:underline">
                                  {person.first_name || "-"}
                                </div>
                              </button>
                            </div>
                          )}
                          {field === "last_name" && (
                            <button
                              type="button"
                              onClick={() => onView && onView(person as Person)}
                              className="text-left"
                              title="View profile"
                            >
                              <div className="text-sm font-medium text-blue-700 hover:underline">
                                {person.last_name || "-"}
                              </div>
                            </button>
                          )}
                          {field === "middle_name" && (
                            <div className="text-sm text-gray-900">
                              {person.middle_name || "-"}
                            </div>
                          )}
                          {field === "suffix" && (
                            <div className="text-sm text-gray-900">
                              {person.suffix || "-"}
                            </div>
                          )}
                          {field === "username" && (
                            <div className="text-sm text-gray-900">
                              {person.username || "-"}
                            </div>
                          )}
                          {field === "email" && (
                            <div className="text-sm text-gray-900">
                              {person.email || "-"}
                            </div>
                          )}
                          {field === "phone" && (
                            <div className="text-sm text-gray-900">
                              {person.phone || "-"}
                            </div>
                          )}
                          {field === "gender" && (
                            <div className="text-sm text-gray-900">
                              {person.gender || "-"}
                            </div>
                          )}
                          {field === "address" && (
                            <div className="text-sm text-gray-900">
                              {person.address || "-"}
                            </div>
                          )}
                          {field === "country" && (
                            <div className="text-sm text-gray-900">
                              {person.country || "-"}
                            </div>
                          )}
                          {field === "member_id" && (
                            <div className="text-sm text-gray-900">
                              {person.member_id || "-"}
                            </div>
                          )}
                          {field === "facebook_name" && (
                            <div className="text-sm text-gray-900">
                              {person.facebook_name || "-"}
                            </div>
                          )}
                          {field === "dateOfBirth" && (
                            <div className="text-sm text-gray-900">
                              {person.dateOfBirth
                                ? new Date(
                                    person.dateOfBirth
                                  ).toLocaleDateString()
                                : "-"}
                            </div>
                          )}
                          {field === "first_activity_attended" && (
                            <div className="text-sm text-gray-900">
                              {(person as any).first_activity_attended || "-"}
                            </div>
                          )}
                          {field === "role" && (
                            <span
                              className={`px-2 py-1 rounded-full text-xs font-medium ${getRoleColor(
                                person.role
                              )}`}
                            >
                              {person.role}
                            </span>
                          )}
                          {field === "status" && (
                            <span
                              className={`px-2 py-1 rounded-full text-xs font-medium ${
                                person.status === "ACTIVE"
                                  ? "bg-green-100 text-green-800"
                                  : person.status === "INACTIVE"
                                  ? "bg-gray-100 text-gray-800"
                                  : "bg-red-100 text-red-800"
                              }`}
                            >
                              {person.status}
                            </span>
                          )}
                          {field === "branch" && (
                            <div className="text-sm text-gray-900">
                              {person.branch_name ||
                                (person.branch
                                  ? `Branch ${person.branch}`
                                  : "-")}
                            </div>
                          )}
                          {field === "dateFirstAttended" && (
                            <div className="text-sm text-gray-900">
                              {person.dateFirstAttended
                                ? new Date(
                                    person.dateFirstAttended
                                  ).toLocaleDateString()
                                : "-"}
                            </div>
                          )}
                          {field === "waterBaptismDate" && (
                            <div className="text-sm text-gray-900">
                              {person.waterBaptismDate
                                ? new Date(
                                    person.waterBaptismDate
                                  ).toLocaleDateString()
                                : "-"}
                            </div>
                          )}
                          {field === "spiritBaptismDate" && (
                            <div className="text-sm text-gray-900">
                              {person.spiritBaptismDate
                                ? new Date(
                                    person.spiritBaptismDate
                                  ).toLocaleDateString()
                                : "-"}
                            </div>
                          )}
                        </td>
                      );
                    })}
                    <td className="px-2 py-3 whitespace-nowrap text-sm font-medium w-12">
                      <ActionMenu
                        person={person}
                        isOpen={openActionMenuId === person.id}
                        onOpen={() => {
                          setOpenActionMenuId(person.id);
                          setOpenActionMenuView("mobile-table");
                        }}
                        onClose={() => {
                          setOpenActionMenuId(null);
                          setOpenActionMenuView(null);
                        }}
                        currentOpenMenuId={openActionMenuId}
                        viewType="mobile-table"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Desktop Table */}
        <div className="hidden md:block overflow-x-auto">
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
                {availableColumns.map((col) => {
                  if (!visibleColumns.has(col.key)) return null;
                  const field = col.key;
                  return (
                    <th
                      key={field}
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                      onClick={() => handleSort(field as keyof DisplayPerson)}
                    >
                      <div className="flex items-center space-x-1">
                        <span>{col.label.toUpperCase()}</span>
                        <SortIcon field={field as keyof DisplayPerson} />
                      </div>
                    </th>
                  );
                })}
                <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-12"></th>
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
                  {availableColumns.map((col) => {
                    if (!visibleColumns.has(col.key)) return null;
                    const field = col.key;
                    return (
                      <td key={field} className="px-6 py-4 whitespace-nowrap">
                        {field === "first_name" && (
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
                                {person.first_name || "-"}
                              </div>
                            </button>
                          </div>
                        )}
                        {field === "last_name" && (
                          <button
                            type="button"
                            onClick={() => onView && onView(person as Person)}
                            className="text-left"
                            title="View profile"
                          >
                            <div className="text-sm font-medium text-blue-700 hover:underline">
                              {person.last_name || "-"}
                            </div>
                          </button>
                        )}
                        {field === "middle_name" && (
                          <div className="text-sm text-gray-900">
                            {person.middle_name || "-"}
                          </div>
                        )}
                        {field === "suffix" && (
                          <div className="text-sm text-gray-900">
                            {person.suffix || "-"}
                          </div>
                        )}
                        {field === "username" && (
                          <div className="text-sm text-gray-900">
                            {person.username || "-"}
                          </div>
                        )}
                        {field === "email" && (
                          <div className="text-sm text-gray-900">
                            {person.email || "-"}
                          </div>
                        )}
                        {field === "phone" && (
                          <div className="text-sm text-gray-900">
                            {person.phone || "-"}
                          </div>
                        )}
                        {field === "gender" && (
                          <div className="text-sm text-gray-900">
                            {person.gender || "-"}
                          </div>
                        )}
                        {field === "address" && (
                          <div className="text-sm text-gray-900">
                            {person.address || "-"}
                          </div>
                        )}
                        {field === "country" && (
                          <div className="text-sm text-gray-900">
                            {person.country || "-"}
                          </div>
                        )}
                        {field === "member_id" && (
                          <div className="text-sm text-gray-900">
                            {person.member_id || "-"}
                          </div>
                        )}
                        {field === "facebook_name" && (
                          <div className="text-sm text-gray-900">
                            {person.facebook_name || "-"}
                          </div>
                        )}
                        {field === "dateOfBirth" && (
                          <div className="text-sm text-gray-900">
                            {person.dateOfBirth
                              ? new Date(
                                  person.dateOfBirth
                                ).toLocaleDateString()
                              : "-"}
                          </div>
                        )}
                        {field === "first_activity_attended" && (
                          <div className="text-sm text-gray-900">
                            {(person as any).first_activity_attended || "-"}
                          </div>
                        )}
                        {field === "role" && (
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-medium ${getRoleColor(
                              person.role
                            )}`}
                          >
                            {person.role.toLowerCase()}
                          </span>
                        )}
                        {field === "status" && (
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(
                              person.status
                            )}`}
                          >
                            {person.status.toLowerCase()}
                          </span>
                        )}
                        {field === "branch" && (
                          <div className="text-sm text-gray-900">
                            {person.branch_name ||
                              (person.branch ? `Branch ${person.branch}` : "-")}
                          </div>
                        )}
                        {field === "dateFirstAttended" && (
                          <div className="text-sm text-gray-900">
                            {person.dateFirstAttended
                              ? new Date(
                                  person.dateFirstAttended
                                ).toLocaleDateString()
                              : "-"}
                          </div>
                        )}
                        {field === "waterBaptismDate" && (
                          <div className="text-sm text-gray-900">
                            {person.waterBaptismDate
                              ? new Date(
                                  person.waterBaptismDate
                                ).toLocaleDateString()
                              : "-"}
                          </div>
                        )}
                        {field === "spiritBaptismDate" && (
                          <div className="text-sm text-gray-900">
                            {person.spiritBaptismDate
                              ? new Date(
                                  person.spiritBaptismDate
                                ).toLocaleDateString()
                              : "-"}
                          </div>
                        )}
                      </td>
                    );
                  })}
                  <td className="px-2 py-4 whitespace-nowrap text-sm font-medium w-12">
                    <ActionMenu
                      person={person}
                      isOpen={openActionMenuId === person.id}
                      onOpen={() => {
                        setOpenActionMenuId(person.id);
                        setOpenActionMenuView("desktop");
                      }}
                      onClose={() => {
                        setOpenActionMenuId(null);
                        setOpenActionMenuView(null);
                      }}
                      currentOpenMenuId={openActionMenuId}
                      viewType="desktop"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="bg-white px-4 md:px-6 py-3 border-t border-gray-200">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-sm text-gray-700 text-center sm:text-left">
              Showing {startIndex + 1} to{" "}
              {Math.min(endIndex, sortedPeople.length)} of {sortedPeople.length}{" "}
              results
            </div>
            <div className="flex items-center space-x-2 sm:space-x-4 flex-wrap justify-center">
              <div className="flex items-center space-x-2">
                <label className="text-sm text-gray-700 hidden sm:inline">
                  Show:
                </label>
                <select
                  value={itemsPerPage}
                  onChange={(e) => {
                    setItemsPerPage(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="px-3 py-2 text-sm rounded-lg border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 min-h-[44px] md:min-h-0"
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={30}>30</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-2 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors min-h-[44px] md:min-h-0 min-w-[44px] md:min-w-0 flex items-center justify-center"
                  aria-label="Previous page"
                >
                  <ChevronLeftIcon className="w-4 h-4" />
                </button>
                <span className="px-3 py-2 text-sm text-gray-700 min-h-[44px] md:min-h-0 flex items-center">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() =>
                    setCurrentPage(Math.min(totalPages, currentPage + 1))
                  }
                  disabled={currentPage === totalPages}
                  className="px-3 py-2 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors min-h-[44px] md:min-h-0 min-w-[44px] md:min-w-0 flex items-center justify-center"
                  aria-label="Next page"
                >
                  <ChevronRightIcon className="w-4 h-4" />
                </button>
              </div>
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

      {/* Columns Configuration Modal */}
      {showColumnsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                Configure Columns
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                Select which columns to display in the table
              </p>
            </div>
            <div className="px-6 py-4 max-h-96 overflow-y-auto">
              <div className="space-y-2">
                {availableColumns.map((col) => (
                  <label
                    key={col.key}
                    className="flex items-center space-x-3 cursor-pointer hover:bg-gray-50 p-2 rounded"
                  >
                    <input
                      type="checkbox"
                      checked={visibleColumns.has(col.key)}
                      onChange={(e) => {
                        const newVisible = new Set(visibleColumns);
                        if (e.target.checked) {
                          newVisible.add(col.key);
                        } else {
                          newVisible.delete(col.key);
                        }
                        setVisibleColumns(newVisible);
                      }}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">{col.label}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end space-x-3">
              <button
                onClick={() => {
                  setVisibleColumns(
                    new Set(
                      availableColumns
                        .filter((col) => col.default)
                        .map((col) => col.key)
                    )
                  );
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900"
              >
                Reset to Default
              </button>
              <button
                onClick={() => setShowColumnsModal(false)}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
