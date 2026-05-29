import { PaginatedResponse } from "@/src/lib/api";
import {
  GlobalSearchEntity,
  GlobalSearchResult,
} from "@/src/types/globalSearch";
import { formatPersonName } from "@/src/lib/name";
import { Person } from "@/src/types/person";
import { Family } from "@/src/types/person";
import { Cluster } from "@/src/types/cluster";
import { Event } from "@/src/types/event";
import { Ministry } from "@/src/types/ministry";
import { EvangelismGroup, Prospect } from "@/src/types/evangelism";
import { SundaySchoolClass } from "@/src/types/sundaySchool";
import { ModuleType } from "@/src/types/moduleSettings";

export const MIN_GLOBAL_SEARCH_LENGTH = 2;
export const GLOBAL_SEARCH_PAGE_SIZE = 5;

export function unwrapList<T>(data: T[] | PaginatedResponse<T>): T[] {
  if (Array.isArray(data)) {
    return data;
  }
  return data.results ?? [];
}

export const ENTITY_MODULE_MAP: Partial<
  Record<GlobalSearchEntity, ModuleType>
> = {
  cluster: "CLUSTER",
  event: "EVENTS",
  ministry: "MINISTRIES",
  evangelism_group: "EVANGELISM",
  prospect: "EVANGELISM",
  sunday_school_class: "SUNDAY_SCHOOL",
};

export function isEntityEnabled(
  entity: GlobalSearchEntity,
  moduleEnabled: Partial<Record<ModuleType, boolean>>,
  isAdmin: boolean,
): boolean {
  const module = ENTITY_MODULE_MAP[entity];
  if (!module) {
    return true;
  }
  if (isAdmin) {
    return true;
  }
  return moduleEnabled[module] !== false;
}

export function mapPersonToResult(person: Person): GlobalSearchResult {
  const clusterCodes = (person.cluster_codes ?? []).filter(Boolean);
  const branchCode =
    person.branch_code?.trim() ||
    undefined;

  return {
    id: String(person.id),
    entity: "person",
    title: formatPersonName(person),
    href: `/people?open=${person.id}`,
    personMeta: {
      status: person.status,
      clusterCodes,
      branchCode,
    },
  };
}

export function mapFamilyToResult(family: Family): GlobalSearchResult {
  return {
    id: String(family.id),
    entity: "family",
    title: family.name,
    href: `/people/families?open=${family.id}`,
  };
}

export function mapClusterToResult(cluster: Cluster): GlobalSearchResult {
  return {
    id: String(cluster.id),
    entity: "cluster",
    title: cluster.name || "Unnamed cluster",
    subtitle: cluster.code || cluster.location || undefined,
    href: `/clusters?open=${cluster.id}`,
  };
}

export function mapEventToResult(event: Event): GlobalSearchResult {
  return {
    id: String(event.id),
    entity: "event",
    title: event.title,
    subtitle: event.type || undefined,
    href: `/events?open=${event.id}`,
  };
}

export function mapMinistryToResult(ministry: Ministry): GlobalSearchResult {
  return {
    id: String(ministry.id),
    entity: "ministry",
    title: ministry.name,
    subtitle: ministry.category || undefined,
    href: `/ministries?open=${ministry.id}`,
  };
}

export function mapEvangelismGroupToResult(
  group: EvangelismGroup,
): GlobalSearchResult {
  return {
    id: String(group.id),
    entity: "evangelism_group",
    title: group.name,
    subtitle: group.location || undefined,
    href: `/evangelism?openGroup=${group.id}`,
  };
}

export function prospectDisplayName(prospect: Prospect): string {
  if (prospect.display_name?.trim()) {
    return prospect.display_name.trim();
  }
  return [prospect.first_name, prospect.middle_name, prospect.last_name]
    .filter(Boolean)
    .join(" ");
}

export function mapProspectToResult(prospect: Prospect): GlobalSearchResult {
  return {
    id: String(prospect.id),
    entity: "prospect",
    title: prospectDisplayName(prospect),
    subtitle: prospect.pipeline_stage || undefined,
    href: `/evangelism?tab=prospects&open=${prospect.id}`,
  };
}

export function mapSundaySchoolClassToResult(
  ssClass: SundaySchoolClass,
): GlobalSearchResult {
  return {
    id: String(ssClass.id),
    entity: "sunday_school_class",
    title: ssClass.name,
    subtitle: ssClass.room_location || undefined,
    href: `/sunday-school?open=${ssClass.id}`,
  };
}
