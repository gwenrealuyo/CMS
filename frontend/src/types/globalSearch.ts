import { PersonStatus } from "@/src/types/person";

export type GlobalSearchEntity =
  | "person"
  | "cluster"
  | "ministry"
  | "evangelism_group"
  | "prospect"
  | "sunday_school_class"
  | "family";

export interface PersonSearchMeta {
  status: PersonStatus;
  clusterCodes: string[];
  branchCode?: string;
  memberId?: string;
  cordName?: string;
  canViewProfile?: boolean;
}

export interface GlobalSearchResult {
  id: string;
  entity: GlobalSearchEntity;
  title: string;
  subtitle?: string;
  href: string;
  personMeta?: PersonSearchMeta;
  /** False when list/search is wider than profile retrieve (preview only). */
  canOpen?: boolean;
}

export const GLOBAL_SEARCH_ENTITY_LABELS: Record<GlobalSearchEntity, string> = {
  person: "People",
  cluster: "Clusters",
  ministry: "Ministries",
  evangelism_group: "Evangelism groups",
  prospect: "Prospects",
  sunday_school_class: "Sunday School",
  family: "Families",
};

export const GLOBAL_SEARCH_ENTITY_ORDER: GlobalSearchEntity[] = [
  "person",
  "family",
  "cluster",
  "ministry",
  "evangelism_group",
  "prospect",
  "sunday_school_class",
];
