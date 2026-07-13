"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import LoadingSpinner from "@/src/components/ui/LoadingSpinner";
import ConfirmationModal from "@/src/components/ui/ConfirmationModal";
import ActionMenu from "@/src/components/families/ActionMenu";
import { branchesApi, peopleApi } from "@/src/lib/api";
import { Branch } from "@/src/types/branch";
import { formatPersonName } from "@/src/lib/name";
import { TABLE_ENTITY_LINK_CLASS } from "@/src/lib/tableEntityLink";

type MatchFilter = "both" | "name" | "member_id";

type DuplicatePerson = {
  id: number;
  first_name: string;
  last_name: string;
  middle_name?: string;
  username: string;
  email?: string;
  phone?: string;
  member_id?: string;
  role: string;
  status?: string;
  branch_id?: number | null;
  branch_name?: string | null;
  branch_code?: string | null;
  cluster_codes?: string[];
};

type DuplicateGroup = {
  match_type: "name" | "member_id";
  key: string;
  label: string;
  count: number;
  same_branch: boolean;
  people: DuplicatePerson[];
};

export default function PeopleDuplicatesPanel() {
  const [groups, setGroups] = useState<DuplicateGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [match, setMatch] = useState<MatchFilter>("both");
  const [branchId, setBranchId] = useState<string>("");
  const [sameBranchOnly, setSameBranchOnly] = useState(false);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    isOpen: boolean;
    person: DuplicatePerson | null;
    loading: boolean;
  }>({ isOpen: false, person: null, loading: false });

  useEffect(() => {
    let cancelled = false;
    branchesApi
      .getAll({ is_active: true })
      .then((res) => {
        if (!cancelled) setBranches(res.data || []);
      })
      .catch(() => {
        if (!cancelled) setBranches([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const loadGroups = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await peopleApi.getPossibleDuplicates({
        match,
        branch_id: branchId ? Number(branchId) : "",
        same_branch_only: sameBranchOnly,
      });
      setGroups(res.data.groups || []);
    } catch (err: any) {
      setError(
        err?.response?.data?.detail ||
          "Failed to load possible duplicate groups.",
      );
      setGroups([]);
    } finally {
      setLoading(false);
    }
  }, [match, branchId, sameBranchOnly]);

  useEffect(() => {
    void loadGroups();
  }, [loadGroups]);

  const totalPeople = useMemo(
    () => groups.reduce((sum, g) => sum + g.count, 0),
    [groups],
  );

  const openPerson = (person: DuplicatePerson, mode: "view" | "edit") => {
    const params = new URLSearchParams({ open: String(person.id) });
    if (mode === "edit") params.set("mode", "edit");
    window.open(`/people?${params.toString()}`, "_blank", "noopener,noreferrer");
  };

  const confirmDeletePerson = async () => {
    if (!deleteConfirmation.person) return;
    setDeleteConfirmation((prev) => ({ ...prev, loading: true }));
    try {
      await peopleApi.delete(String(deleteConfirmation.person.id));
      toast.success("Person deleted.");
      setDeleteConfirmation({ isOpen: false, person: null, loading: false });
      await loadGroups();
    } catch (err: any) {
      toast.error(
        err?.response?.data?.detail ||
          "Failed to delete person. Please try again.",
      );
      setDeleteConfirmation((prev) => ({ ...prev, loading: false }));
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground">
          Possible People Duplicates
        </h2>
        <p className="mt-1 text-sm text-gray-600">
          Review people who share the same first and last name, or the same LAMP
          ID. This is an audit list only — it does not merge records.
        </p>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Match type
            </label>
            <select
              value={match}
              onChange={(e) => setMatch(e.target.value as MatchFilter)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              <option value="both">Name and LAMP ID</option>
              <option value="name">Name only</option>
              <option value="member_id">LAMP ID only</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Branch
            </label>
            <select
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              <option value="">All branches</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                  {b.is_headquarters ? " (HQ)" : ""}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <label className="inline-flex items-center gap-2 text-sm text-gray-700 pb-2">
              <input
                type="checkbox"
                checked={sameBranchOnly}
                onChange={(e) => setSameBranchOnly(e.target.checked)}
                className="rounded border-gray-300"
              />
              Same branch only
            </label>
          </div>
          <div className="flex items-end justify-start sm:justify-end">
            <button
              type="button"
              onClick={() => void loadGroups()}
              className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
            >
              Refresh
            </button>
          </div>
        </div>
        <p className="text-xs text-gray-500">
          {loading
            ? "Loading…"
            : `${groups.length} group${groups.length === 1 ? "" : "s"} · ${totalPeople} people listed`}
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
      ) : groups.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg px-4 py-10 text-center text-sm text-gray-600">
          No possible duplicates found for the current filters.
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map((group) => (
            <div
              key={`${group.match_type}:${group.key}`}
              className="bg-white border border-gray-200 rounded-lg overflow-hidden"
            >
              <div className="px-4 py-3 border-b border-gray-100 flex flex-wrap items-center gap-2 justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">
                    {group.label}
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {group.match_type === "name"
                      ? "Same first and last name"
                      : "Same LAMP ID"}{" "}
                    · {group.count} records
                    {group.same_branch ? " · same branch" : " · mixed branches"}
                  </p>
                </div>
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                    group.match_type === "name"
                      ? "bg-amber-50 text-amber-800"
                      : "bg-violet-50 text-violet-800"
                  }`}
                >
                  {group.match_type === "name" ? "Name" : "LAMP ID"}
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
                    <tr>
                      <th className="px-4 py-2 font-medium">Name</th>
                      <th className="px-4 py-2 font-medium">LAMP ID</th>
                      <th className="px-4 py-2 font-medium">Branch</th>
                      <th className="px-4 py-2 font-medium">Cluster Code</th>
                      <th className="px-4 py-2 font-medium">Role</th>
                      <th className="px-4 py-2 font-medium">Status</th>
                      <th className="px-4 py-2 font-medium">Username</th>
                      <th className="px-4 py-2 font-medium text-right">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {group.people.map((person) => (
                      <tr key={person.id} className="hover:bg-gray-50">
                        <td className="px-4 py-2">
                          <Link
                            href={`/people?open=${person.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={TABLE_ENTITY_LINK_CLASS}
                          >
                            {formatPersonName(person)}
                          </Link>
                        </td>
                        <td className="px-4 py-2 text-gray-700">
                          {person.member_id?.trim() || "—"}
                        </td>
                        <td className="px-4 py-2 text-gray-700">
                          {person.branch_code || person.branch_name || "—"}
                        </td>
                        <td className="px-4 py-2 text-gray-700">
                          {person.cluster_codes?.filter(Boolean).join(", ") ||
                            "—"}
                        </td>
                        <td className="px-4 py-2 text-gray-700">
                          {person.role}
                        </td>
                        <td className="px-4 py-2 text-gray-700">
                          {person.status || "—"}
                        </td>
                        <td className="px-4 py-2 text-gray-500">
                          {person.username}
                        </td>
                        <td className="px-4 py-2 text-right">
                          <div className="inline-flex justify-end">
                            <ActionMenu
                              onView={() => openPerson(person, "view")}
                              onEdit={() => openPerson(person, "edit")}
                              onDelete={() =>
                                setDeleteConfirmation({
                                  isOpen: true,
                                  person,
                                  loading: false,
                                })
                              }
                              labels={{
                                view: "View Person",
                                edit: "Edit Person",
                                delete: "Delete Person",
                                title: "Person Actions",
                              }}
                            />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmationModal
        isOpen={deleteConfirmation.isOpen}
        onClose={() =>
          setDeleteConfirmation({ isOpen: false, person: null, loading: false })
        }
        onConfirm={() => void confirmDeletePerson()}
        title="Delete Person"
        message={
          deleteConfirmation.person
            ? `Are you sure you want to delete "${formatPersonName(deleteConfirmation.person)}"? This action cannot be undone and will permanently remove this person from the system.`
            : "Are you sure you want to delete this person?"
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
