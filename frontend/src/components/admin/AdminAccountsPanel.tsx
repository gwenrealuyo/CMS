"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import LoadingSpinner from "@/src/components/ui/LoadingSpinner";
import ConfirmationModal from "@/src/components/ui/ConfirmationModal";
import ActionMenu from "@/src/components/families/ActionMenu";
import { peopleApi } from "@/src/lib/api";
import { useAuth } from "@/src/contexts/AuthContext";
import { Person } from "@/src/types/person";
import { formatPersonName } from "@/src/lib/name";
import { TABLE_ENTITY_LINK_CLASS } from "@/src/lib/tableEntityLink";

function unwrapPeopleList(data: unknown): Person[] {
  if (Array.isArray(data)) return data;
  if (
    data &&
    typeof data === "object" &&
    Array.isArray((data as { results?: Person[] }).results)
  ) {
    return (data as { results: Person[] }).results;
  }
  return [];
}

type SortField = "name" | "username" | "email" | "branch" | "status";
type SortDirection = "asc" | "desc";

function sortValue(person: Person, field: SortField): string {
  switch (field) {
    case "name":
      return formatPersonName(person).toLowerCase();
    case "username":
      return (person.username || "").toLowerCase();
    case "email":
      return (person.email || "").toLowerCase();
    case "branch":
      return (person.branch_code || person.branch_name || "").toLowerCase();
    case "status":
      return (person.status || "").toLowerCase();
  }
}

export default function AdminAccountsPanel() {
  const { user } = useAuth();
  const [admins, setAdmins] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    isOpen: boolean;
    person: Person | null;
    loading: boolean;
  }>({ isOpen: false, person: null, loading: false });

  const loadAdmins = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await peopleApi.search({ role: "ADMIN" });
      setAdmins(unwrapPeopleList(res.data));
    } catch (err: any) {
      setError(
        err?.response?.data?.detail || "Failed to load admin accounts.",
      );
      setAdmins([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAdmins();
  }, [loadAdmins]);

  const filteredAdmins = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = !q
      ? admins
      : admins.filter((person) => {
          const name = formatPersonName(person).toLowerCase();
          const username = (person.username || "").toLowerCase();
          const email = (person.email || "").toLowerCase();
          return name.includes(q) || username.includes(q) || email.includes(q);
        });

    const direction = sortDirection === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const aValue = sortValue(a, sortField);
      const bValue = sortValue(b, sortField);
      if (aValue < bValue) return -1 * direction;
      if (aValue > bValue) return 1 * direction;
      return formatPersonName(a).localeCompare(formatPersonName(b)) * direction;
    });
  }, [admins, search, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const SortHeader = ({
    field,
    label,
  }: {
    field: SortField;
    label: string;
  }) => {
    const active = sortField === field;
    return (
      <th className="px-4 py-2 font-medium">
        <button
          type="button"
          onClick={() => handleSort(field)}
          className="inline-flex items-center gap-1 uppercase hover:text-gray-800"
        >
          <span>{label}</span>
          <span className="text-[10px] text-gray-400" aria-hidden>
            {active ? (sortDirection === "asc" ? "▲" : "▼") : "↕"}
          </span>
        </button>
      </th>
    );
  };

  const openPerson = (person: Person, mode: "view" | "edit") => {
    const params = new URLSearchParams({ open: String(person.id) });
    if (mode === "edit") params.set("mode", "edit");
    window.open(`/people?${params.toString()}`, "_blank", "noopener,noreferrer");
  };

  const requestDelete = (person: Person) => {
    if (user && String(user.id) === String(person.id)) {
      toast.error("You cannot delete your own admin account.");
      return;
    }
    setDeleteConfirmation({ isOpen: true, person, loading: false });
  };

  const confirmDeletePerson = async () => {
    if (!deleteConfirmation.person) return;
    if (user && String(user.id) === String(deleteConfirmation.person.id)) {
      toast.error("You cannot delete your own admin account.");
      setDeleteConfirmation({ isOpen: false, person: null, loading: false });
      return;
    }
    setDeleteConfirmation((prev) => ({ ...prev, loading: true }));
    try {
      await peopleApi.delete(String(deleteConfirmation.person.id));
      toast.success("Admin account deleted.");
      setDeleteConfirmation({ isOpen: false, person: null, loading: false });
      await loadAdmins();
    } catch (err: any) {
      toast.error(
        err?.response?.data?.detail ||
          "Failed to delete admin account. Please try again.",
      );
      setDeleteConfirmation((prev) => ({ ...prev, loading: false }));
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Admin Accounts</h2>
        <p className="mt-1 text-sm text-gray-600">
          All people with the ADMIN role. View and edit open in a new tab.
        </p>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div className="sm:col-span-1 lg:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Search
            </label>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, username, or email…"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
          <div className="flex items-end justify-start sm:justify-end">
            <button
              type="button"
              onClick={() => void loadAdmins()}
              className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
            >
              Refresh
            </button>
          </div>
        </div>
        <p className="text-xs text-gray-500">
          {loading
            ? "Loading…"
            : `${filteredAdmins.length} admin${filteredAdmins.length === 1 ? "" : "s"}`}
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <LoadingSpinner />
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      ) : filteredAdmins.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg px-4 py-10 text-center text-sm text-gray-600">
          {search.trim()
            ? "No admin accounts match your search."
            : "No admin accounts found."}
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
                <tr>
                  <SortHeader field="name" label="Name" />
                  <SortHeader field="username" label="Username" />
                  <SortHeader field="email" label="Email" />
                  <SortHeader field="branch" label="Branch" />
                  <SortHeader field="status" label="Status" />
                  <th className="px-4 py-2 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredAdmins.map((person) => {
                  const isSelf =
                    user != null && String(user.id) === String(person.id);
                  return (
                    <tr key={person.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2">
                        <Link
                          href={`/people?open=${person.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={TABLE_ENTITY_LINK_CLASS}
                        >
                          {formatPersonName(person)}
                          {isSelf ? (
                            <span className="ml-2 text-xs text-gray-500 font-normal">
                              (you)
                            </span>
                          ) : null}
                        </Link>
                      </td>
                      <td className="px-4 py-2 text-gray-700">
                        {person.username || "—"}
                      </td>
                      <td className="px-4 py-2 text-gray-700">
                        {person.email?.trim() || "—"}
                      </td>
                      <td className="px-4 py-2 text-gray-700">
                        {person.branch_code || person.branch_name || "—"}
                      </td>
                      <td className="px-4 py-2 text-gray-700">
                        {person.status || "—"}
                      </td>
                      <td className="px-4 py-2 text-right">
                        <div className="inline-flex justify-end">
                          <ActionMenu
                            onView={() => openPerson(person, "view")}
                            onEdit={() => openPerson(person, "edit")}
                            onDelete={() => requestDelete(person)}
                            labels={{
                              view: "View Person",
                              edit: "Edit Person",
                              delete: "Delete Person",
                              title: "Admin Actions",
                            }}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <ConfirmationModal
        isOpen={deleteConfirmation.isOpen}
        onClose={() =>
          setDeleteConfirmation({ isOpen: false, person: null, loading: false })
        }
        onConfirm={() => void confirmDeletePerson()}
        title="Delete Admin Account"
        message={
          deleteConfirmation.person
            ? `Are you sure you want to delete "${formatPersonName(deleteConfirmation.person)}"? This action cannot be undone and will permanently remove this admin from the system.`
            : "Are you sure you want to delete this admin account?"
        }
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
        loading={deleteConfirmation.loading}
        zIndex={80}
      />
    </div>
  );
}
