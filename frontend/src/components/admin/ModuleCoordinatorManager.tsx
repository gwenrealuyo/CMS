"use client";

import { useState, useEffect } from "react";
import { ModuleCoordinator } from "@/src/types/person";
import { Person } from "@/src/types/person";
import { moduleCoordinatorsApi, peopleApi } from "@/src/lib/api";
import Button from "@/src/components/ui/Button";
import Modal from "@/src/components/ui/Modal";
import LoadingSpinner from "@/src/components/ui/LoadingSpinner";

interface ModuleCoordinatorFormData {
  person: number | "";
  module: ModuleCoordinator["module"] | "";
  level: ModuleCoordinator["level"] | "";
  resource_id: number | "" | null;
  resource_type: string;
}

const MODULE_OPTIONS: { value: ModuleCoordinator["module"]; label: string }[] = [
  { value: "CLUSTER", label: "Cluster" },
  { value: "FINANCE", label: "Finance" },
  { value: "EVANGELISM", label: "Evangelism" },
  { value: "SUNDAY_SCHOOL", label: "Sunday School" },
  { value: "LESSONS", label: "Lessons" },
  { value: "EVENTS", label: "Events" },
  { value: "MINISTRIES", label: "Ministries" },
];

const LEVEL_OPTIONS: { value: ModuleCoordinator["level"]; label: string }[] = [
  { value: "COORDINATOR", label: "Coordinator" },
  { value: "SENIOR_COORDINATOR", label: "Senior Coordinator" },
  { value: "TEACHER", label: "Teacher" },
  { value: "BIBLE_SHARER", label: "Bible Sharer" },
];

export default function ModuleCoordinatorManager() {
  const [assignments, setAssignments] = useState<ModuleCoordinator[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState<ModuleCoordinator | null>(null);
  const [formData, setFormData] = useState<ModuleCoordinatorFormData>({
    person: "",
    module: "",
    level: "",
    resource_id: null,
    resource_type: "",
  });
  const [filters, setFilters] = useState({
    module: "",
    level: "",
    search: "",
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchData();
  }, [filters]);

  const fetchData = async () => {
    setLoading(true);
    setError("");
    try {
      const [assignmentsRes, peopleRes] = await Promise.all([
        moduleCoordinatorsApi.getAll({
          module: filters.module || undefined,
          level: filters.level || undefined,
          search: filters.search || undefined,
        }),
        peopleApi.getAll(),
      ]);
      setAssignments(assignmentsRes.data);
      setPeople(peopleRes.data);
    } catch (err: any) {
      setError(
        err.response?.data?.message || err.message || "Failed to load data."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingAssignment(null);
    setFormData({
      person: "",
      module: "",
      level: "",
      resource_id: null,
      resource_type: "",
    });
    setIsModalOpen(true);
  };

  const handleEdit = (assignment: ModuleCoordinator) => {
    setEditingAssignment(assignment);
    setFormData({
      person: assignment.person,
      module: assignment.module,
      level: assignment.level,
      resource_id: assignment.resource_id || null,
      resource_type: assignment.resource_type || "",
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this assignment?")) {
      return;
    }
    try {
      await moduleCoordinatorsApi.delete(id);
      await fetchData();
    } catch (err: any) {
      alert(
        err.response?.data?.message || err.message || "Failed to delete assignment."
      );
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      const data = {
        person: Number(formData.person),
        module: formData.module as ModuleCoordinator["module"],
        level: formData.level as ModuleCoordinator["level"],
        resource_id: formData.resource_id === "" ? null : (formData.resource_id ? Number(formData.resource_id) : null),
        resource_type: formData.resource_type || "",
      };

      if (editingAssignment) {
        await moduleCoordinatorsApi.update(editingAssignment.id, data);
      } else {
        await moduleCoordinatorsApi.create(data);
      }

      setIsModalOpen(false);
      await fetchData();
    } catch (err: any) {
      const errorMessage =
        err.response?.data?.message ||
        err.response?.data?.detail ||
        err.message ||
        "Failed to save assignment.";
      setError(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleDateString();
  };

  const getPersonName = (personId: number) => {
    const person = people.find((p) => Number(p.id) === personId);
    if (!person) return `User #${personId}`;
    return `${person.first_name} ${person.last_name}`.trim() || person.username;
  };

  const filteredAssignments = assignments.filter((assignment) => {
    if (filters.search) {
      const personName = getPersonName(assignment.person).toLowerCase();
      return personName.includes(filters.search.toLowerCase());
    }
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold text-[#2D3748]">
          Module Coordinator Assignments
        </h2>
        <Button onClick={handleCreate}>Create Assignment</Button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-md p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Module
            </label>
            <select
              value={filters.module}
              onChange={(e) => setFilters({ ...filters, module: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
            >
              <option value="">All Modules</option>
              {MODULE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Level
            </label>
            <select
              value={filters.level}
              onChange={(e) => setFilters({ ...filters, level: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
            >
              <option value="">All Levels</option>
              {LEVEL_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Search Person
            </label>
            <input
              type="text"
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              placeholder="Search by name..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
            />
          </div>
          <div className="flex items-end">
            <Button
              onClick={() => setFilters({ module: "", level: "", search: "" })}
              className="w-full"
              variant="secondary"
            >
              Clear Filters
            </Button>
          </div>
        </div>
      </div>

      {error && !isModalOpen && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center items-center py-12">
          <LoadingSpinner />
        </div>
      ) : filteredAssignments.length === 0 ? (
        <div className="bg-white rounded-lg shadow-md p-8 text-center">
          <p className="text-gray-500">No module coordinator assignments found.</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Person
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Module
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Level
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Resource
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Created At
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredAssignments.map((assignment) => (
                <tr key={assignment.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {getPersonName(assignment.person)}
                    </div>
                    <div className="text-sm text-gray-500">
                      ID: {assignment.person}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                      {assignment.module_display || assignment.module}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                      {assignment.level_display || assignment.level}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {assignment.resource_id
                      ? `${assignment.resource_type || "Resource"} #${assignment.resource_id}`
                      : "Module-wide"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDate(assignment.created_at)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex gap-2">
                      <Button
                        onClick={() => handleEdit(assignment)}
                        variant="secondary"
                        className="text-sm px-3 py-1"
                      >
                        Edit
                      </Button>
                      <Button
                        onClick={() => handleDelete(assignment.id)}
                        variant="secondary"
                        className="text-sm px-3 py-1 bg-red-600 hover:bg-red-700 text-white"
                      >
                        Delete
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create/Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setError("");
        }}
        title={editingAssignment ? "Edit Assignment" : "Create Assignment"}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Person <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.person}
              onChange={(e) =>
                setFormData({ ...formData, person: e.target.value ? Number(e.target.value) : "" })
              }
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
            >
              <option value="">Select a person...</option>
              {people.map((person) => (
                <option key={person.id} value={person.id}>
                  {`${person.first_name} ${person.last_name}`.trim() || person.username} ({person.email})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Module <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.module}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  module: e.target.value as ModuleCoordinator["module"],
                })
              }
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
            >
              <option value="">Select a module...</option>
              {MODULE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Level <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.level}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  level: e.target.value as ModuleCoordinator["level"],
                })
              }
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
            >
              <option value="">Select a level...</option>
              {LEVEL_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Resource Type (Optional)
            </label>
            <input
              type="text"
              value={formData.resource_type}
              onChange={(e) =>
                setFormData({ ...formData, resource_type: e.target.value })
              }
              placeholder="e.g., Cluster, EvangelismGroup"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
            />
            <p className="mt-1 text-xs text-gray-500">
              Type of resource (e.g., "Cluster", "EvangelismGroup")
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Resource ID (Optional)
            </label>
            <input
              type="number"
              value={formData.resource_id === null ? "" : formData.resource_id}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  resource_id: e.target.value ? Number(e.target.value) : null,
                })
              }
              placeholder="e.g., 1, 2, 3"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
            />
            <p className="mt-1 text-xs text-gray-500">
              ID of the specific resource. Leave blank for module-wide access.
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              onClick={() => {
                setIsModalOpen(false);
                setError("");
              }}
              variant="secondary"
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving..." : editingAssignment ? "Update" : "Create"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

