import type { FilterCondition } from "@/src/components/people/FilterBar";
import type { EvangelismGroupsListParams } from "@/src/lib/api";

/**
 * Translate directory FilterBar conditions into evangelism groups list query params.
 */
export function filtersToEvangelismGroupsListParams(
  filters: FilterCondition[],
): EvangelismGroupsListParams {
  const params: EvangelismGroupsListParams = {};

  for (const filter of filters) {
    const field = filter.field;
    const value = filter.value;
    const scalar = Array.isArray(value)
      ? String(value[0] ?? "")
      : String(value ?? "");

    if (field === "name") {
      switch (filter.operator) {
        case "contains":
          params.name__icontains = scalar;
          break;
        case "is":
          params.name = scalar;
          break;
        case "is_not":
          params.name_ne = scalar;
          break;
        case "starts_with":
          params.name__istartswith = scalar;
          break;
        case "ends_with":
          params.name__iendswith = scalar;
          break;
        default:
          break;
      }
    } else if (field === "description") {
      switch (filter.operator) {
        case "contains":
          params.description__icontains = scalar;
          break;
        case "is":
          params.description = scalar;
          break;
        case "starts_with":
          params.description__istartswith = scalar;
          break;
        case "ends_with":
          params.description__iendswith = scalar;
          break;
        default:
          break;
      }
    } else if (field === "coordinator") {
      params.coordinator__icontains = scalar;
    } else if (field === "cluster_code") {
      switch (filter.operator) {
        case "contains":
          params.cluster_code__icontains = scalar;
          break;
        case "is":
          params.cluster_code = scalar;
          break;
        case "starts_with":
          params.cluster_code__istartswith = scalar;
          break;
        default:
          break;
      }
    } else if (field === "location") {
      switch (filter.operator) {
        case "contains":
          params.location__icontains = scalar;
          break;
        case "is":
          params.location = scalar;
          break;
        default:
          break;
      }
    } else if (field === "meeting_schedule") {
      params.meeting_schedule__icontains = scalar;
    } else if (field === "member_count") {
      if (Array.isArray(value) && value.length >= 2) {
        params.member_count_min = value[0];
        params.member_count_max = value[1];
      } else if (filter.operator === "greater_than") {
        params.member_count_min = Number(scalar) + 1;
      } else if (filter.operator === "less_than") {
        params.member_count_max = Number(scalar) - 1;
      } else if (filter.operator === "is") {
        params.member_count = scalar;
      }
    } else if (field === "visitor_count") {
      if (Array.isArray(value) && value.length >= 2) {
        params.visitor_count_min = value[0];
        params.visitor_count_max = value[1];
      } else if (filter.operator === "greater_than") {
        params.visitor_count_min = Number(scalar) + 1;
      } else if (filter.operator === "less_than") {
        params.visitor_count_max = Number(scalar) - 1;
      } else if (filter.operator === "is") {
        params.visitor_count = scalar;
      }
    } else if (field === "status") {
      const wantsActive = scalar.toLowerCase() === "active";
      if (filter.operator === "is_not") {
        params.is_active = !wantsActive;
      } else {
        params.is_active = wantsActive;
      }
    } else if (field === "approval_status") {
      params.approval_status = scalar as
        | "pending"
        | "approved"
        | "rejected";
    } else if (field === "bible_sharers") {
      const wantsYes = scalar.toLowerCase() === "yes";
      if (filter.operator === "is_not") {
        params.has_bible_sharers = !wantsYes;
      } else {
        params.has_bible_sharers = wantsYes;
      }
    }
  }

  return params;
}

export function evangelismGroupOrdering(
  sortBy: string,
  sortOrder: "asc" | "desc",
): string {
  const prefix = sortOrder === "desc" ? "-" : "";
  const fieldMap: Record<string, string> = {
    name: "name",
    member_count: "members_count",
    visitor_count: "visitors_count",
    cluster_code: "cluster__code",
    created_at: "created_at",
  };
  const field = fieldMap[sortBy] || "name";
  return `${prefix}${field},id`;
}
