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

function formatScope(a: ModuleCoordinator): string {
  if (a.resource_id == null) return "—";
  const rt =
    (a.resource_type || "").replace(/_/g, " ").trim() || "Resource";
  return `${rt} · ID ${a.resource_id}`;
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
                {assignments.map((a) => (
                  <tr key={a.id} className="bg-white">
                    <td className="px-3 py-2 text-gray-900">
                      {a.module_display || a.module}
                    </td>
                    <td className="px-3 py-2 text-gray-800">
                      {a.level_display || a.level}
                    </td>
                    <td className="px-3 py-2 text-gray-600">{formatScope(a)}</td>
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
