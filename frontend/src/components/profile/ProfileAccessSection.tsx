import { User } from "@/src/lib/api";
import { ModuleCoordinator } from "@/src/types/person";

function roleBadgeClass(role: string): string {
  switch (role) {
    case "ADMIN":
      return "bg-green-100 text-green-800";
    case "PASTOR":
      return "bg-purple-100 text-purple-800";
    case "COORDINATOR":
      return "bg-blue-100 text-blue-800";
    case "MEMBER":
      return "bg-slate-100 text-slate-800";
    case "VISITOR":
      return "bg-red-100 text-red-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

function sortAssignments(rows: ModuleCoordinator[]): ModuleCoordinator[] {
  return [...rows].sort((a, b) => {
    const ma = (a.module_display || a.module || "").localeCompare(
      b.module_display || b.module || "",
    );
    if (ma !== 0) return ma;
    const la = (a.level_display || a.level || "").localeCompare(
      b.level_display || b.level || "",
    );
    if (la !== 0) return la;
    return (a.id ?? 0) - (b.id ?? 0);
  });
}

/** Scope cell text: prefer API label (oversight, cluster codes), else resource_id fallback. */
function scopeLabelForAssignment(a: ModuleCoordinator): string | null {
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

function formatScope(a: ModuleCoordinator): string {
  return scopeLabelForAssignment(a) ?? "—";
}

function isClusterCoordinatorAssignment(a: ModuleCoordinator): boolean {
  return a.module === "CLUSTER" && a.level === "COORDINATOR";
}

type AccessTableRow = {
  key: string;
  moduleLabel: string;
  levelLabel: string;
  scope: string;
};

function buildMergedClusterCoordinatorRow(
  clusterCoordRows: ModuleCoordinator[],
): AccessTableRow | null {
  if (clusterCoordRows.length === 0) return null;
  const labels = [
    ...new Set(
      clusterCoordRows
        .map((a) => scopeLabelForAssignment(a))
        .filter((s): s is string => s != null && s !== ""),
    ),
  ].sort((x, y) => x.localeCompare(y));
  const scope = labels.length > 0 ? labels.join(", ") : "—";
  const first = clusterCoordRows[0];
  return {
    key: "merged-cluster-coordinator",
    moduleLabel: first.module_display || first.module,
    levelLabel: first.level_display || first.level,
    scope,
  };
}

function buildAccessTableRows(sorted: ModuleCoordinator[]): AccessTableRow[] {
  const merged = buildMergedClusterCoordinatorRow(
    sorted.filter(isClusterCoordinatorAssignment),
  );
  const firstClusterCoordIndex = sorted.findIndex(isClusterCoordinatorAssignment);
  const rows: AccessTableRow[] = [];

  for (let i = 0; i < sorted.length; i++) {
    const a = sorted[i];
    if (isClusterCoordinatorAssignment(a)) {
      if (merged && i === firstClusterCoordIndex) {
        rows.push(merged);
      }
      continue;
    }
    rows.push({
      key: `mc-${a.id}`,
      moduleLabel: a.module_display || a.module,
      levelLabel: a.level_display || a.level,
      scope: formatScope(a),
    });
  }
  return rows;
}

function BroadAccessNote({ user }: { user: User }) {
  const n = (user.module_coordinator_assignments ?? []).length;

  if (user.role === "ADMIN") {
    return (
      <p className="text-sm text-gray-600">
        You have full administrative access. Module-specific coordinator
        assignments below add scoped roles when present.
      </p>
    );
  }

  if (user.role === "PASTOR") {
    return (
      <p className="text-sm text-gray-600">
        Pastoral access follows your church and branch policies. The table below
        lists any module-specific coordinator assignments.
      </p>
    );
  }

  if (user.role === "COORDINATOR" && n === 0) {
    return (
      <p className="text-sm text-gray-600">
        You have the coordinator role. If nothing appears below, your duties may
        be configured elsewhere—contact an administrator.
      </p>
    );
  }

  if (user.role === "MEMBER") {
    return (
      <p className="text-sm text-gray-600">
        You have standard member access to areas enabled for your church.
      </p>
    );
  }

  if (user.role === "VISITOR") {
    return (
      <p className="text-sm text-gray-600">
        Visitor accounts have limited access to the system.
      </p>
    );
  }

  return null;
}

function EmptyAssignmentsLine({ user }: { user: User }) {
  const n = (user.module_coordinator_assignments ?? []).length;
  if (n > 0) return null;
  if (user.role === "ADMIN") return null;

  return (
    <p className="text-sm text-gray-500">
      No module-specific coordinator assignments.
    </p>
  );
}

export default function ProfileAccessSection({ user }: { user: User }) {
  const assignments = sortAssignments(
    user.module_coordinator_assignments ?? [],
  );
  const tableRows = buildAccessTableRows(assignments);

  const branchLine =
    user.branch_name?.trim() ||
    (user.branch != null ? `Branch ID ${user.branch}` : null);

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-xl font-semibold text-[#2D3748] mb-1">
        Your access
      </h2>
      <p className="text-sm text-gray-500 mb-4">
        Roles and module access are assigned by administrators. This summary is
        for your information only.
      </p>

      <div className="space-y-4">
        <div>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
            Church role
          </p>
          <span
            className={`inline-flex px-2.5 py-0.5 rounded-full text-sm font-medium ${roleBadgeClass(
              user.role,
            )}`}
          >
            {user.role}
          </span>
        </div>

        {branchLine && (
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
              Branch
            </p>
            <p className="text-sm text-gray-800">{branchLine}</p>
          </div>
        )}

        <BroadAccessNote user={user} />
        <EmptyAssignmentsLine user={user} />

        {assignments.length > 0 && (
          <div className="overflow-x-auto border border-gray-200 rounded-lg">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-left text-gray-600">
                <tr>
                  <th className="px-3 py-2 font-medium">Module</th>
                  <th className="px-3 py-2 font-medium">Level</th>
                  <th className="px-3 py-2 font-medium">Scope</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {tableRows.map((row) => (
                  <tr key={row.key} className="bg-white">
                    <td className="px-3 py-2 text-gray-900">{row.moduleLabel}</td>
                    <td className="px-3 py-2 text-gray-800">{row.levelLabel}</td>
                    <td className="px-3 py-2 text-gray-600">{row.scope}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
