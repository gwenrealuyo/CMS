import axios from "axios";
import {
  Person,
  Family,
  Cluster,
  Milestone,
  ClusterWeeklyReport,
  ReportAnalytics,
} from "@/src/types/person";
import { Event } from "@/src/types/event";

const api = axios.create({
  baseURL: "http://localhost:8000/api",
  headers: {
    "Content-Type": "application/json",
  },
});

export const peopleApi = {
  getAll: () => api.get<Person[]>("/people/people"),
  getById: (id: string) => api.get<Person>(`/people/people/${id}/`),
  create: (data: Partial<Person>) => api.post<Person>("/people/people/", data),
  update: (id: string, data: Partial<Person>) =>
    api.put<Person>(`/people/people/${id}/`, data),
  delete: (id: string) => api.delete(`/people/people/${id}/`),
};

export const familiesApi = {
  getAll: () => api.get<Family[]>("/people/families/"),
  getById: (id: string) => api.get<Family>(`/people/families/${id}/`),
  create: (data: Partial<Family>) =>
    api.post<Family>("/people/families/", data),
  update: (id: string, data: Partial<Family>) =>
    api.put<Family>(`/people/families/${id}/`, data),
  patch: (id: string, data: Partial<Family>) =>
    api.patch<Family>(`/people/families/${id}/`, data),
  delete: (id: string) => api.delete(`/people/families/${id}/`),
  addMember: (familyId: string, memberId: string) =>
    api.post(`/people/families/${familyId}/members/`, { memberId }),
  removeMember: (familyId: string, memberId: string) =>
    api.delete(`/people/families/${familyId}/members/${memberId}/`),
};

export const clustersApi = {
  getAll: () => api.get<Cluster[]>("/people/clusters/"),
  getById: (id: string) => api.get<Cluster>(`/people/clusters/${id}/`),
  create: (data: Partial<Cluster>) =>
    api.post<Cluster>("/people/clusters/", data),
  update: (id: string, data: Partial<Cluster>) =>
    api.put<Cluster>(`/people/clusters/${id}/`, data),
  patch: (id: string, data: Partial<Cluster>) =>
    api.patch<Cluster>(`/people/clusters/${id}/`, data),
  delete: (id: string) => api.delete(`/people/clusters/${id}/`),
  addFamily: (clusterId: string, familyId: string) =>
    api.post(`/people/clusters/${clusterId}/families/`, { familyId }),
  removeFamily: (clusterId: string, familyId: string) =>
    api.delete(`/people/clusters/${clusterId}/families/${familyId}/`),
};

export const eventsApi = {
  getAll: () => api.get<Event[]>("/events/"),
  getById: (id: string) => api.get<Event>(`/events/${id}/`),
  create: (data: Partial<Event>) => api.post<Event>("/events/", data),
  update: (id: string, data: Partial<Event>) =>
    api.put<Event>(`/events/${id}/`, data),
  delete: (id: string) => api.delete(`/events/${id}/`),
  addVolunteer: (eventId: string, memberId: string) =>
    api.post(`/events/${eventId}/volunteers/`, { memberId }),
  removeVolunteer: (eventId: string, memberId: string) =>
    api.delete(`/events/${eventId}/volunteers/${memberId}/`),
  markAttendance: (eventId: string, memberId: string) =>
    api.post(`/events/${eventId}/attendance/`, { memberId }),
  removeAttendance: (eventId: string, memberId: string) =>
    api.delete(`/events/${eventId}/attendance/${memberId}/`),
};

export const milestonesApi = {
  getAll: () => api.get<Milestone[]>("/people/milestones/"),
  getById: (id: string) => api.get<Milestone>(`/people/milestones/${id}/`),
  create: (data: Partial<Milestone>) =>
    api.post<Milestone>("/people/milestones/", data),
  update: (id: string, data: Partial<Milestone>) =>
    api.put<Milestone>(`/people/milestones/${id}/`, data),
  delete: (id: string) => api.delete(`/people/milestones/${id}/`),
  getByUser: (userId: string) =>
    api.get<Milestone[]>(`/people/milestones/?user=${userId}`),
};

export const clusterWeeklyReportsApi = {
  getAll: () =>
    api.get<ClusterWeeklyReport[]>("/people/cluster-weekly-reports/"),
  getById: (id: string) =>
    api.get<ClusterWeeklyReport>(`/people/cluster-weekly-reports/${id}/`),
  create: (data: Partial<ClusterWeeklyReport>) =>
    api.post<ClusterWeeklyReport>("/people/cluster-weekly-reports/", data),
  update: (id: string, data: Partial<ClusterWeeklyReport>) =>
    api.put<ClusterWeeklyReport>(`/people/cluster-weekly-reports/${id}/`, data),
  delete: (id: string) => api.delete(`/people/cluster-weekly-reports/${id}/`),
  getAnalytics: (params?: { cluster?: string; year?: number }) =>
    api.get<ReportAnalytics>("/people/cluster-weekly-reports/analytics/", {
      params,
    }),
  getOverdue: () => api.get("/people/cluster-weekly-reports/overdue/"),
};

export default api;
