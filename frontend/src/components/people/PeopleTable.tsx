"use client";

import { useState } from "react";
import { Person } from "@/src/types/person";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import ExportPreviewModal from "./ExportPreviewModal";
import BulkActionsMenu from "./BulkActionsMenu";
import SelectedPeoplePreview from "./SelectedPeoplePreview";
import {
  ChevronUpIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  DocumentArrowDownIcon,
} from "@heroicons/react/24/outline";

interface PeopleTableProps {
  people: Person[];
  onView?: (person: Person) => void;
  onEdit?: (person: Person) => void;
  onDelete?: (person: Person) => void;
  onBulkDelete?: (people: Person[]) => void;
  onBulkExport?: (people: Person[], format: "excel" | "pdf" | "csv") => void;
}

export default function PeopleTable({
  people,
  onView,
  onEdit,
  onDelete,
  onBulkDelete,
  onBulkExport,
}: PeopleTableProps) {
  type DisplayPerson = Person & { name: string; dateFirstAttended?: string };

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
    }));

  const [sortField, setSortField] = useState<keyof DisplayPerson>("last_name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [currentPage, setCurrentPage] = useState(1);
  const [showExportModal, setShowExportModal] = useState(false);
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

  const exportToExcel = (peopleToExport: DisplayPerson[] = displayPeople) => {
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

  const exportToPDF = (peopleToExport: DisplayPerson[] = displayPeople) => {
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

  const exportToCSV = (peopleToExport: DisplayPerson[] = displayPeople) => {
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

  const handleExport = (format: "excel" | "pdf" | "csv") => {
    setShowExportModal(false);
    switch (format) {
      case "excel":
        exportToExcel();
        break;
      case "pdf":
        exportToPDF();
        break;
      case "csv":
        exportToCSV();
        break;
    }
  };

  const handleBulkExport = (format: "excel" | "pdf" | "csv") => {
    const selectedPeopleObjects = getSelectedPeopleObjects();
    if (onBulkExport) {
      onBulkExport(selectedPeopleObjects, format);
    } else {
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

  const handleBulkDelete = () => {
    const selectedPeopleObjects = getSelectedPeopleObjects();
    if (onBulkDelete) {
      onBulkDelete(selectedPeopleObjects);
    }
    setSelectedPeople(new Set());
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return "bg-green-100 text-green-800";
      case "SEMIACTIVE":
        return "bg-yellow-100 text-yellow-800";
      case "INACTIVE":
        return "bg-gray-100 text-gray-800";
      case "DECEASED":
        return "bg-red-100 text-red-800";
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

  const SortIcon = ({ field }: { field: keyof DisplayPerson }) => {
    if (field !== sortField) return null;
    return sortDirection === "asc" ? (
      <ChevronUpIcon className="w-4 h-4 inline-block" />
    ) : (
      <ChevronDownIcon className="w-4 h-4 inline-block" />
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
  const paginatedPeople = sortedPeople.slice(
    startIndex,
    startIndex + itemsPerPage
  );

  return (
    <div className="space-y-4">
      <SelectedPeoplePreview
        selectedPeople={getSelectedPeopleObjects()}
        onClearSelection={() => setSelectedPeople(new Set())}
      />

      <div className="flex justify-between items-center">
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
        <div className="relative group">
          <button
            onClick={() => setShowExportModal(true)}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 flex items-center gap-2"
          >
            <DocumentArrowDownIcon className="w-4 h-4" />
            Export All
          </button>
        </div>
      </div>

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
                "email",
                "phone",
                "role",
                "status",
                "dateFirstAttended",
              ].map((field) => (
                <th
                  key={field}
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort(field as keyof DisplayPerson)}
                >
                  {field.charAt(0).toUpperCase() + field.slice(1)}{" "}
                  <SortIcon field={field as keyof DisplayPerson} />
                </th>
              ))}
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {paginatedPeople.map((person) => (
              <tr key={person.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <input
                    type="checkbox"
                    checked={selectedPeople.has(person.id)}
                    onChange={() => handleSelectPerson(person.id)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                </td>
                <td className="px-6 py-4 whitespace-nowrap">{person.name}</td>
                <td className="px-6 py-4 whitespace-nowrap">{person.email}</td>
                <td className="px-6 py-4 whitespace-nowrap">{person.phone}</td>
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
                <td className="px-6 py-4 whitespace-nowrap">
                  {person.dateFirstAttended
                    ? new Date(person.dateFirstAttended).toLocaleDateString()
                    : ""}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex gap-2">
                    {onView && (
                      <button
                        className="px-2 py-1 text-xs rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200"
                        onClick={() => onView(person as Person)}
                      >
                        View
                      </button>
                    )}
                    {onEdit && (
                      <button
                        className="px-2 py-1 text-xs rounded-md bg-blue-100 text-blue-700 hover:bg-blue-200"
                        onClick={() => onEdit(person as Person)}
                      >
                        Edit
                      </button>
                    )}
                    {onDelete && (
                      <button
                        className="px-2 py-1 text-xs rounded-md bg-red-100 text-red-700 hover:bg-red-200"
                        onClick={() => onDelete(person as Person)}
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex items-center justify-between px-4 py-3 bg-white border-t border-gray-200 sm:px-6">
          <div className="flex justify-between items-center mt-4">
            <button
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 rounded-md bg-gray-100 text-gray-700 disabled:opacity-50"
            >
              <ChevronLeftIcon className="w-5 h-5" />
            </button>
            <span className="px-4">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() =>
                setCurrentPage(Math.min(totalPages, currentPage + 1))
              }
              disabled={currentPage === totalPages}
              className="px-3 py-1 rounded-md bg-gray-100 text-gray-700 disabled:opacity-50"
            >
              <ChevronRightIcon className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      <ExportPreviewModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        data={sortedPeople}
        onExport={handleExport}
      />
    </div>
  );
}
