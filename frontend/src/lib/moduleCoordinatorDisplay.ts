import { ModuleCoordinator } from "@/src/types/person";

export function groupKey(a: ModuleCoordinator): string {
  return `${a.person}-${a.module}-${a.level}`;
}

export function assignmentResourceId(a: ModuleCoordinator): number | null {
  if (a.resource_id == null) return null;
  return Number(a.resource_id);
}

/** Diff checked resources against a grouped edit so unchecking deletes, not retargets. */
export function planGroupedResourceAssignmentSync(args: {
  editGroup: ModuleCoordinator[];
  selectedResourceIds: number[];
  person: number;
  module: ModuleCoordinator["module"];
  existingAssignments: ModuleCoordinator[];
}): {
  toDelete: ModuleCoordinator[];
  toKeep: ModuleCoordinator[];
  toCreate: number[];
} {
  const selected = new Set(args.selectedResourceIds);
  const toDelete = args.editGroup.filter((a) => {
    const rid = assignmentResourceId(a);
    return rid != null && !selected.has(rid);
  });
  const toKeep = args.editGroup.filter((a) => {
    const rid = assignmentResourceId(a);
    return rid != null && selected.has(rid);
  });
  const deleteIds = new Set(toDelete.map((a) => a.id));
  const occupied = new Set<number>();
  for (const a of args.existingAssignments) {
    if (deleteIds.has(a.id)) continue;
    if (Number(a.person) !== Number(args.person)) continue;
    if (a.module !== args.module) continue;
    const rid = assignmentResourceId(a);
    if (rid != null) occupied.add(rid);
  }
  const toCreate = args.selectedResourceIds.filter((rid) => !occupied.has(rid));
  return { toDelete, toKeep, toCreate };
}

/** Scope cell text: prefer API label (oversight, cluster codes), else resource_id fallback. */
export function scopeLabelForAssignment(a: ModuleCoordinator): string | null {
  if (
    a.resource_scope_label != null &&
    String(a.resource_scope_label).trim() !== ""
  ) {
    return String(a.resource_scope_label).trim();
  }
  if (a.resource_id == null) return null;
  const rt =
    (a.resource_type || "").replace(/_/g, " ").trim() || "Resource";
  return `${rt} · ID ${a.resource_id}`;
}

export function formatGroupedResourceScope(
  assignments: ModuleCoordinator[],
): string {
  const moduleWide = assignments.find((a) => a.resource_id == null);
  if (moduleWide) {
    return scopeLabelForAssignment(moduleWide) ?? "Module-wide";
  }

  const labels = Array.from(
    new Set(
      assignments
        .map((a) => scopeLabelForAssignment(a))
        .filter((s): s is string => s != null && s !== ""),
    ),
  ).sort((x, y) => x.localeCompare(y));
  return labels.length > 0 ? labels.join(", ") : "—";
}

export type GroupedAssignmentRow = {
  key: string;
  person: number;
  module: ModuleCoordinator["module"];
  level: ModuleCoordinator["level"];
  assignments: ModuleCoordinator[];
  resourceLabel: string;
  createdAt?: string;
  representative: ModuleCoordinator;
};

export function groupModuleCoordinatorAssignments(
  assignments: ModuleCoordinator[],
  options?: { resolvePersonLabel?: (personId: number) => string },
): GroupedAssignmentRow[] {
  const byKey = new Map<string, ModuleCoordinator[]>();
  for (const a of assignments) {
    const key = groupKey(a);
    const list = byKey.get(key) ?? [];
    list.push(a);
    byKey.set(key, list);
  }

  const rows: GroupedAssignmentRow[] = [];
  for (const [key, group] of Array.from(byKey.entries())) {
    const sorted = [...group].sort((a, b) => (a.id ?? 0) - (b.id ?? 0));
    const first = sorted[0];
    const createdAt = sorted
      .map((a) => a.created_at)
      .filter((d): d is string => Boolean(d))
      .sort()[0];

    rows.push({
      key,
      person: first.person,
      module: first.module,
      level: first.level,
      assignments: sorted,
      resourceLabel: formatGroupedResourceScope(sorted),
      createdAt,
      representative: first,
    });
  }

  const resolveLabel =
    options?.resolvePersonLabel ?? ((personId: number) => String(personId));
  rows.sort((a, b) => {
    const pa = resolveLabel(a.person).localeCompare(resolveLabel(b.person));
    if (pa !== 0) return pa;
    const ma = (a.representative.module_display || a.module).localeCompare(
      b.representative.module_display || b.module,
    );
    if (ma !== 0) return ma;
    return (a.representative.level_display || a.level).localeCompare(
      b.representative.level_display || b.level,
    );
  });

  return rows;
}
