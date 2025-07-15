export type PersonRole =
  | "Member"
  | "Visitor"
  | "Coordinator"
  | "Pastor"
  | "Admin";

export interface Person {
  id: string;
  name: string;
  email: string;
  phone: string;
  photo: string;
  role: PersonRole;
  dateFirstAttended: Date;
  familyId?: string;
  clusterId?: string;
  milestones: {
    id: string;
    date: Date;
    type: "Lesson" | "Baptism" | "Spirit" | "Cluster";
    description: string;
  }[];
}

export interface Family {
  id: string;
  name: string;
  members: string[];
}

export interface Cluster {
  id: string;
  name: string;
  families: string[];
  leader: string;
}
