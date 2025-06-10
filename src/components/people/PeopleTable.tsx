"use client";

import { useState } from "react";
import { Person } from "@/src/types/person";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import ExportPreviewModal from "./ExportPreviewModal";
import {
  ChevronUpIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  DocumentArrowDownIcon,
} from "@heroicons/react/24/outline";

interface PeopleTableProps {
  people: Person[];
}

export default function PeopleTable({ people }: PeopleTableProps) {
  const [sortField, setSortField] = useState<keyof Person>("name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [currentPage, setCurrentPage] = useState(1);
  const [showExportModal, setShowExportModal] = useState(false);
  const itemsPerPage = 10;

  const handleSort = (field: keyof Person) => {
    if (field === sortField) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const exportToExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(
      people.map((person) => ({
        Name: person.name,
        Email: person.email,
        Phone: person.phone,
        Role: person.role,
        "Join Date": new Date(person.joinDate).toLocaleDateString(),
      }))
    );

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "People");
    XLSX.writeFile(workbook, "people_data.xlsx");
  };

  const exportToPDF = () => {
    const doc = new jsPDF();

    const tableColumn = ["Name", "Email", "Phone", "Role", "Join Date"];
    const tableRows = people.map((person) => [
      person.name,
      person.email,
      person.phone,
      person.role,
      new Date(person.joinDate).toLocaleDateString(),
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

  const exportToCSV = () => {
    const csvContent = people
      .map((person) =>
        [
          person.name,
          person.email,
          person.phone,
          person.role,
          new Date(person.joinDate).toLocaleDateString(),
        ].join(",")
      )
      .join("\n");

    const blob = new Blob([`Name,Email,Phone,Role,Join Date\n${csvContent}`], {
      type: "text/csv;charset=utf-8;",
    });
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

  const SortIcon = ({ field }: { field: keyof Person }) => {
    if (field !== sortField) return null;
    return sortDirection === "asc" ? (
      <ChevronUpIcon className="w-4 h-4 inline-block" />
    ) : (
      <ChevronDownIcon className="w-4 h-4 inline-block" />
    );
  };

  const sortedPeople = [...people].sort((a, b) => {
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
      <div className="flex justify-end">
        <div className="relative group">
          <button
            onClick={() => setShowExportModal(true)}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 flex items-center gap-2"
          >
            <DocumentArrowDownIcon className="w-4 h-4" />
            Export
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {["name", "email", "phone", "role", "joinDate"].map((field) => (
                <th
                  key={field}
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort(field as keyof Person)}
                >
                  {field.charAt(0).toUpperCase() + field.slice(1)}{" "}
                  <SortIcon field={field as keyof Person} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {paginatedPeople.map((person) => (
              <tr key={person.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">{person.name}</td>
                <td className="px-6 py-4 whitespace-nowrap">{person.email}</td>
                <td className="px-6 py-4 whitespace-nowrap">{person.phone}</td>
                <td className="px-6 py-4 whitespace-nowrap">{person.role}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {new Date(person.joinDate).toLocaleDateString()}
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
