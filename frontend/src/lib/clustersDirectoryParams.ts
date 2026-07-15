import type { FilterCondition } from "@/src/components/people/FilterBar";
import type { ClustersListParams } from "@/src/lib/api";

/**
 * Translate directory FilterBar conditions into clusters list query params.
 */
export function filtersToClustersListParams(
  filters: FilterCondition[]
): ClustersListParams {
  const params: ClustersListParams = {};

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
    } else if (field === "code") {
      switch (filter.operator) {
        case "contains":
          params.code__icontains = scalar;
          break;
        case "is":
          params.code = scalar;
          break;
        case "starts_with":
          params.code__istartswith = scalar;
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
      if (filter.operator === "contains" || !filter.operator) {
        params.meeting_schedule__icontains = scalar;
      }
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
    } else if (field === "family_count") {
      if (Array.isArray(value) && value.length >= 2) {
        params.family_count_min = value[0];
        params.family_count_max = value[1];
      } else if (filter.operator === "greater_than") {
        params.family_count_min = Number(scalar) + 1;
      } else if (filter.operator === "less_than") {
        params.family_count_max = Number(scalar) - 1;
      } else if (filter.operator === "is") {
        params.family_count = scalar;
      }
    }
  }

  return params;
}
