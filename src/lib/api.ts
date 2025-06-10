import axios from "axios";
import { Member, Family, Cluster } from "@/src/types/member";
import { Event } from "@/src/types/event";

const api = axios.create({
  baseURL: "http://localhost:8000/api",
  headers: {
    "Content-Type": "application/json",
  },
});

export const membersApi = {
  getAll: () => api.get<Member[]>("/members/"),
  getById: (id: string) => api.get<Member>(`/members/${id}/`),
  create: (data: Partial<Member>) => api.post<Member>("/members/", data),
  update: (id: string, data: Partial<Member>) =>
    api.put<Member>(`/members/${id}/`, data),
  delete: (id: string) => api.delete(`/members/${id}/`),
};

export const familiesApi = {
  getAll: () => api.get<Family[]>("/families/"),
  getById: (id: string) => api.get<Family>(`/families/${id}/`),
  create: (data: Partial<Family>) => api.post<Family>("/families/", data),
  update: (id: string, data: Partial<Family>) =>
    api.put<Family>(`/families/${id}/`, data),
  delete: (id: string) => api.delete(`/families/${id}/`),
  addMember: (familyId: string, memberId: string) =>
    api.post(`/families/${familyId}/members/`, { memberId }),
  removeMember: (familyId: string, memberId: string) =>
    api.delete(`/families/${familyId}/members/${memberId}/`),
};

export const clustersApi = {
  getAll: () => api.get<Cluster[]>("/clusters/"),
  getById: (id: string) => api.get<Cluster>(`/clusters/${id}/`),
  create: (data: Partial<Cluster>) => api.post<Cluster>("/clusters/", data),
  update: (id: string, data: Partial<Cluster>) =>
    api.put<Cluster>(`/clusters/${id}/`, data),
  delete: (id: string) => api.delete(`/clusters/${id}/`),
  addFamily: (clusterId: string, familyId: string) =>
    api.post(`/clusters/${clusterId}/families/`, { familyId }),
  removeFamily: (clusterId: string, familyId: string) =>
    api.delete(`/clusters/${clusterId}/families/${familyId}/`),
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

export default api;
