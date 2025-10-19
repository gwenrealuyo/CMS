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
  user: string; // refers to Person ID
  title?: string;
  date: string; // ISO date string (YYYY-MM-DD)
  type: MilestoneType;
  description?: string;
  verified_by?: string; // Person ID
  created_at?: string; // ISO datetime
}

export interface Person {
  id: string;
  username: string;
  email: string;
  first_name: string;
  middle_name?: string;
  last_name: string;
  suffix?: string;
  phone?: string;
  photo?: string; // URL to profile image
  gender?: Gender;
  facebook_name?: string;
  role: PersonRole;
  address?: string;
  country?: string;
  date_of_birth?: string; // ISO date string
  date_first_attended?: string; // ISO date string
  inviter?: string; // ID of another Person
  member_id?: string;
  status: PersonStatus;
  milestones?: Milestone[];
  groups?: string[]; // Group IDs
  user_permissions?: string[]; // Permission IDs
}

// UI-normalized view of a person for components
export interface PersonUI extends Person {
  name: string;
  dateFirstAttended?: string;
}

export interface Family {
  id: string;
  name: string;
  leader?: string; // Person ID
  members: string[]; // List of Person IDs
  address?: string; // Physical address/location
  notes?: string; // Family notes/description
}

export interface Cluster {
  id: string;
  code?: string; // unique cluster code
  name?: string;
  coordinator?: string; // Person ID
  families: string[]; // List of Family IDs
  description?: string;
}
