import type { Cluster, ClusterMemberDetail } from "@/src/types/cluster";
import type { Family, Person, PersonUI } from "@/src/types/person";

/** Person shown on a cluster roster; profile open only when in People scope. */
export type ClusterRosterPerson = Person & { canOpenProfile?: boolean };

/** Family shown on a cluster roster; panel open only when in Families scope. */
export type ClusterRosterFamily = Family & {
  canOpenProfile?: boolean;
  /** Present when built from families_details without a full Family payload. */
  member_count?: number;
};

function detailToRosterPerson(
  detail: ClusterMemberDetail,
  existing?: PersonUI
): ClusterRosterPerson {
  if (existing) {
    return {
      ...existing,
      id: String(existing.id),
      canOpenProfile: existing.can_view_profile !== false,
    };
  }
  return {
    id: String(detail.id),
    username: "",
    email: "",
    first_name: detail.first_name || "",
    last_name: detail.last_name || "",
    role: detail.role as Person["role"],
    status: (detail.status as Person["status"]) || "ACTIVE",
    photo: detail.photo ?? undefined,
    canOpenProfile: false,
  };
}

/**
 * Resolve cluster members for display: prefer privacy-safe members_details,
 * enriched with full Person when already in the caller's people scope.
 */
export function resolveClusterRosterPeople(
  cluster: Cluster,
  peopleUI: PersonUI[]
): ClusterRosterPerson[] {
  const byId = new Map(peopleUI.map((p) => [String(p.id), p]));

  if (cluster.members_details != null) {
    return cluster.members_details.map((d) =>
      detailToRosterPerson(d, byId.get(String(d.id)))
    );
  }

  return (cluster.members || [])
    .map((id) => byId.get(String(id)))
    .filter((p): p is PersonUI => !!p)
    .map((p) => ({
      ...p,
      id: String(p.id),
      canOpenProfile: p.can_view_profile !== false,
    }));
}

/**
 * Resolve cluster families for display: prefer families_details,
 * enriched when the family is already in the caller's family scope.
 */
export function resolveClusterRosterFamilies(
  cluster: Cluster,
  families: Family[]
): ClusterRosterFamily[] {
  const byId = new Map(families.map((f) => [String(f.id), f]));

  if (cluster.families_details != null) {
    return cluster.families_details.map((d) => {
      const existing = byId.get(String(d.id));
      if (existing) {
        return {
          ...existing,
          canOpenProfile: true,
          member_count: existing.members?.length ?? d.member_count,
        };
      }
      return {
        id: String(d.id),
        name: d.name || "",
        members: [],
        member_count: d.member_count,
        canOpenProfile: false,
      };
    });
  }

  return (cluster.families || [])
    .map((id) => byId.get(String(id)))
    .filter((f): f is Family => !!f)
    .map((f) => ({
      ...f,
      canOpenProfile: true,
      member_count: f.members?.length ?? 0,
    }));
}

export function countClusterMembersFromDetails(
  cluster: Cluster,
  peopleUI: PersonUI[]
): { memberCount: number; visitorCount: number } {
  if (
    typeof cluster.member_count === "number" ||
    typeof cluster.visitor_count === "number"
  ) {
    return {
      memberCount: cluster.member_count ?? 0,
      visitorCount: cluster.visitor_count ?? 0,
    };
  }

  const roster = resolveClusterRosterPeople(cluster, peopleUI);
  const coordinatorId =
    cluster.coordinator?.id != null
      ? String(cluster.coordinator.id)
      : cluster.coordinator_id != null
        ? String(cluster.coordinator_id)
        : null;

  const coordinator = coordinatorId
    ? peopleUI.find((p) => String(p.id) === coordinatorId) ||
      roster.find((p) => String(p.id) === coordinatorId)
    : undefined;

  const coordinatorInMembers = coordinator
    ? roster.some((m) => String(m.id) === String(coordinator.id))
    : false;

  let memberCount = roster.filter(
    (m) => m.role !== "ADMIN" && m.role !== "VISITOR"
  ).length;
  let visitorCount = roster.filter((m) => m.role === "VISITOR").length;

  if (
    coordinator &&
    !coordinatorInMembers &&
    coordinator.role !== "ADMIN" &&
    coordinator.role !== "VISITOR"
  ) {
    memberCount += 1;
  }
  if (
    coordinator &&
    !coordinatorInMembers &&
    coordinator.role === "VISITOR"
  ) {
    visitorCount += 1;
  }

  // Coordinator nested on cluster may not be in roster/peopleUI; count them as member
  if (!coordinator && cluster.coordinator) {
    const already = roster.some(
      (m) => String(m.id) === String(cluster.coordinator!.id)
    );
    if (!already) memberCount += 1;
  }

  return { memberCount, visitorCount };
}
