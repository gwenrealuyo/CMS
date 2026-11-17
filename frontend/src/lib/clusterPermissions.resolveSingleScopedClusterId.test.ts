/**
 * Run: npx --yes tsx src/lib/clusterPermissions.resolveSingleScopedClusterId.test.ts
 */
import assert from "node:assert/strict";
import type { Cluster } from "@/src/types/cluster";
import type { ModuleCoordinator } from "@/src/types/person";
import {
  resolveSingleScopedClusterId,
  coordinatorClusterIdsFromAssignments,
} from "./clusterPermissions";

function auth(overrides: {
  userId?: number;
  role?: string;
  assignments?: ModuleCoordinator[];
  hasClusterModuleWideAccess?: boolean;
  isSenior?: boolean;
}) {
  const assignments = overrides.assignments ?? [];
  return {
    userId: overrides.userId ?? 10,
    role: overrides.role ?? "MEMBER",
    moduleCoordinatorAssignments: assignments,
    hasClusterModuleWideAccess: overrides.hasClusterModuleWideAccess ?? false,
    isSeniorCoordinator: (module?: ModuleCoordinator["module"]) =>
      Boolean(overrides.isSenior) && (!module || module === "CLUSTER"),
    isModuleCoordinator: (
      module: ModuleCoordinator["module"],
      level?: ModuleCoordinator["level"],
      resourceId?: number,
    ) =>
      assignments.some(
        (a) =>
          a.module === module &&
          (!level || a.level === level) &&
          (resourceId === undefined ||
            (a.resource_id != null && Number(a.resource_id) === resourceId)),
      ),
  };
}

function assignment(
  level: ModuleCoordinator["level"],
  resource_id: number | null,
): ModuleCoordinator {
  return {
    id: Math.floor(Math.random() * 100000),
    module: "CLUSTER",
    level,
    resource_id,
  } as ModuleCoordinator;
}

function cluster(id: number, coordinatorId?: number): Cluster {
  return {
    id,
    name: `Cluster ${id}`,
    coordinator_id: coordinatorId,
  } as Cluster;
}

assert.equal(
  resolveSingleScopedClusterId(
    auth({
      assignments: [assignment("REPORTER", 42)],
    }),
  ),
  42,
  "single reporter assignment → that cluster id",
);

assert.equal(
  resolveSingleScopedClusterId(
    auth({
      assignments: [assignment("ASSISTANT_COORDINATOR", 7)],
    }),
  ),
  7,
  "single assistant assignment → that cluster id",
);

assert.equal(
  resolveSingleScopedClusterId(
    auth({
      assignments: [assignment("COORDINATOR", 3)],
    }),
  ),
  3,
  "single coordinator assignment → that cluster id",
);

assert.deepEqual(
  coordinatorClusterIdsFromAssignments([assignment("COORDINATOR", 3)]),
  [3],
);

assert.equal(
  resolveSingleScopedClusterId(
    auth({
      assignments: [
        assignment("COORDINATOR", 3),
        assignment("REPORTER", 9),
      ],
    }),
  ),
  null,
  "two different assigned clusters → null",
);

assert.equal(
  resolveSingleScopedClusterId(
    auth({
      assignments: [
        assignment("COORDINATOR", 3),
        assignment("REPORTER", 3),
      ],
    }),
  ),
  3,
  "coord + reporter on same cluster → that id",
);

assert.equal(
  resolveSingleScopedClusterId(
    auth({
      hasClusterModuleWideAccess: true,
      assignments: [assignment("COORDINATOR", 3)],
    }),
  ),
  null,
  "module-wide access → null even with one assignment",
);

assert.equal(
  resolveSingleScopedClusterId(auth({ assignments: [] }), [
    cluster(11, 10),
  ]),
  11,
  "named FK coordinator of one cluster → that id",
);

assert.equal(
  resolveSingleScopedClusterId(auth({ assignments: [] }), [
    cluster(11, 10),
    cluster(12, 10),
  ]),
  null,
  "named FK coordinator of two clusters → null",
);

assert.equal(
  resolveSingleScopedClusterId(auth({ assignments: [] }), [cluster(11, 99)]),
  null,
  "no assignment and not named coordinator → null",
);

assert.equal(
  resolveSingleScopedClusterId(
    auth({
      assignments: [assignment("COORDINATOR", null)],
    }),
  ),
  null,
  "module-wide coordinator row without resource_id → null",
);

console.log(
  "clusterPermissions.resolveSingleScopedClusterId: all assertions passed",
);
