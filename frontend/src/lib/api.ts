import axios from "axios";
import {
  Person,
  Family,
  Cluster,
  Milestone,
  ClusterWeeklyReport,
  ReportAnalytics,
} from "@/src/types/person";
import {
  Lesson,
  LessonCommitmentSettings,
  LessonProgressSummary,
  LessonSessionReport,
  LessonSessionReportInput,
  PersonLessonProgress,
} from "@/src/types/lesson";
import {
  Event,
  EventAttendanceRecord,
  AttendanceStatus,
} from "@/src/types/event";
import { Ministry, MinistryMember, MinistryCreateInput } from "@/src/types/ministry";

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
  getAll: (params?: {
    include_attendance?: boolean;
    attendance_date?: string;
    start?: string;
    end?: string;
  }) =>
    api.get<Event[]>("/events/", {
      params,
    }),
  getById: (
    id: string,
    params?: { include_attendance?: boolean; attendance_date?: string }
  ) =>
    api.get<Event>(`/events/${id}/`, {
      params,
    }),
  create: (data: Partial<Event>) => api.post<Event>("/events/", data),
  update: (id: string, data: Partial<Event>) =>
    api.put<Event>(`/events/${id}/`, data),
  delete: (id: string) => api.delete(`/events/${id}/`),
  excludeOccurrence: (id: string, payload: { date: string }) =>
    api.post<Event>(`/events/${id}/exclude-occurrence/`, payload),
  listAttendance: (id: string, params?: { occurrence_date?: string }) =>
    api.get<EventAttendanceRecord[]>(`/events/${id}/attendance/`, {
      params,
    }),
  addAttendance: (
    id: string,
    payload: {
      person_id: string;
      occurrence_date: string;
      status?: AttendanceStatus;
      notes?: string;
    }
  ) =>
    api.post<{
      attendance_record: EventAttendanceRecord;
      event: Event;
    }>(`/events/${id}/attendance/`, payload),
  removeAttendance: (id: string, attendanceId: number | string) =>
    api.delete<{ event: Event }>(`/events/${id}/attendance/${attendanceId}/`),
};

export const attendanceApi = {
  getAll: (params?: {
    event?: string;
    person?: string;
    occurrence_date?: string;
    status?: AttendanceStatus;
  }) =>
    api.get<EventAttendanceRecord[]>("/attendance/", {
      params,
    }),
  byEvent: (eventId: string, params?: { occurrence_date?: string }) =>
    api.get<EventAttendanceRecord[]>(`/attendance/by-event/${eventId}/`, {
      params,
    }),
  create: (data: {
    event_id: string;
    person_id: string;
    occurrence_date: string;
    status?: AttendanceStatus;
    notes?: string;
  }) => api.post<EventAttendanceRecord>("/attendance/", data),
  update: (
    id: string | number,
    data: Partial<{
      status: AttendanceStatus;
      notes: string;
      occurrence_date: string;
    }>
  ) => api.put<EventAttendanceRecord>(`/attendance/${id}/`, data),
  delete: (id: string | number) => api.delete(`/attendance/${id}/`),
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

export const lessonsApi = {
  getAll: (params?: { include_superseded?: boolean }) =>
    api.get<Lesson[]>("/lessons/lessons/", { params }),
  create: (data: Partial<Lesson>) =>
    api.post<Lesson>("/lessons/lessons/", data),
  update: (id: number | string, data: Partial<Lesson>) =>
    api.put<Lesson>(`/lessons/lessons/${id}/`, data),
  delete: (id: number | string) => api.delete(`/lessons/lessons/${id}/`),
  getProgress: (params?: {
    person?: string | number;
    lesson?: string | number;
    status?: string;
  }) =>
    api.get<PersonLessonProgress[]>("/lessons/progress/", {
      params,
    }),
  updateProgress: (id: number | string, data: Partial<PersonLessonProgress>) =>
    api.patch<PersonLessonProgress>(`/lessons/progress/${id}/`, data),
  assign: (payload: {
    lesson_id: number | string;
    person_ids: Array<number | string>;
  }) => api.post<{ created: number }>("/lessons/progress/assign/", payload),
  complete: (
    id: number | string,
    payload: {
      note?: string;
      completed_at?: string;
      completed_by?: number | string;
    }
  ) =>
    api.post<PersonLessonProgress>(
      `/lessons/progress/${id}/complete/`,
      payload
    ),
  summary: (params?: {
    lesson?: string | number;
    version_label?: string;
    include_superseded?: boolean;
  }) =>
    api.get<LessonProgressSummary>("/lessons/progress/summary/", { params }),
  listSessionReports: (params?: {
    lesson?: string | number;
    student?: string | number;
    teacher?: string | number;
    date_from?: string;
    date_to?: string;
  }) =>
    api.get<LessonSessionReport[]>("/lessons/session-reports/", { params }),
  getSessionReport: (id: number | string) =>
    api.get<LessonSessionReport>(`/lessons/session-reports/${id}/`),
  createSessionReport: (payload: LessonSessionReportInput) =>
    api.post<LessonSessionReport>("/lessons/session-reports/", payload),
  updateSessionReport: (
    id: number | string,
    payload: Partial<LessonSessionReportInput>
  ) => api.put<LessonSessionReport>(`/lessons/session-reports/${id}/`, payload),
  deleteSessionReport: (id: number | string) =>
    api.delete(`/lessons/session-reports/${id}/`),
  getCommitmentForm: () =>
    api.get<LessonCommitmentSettings>("/lessons/lessons/commitment-form/"),
  uploadCommitmentForm: (formData: FormData) =>
    api.post<LessonCommitmentSettings>(
      "/lessons/lessons/commitment-form/",
      formData,
      {
        headers: { "Content-Type": "multipart/form-data" },
      }
    ),
};

export const ministriesApi = {
  list: (params?: {
    search?: string;
    activity_cadence?: string;
    category?: string;
    is_active?: boolean;
  }) => api.get<Ministry[]>("/ministries/", { params }),
  retrieve: (id: number | string) => api.get<Ministry>(`/ministries/${id}/`),
  create: (data: MinistryCreateInput) => api.post<Ministry>("/ministries/", data),
  update: (id: number | string, data: Partial<Ministry>) =>
    api.put<Ministry>(`/ministries/${id}/`, data),
  patch: (id: number | string, data: Partial<Ministry>) =>
    api.patch<Ministry>(`/ministries/${id}/`, data),
  delete: (id: number | string) => api.delete(`/ministries/${id}/`),
};

export const ministryMembersApi = {
  list: (params?: { ministry?: number | string; role?: string; is_active?: boolean }) =>
    api.get<MinistryMember[]>("/ministries/members/", { params }),
  create: (data: Partial<MinistryMember>) =>
    api.post<MinistryMember>("/ministries/members/", data),
  update: (id: number | string, data: Partial<MinistryMember>) =>
    api.put<MinistryMember>(`/ministries/members/${id}/`, data),
  delete: (id: number | string) => api.delete(`/ministries/members/${id}/`),
};

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export const clusterWeeklyReportsApi = {
  getAll: (params?: {
    page?: number;
    page_size?: number;
    cluster?: string;
    year?: number;
    week_number?: number;
    gathering_type?: string;
    submitted_by?: string;
    month?: string;
  }) =>
    api.get<PaginatedResponse<ClusterWeeklyReport>>(
      "/people/cluster-weekly-reports/",
      { params }
    ),
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
