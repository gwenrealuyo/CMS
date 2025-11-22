"use client";

import { useState, useEffect, useMemo } from "react";
import { ModuleCoordinator } from "@/src/types/person";
import { Person } from "@/src/types/person";
import {
  moduleCoordinatorsApi,
  peopleApi,
  clustersApi,
  evangelismApi,
  sundaySchoolApi,
} from "@/src/lib/api";
import Button from "@/src/components/ui/Button";
import Modal from "@/src/components/ui/Modal";
import LoadingSpinner from "@/src/components/ui/LoadingSpinner";
import ScalableSelect from "@/src/components/ui/ScalableSelect";
import ConfirmationModal from "@/src/components/ui/ConfirmationModal";
import { formatPersonName } from "@/src/lib/name";
import { PencilIcon, TrashIcon } from "@heroicons/react/24/outline";

interface ModuleCoordinatorFormData {
  person: number | "";
  module: ModuleCoordinator["module"] | "";
  level: ModuleCoordinator["level"] | "";
  resource_id: number | "" | null;
  resource_type: string;
}

const MODULE_OPTIONS: { value: ModuleCoordinator["module"]; label: string }[] =
  [
    { value: "CLUSTER", label: "Cluster" },
    { value: "FINANCE", label: "Finance" },
    { value: "EVANGELISM", label: "Evangelism" },
    { value: "SUNDAY_SCHOOL", label: "Sunday School" },
    { value: "LESSONS", label: "Lessons" },
    { value: "EVENTS", label: "Events" },
    { value: "MINISTRIES", label: "Ministries" },
  ];

const ALL_LEVEL_OPTIONS: {
  value: ModuleCoordinator["level"];
  label: string;
}[] = [
  { value: "COORDINATOR", label: "Coordinator" },
  { value: "SENIOR_COORDINATOR", label: "Senior Coordinator" },
  { value: "TEACHER", label: "Teacher" },
  { value: "BIBLE_SHARER", label: "Bible Sharer" },
];

// Get available levels based on module
const getAvailableLevels = (
  module: ModuleCoordinator["module"] | ""
): typeof ALL_LEVEL_OPTIONS => {
  if (!module) return ALL_LEVEL_OPTIONS;

  switch (module) {
    case "FINANCE":
    case "CLUSTER":
    case "EVENTS":
    case "MINISTRIES":
      // Only Coordinator and Senior Coordinator
      return ALL_LEVEL_OPTIONS.filter(
        (opt) =>
          opt.value === "COORDINATOR" || opt.value === "SENIOR_COORDINATOR"
      );

    case "EVANGELISM":
      // Coordinator, Senior Coordinator, and Bible Sharer
      return ALL_LEVEL_OPTIONS.filter((opt) => opt.value !== "TEACHER");

    case "LESSONS":
    case "SUNDAY_SCHOOL":
      // Coordinator, Senior Coordinator, and Teacher
      return ALL_LEVEL_OPTIONS.filter((opt) => opt.value !== "BIBLE_SHARER");

    default:
      return ALL_LEVEL_OPTIONS;
  }
};

// Get badge color classes for modules
const getModuleBadgeColor = (module: ModuleCoordinator["module"]): string => {
  const colorMap: Record<ModuleCoordinator["module"], string> = {
    CLUSTER: "bg-purple-100 text-purple-800 border-purple-200",
    FINANCE: "bg-emerald-100 text-emerald-800 border-emerald-200",
    EVANGELISM: "bg-orange-100 text-orange-800 border-orange-200",
    SUNDAY_SCHOOL: "bg-cyan-100 text-cyan-800 border-cyan-200",
    LESSONS: "bg-indigo-100 text-indigo-800 border-indigo-200",
    EVENTS: "bg-pink-100 text-pink-800 border-pink-200",
    MINISTRIES: "bg-teal-100 text-teal-800 border-teal-200",
  };
  return colorMap[module] || "bg-gray-100 text-gray-800 border-gray-200";
};

// Get badge color classes for levels
const getLevelBadgeColor = (level: ModuleCoordinator["level"]): string => {
  const colorMap: Record<ModuleCoordinator["level"], string> = {
    COORDINATOR: "bg-blue-100 text-blue-800 border-blue-200",
    SENIOR_COORDINATOR: "bg-violet-100 text-violet-800 border-violet-200",
    TEACHER: "bg-amber-100 text-amber-800 border-amber-200",
    BIBLE_SHARER: "bg-rose-100 text-rose-800 border-rose-200",
  };
  return colorMap[level] || "bg-gray-100 text-gray-800 border-gray-200";
};

export default function ModuleCoordinatorManager() {
  const [assignments, setAssignments] = useState<ModuleCoordinator[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAssignment, setEditingAssignment] =
    useState<ModuleCoordinator | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    isOpen: boolean;
    assignment: ModuleCoordinator | null;
    loading: boolean;
  }>({
    isOpen: false,
    assignment: null,
    loading: false,
  });
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

  // Resource selection state
  const [assignmentType, setAssignmentType] = useState<
    "module-wide" | "resource-specific"
  >("module-wide");
  const [availableResources, setAvailableResources] = useState<
    Array<{ id: number; name: string; type: string }>
  >([]);
  const [loadingResources, setLoadingResources] = useState(false);
  const [selectedResource, setSelectedResource] = useState<number | null>(null);

  useEffect(() => {
    fetchData();
  }, [filters]);

  // Fetch resources based on module selection
  useEffect(() => {
    const fetchResources = async () => {
      if (!formData.module || assignmentType === "module-wide") {
        setAvailableResources([]);
        setSelectedResource(null);
        return;
      }

      setLoadingResources(true);
      try {
        let resources: Array<{ id: number; name: string; type: string }> = [];

        switch (formData.module) {
          case "CLUSTER":
            const clusters = await clustersApi.getAll();
            resources = clusters.data.map((c: any) => ({
              id: c.id,
              name: c.name || c.code || `Cluster #${c.id}`,
              type: "Cluster",
            }));
            break;

          case "EVANGELISM":
            const groups = await evangelismApi.listGroups();
            resources = groups.data.map((g: any) => ({
              id: g.id,
              name: g.name || `Evangelism Group #${g.id}`,
              type: "EvangelismGroup",
            }));
            break;

          case "SUNDAY_SCHOOL":
            const classes = await sundaySchoolApi.listClasses();
            resources = classes.data.map((c: any) => ({
              id: c.id,
              name: c.name || `Sunday School Class #${c.id}`,
              type: "SundaySchoolClass",
            }));
            break;

          case "LESSONS":
          case "EVENTS":
          case "FINANCE":
          case "MINISTRIES":
            // These are typically module-wide only
            resources = [];
            break;
        }

        setAvailableResources(resources);
      } catch (err) {
        console.error("Failed to fetch resources:", err);
        setAvailableResources([]);
      } finally {
        setLoadingResources(false);
      }
    };

    fetchResources();
  }, [formData.module, assignmentType]);

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

  // Handle assignment type change
  const handleAssignmentTypeChange = (
    type: "module-wide" | "resource-specific"
  ) => {
    setAssignmentType(type);
    if (type === "module-wide") {
      setFormData({
        ...formData,
        resource_id: null,
        resource_type: "",
      });
      setSelectedResource(null);
    }
  };

  // Handle resource selection
  const handleResourceSelect = (resourceId: number | null) => {
    setSelectedResource(resourceId);
    if (resourceId) {
      const resource = availableResources.find((r) => r.id === resourceId);
      setFormData({
        ...formData,
        resource_id: resourceId,
        resource_type: resource?.type || "",
      });
    } else {
      setFormData({
        ...formData,
        resource_id: null,
        resource_type: "",
      });
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
    setAssignmentType("module-wide");
    setSelectedResource(null);
    setIsModalOpen(true);
  };

  const handleEdit = (assignment: ModuleCoordinator) => {
    setEditingAssignment(assignment);
    const hasResource =
      assignment.resource_id !== null && assignment.resource_id !== undefined;
    setAssignmentType(hasResource ? "resource-specific" : "module-wide");
    setFormData({
      person: assignment.person,
      module: assignment.module,
      level: assignment.level,
      resource_id: assignment.resource_id || null,
      resource_type: assignment.resource_type || "",
    });
    setSelectedResource(assignment.resource_id || null);
    setIsModalOpen(true);
  };

  const handleDelete = (assignment: ModuleCoordinator) => {
    setDeleteConfirmation({
      isOpen: true,
      assignment,
      loading: false,
    });
  };

  const confirmDelete = async () => {
    if (!deleteConfirmation.assignment) return;

    setDeleteConfirmation((prev) => ({ ...prev, loading: true }));
    try {
      await moduleCoordinatorsApi.delete(deleteConfirmation.assignment.id);
      setDeleteConfirmation({
        isOpen: false,
        assignment: null,
        loading: false,
      });
      await fetchData();
    } catch (err: any) {
      alert(
        err.response?.data?.message ||
          err.message ||
          "Failed to delete assignment."
      );
      setDeleteConfirmation((prev) => ({ ...prev, loading: false }));
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
        resource_id:
          formData.resource_id === ""
            ? null
            : formData.resource_id
            ? Number(formData.resource_id)
            : null,
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
    return formatPersonName(person);
  };

  // Format person options for ScalableSelect
  const personOptions = useMemo(() => {
    return people
      .map((person) => {
        const name = `${person.first_name ?? ""} ${
          person.last_name ?? ""
        }`.trim();
        const label = name || person.email || person.username;
        return {
          label: label,
          value: String(person.id),
        };
      })
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [people]);

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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Module
            </label>
            <select
              value={filters.module}
              onChange={(e) =>
                setFilters({ ...filters, module: e.target.value })
              }
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
              onChange={(e) =>
                setFilters({ ...filters, level: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
            >
              <option value="">All Levels</option>
              {ALL_LEVEL_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex gap-4">
          <input
            type="text"
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            placeholder="Search by name..."
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
          />
          <Button
            variant="tertiary"
            onClick={() => setFilters({ module: "", level: "", search: "" })}
          >
            Reset
          </Button>
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
          <p className="text-gray-500">
            No module coordinator assignments found.
          </p>
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
                    <span
                      className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full border ${getModuleBadgeColor(
                        assignment.module
                      )}`}
                    >
                      {assignment.module_display || assignment.module}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full border ${getLevelBadgeColor(
                        assignment.level
                      )}`}
                    >
                      {assignment.level_display || assignment.level}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {assignment.resource_id
                      ? `${assignment.resource_type || "Resource"} #${
                          assignment.resource_id
                        }`
                      : "Module-wide"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDate(assignment.created_at)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEdit(assignment)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-white border border-blue-500 text-blue-600 rounded-md hover:bg-blue-50 transition-colors"
                      >
                        <PencilIcon className="w-4 h-4" />
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(assignment)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-white border border-red-500 text-red-600 rounded-md hover:bg-red-50 transition-colors"
                      >
                        <TrashIcon className="w-4 h-4" />
                        Delete
                      </button>
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
          setAssignmentType("module-wide");
          setSelectedResource(null);
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
            <ScalableSelect
              options={[
                { label: "Select a person...", value: "" },
                ...personOptions,
              ]}
              value={formData.person ? String(formData.person) : ""}
              onChange={(value) =>
                setFormData({ ...formData, person: value ? Number(value) : "" })
              }
              placeholder="Select a person..."
              className="w-full"
              showSearch
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Module <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.module}
              onChange={(e) => {
                const newModule = e.target.value as ModuleCoordinator["module"];
                const availableLevels = getAvailableLevels(newModule);
                const currentLevel =
                  formData.level as ModuleCoordinator["level"];

                // Check if current level is valid for new module
                const isCurrentLevelValid = availableLevels.some(
                  (opt) => opt.value === currentLevel
                );

                setFormData({
                  ...formData,
                  module: newModule,
                  // Reset level if it's not valid for the new module
                  level: isCurrentLevelValid ? currentLevel : "",
                  // Reset resource when module changes
                  resource_id: null,
                  resource_type: "",
                });
                setSelectedResource(null);
                // Auto-switch to module-wide for modules without resources
                if (["FINANCE", "MINISTRIES"].includes(newModule)) {
                  setAssignmentType("module-wide");
                }
              }}
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
              onChange={(e) => {
                const newLevel = e.target.value as ModuleCoordinator["level"];

                // Auto-select assignment type based on level
                if (newLevel === "SENIOR_COORDINATOR") {
                  setAssignmentType("module-wide");
                  setFormData({
                    ...formData,
                    level: newLevel,
                    resource_id: null,
                    resource_type: "",
                  });
                  setSelectedResource(null);
                } else if (
                  newLevel === "TEACHER" ||
                  newLevel === "BIBLE_SHARER"
                ) {
                  setAssignmentType("resource-specific");
                  setFormData({
                    ...formData,
                    level: newLevel,
                  });
                } else if (newLevel === "COORDINATOR") {
                  // Default to resource-specific for coordinators, but allow either
                  // Only change if currently module-wide (to avoid disrupting user choice)
                  if (assignmentType === "module-wide") {
                    setAssignmentType("resource-specific");
                  }
                  setFormData({
                    ...formData,
                    level: newLevel,
                  });
                } else {
                  setFormData({
                    ...formData,
                    level: newLevel,
                  });
                }
              }}
              required
              disabled={!formData.module}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#2563EB] disabled:bg-gray-100 disabled:cursor-not-allowed"
            >
              <option value="">
                {formData.module
                  ? "Select a level..."
                  : "Select a module first"}
              </option>
              {getAvailableLevels(formData.module).map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-500">
              {formData.level === "SENIOR_COORDINATOR"
                ? "Senior Coordinators automatically have module-wide access"
                : formData.level === "COORDINATOR"
                ? "Coordinators can be assigned to specific resources or module-wide"
                : formData.level === "TEACHER" ||
                  formData.level === "BIBLE_SHARER"
                ? `${
                    formData.level === "TEACHER" ? "Teachers" : "Bible Sharers"
                  } must be assigned to a specific resource`
                : ""}
            </p>
          </div>

          {/* Assignment Type Toggle - Only show if module supports resources */}
          {formData.module &&
            !["FINANCE", "MINISTRIES"].includes(formData.module) && (
              <div className="border-t border-b border-gray-200 py-4">
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Assignment Scope
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="radio"
                      name="assignmentType"
                      value="module-wide"
                      checked={assignmentType === "module-wide"}
                      onChange={() => handleAssignmentTypeChange("module-wide")}
                      disabled={
                        formData.level === "TEACHER" ||
                        formData.level === "BIBLE_SHARER"
                      }
                      className="mr-2 text-[#2563EB] focus:ring-[#2563EB] disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                    <div>
                      <span
                        className={`font-medium ${
                          formData.level === "TEACHER" ||
                          formData.level === "BIBLE_SHARER"
                            ? "text-gray-400"
                            : "text-gray-900"
                        }`}
                      >
                        Module-wide Access
                      </span>
                      <p className="text-xs text-gray-500">
                        Access to all resources in this module
                      </p>
                    </div>
                  </label>
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="radio"
                      name="assignmentType"
                      value="resource-specific"
                      checked={assignmentType === "resource-specific"}
                      onChange={() =>
                        handleAssignmentTypeChange("resource-specific")
                      }
                      disabled={formData.level === "SENIOR_COORDINATOR"}
                      className="mr-2 text-[#2563EB] focus:ring-[#2563EB] disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                    <div>
                      <span
                        className={`font-medium ${
                          formData.level === "SENIOR_COORDINATOR"
                            ? "text-gray-400"
                            : "text-gray-900"
                        }`}
                      >
                        Specific Resource
                      </span>
                      <p className="text-xs text-gray-500">
                        Access to a specific resource only
                      </p>
                    </div>
                  </label>
                </div>
                {formData.level === "SENIOR_COORDINATOR" && (
                  <p className="mt-2 text-xs text-amber-600">
                    Senior Coordinators automatically have module-wide access.
                  </p>
                )}
                {(formData.level === "TEACHER" ||
                  formData.level === "BIBLE_SHARER") && (
                  <p className="mt-2 text-xs text-amber-600">
                    {formData.level === "TEACHER"
                      ? "Teachers"
                      : "Bible Sharers"}{" "}
                    must be assigned to a specific resource.
                  </p>
                )}
              </div>
            )}

          {/* Resource Selection - Only show when resource-specific is selected */}
          {assignmentType === "resource-specific" && formData.module && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Resource <span className="text-red-500">*</span>
              </label>
              {loadingResources ? (
                <div className="flex items-center justify-center py-4">
                  <LoadingSpinner />
                  <span className="ml-2 text-sm text-gray-500">
                    Loading resources...
                  </span>
                </div>
              ) : availableResources.length === 0 ? (
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                  <p className="text-sm text-yellow-800">
                    No resources available for this module. Switch to
                    "Module-wide Access" instead.
                  </p>
                </div>
              ) : (
                <select
                  value={selectedResource || ""}
                  onChange={(e) =>
                    handleResourceSelect(
                      e.target.value ? Number(e.target.value) : null
                    )
                  }
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                >
                  <option value="">Select a resource...</option>
                  {availableResources.map((resource) => (
                    <option key={resource.id} value={resource.id}>
                      {resource.name}
                    </option>
                  ))}
                </select>
              )}
              {selectedResource && (
                <div className="mt-2 p-2 bg-white rounded border border-blue-300">
                  <p className="text-xs text-gray-600">
                    <span className="font-medium">Selected:</span>{" "}
                    {
                      availableResources.find((r) => r.id === selectedResource)
                        ?.name
                    }
                    <br />
                    <span className="font-medium">Type:</span>{" "}
                    {formData.resource_type}
                    <br />
                    <span className="font-medium">ID:</span>{" "}
                    {formData.resource_id}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Info box for module-wide - only show when person and module are selected */}
          {assignmentType === "module-wide" &&
            formData.person &&
            formData.module && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-start">
                  <svg
                    className="w-5 h-5 text-green-600 mt-0.5 mr-2"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <div>
                    <p className="text-sm font-medium text-green-800">
                      Module-wide Access
                    </p>
                    <p className="text-xs text-green-700 mt-1">
                      This person will have access to all resources in the{" "}
                      {MODULE_OPTIONS.find((m) => m.value === formData.module)
                        ?.label || "selected"}{" "}
                      module.
                    </p>
                  </div>
                </div>
              </div>
            )}

          <div className="flex gap-4 pt-4">
            <Button
              type="button"
              variant="tertiary"
              className="flex-1"
              onClick={() => {
                setIsModalOpen(false);
                setError("");
                setAssignmentType("module-wide");
                setSelectedResource(null);
              }}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" className="flex-1" disabled={submitting}>
              {submitting
                ? "Saving..."
                : editingAssignment
                ? "Update Assignment"
                : "Create Assignment"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={deleteConfirmation.isOpen}
        onClose={() =>
          setDeleteConfirmation({
            isOpen: false,
            assignment: null,
            loading: false,
          })
        }
        onConfirm={confirmDelete}
        title="Delete Module Coordinator Assignment"
        message={
          deleteConfirmation.assignment
            ? `Are you sure you want to delete the assignment for ${getPersonName(
                deleteConfirmation.assignment.person
              )} (${
                deleteConfirmation.assignment.module_display ||
                deleteConfirmation.assignment.module
              } - ${
                deleteConfirmation.assignment.level_display ||
                deleteConfirmation.assignment.level
              })? This action cannot be undone.`
            : "Are you sure you want to delete this assignment?"
        }
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
        loading={deleteConfirmation.loading}
      />
    </div>
  );
}
