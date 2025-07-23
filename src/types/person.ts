// types/person.ts

export type PersonRole =
  | "MEMBER"
  | "VISITOR"
  | "COORDINATOR"
  | "PASTOR"
  | "ADMIN";

export type PersonStatus = "ACTIVE" | "SEMIACTIVE" | "INACTIVE" | "DECEASED";

export type Gender = "MALE" | "FEMALE" | "";

export type MilestoneType =
  | "LESSON"
  | "BAPTISM"
  | "SPIRIT"
  | "CLUSTER"
  | "NOTE";

export interface Milestone {
  id: string;
  date: string;
  type: MilestoneType;
  title?: string;
  description?: string;
  verified_by?: string; // could also be a full Person object if needed
}

export interface Person {
  id: string;
  first_name: string;
  middle_name?: string;
  last_name: string;
  suffix?: string;
  email: string;
  phone?: string;
  photo?: string; // This will typically be a URL string
  gender?: Gender;
  facebook_name?: string;
  role: PersonRole;
  address?: string;
  country?: string;
  date_of_birth?: string;
  date_first_attended?: string;
  inviter?: string; // could also be a full Person object
  member_id?: string;
  status: PersonStatus;
  milestones?: Milestone[];
  familyId?: string;
  clusterId?: string;
}

export interface Family {
  id: string;
  name: string;
  members: string[];
  leader?: string;
  address?: string;
  created_at?: string;
}

export interface Cluster {
  id: string;
  name: string;
  families: string[];
  leader: string;
  description?: string;
  created_at?: string;
}
