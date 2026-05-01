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
import ResourceAssignmentMultiPicker from "@/src/components/admin/ResourceAssignmentMultiPicker";
import ConfirmationModal from "@/src/components/ui/ConfirmationModal";
import { formatPersonName } from "@/src/lib/name";
import {
  PencilIcon,
  TrashIcon,
  Squares2X2Icon,
  TableCellsIcon,
} from "@heroicons/react/24/outline";

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

type BulkAssignmentRow = {
  module: ModuleCoordinator["module"] | "";
  level: ModuleCoordinator["level"] | "";
  assignmentType: "module-wide" | "resource-specific";
  resource_id: number | null;
  resource_type: string;
};

type BulkSimpleForm = {
  person: number | "";
  module: ModuleCoordinator["module"] | "";
  level: ModuleCoordinator["level"] | "";
  assignmentType: "module-wide" | "resource-specific";
  selectedResourceIds: number[];
};

const emptyBulkSimple = (): BulkSimpleForm => ({
  person: "",
  module: "",
  level: "",
  assignmentType: "module-wide",
  selectedResourceIds: [],
});

const emptyBulkRow = (): BulkAssignmentRow => ({
  module: "",
  level: "",
  assignmentType: "module-wide",
  resource_id: null,
  resource_type: "",
});

const moduleSupportsResourceMultiSelect = (
  module: ModuleCoordinator["module"] | ""
): boolean =>
  module === "CLUSTER" ||
  module === "EVANGELISM" ||
  module === "SUNDAY_SCHOOL";

const resourceTypeForModule = (
  module: ModuleCoordinator["module"]
): string => {
  switch (module) {
    case "CLUSTER":
      return "Cluster";
    case "EVANGELISM":
      return "EvangelismGroup";
    case "SUNDAY_SCHOOL":
      return "SundaySchoolClass";
    default:
      return "";
  }
};

const bulkModuleShowsScopeUi = (module: string | "") =>
  Boolean(module && !["FINANCE", "MINISTRIES"].includes(module));

/** Rows loaded for coordinator resource pickers (create/edit, bulk, advanced). */
type CoordinatorResourceOption = {
  id: number;
  name: string;
  type: string;
  /** Right column in multi-picker (cluster code, etc.) */
  trailingLabel?: string;
};

function clusterApiRowToResourceOption(c: {
  id: number;
  name?: string | null;
  code?: string | null;
}): CoordinatorResourceOption {
  const codeTrim =
    c.code != null && String(c.code).trim() !== ""
      ? String(c.code).trim()
      : null;
  return {
    id: c.id,
    name: c.name || c.code || `Cluster #${c.id}`,
    type: "Cluster",
    trailingLabel: codeTrim ?? `#${c.id}`,
  };
}

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

  // Bulk assignment modal: simple multi-select (default) + optional advanced rows
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [bulkSimple, setBulkSimple] = useState<BulkSimpleForm>(emptyBulkSimple);
  const [bulkAdvancedOpen, setBulkAdvancedOpen] = useState(false);
  const [bulkAssignments, setBulkAssignments] = useState<BulkAssignmentRow[]>([
    emptyBulkRow(),
  ]);
  const [bulkSubmitting, setBulkSubmitting] = useState(false);
  const [bulkError, setBulkError] = useState("");
  const [bulkAvailableResources, setBulkAvailableResources] = useState<
    CoordinatorResourceOption[]
  >([]);
  const [bulkLoadingResources, setBulkLoadingResources] = useState(false);

  // View mode state - Initialize based on screen size
  const [viewMode, setViewMode] = useState<"table" | "cards">(() => {
    if (typeof window !== "undefined") {
      return window.innerWidth < 768 ? "cards" : "table";
    }
    return "table";
  });

  // Resource selection state
  const [assignmentType, setAssignmentType] = useState<
    "module-wide" | "resource-specific"
  >("module-wide");
  const [availableResources, setAvailableResources] = useState<
    CoordinatorResourceOption[]
  >([]);
  const [loadingResources, setLoadingResources] = useState(false);
  /** Selected resources for Create/Edit modal when scope is resource-specific (CLUSTER / EVANGELISM / SUNDAY_SCHOOL) */
  const [formResourceSelectedIds, setFormResourceSelectedIds] = useState<
    number[]
  >([]);

  useEffect(() => {
    fetchData();
  }, [filters]);

  // Fetch resources based on module selection
  useEffect(() => {
    const fetchResources = async () => {
      if (!formData.module || assignmentType === "module-wide") {
        setAvailableResources([]);
        setFormResourceSelectedIds([]);
        return;
      }

      setLoadingResources(true);
      try {
        let resources: CoordinatorResourceOption[] = [];

        switch (formData.module) {
          case "CLUSTER":
            const clusters = await clustersApi.getAll();
            resources = clusters.data.map(clusterApiRowToResourceOption);
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

  useEffect(() => {
    if (!isBulkModalOpen || bulkAdvancedOpen) {
      setBulkAvailableResources([]);
      setBulkLoadingResources(false);
      return;
    }
    const { module: bulkModule, assignmentType: bulkScope } = bulkSimple;
    if (
      !bulkModule ||
      bulkScope !== "resource-specific" ||
      !moduleSupportsResourceMultiSelect(bulkModule)
    ) {
      setBulkAvailableResources([]);
      setBulkLoadingResources(false);
      return;
    }

    let cancelled = false;
    setBulkLoadingResources(true);
    (async () => {
      try {
        let resources: CoordinatorResourceOption[] = [];
        switch (bulkModule) {
          case "CLUSTER": {
            const clusters = await clustersApi.getAll();
            resources = clusters.data.map(clusterApiRowToResourceOption);
            break;
          }
          case "EVANGELISM": {
            const groups = await evangelismApi.listGroups();
            resources = groups.data.map((g: any) => ({
              id: g.id,
              name: g.name || `Evangelism Group #${g.id}`,
              type: "EvangelismGroup",
            }));
            break;
          }
          case "SUNDAY_SCHOOL": {
            const classes = await sundaySchoolApi.listClasses();
            resources = classes.data.map((c: any) => ({
              id: c.id,
              name: c.name || `Sunday School Class #${c.id}`,
              type: "SundaySchoolClass",
            }));
            break;
          }
          default:
            resources = [];
        }
        if (!cancelled) setBulkAvailableResources(resources);
      } catch (err) {
        console.error("Failed to fetch bulk resources:", err);
        if (!cancelled) setBulkAvailableResources([]);
      } finally {
        if (!cancelled) setBulkLoadingResources(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  },
  // eslint-disable-next-line react-hooks/exhaustive-deps -- only module + scope trigger fetch; full bulkSimple would over-fetch
  [
    isBulkModalOpen,
    bulkAdvancedOpen,
    bulkSimple.module,
    bulkSimple.assignmentType,
  ]);

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
      setFormResourceSelectedIds([]);
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
    setFormResourceSelectedIds([]);
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
    setFormResourceSelectedIds(
      hasResource && assignment.resource_id != null
        ? [Number(assignment.resource_id)]
        : []
    );
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
      const assignmentModule = formData.module as ModuleCoordinator["module"];
      const level = formData.level as ModuleCoordinator["level"];
      const person = Number(formData.person);

      const effectiveWide =
        assignmentType === "module-wide" ||
        level === "SENIOR_COORDINATOR" ||
        !bulkModuleShowsScopeUi(assignmentModule);

      const payloadWide = {
        person,
        module: assignmentModule,
        level,
        resource_id: null as number | null,
        resource_type: "",
      };

      if (effectiveWide) {
        if (editingAssignment) {
          await moduleCoordinatorsApi.update(editingAssignment.id, payloadWide);
        } else {
          await moduleCoordinatorsApi.create(payloadWide);
        }
        setIsModalOpen(false);
        await fetchData();
        return;
      }

      const multi = moduleSupportsResourceMultiSelect(assignmentModule);
      let ids: number[];
      if (multi) {
        const allowed = new Set(availableResources.map((r) => r.id));
        ids = Array.from(
          new Set(
            formResourceSelectedIds.filter((id) => allowed.has(id))
          )
        ).sort((a, b) => a - b);
      } else {
        ids =
          formData.resource_id !== null && formData.resource_id !== undefined
            ? [Number(formData.resource_id)]
            : [];
      }

      if (ids.length === 0) {
        setError("Select at least one resource.");
        setSubmitting(false);
        return;
      }

      const resourceType = resourceTypeForModule(assignmentModule);

      if (!editingAssignment) {
        if (ids.length === 1) {
          await moduleCoordinatorsApi.create({
            person,
            module: assignmentModule,
            level,
            resource_id: ids[0],
            resource_type: resourceType,
          });
        } else {
          await moduleCoordinatorsApi.bulkCreate(
            ids.map((resource_id) => ({
              person,
              module: assignmentModule,
              level,
              resource_id,
              resource_type: resourceType,
            }))
          );
        }
        setIsModalOpen(false);
        await fetchData();
        return;
      }

      const original =
        editingAssignment.resource_id !== null &&
        editingAssignment.resource_id !== undefined
          ? Number(editingAssignment.resource_id)
          : null;

      const existingKeys = new Set(
        assignments
          .filter((a) => a.person === person && a.module === assignmentModule)
          .map((a) =>
            a.resource_id != null ? `${a.module}-${a.resource_id}` : ""
          )
      );

      const filterNew = (candidates: number[]) =>
        candidates.filter(
          (rid) => !existingKeys.has(`${assignmentModule}-${rid}`)
        );

      if (original !== null && ids.includes(original)) {
        await moduleCoordinatorsApi.update(editingAssignment.id, {
          person,
          module: assignmentModule,
          level,
          resource_id: original,
          resource_type: resourceType,
        });
        const extras = filterNew(ids.filter((id) => id !== original));
        if (extras.length > 0) {
          await moduleCoordinatorsApi.bulkCreate(
            extras.map((resource_id) => ({
              person,
              module: assignmentModule,
              level,
              resource_id,
              resource_type: resourceType,
            }))
          );
        }
      } else {
        const primary = ids[0];
        await moduleCoordinatorsApi.update(editingAssignment.id, {
          person,
          module: assignmentModule,
          level,
          resource_id: primary,
          resource_type: resourceType,
        });
        const extras = filterNew(ids.slice(1));
        if (extras.length > 0) {
          await moduleCoordinatorsApi.bulkCreate(
            extras.map((resource_id) => ({
              person,
              module: assignmentModule,
              level,
              resource_id,
              resource_type: resourceType,
            }))
          );
        }
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

  const resetBulkModal = () => {
    setBulkSimple(emptyBulkSimple());
    setBulkAssignments([emptyBulkRow()]);
    setBulkAdvancedOpen(false);
    setBulkError("");
    setBulkAvailableResources([]);
    setBulkLoadingResources(false);
  };

  const handleBulkSimpleModuleChange = (
    module: ModuleCoordinator["module"] | ""
  ) => {
    setBulkSimple((prev) => {
      let assignmentType = prev.assignmentType;
      let level = prev.level;
      if (!bulkModuleShowsScopeUi(module)) {
        assignmentType = "module-wide";
      }
      const avail = getAvailableLevels(module);
      if (level && !avail.some((o) => o.value === level)) {
        level = "";
      }
      return {
        ...prev,
        module,
        level,
        assignmentType,
        selectedResourceIds: [],
      };
    });
  };

  const handleBulkSimpleLevelChange = (
    level: ModuleCoordinator["level"] | ""
  ) => {
    setBulkSimple((prev) => {
      let assignmentType = prev.assignmentType;
      let selectedResourceIds = prev.selectedResourceIds;
      if (level === "SENIOR_COORDINATOR") {
        assignmentType = "module-wide";
        selectedResourceIds = [];
      } else if (level === "TEACHER" || level === "BIBLE_SHARER") {
        assignmentType = "resource-specific";
      } else if (
        level === "COORDINATOR" &&
        prev.assignmentType === "module-wide"
      ) {
        assignmentType = "resource-specific";
      }
      return { ...prev, level, assignmentType, selectedResourceIds };
    });
  };

  const handleBulkSimpleAssignmentTypeChange = (
    t: "module-wide" | "resource-specific"
  ) => {
    setBulkSimple((prev) => ({
      ...prev,
      assignmentType: t,
      selectedResourceIds: t === "module-wide" ? [] : prev.selectedResourceIds,
    }));
  };

  // Bulk assignment handlers (advanced rows)
  const handleAddBulkAssignment = () => {
    setBulkAssignments([...bulkAssignments, emptyBulkRow()]);
  };

  const handleRemoveBulkAssignment = (index: number) => {
    if (bulkAssignments.length > 1) {
      setBulkAssignments(bulkAssignments.filter((_, i) => i !== index));
    }
  };

  const handleBulkAssignmentChange = (
    index: number,
    field: string,
    value: any
  ) => {
    const updated = [...bulkAssignments];
    updated[index] = { ...updated[index], [field]: value };

    if (field === "level") {
      if (value === "SENIOR_COORDINATOR") {
        updated[index].assignmentType = "module-wide";
        updated[index].resource_id = null;
        updated[index].resource_type = "";
      } else if (value === "TEACHER" || value === "BIBLE_SHARER") {
        updated[index].assignmentType = "resource-specific";
      } else if (
        value === "COORDINATOR" &&
        updated[index].assignmentType === "module-wide"
      ) {
        updated[index].assignmentType = "resource-specific";
      }
    }

    if (field === "module") {
      updated[index].resource_id = null;
      updated[index].resource_type = "";
      if (!bulkModuleShowsScopeUi(value)) {
        updated[index].assignmentType = "module-wide";
      }
    }

    setBulkAssignments(updated);
  };

  const buildValidatedBulkAssignments = (): {
    ok: true;
    assignments: Array<{
      person: number;
      module: ModuleCoordinator["module"];
      level: ModuleCoordinator["level"];
      resource_id: number | null;
      resource_type: string;
    }>;
  } | { ok: false; error: string } => {
    const person = bulkSimple.person;
    if (!person) return { ok: false, error: "Please select a person." };

    if (bulkAdvancedOpen) {
      const validated: Array<{
        person: number;
        module: ModuleCoordinator["module"];
        level: ModuleCoordinator["level"];
        resource_id: number | null;
        resource_type: string;
      }> = [];

      for (const a of bulkAssignments) {
        if (!a.module || !a.level) continue;

        let assignmentType = a.assignmentType;
        if (!bulkModuleShowsScopeUi(a.module)) {
          assignmentType = "module-wide";
        }

        const resourceSpecific = assignmentType === "resource-specific";
        if (
          resourceSpecific &&
          a.level !== "SENIOR_COORDINATOR" &&
          (a.resource_id === null || a.resource_id === undefined)
        ) {
          return {
            ok: false,
            error:
              "Each resource-specific assignment needs a selected resource.",
          };
        }

        validated.push({
          person: Number(person),
          module: a.module as ModuleCoordinator["module"],
          level: a.level as ModuleCoordinator["level"],
          resource_id: resourceSpecific ? a.resource_id : null,
          resource_type: resourceSpecific ? a.resource_type : "",
        });
      }

      if (validated.length === 0) {
        return {
          ok: false,
          error: "Please add at least one complete assignment in Advanced.",
        };
      }

      return { ok: true, assignments: validated };
    }

    const { module, level } = bulkSimple;
    if (!module || !level) {
      return { ok: false, error: "Please select module and level." };
    }

    let assignmentType = bulkSimple.assignmentType;
    if (!bulkModuleShowsScopeUi(module)) {
      assignmentType = "module-wide";
    }

    if (assignmentType === "module-wide" || level === "SENIOR_COORDINATOR") {
      return {
        ok: true,
        assignments: [
          {
            person: Number(person),
            module,
            level,
            resource_id: null,
            resource_type: "",
          },
        ],
      };
    }

    if (!moduleSupportsResourceMultiSelect(module)) {
      return {
        ok: false,
        error:
          "This module has no resources to assign here. Use module-wide scope or open Advanced.",
      };
    }

    const rt = resourceTypeForModule(module);
    const allowedIds = new Set(bulkAvailableResources.map((r) => r.id));
    const ids = bulkSimple.selectedResourceIds.filter((id) =>
      allowedIds.has(id)
    );

    if (ids.length === 0) {
      return {
        ok: false,
        error: "Select at least one resource, or switch to module-wide.",
      };
    }

    return {
      ok: true,
      assignments: ids.map((resource_id) => ({
        person: Number(person),
        module,
        level,
        resource_id,
        resource_type: rt,
      })),
    };
  };

  const handleBulkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBulkSubmitting(true);
    setBulkError("");

    try {
      const built = buildValidatedBulkAssignments();
      if (!built.ok) {
        setBulkError(built.error);
        setBulkSubmitting(false);
        return;
      }

      const validatedAssignments = built.assignments;

      const seen = new Set<string>();
      for (const assignment of validatedAssignments) {
        const key = `${assignment.module}-${assignment.resource_id}`;
        if (seen.has(key)) {
          setBulkError(
            `Duplicate assignment detected: ${assignment.module} with resource_id ${assignment.resource_id}`
          );
          setBulkSubmitting(false);
          return;
        }
        seen.add(key);
      }

      const response = await moduleCoordinatorsApi.bulkCreate(
        validatedAssignments
      );

      const savedPersonId = Number(bulkSimple.person);
      setIsBulkModalOpen(false);
      resetBulkModal();
      await fetchData();

      alert(
        `Successfully created ${response.data.created.length} assignment(s) for ${getPersonName(savedPersonId)}.`
      );
    } catch (err: any) {
      const errorMessage =
        err.response?.data?.message ||
        err.response?.data?.detail ||
        (err.response?.data?.assignments &&
        Array.isArray(err.response.data.assignments)
          ? err.response.data.assignments.join(", ")
          : JSON.stringify(err.response?.data)) ||
        err.message ||
        "Failed to create assignments.";
      setBulkError(errorMessage);
    } finally {
      setBulkSubmitting(false);
    }
  };

  // Format person options for ScalableSelect, excluding ADMIN users
  const personOptions = useMemo(() => {
    return people
      .filter(
        (person) => person.role !== "ADMIN" && person.username !== "admin"
      )
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

  const bulkSubmitLabelCount = useMemo(() => {
    if (bulkAdvancedOpen) {
      return bulkAssignments.filter((a) => a.module && a.level).length;
    }
    const { module, level, assignmentType, selectedResourceIds } = bulkSimple;
    if (!module || !level) return 0;
    if (!bulkModuleShowsScopeUi(module)) return 1;
    const scope =
      level === "SENIOR_COORDINATOR"
        ? "module-wide"
        : assignmentType === "module-wide"
        ? "module-wide"
        : "resource-specific";
    if (scope === "module-wide") return 1;
    return selectedResourceIds.length;
  }, [bulkAdvancedOpen, bulkAssignments, bulkSimple]);

  const bulkSimpleShowsResourcePicker =
    !bulkAdvancedOpen &&
    bulkModuleShowsScopeUi(bulkSimple.module) &&
    bulkSimple.assignmentType === "resource-specific" &&
    moduleSupportsResourceMultiSelect(bulkSimple.module);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-[#2D3748]">
            Module Coordinator Assignments
          </h2>
          {/* View Toggle - Mobile Only */}
          <div className="md:hidden flex items-center">
            <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden">
              <button
                onClick={() => setViewMode("cards")}
                className={`px-3 py-2 min-h-[44px] flex items-center justify-center transition-colors ${
                  viewMode === "cards"
                    ? "bg-blue-500 text-white"
                    : "bg-white text-gray-700 hover:bg-gray-50"
                }`}
                title="Card View"
              >
                <Squares2X2Icon className="w-5 h-5" />
              </button>
              <button
                onClick={() => setViewMode("table")}
                className={`px-3 py-2 min-h-[44px] flex items-center justify-center transition-colors ${
                  viewMode === "table"
                    ? "bg-blue-500 text-white"
                    : "bg-white text-gray-700 hover:bg-gray-50"
                }`}
                title="Table View"
              >
                <TableCellsIcon className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <Button
            onClick={handleCreate}
            className="w-full sm:w-auto min-h-[44px]"
          >
            Create Assignment
          </Button>
          <Button
            onClick={() => {
              resetBulkModal();
              setIsBulkModalOpen(true);
            }}
            variant="secondary"
            className="w-full sm:w-auto min-h-[44px]"
          >
            Bulk assign…
          </Button>
        </div>
        <p className="text-xs text-gray-500 max-w-3xl">
          Use <strong>Bulk assign</strong> to pick one person, one module and level, then
          multi-select clusters, evangelism groups, or Sunday School classes—everything saves
          in a single request. For mixed modules in one submit, open{" "}
          <strong>Advanced</strong> inside the modal.
        </p>
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
              className="w-full min-h-[44px] px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
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
              className="w-full min-h-[44px] px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
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
        <div className="flex flex-col sm:flex-row gap-4">
          <input
            type="text"
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            placeholder="Search by name..."
            className="w-full sm:flex-1 min-h-[44px] px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
          />
          <Button
            variant="tertiary"
            onClick={() => setFilters({ module: "", level: "", search: "" })}
            className="w-full sm:w-auto min-h-[44px]"
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
        <>
          {/* Card View - Mobile Only */}
          {viewMode === "cards" && (
            <div className="md:hidden space-y-3">
              {filteredAssignments.map((assignment) => (
                <div
                  key={assignment.id}
                  className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm"
                >
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 gap-2">
                      <div className="flex items-start justify-between">
                        <span className="text-xs text-gray-500">Person</span>
                        <div className="text-right">
                          <p className="text-sm font-medium text-gray-900 break-words">
                            {getPersonName(assignment.person)}
                          </p>
                          <p className="text-xs text-gray-500">
                            ID: {assignment.person}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-500">Module</span>
                        <span
                          className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full border ${getModuleBadgeColor(
                            assignment.module
                          )}`}
                        >
                          {assignment.module_display || assignment.module}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-500">Level</span>
                        <span
                          className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full border ${getLevelBadgeColor(
                            assignment.level
                          )}`}
                        >
                          {assignment.level_display || assignment.level}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-500">Resource</span>
                        <p className="text-sm text-gray-900 text-right break-words max-w-[60%]">
                          {assignment.resource_id
                            ? `${assignment.resource_type || "Resource"} #${
                                assignment.resource_id
                              }`
                            : "Module-wide"}
                        </p>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-500">
                          Created At
                        </span>
                        <p className="text-sm text-gray-900 text-right">
                          {formatDate(assignment.created_at)}
                        </p>
                      </div>
                    </div>
                    <div className="pt-2 border-t border-gray-200 flex flex-col gap-2">
                      <button
                        onClick={() => handleEdit(assignment)}
                        className="w-full min-h-[44px] flex items-center justify-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-white border border-blue-500 text-blue-600 rounded-md hover:bg-blue-50 transition-colors"
                      >
                        <PencilIcon className="w-4 h-4" />
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(assignment)}
                        className="w-full min-h-[44px] flex items-center justify-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-white border border-red-500 text-red-600 rounded-md hover:bg-red-50 transition-colors"
                      >
                        <TrashIcon className="w-4 h-4" />
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Table View */}
          <div
            className={`bg-white rounded-lg shadow-md overflow-hidden ${
              viewMode === "cards" ? "hidden md:block" : ""
            }`}
          >
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-3 md:px-6 md:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Person
                    </th>
                    <th className="px-3 py-3 md:px-6 md:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Module
                    </th>
                    <th className="px-3 py-3 md:px-6 md:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Level
                    </th>
                    <th className="px-3 py-3 md:px-6 md:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Resource
                    </th>
                    <th className="px-3 py-3 md:px-6 md:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Created At
                    </th>
                    <th className="px-3 py-3 md:px-6 md:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredAssignments.map((assignment) => (
                    <tr key={assignment.id}>
                      <td className="px-3 py-4 md:px-6 md:py-4">
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-gray-900 break-words">
                            {getPersonName(assignment.person)}
                          </div>
                          <div className="text-sm text-gray-500">
                            ID: {assignment.person}
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-4 md:px-6 md:py-4">
                        <span
                          className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full border ${getModuleBadgeColor(
                            assignment.module
                          )}`}
                        >
                          {assignment.module_display || assignment.module}
                        </span>
                      </td>
                      <td className="px-3 py-4 md:px-6 md:py-4">
                        <span
                          className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full border ${getLevelBadgeColor(
                            assignment.level
                          )}`}
                        >
                          {assignment.level_display || assignment.level}
                        </span>
                      </td>
                      <td className="px-3 py-4 md:px-6 md:py-4 text-sm text-gray-500 break-words">
                        {assignment.resource_id
                          ? `${assignment.resource_type || "Resource"} #${
                              assignment.resource_id
                            }`
                          : "Module-wide"}
                      </td>
                      <td className="px-3 py-4 md:px-6 md:py-4 text-sm text-gray-500">
                        {formatDate(assignment.created_at)}
                      </td>
                      <td className="px-3 py-4 md:px-6 md:py-4 text-sm font-medium">
                        <div className="flex flex-col sm:flex-row gap-2">
                          <button
                            onClick={() => handleEdit(assignment)}
                            className="w-full sm:w-auto min-h-[44px] flex items-center justify-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-white border border-blue-500 text-blue-600 rounded-md hover:bg-blue-50 transition-colors"
                          >
                            <PencilIcon className="w-4 h-4" />
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(assignment)}
                            className="w-full sm:w-auto min-h-[44px] flex items-center justify-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-white border border-red-500 text-red-600 rounded-md hover:bg-red-50 transition-colors"
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
          </div>
        </>
      )}

      {/* Create/Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setError("");
          setAssignmentType("module-wide");
          setFormResourceSelectedIds([]);
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
                setFormResourceSelectedIds([]);
                if (["FINANCE", "MINISTRIES"].includes(newModule)) {
                  setAssignmentType("module-wide");
                }
              }}
              required
              className="w-full min-h-[44px] px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
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
                  setFormResourceSelectedIds([]);
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
              className="w-full min-h-[44px] px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#2563EB] disabled:bg-gray-100 disabled:cursor-not-allowed"
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
                <div className="flex flex-col sm:flex-row gap-4">
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

          {/* Resource selection — multi-select for CLUSTER / EVANGELISM / SUNDAY_SCHOOL */}
          {assignmentType === "resource-specific" && formData.module && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
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
                    module-wide access instead.
                  </p>
                </div>
              ) : moduleSupportsResourceMultiSelect(
                  formData.module as ModuleCoordinator["module"]
                ) ? (
                <>
                  <p
                    id="form-resource-picker-label"
                    className="block text-sm font-medium text-gray-700 mb-2"
                  >
                    Select resources <span className="text-red-500">*</span>
                  </p>
                  {editingAssignment &&
                    editingAssignment.resource_id != null && (
                      <p className="text-xs text-gray-600 mb-3">
                        Additional checked resources create new assignments for
                        the same person and module. Uncheck the original resource
                        to move this assignment to a different primary resource.
                      </p>
                    )}
                  <ResourceAssignmentMultiPicker
                    resources={availableResources.map(
                      ({ id, name, trailingLabel }) => ({
                        id,
                        name,
                        trailingLabel,
                      })
                    )}
                    selectedIds={formResourceSelectedIds}
                    onSelectedIdsChange={(ids) => {
                      setFormResourceSelectedIds(ids);
                      const first = ids[0];
                      const row =
                        first != null
                          ? availableResources.find((r) => r.id === first)
                          : undefined;
                      setFormData((prev) => ({
                        ...prev,
                        resource_id: first ?? null,
                        resource_type: row?.type ?? "",
                      }));
                    }}
                    loading={loadingResources}
                    disabled={submitting}
                    labelledBy="form-resource-picker-label"
                  />
                </>
              ) : (
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                  <p className="text-sm text-yellow-800">
                    No resources available for this module. Switch to
                    module-wide access instead.
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

          <div className="flex flex-col-reverse sm:flex-row gap-3 pt-4">
            <Button
              type="button"
              variant="tertiary"
              className="w-full sm:flex-1 min-h-[44px]"
              onClick={() => {
                setIsModalOpen(false);
                setError("");
                setAssignmentType("module-wide");
                setFormResourceSelectedIds([]);
              }}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="w-full sm:flex-1 min-h-[44px]"
              disabled={submitting}
            >
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

      {/* Bulk assign modal */}
      <Modal
        isOpen={isBulkModalOpen}
        onClose={() => {
          setIsBulkModalOpen(false);
          resetBulkModal();
        }}
        title="Bulk assign"
      >
        <form onSubmit={handleBulkSubmit} className="space-y-4">
          {bulkError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-600">{bulkError}</p>
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
              value={bulkSimple.person ? String(bulkSimple.person) : ""}
              onChange={(value) =>
                setBulkSimple((prev) => ({
                  ...prev,
                  person: value ? Number(value) : "",
                }))
              }
              placeholder="Select a person..."
              className="w-full"
              showSearch
            />
          </div>

          {!bulkAdvancedOpen && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Module <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={bulkSimple.module}
                    onChange={(e) =>
                      handleBulkSimpleModuleChange(
                        e.target.value as ModuleCoordinator["module"] | ""
                      )
                    }
                    className="w-full min-h-[44px] px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
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
                    value={bulkSimple.level}
                    onChange={(e) =>
                      handleBulkSimpleLevelChange(
                        e.target.value as ModuleCoordinator["level"] | ""
                      )
                    }
                    disabled={!bulkSimple.module}
                    className="w-full min-h-[44px] px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#2563EB] disabled:bg-gray-100 disabled:cursor-not-allowed"
                  >
                    <option value="">
                      {bulkSimple.module
                        ? "Select a level..."
                        : "Select a module first"}
                    </option>
                    {getAvailableLevels(bulkSimple.module).map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {bulkModuleShowsScopeUi(bulkSimple.module) && (
                <div className="border border-gray-200 rounded-lg p-4 space-y-3">
                  <span className="block text-sm font-medium text-gray-700">
                    Assignment scope
                  </span>
                  <div className="flex flex-col sm:flex-row gap-4">
                    <label className="flex items-center cursor-pointer">
                      <input
                        type="radio"
                        name="bulk-simple-scope"
                        checked={bulkSimple.assignmentType === "module-wide"}
                        onChange={() =>
                          handleBulkSimpleAssignmentTypeChange("module-wide")
                        }
                        disabled={
                          bulkSimple.level === "TEACHER" ||
                          bulkSimple.level === "BIBLE_SHARER"
                        }
                        className="mr-2 text-[#2563EB] focus:ring-[#2563EB] disabled:opacity-50 disabled:cursor-not-allowed"
                      />
                      <span
                        className={
                          bulkSimple.level === "TEACHER" ||
                          bulkSimple.level === "BIBLE_SHARER"
                            ? "text-gray-400"
                            : "text-gray-900"
                        }
                      >
                        Module-wide
                      </span>
                    </label>
                    <label className="flex items-center cursor-pointer">
                      <input
                        type="radio"
                        name="bulk-simple-scope"
                        checked={
                          bulkSimple.assignmentType === "resource-specific"
                        }
                        onChange={() =>
                          handleBulkSimpleAssignmentTypeChange(
                            "resource-specific"
                          )
                        }
                        disabled={
                          bulkSimple.level === "SENIOR_COORDINATOR"
                        }
                        className="mr-2 text-[#2563EB] focus:ring-[#2563EB] disabled:opacity-50 disabled:cursor-not-allowed"
                      />
                      <span
                        className={
                          bulkSimple.level === "SENIOR_COORDINATOR"
                            ? "text-gray-400"
                            : "text-gray-900"
                        }
                      >
                        Specific resources
                      </span>
                    </label>
                  </div>
                  {bulkSimple.level === "SENIOR_COORDINATOR" && (
                    <p className="text-xs text-amber-600">
                      Senior coordinators have module-wide access.
                    </p>
                  )}
                  {(bulkSimple.level === "TEACHER" ||
                    bulkSimple.level === "BIBLE_SHARER") && (
                    <p className="text-xs text-amber-600">
                      {bulkSimple.level === "TEACHER"
                        ? "Teachers"
                        : "Bible Sharers"}{" "}
                      must be assigned to specific resources.
                    </p>
                  )}
                </div>
              )}

              {bulkSimpleShowsResourcePicker && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p
                    id="bulk-resource-picker-label"
                    className="block text-sm font-medium text-gray-700 mb-2"
                  >
                    Select resources <span className="text-red-500">*</span>
                  </p>
                  <ResourceAssignmentMultiPicker
                    resources={bulkAvailableResources.map(
                      ({ id, name, trailingLabel }) => ({
                        id,
                        name,
                        trailingLabel,
                      })
                    )}
                    selectedIds={bulkSimple.selectedResourceIds}
                    onSelectedIdsChange={(ids) =>
                      setBulkSimple((prev) => ({
                        ...prev,
                        selectedResourceIds: ids,
                      }))
                    }
                    loading={bulkLoadingResources}
                    disabled={bulkSubmitting}
                    labelledBy="bulk-resource-picker-label"
                  />
                </div>
              )}

              {bulkModuleShowsScopeUi(bulkSimple.module) &&
                bulkSimple.assignmentType === "resource-specific" &&
                !moduleSupportsResourceMultiSelect(bulkSimple.module) && (
                  <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md text-sm text-yellow-900">
                    This module has no resource list in bulk assign. Use
                    module-wide access or open Advanced below.
                  </div>
                )}
            </>
          )}

          <div className="border-t border-gray-200 pt-4">
            <button
              type="button"
              className="text-sm font-medium text-[#2563EB] hover:underline min-h-[44px] text-left"
              onClick={() => {
                const next = !bulkAdvancedOpen;
                setBulkAdvancedOpen(next);
                if (next) {
                  setBulkAssignments([emptyBulkRow()]);
                }
              }}
            >
              {bulkAdvancedOpen
                ? "← Back to simple bulk assign"
                : "Advanced: assign multiple modules in one submit"}
            </button>

            {bulkAdvancedOpen && (
              <div className="mt-4 space-y-4">
                <p className="text-xs text-gray-600">
                  Add one block per assignment. Each row can use a different
                  module or resource.
                </p>
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
                  <span className="text-sm font-medium text-gray-700">
                    Assignment rows
                  </span>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={handleAddBulkAssignment}
                    className="w-full sm:w-auto min-h-[44px] text-sm"
                  >
                    Add row
                  </Button>
                </div>

                <div className="space-y-4">
                  {bulkAssignments.map((assignment, index) => (
                    <div
                      key={index}
                      className="p-4 border border-gray-200 rounded-lg space-y-3"
                    >
                      <div className="flex justify-between items-center">
                        <h4 className="text-sm font-medium text-gray-700">
                          Assignment {index + 1}
                        </h4>
                        {bulkAssignments.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveBulkAssignment(index)}
                            className="text-red-600 hover:text-red-800 text-sm min-h-[44px] px-2"
                          >
                            Remove
                          </button>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Module <span className="text-red-500">*</span>
                        </label>
                        <select
                          value={assignment.module}
                          onChange={(e) =>
                            handleBulkAssignmentChange(
                              index,
                              "module",
                              e.target.value
                            )
                          }
                          required
                          className="w-full min-h-[44px] px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
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
                          value={assignment.level}
                          onChange={(e) =>
                            handleBulkAssignmentChange(
                              index,
                              "level",
                              e.target.value
                            )
                          }
                          required
                          disabled={!assignment.module}
                          className="w-full min-h-[44px] px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#2563EB] disabled:bg-gray-100 disabled:cursor-not-allowed"
                        >
                          <option value="">
                            {assignment.module
                              ? "Select a level..."
                              : "Select a module first"}
                          </option>
                          {getAvailableLevels(assignment.module).map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      {assignment.module &&
                        !["FINANCE", "MINISTRIES"].includes(
                          assignment.module
                        ) && (
                          <div className="border-t border-gray-200 pt-3">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Assignment scope
                            </label>
                            <div className="flex flex-col sm:flex-row gap-4">
                              <label className="flex items-center cursor-pointer">
                                <input
                                  type="radio"
                                  name={`assignmentType-${index}`}
                                  value="module-wide"
                                  checked={
                                    assignment.assignmentType === "module-wide"
                                  }
                                  onChange={() =>
                                    handleBulkAssignmentChange(
                                      index,
                                      "assignmentType",
                                      "module-wide"
                                    )
                                  }
                                  disabled={
                                    assignment.level === "TEACHER" ||
                                    assignment.level === "BIBLE_SHARER"
                                  }
                                  className="mr-2 text-[#2563EB] focus:ring-[#2563EB] disabled:opacity-50 disabled:cursor-not-allowed"
                                />
                                <span
                                  className={
                                    assignment.level === "TEACHER" ||
                                    assignment.level === "BIBLE_SHARER"
                                      ? "text-gray-400"
                                      : "text-gray-900"
                                  }
                                >
                                  Module-wide
                                </span>
                              </label>
                              <label className="flex items-center cursor-pointer">
                                <input
                                  type="radio"
                                  name={`assignmentType-${index}`}
                                  value="resource-specific"
                                  checked={
                                    assignment.assignmentType ===
                                    "resource-specific"
                                  }
                                  onChange={() =>
                                    handleBulkAssignmentChange(
                                      index,
                                      "assignmentType",
                                      "resource-specific"
                                    )
                                  }
                                  disabled={
                                    assignment.level === "SENIOR_COORDINATOR"
                                  }
                                  className="mr-2 text-[#2563EB] focus:ring-[#2563EB] disabled:opacity-50 disabled:cursor-not-allowed"
                                />
                                <span
                                  className={
                                    assignment.level === "SENIOR_COORDINATOR"
                                      ? "text-gray-400"
                                      : "text-gray-900"
                                  }
                                >
                                  Specific resource
                                </span>
                              </label>
                            </div>
                          </div>
                        )}

                      {assignment.assignmentType === "resource-specific" &&
                        assignment.module && (
                          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Select resource{" "}
                              {assignment.level !== "SENIOR_COORDINATOR" && (
                                <span className="text-red-500">*</span>
                              )}
                            </label>
                            {bulkLoadingResources ? (
                              <div className="flex items-center justify-center py-2">
                                <LoadingSpinner />
                                <span className="ml-2 text-sm text-gray-500">
                                  Loading resources...
                                </span>
                              </div>
                            ) : (
                              <select
                                value={assignment.resource_id || ""}
                                onChange={async (e) => {
                                  const resourceId = e.target.value
                                    ? Number(e.target.value)
                                    : null;
                                  const resource = bulkAvailableResources.find(
                                    (r) => r.id === resourceId
                                  );
                                  handleBulkAssignmentChange(
                                    index,
                                    "resource_id",
                                    resourceId
                                  );
                                  handleBulkAssignmentChange(
                                    index,
                                    "resource_type",
                                    resource?.type || ""
                                  );
                                }}
                                required={
                                  assignment.level !== "SENIOR_COORDINATOR"
                                }
                                className="w-full min-h-[44px] px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                                onFocus={async () => {
                                  if (!assignment.module) return;
                                  setBulkLoadingResources(true);
                                  try {
                                    let resources: CoordinatorResourceOption[] =
                                      [];

                                    switch (assignment.module) {
                                      case "CLUSTER": {
                                        const clusters =
                                          await clustersApi.getAll();
                                        resources =
                                          clusters.data.map(
                                            clusterApiRowToResourceOption
                                          );
                                        break;
                                      }
                                      case "EVANGELISM": {
                                        const groups =
                                          await evangelismApi.listGroups();
                                        resources = groups.data.map(
                                          (g: any) => ({
                                            id: g.id,
                                            name:
                                              g.name ||
                                              `Evangelism Group #${g.id}`,
                                            type: "EvangelismGroup",
                                          })
                                        );
                                        break;
                                      }
                                      case "SUNDAY_SCHOOL": {
                                        const classes =
                                          await sundaySchoolApi.listClasses();
                                        resources = classes.data.map(
                                          (c: any) => ({
                                            id: c.id,
                                            name:
                                              c.name ||
                                              `Sunday School Class #${c.id}`,
                                            type: "SundaySchoolClass",
                                          })
                                        );
                                        break;
                                      }
                                    }
                                    setBulkAvailableResources(resources);
                                  } catch (err) {
                                    console.error(
                                      "Failed to fetch resources:",
                                      err
                                    );
                                    setBulkAvailableResources([]);
                                  } finally {
                                    setBulkLoadingResources(false);
                                  }
                                }}
                              >
                                <option value="">Select a resource...</option>
                                {bulkAvailableResources.map((resource) => (
                                  <option key={resource.id} value={resource.id}>
                                    {resource.type === "Cluster" &&
                                    resource.trailingLabel
                                      ? `${resource.name} (${resource.trailingLabel})`
                                      : resource.name}
                                  </option>
                                ))}
                              </select>
                            )}
                          </div>
                        )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 justify-between pt-2 border-t border-gray-200">
            <span className="text-sm text-gray-600" aria-live="polite">
              Will create <strong>{bulkSubmitLabelCount}</strong> assignment(s)
            </span>
          </div>

          <div className="flex flex-col-reverse sm:flex-row gap-3 pt-2">
            <Button
              type="button"
              variant="tertiary"
              className="w-full sm:flex-1 min-h-[44px]"
              onClick={() => {
                setIsBulkModalOpen(false);
                resetBulkModal();
              }}
              disabled={bulkSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="w-full sm:flex-1 min-h-[44px]"
              disabled={
                bulkSubmitting ||
                !bulkSimple.person ||
                bulkSubmitLabelCount === 0
              }
            >
              {bulkSubmitting
                ? "Saving..."
                : `Create ${bulkSubmitLabelCount} assignment(s)`}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
