import { FilterCondition } from "@/src/components/people/FilterBar";
import {
  formatEvangelismGroupSchedule,
  getEvangelismGroupCoordinatorName,
  getEvangelismGroupMemberCount,
  resolveEvangelismGroupClusterMeta,
} from "@/src/lib/evangelismGroupDisplay";
import { Branch } from "@/src/types/branch";
import { Cluster } from "@/src/types/cluster";
import { EvangelismGroup } from "@/src/types/evangelism";

function matchesTextFilter(
  value: string,
  filterValue: string,
  operator: string
): boolean {
  switch (operator) {
    case "contains":
      return value.includes(filterValue);
    case "is":
      return value === filterValue;
    case "is_not":
      return value !== filterValue;
    case "starts_with":
      return value.startsWith(filterValue);
    case "ends_with":
      return value.endsWith(filterValue);
    default:
      return value.includes(filterValue);
  }
}

function matchesRangeFilter(
  count: number,
  filter: FilterCondition
): boolean {
  if (filter.operator === "between" && Array.isArray(filter.value)) {
    const [min, max] = filter.value;
    return (
      count >= parseInt(min.toString(), 10) &&
      count <= parseInt(max.toString(), 10)
    );
  }
  if (filter.operator === "greater_than") {
    return count > parseInt(filter.value.toString(), 10);
  }
  if (filter.operator === "less_than") {
    return count < parseInt(filter.value.toString(), 10);
  }
  const filterCount = parseInt(filter.value.toString(), 10);
  return filter.operator === "is_not"
    ? count !== filterCount
    : count === filterCount;
}

function groupMatchesFilter(
  group: EvangelismGroup,
  filter: FilterCondition,
  clusters: Cluster[],
  branches: Branch[]
): boolean {
  const filterValue = String(filter.value).toLowerCase();
  const { clusterDisplayCode } = resolveEvangelismGroupClusterMeta(
    group,
    clusters,
    branches
  );

  switch (filter.field) {
    case "name":
      return matchesTextFilter(
        (group.name || "").toLowerCase(),
        filterValue,
        filter.operator
      );
    case "description":
      return matchesTextFilter(
        (group.description || "").toLowerCase(),
        filterValue,
        filter.operator
      );
    case "coordinator":
      return matchesTextFilter(
        getEvangelismGroupCoordinatorName(group).toLowerCase(),
        filterValue,
        filter.operator
      );
    case "cluster_code":
      return matchesTextFilter(
        (clusterDisplayCode || "").toLowerCase(),
        filterValue,
        filter.operator
      );
    case "location":
      return matchesTextFilter(
        (group.location || "").toLowerCase(),
        filterValue,
        filter.operator
      );
    case "meeting_schedule":
      return matchesTextFilter(
        formatEvangelismGroupSchedule(group).toLowerCase(),
        filterValue,
        filter.operator
      );
    case "member_count":
      return matchesRangeFilter(getEvangelismGroupMemberCount(group), filter);
    case "visitor_count":
      return matchesRangeFilter(group.visitors_count ?? 0, filter);
    case "status": {
      const isActive = group.is_active;
      const wantsActive = filterValue === "active";
      if (filter.operator === "is_not") {
        return wantsActive ? !isActive : isActive;
      }
      return wantsActive ? isActive : !isActive;
    }
    case "bible_sharers": {
      const isBibleSharers = Boolean(group.is_bible_sharers_group);
      const wantsYes = filterValue === "yes";
      if (filter.operator === "is_not") {
        return wantsYes ? !isBibleSharers : isBibleSharers;
      }
      return wantsYes ? isBibleSharers : !isBibleSharers;
    }
    default:
      return true;
  }
}

export function applyEvangelismGroupFilters(
  groups: EvangelismGroup[],
  filters: FilterCondition[],
  clusters: Cluster[],
  branches: Branch[]
): EvangelismGroup[] {
  if (filters.length === 0) return groups;

  return groups.filter((group) =>
    filters.every((filter) =>
      groupMatchesFilter(group, filter, clusters, branches)
    )
  );
}

export function sortEvangelismGroups(
  groups: EvangelismGroup[],
  sortBy: string,
  sortOrder: "asc" | "desc",
  clusters: Cluster[],
  branches: Branch[]
): EvangelismGroup[] {
  const sorted = [...groups];
  sorted.sort((a, b) => {
    let aValue: string | number | Date;
    let bValue: string | number | Date;

    switch (sortBy) {
      case "member_count":
        aValue = getEvangelismGroupMemberCount(a);
        bValue = getEvangelismGroupMemberCount(b);
        break;
      case "visitor_count":
        aValue = a.visitors_count ?? 0;
        bValue = b.visitors_count ?? 0;
        break;
      case "cluster_code":
        aValue = (
          resolveEvangelismGroupClusterMeta(a, clusters, branches)
            .clusterDisplayCode || ""
        ).toLowerCase();
        bValue = (
          resolveEvangelismGroupClusterMeta(b, clusters, branches)
            .clusterDisplayCode || ""
        ).toLowerCase();
        break;
      case "created_at":
        aValue = new Date(a.created_at || 0);
        bValue = new Date(b.created_at || 0);
        break;
      case "name":
      default:
        aValue = (a.name || "").toLowerCase();
        bValue = (b.name || "").toLowerCase();
    }

    if (aValue < bValue) return sortOrder === "asc" ? -1 : 1;
    if (aValue > bValue) return sortOrder === "asc" ? 1 : -1;
    return 0;
  });

  return sorted;
}
