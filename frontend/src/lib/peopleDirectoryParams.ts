import type { FilterCondition } from "@/src/components/people/FilterBar";
import type { PeopleListParams } from "@/src/lib/api";

const TEXT_FIELDS = new Set(["first_name", "last_name", "email", "phone"]);
const DATE_FIELDS = new Set(["date_first_attended", "date_of_birth", "birth_date"]);

function resolveDateField(field: string): "date_first_attended" | "date_of_birth" {
  if (field === "birth_date" || field === "date_of_birth") {
    return "date_of_birth";
  }
  return "date_first_attended";
}

function flattenBranchIds(filters: FilterCondition[]): string[] {
  const ids: string[] = [];
  for (const filter of filters) {
    const value = filter.value;
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item != null && String(item).trim() !== "") {
          ids.push(String(item));
        }
      }
    } else if (value != null && String(value).trim() !== "") {
      ids.push(String(value));
    }
  }
  return ids;
}

/**
 * Translate directory FilterBar conditions into people list query params.
 */
export function filtersToPeopleListParams(
  filters: FilterCondition[]
): PeopleListParams {
  const params: PeopleListParams = {};

  const branchFilters = filters.filter((f) => f.field === "branch");
  const otherFilters = filters.filter((f) => f.field !== "branch");

  const branchIsIds = flattenBranchIds(
    branchFilters.filter((f) => f.operator === "is")
  );
  const branchIsNotIds = flattenBranchIds(
    branchFilters.filter((f) => f.operator === "is_not")
  );

  if (branchIsIds.length === 1) {
    params.branch = branchIsIds[0];
  } else if (branchIsIds.length > 1) {
    params.branch__in = branchIsIds.join(",");
  }

  if (branchIsNotIds.length === 1) {
    params.branch_ne = branchIsNotIds[0];
  } else if (branchIsNotIds.length > 1) {
    params.branch_ne__in = branchIsNotIds.join(",");
  }

  for (const filter of otherFilters) {
    const field = filter.field;
    const value = filter.value;
    const scalar =
      Array.isArray(value) && filter.operator !== "between"
        ? String(value[0] ?? "")
        : Array.isArray(value)
          ? ""
          : String(value ?? "");

    if (field === "role") {
      if (filter.operator === "is") params.role = scalar;
      if (filter.operator === "is_not") params.role_ne = scalar;
      continue;
    }

    if (field === "status") {
      if (filter.operator === "is") params.status = scalar;
      if (filter.operator === "is_not") params.status_ne = scalar;
      continue;
    }

    if (TEXT_FIELDS.has(field)) {
      const key = field as "first_name" | "last_name" | "email" | "phone";
      switch (filter.operator) {
        case "contains":
          params[`${key}__icontains`] = scalar;
          break;
        case "is":
          params[key] = scalar;
          break;
        case "is_not":
          params[`${key}_ne`] = scalar;
          break;
        case "starts_with":
          params[`${key}__istartswith`] = scalar;
          break;
        case "ends_with":
          params[`${key}__iendswith`] = scalar;
          break;
        default:
          break;
      }
      continue;
    }

    if (DATE_FIELDS.has(field)) {
      const dateField = resolveDateField(field);
      switch (filter.operator) {
        case "is":
          params[dateField] = scalar;
          break;
        case "is_not":
          params[`${dateField}_ne`] = scalar;
          break;
        case "before":
          params[`${dateField}_before`] = scalar;
          break;
        case "after":
          params[`${dateField}_after`] = scalar;
          break;
        case "between":
          if (Array.isArray(value) && value.length >= 2) {
            params[`${dateField}_min`] = String(value[0]);
            params[`${dateField}_max`] = String(value[1]);
          }
          break;
        default:
          break;
      }
    }
  }

  return params;
}

/** Map DataTable column keys to DRF ordering fields. */
export function sortFieldToOrdering(
  sortField: string,
  sortDirection: "asc" | "desc"
): string {
  const fieldMap: Record<string, string> = {
    first_name: "first_name",
    middle_name: "middle_name",
    last_name: "last_name",
    suffix: "suffix",
    maiden_name: "maiden_name",
    username: "username",
    email: "email",
    phone: "phone",
    gender: "gender",
    role: "role",
    status: "status",
    branch: "branch__code",
    dateOfBirth: "date_of_birth",
    date_of_birth: "date_of_birth",
    dateFirstAttended: "date_first_attended",
    date_first_attended: "date_first_attended",
    waterBaptismDate: "water_baptism_date",
    spiritBaptismDate: "spirit_baptism_date",
    member_id: "member_id",
    facebook_name: "facebook_name",
  };

  const backendField = fieldMap[sortField] ?? "last_name";
  return sortDirection === "desc" ? `-${backendField}` : backendField;
}
