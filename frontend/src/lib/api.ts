import axios from "axios";
import { Person, Family, Milestone } from "@/src/types/person";
import {
  Cluster,
  ClusterWeeklyReport,
  ClusterInput,
  ClusterWeeklyReportInput,
  ClusterAnalytics,
  OverdueClusters,
} from "@/src/types/cluster";
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
import {
  Ministry,
  MinistryMember,
  MinistryCreateInput,
} from "@/src/types/ministry";
import {
  SundaySchoolCategory,
  SundaySchoolClass,
  SundaySchoolClassMember,
  SundaySchoolSession,
  SundaySchoolSummary,
  UnenrolledByCategory,
  AttendanceReport,
  RecurringSessionData,
} from "@/src/types/sundaySchool";
import {
  Donation,
  DonationPurpose,
  Offering,
  OfferingWeeklySummary,
  PaymentMethod,
  Pledge,
  PledgeStatus,
  PledgeSummary,
  PledgeContribution,
  PledgeContributionInput,
} from "@/src/types/finance";

const api = axios.create({
  baseURL: "http://localhost:8000/api",
  headers: {
    "Content-Type": "application/json",
  },
});

export const peopleApi = {
  getAll: () => api.get<Person[]>("/people/people"),
  search: (params?: { search?: string; role?: string }) =>
    api.get<Person[]>("/people/people/", { params }),
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
  getAll: () => api.get<Cluster[]>("/clusters/clusters/"),
  getById: (id: string | number) =>
    api.get<Cluster>(`/clusters/clusters/${id}/`),
  create: (data: ClusterInput) =>
    api.post<Cluster>("/clusters/clusters/", data),
  update: (id: string | number, data: Partial<ClusterInput>) =>
    api.put<Cluster>(`/clusters/clusters/${id}/`, data),
  patch: (id: string | number, data: Partial<ClusterInput>) =>
    api.patch<Cluster>(`/clusters/clusters/${id}/`, data),
  delete: (id: string | number) => api.delete(`/clusters/clusters/${id}/`),
};

export const clusterReportsApi = {
  getAll: (params?: {
    cluster?: string;
    year?: number;
    week_number?: number;
    gathering_type?: string;
    submitted_by?: string;
    month?: number;
    page?: number;
    page_size?: number;
  }) =>
    api.get<{
      results: ClusterWeeklyReport[];
      count: number;
      next?: string;
      previous?: string;
    }>("/clusters/cluster-weekly-reports/", { params }),
  getById: (id: string) =>
    api.get<ClusterWeeklyReport>(`/clusters/cluster-weekly-reports/${id}/`),
  create: (data: ClusterWeeklyReportInput) =>
    api.post<ClusterWeeklyReport>("/clusters/cluster-weekly-reports/", data),
  update: (id: string, data: Partial<ClusterWeeklyReportInput>) =>
    api.put<ClusterWeeklyReport>(
      `/clusters/cluster-weekly-reports/${id}/`,
      data
    ),
  patch: (id: string, data: Partial<ClusterWeeklyReportInput>) =>
    api.patch<ClusterWeeklyReport>(
      `/clusters/cluster-weekly-reports/${id}/`,
      data
    ),
  delete: (id: string) => api.delete(`/clusters/cluster-weekly-reports/${id}/`),
  analytics: (params?: { cluster?: string; year?: number }) =>
    api.get<ClusterAnalytics>("/clusters/cluster-weekly-reports/analytics/", {
      params,
    }),
  overdue: () =>
    api.get<OverdueClusters>("/clusters/cluster-weekly-reports/overdue/"),
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
  }) => api.get<LessonSessionReport[]>("/lessons/session-reports/", { params }),
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
  create: (data: MinistryCreateInput) =>
    api.post<Ministry>("/ministries/", data),
  update: (id: number | string, data: Partial<Ministry>) =>
    api.put<Ministry>(`/ministries/${id}/`, data),
  patch: (id: number | string, data: Partial<Ministry>) =>
    api.patch<Ministry>(`/ministries/${id}/`, data),
  delete: (id: number | string) => api.delete(`/ministries/${id}/`),
};

export const ministryMembersApi = {
  list: (params?: {
    ministry?: number | string;
    role?: string;
    is_active?: boolean;
  }) => api.get<MinistryMember[]>("/ministries/members/", { params }),
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

const mapDonation = (payload: any): Donation => ({
  id: payload.id,
  amount: Number(payload.amount ?? 0),
  date: payload.date,
  purpose: payload.purpose as DonationPurpose,
  donorId: payload.donor ?? null,
  donorName: payload.donor_name ?? payload.donorName ?? null,
  notes: payload.notes ?? null,
  paymentMethod: payload.payment_method as PaymentMethod,
  isAnonymous: Boolean(payload.is_anonymous),
  receiptNumber: payload.receipt_number,
  recordedById: payload.recorded_by ?? null,
  recordedByName: payload.recorded_by_name ?? null,
  createdAt: payload.created_at,
});

const mapOffering = (payload: any): Offering => ({
  id: payload.id,
  serviceDate: payload.service_date,
  serviceName: payload.service_name,
  fund: payload.fund ?? null,
  amount: Number(payload.amount ?? 0),
  notes: payload.notes ?? null,
  recordedByName: payload.recorded_by_name ?? null,
  createdAt: payload.created_at,
});

const mapPledgeContribution = (payload: any): PledgeContribution => ({
  id: payload.id,
  pledgeId: payload.pledge,
  contributorId: payload.contributor ?? null,
  contributorName: payload.contributor_name ?? null,
  amount: Number(payload.amount ?? 0),
  contributionDate: payload.contribution_date,
  note: payload.note ?? null,
  recordedById: payload.recorded_by ?? null,
  recordedByName: payload.recorded_by_name ?? null,
  createdAt: payload.created_at,
  updatedAt: payload.updated_at,
});

const mapPledge = (payload: any): Pledge => {
  const pledgeAmount = Number(payload.pledge_amount ?? 0);
  const contributionsTotal = Number(
    payload.contributions_total ?? payload.amount_received ?? 0
  );
  const amountReceived = contributionsTotal;
  const balance =
    payload.balance !== undefined && payload.balance !== null
      ? Number(payload.balance)
      : pledgeAmount - amountReceived;
  const contributions = Array.isArray(payload.contributions)
    ? payload.contributions.map(mapPledgeContribution)
    : [];
  const progressPercent =
    payload.progress_percent !== undefined && payload.progress_percent !== null
      ? Number(payload.progress_percent)
      : pledgeAmount
      ? (amountReceived / pledgeAmount) * 100
      : 0;

  return {
    id: payload.id,
    pledgeTitle: payload.pledge_title,
    pledgeAmount,
    amountReceived,
    contributionsTotal,
    balance,
    progressPercent,
    startDate: payload.start_date,
    targetDate: payload.target_date ?? null,
    purpose: payload.purpose ?? null,
    status: payload.status as PledgeStatus,
    notes: payload.notes ?? null,
    pledgerId: payload.pledger ?? null,
    pledgerName: payload.pledger_name ?? null,
    recordedByName: payload.recorded_by_name ?? null,
    createdAt: payload.created_at,
    updatedAt: payload.updated_at,
    contributions,
  };
};

const toDonationPayload = (donation: Partial<Donation>) => ({
  donor: donation.donorId ?? null,
  amount: donation.amount,
  date: donation.date,
  purpose: donation.purpose,
  is_anonymous: donation.isAnonymous,
  payment_method: donation.paymentMethod,
  receipt_number: donation.receiptNumber,
  notes: donation.notes,
});

const toOfferingPayload = (offering: Partial<Offering>) => ({
  service_date: offering.serviceDate,
  service_name: offering.serviceName,
  fund: offering.fund,
  amount: offering.amount,
  notes: offering.notes,
});

const toPledgePayload = (pledge: Partial<Pledge>) => ({
  pledger: pledge.pledgerId ?? null,
  pledge_title: pledge.pledgeTitle,
  pledge_amount: pledge.pledgeAmount,
  amount_received: pledge.amountReceived ?? pledge.contributionsTotal ?? 0,
  start_date: pledge.startDate,
  target_date: pledge.targetDate,
  purpose: pledge.purpose,
  status: pledge.status,
  notes: pledge.notes,
});

const toPledgeContributionPayload = (
  pledgeId: number | string,
  payload: PledgeContributionInput
) => ({
  pledge: pledgeId,
  contributor: payload.contributorId ?? null,
  amount: payload.amount,
  contribution_date: payload.contributionDate,
  note: payload.note,
});

export const financeApi = {
  listDonations: (params?: { start?: string; end?: string }) =>
    api
      .get("/finance/donations/", { params })
      .then(
        (response) => (response.data as any[]).map(mapDonation) as Donation[]
      ),
  createDonation: (payload: Partial<Donation>) =>
    api
      .post("/finance/donations/", toDonationPayload(payload))
      .then((response) => mapDonation(response.data)),
  updateDonation: (id: number | string, payload: Partial<Donation>) =>
    api
      .put(`/finance/donations/${id}/`, toDonationPayload(payload))
      .then((response) => mapDonation(response.data)),
  deleteDonation: (id: number | string) =>
    api.delete(`/finance/donations/${id}/`),
  donationStats: (params?: { start?: string; end?: string }) =>
    api.get("/finance/donations/stats/", { params }).then((response) => ({
      totalAmount: Number(response.data.total_amount ?? 0),
      donationCount: Number(response.data.donation_count ?? 0),
      averageDonation: Number(response.data.average_donation ?? 0),
      purposeBreakdown: response.data.purpose_breakdown ?? {},
    })),
  listOfferings: (params?: { start?: string; end?: string }) =>
    api
      .get("/finance/offerings/", { params })
      .then(
        (response) => (response.data as any[]).map(mapOffering) as Offering[]
      ),
  createOffering: (payload: Partial<Offering>) =>
    api
      .post("/finance/offerings/", toOfferingPayload(payload))
      .then((response) => mapOffering(response.data)),
  updateOffering: (id: number | string, payload: Partial<Offering>) =>
    api
      .put(`/finance/offerings/${id}/`, toOfferingPayload(payload))
      .then((response) => mapOffering(response.data)),
  deleteOffering: (id: number | string) =>
    api.delete(`/finance/offerings/${id}/`),
  weeklyOfferingSummary: (params?: { start?: string; end?: string }) =>
    api.get("/finance/offerings/weekly_summary/", { params }).then((response) =>
      (response.data as any[]).map(
        (row) =>
          ({
            weekStart: row.week_start ?? row.weekStart ?? null,
            totalAmount: Number(row.total_amount ?? row.totalAmount ?? 0),
          } as OfferingWeeklySummary)
      )
    ),
  listPledges: (params?: { status?: PledgeStatus | PledgeStatus[] }) =>
    api
      .get("/finance/pledges/", {
        params: Array.isArray(params?.status)
          ? { status: params?.status }
          : params?.status
          ? { status: [params.status] }
          : undefined,
      })
      .then((response) => (response.data as any[]).map(mapPledge) as Pledge[]),
  createPledge: (payload: Partial<Pledge>) =>
    api
      .post("/finance/pledges/", toPledgePayload(payload))
      .then((response) => mapPledge(response.data)),
  updatePledge: (id: number | string, payload: Partial<Pledge>) =>
    api
      .put(`/finance/pledges/${id}/`, toPledgePayload(payload))
      .then((response) => mapPledge(response.data)),
  deletePledge: (id: number | string) => api.delete(`/finance/pledges/${id}/`),
  listPledgeContributions: (pledgeId: number | string) =>
    api
      .get("/finance/pledge-contributions/", {
        params: { pledge: pledgeId },
      })
      .then((response) => {
        const data = response.data;
        if (!Array.isArray(data)) {
          console.error("Expected array but got:", data);
          return [];
        }
        return data.map(mapPledgeContribution) as PledgeContribution[];
      }),
  listAllPledgeContributions: (params?: { start?: string; end?: string }) =>
    api
      .get("/finance/pledge-contributions/", { params })
      .then(
        (response) =>
          (response.data as any[]).map(
            mapPledgeContribution
          ) as PledgeContribution[]
      ),
  createPledgeContribution: (
    pledgeId: number | string,
    payload: PledgeContributionInput
  ) =>
    api
      .post(
        "/finance/pledge-contributions/",
        toPledgeContributionPayload(pledgeId, payload)
      )
      .then((response) => mapPledgeContribution(response.data)),
  updatePledgeContribution: (
    id: number | string,
    pledgeId: number | string,
    payload: PledgeContributionInput
  ) =>
    api
      .put(
        `/finance/pledge-contributions/${id}/`,
        toPledgeContributionPayload(pledgeId, payload)
      )
      .then((response) => mapPledgeContribution(response.data)),
  deletePledgeContribution: (id: number | string) =>
    api.delete(`/finance/pledge-contributions/${id}/`),
  pledgeSummary: (params?: { status?: PledgeStatus[] }) =>
    api
      .get("/finance/pledges/summary/", {
        params: params?.status ? { status: params.status } : undefined,
      })
      .then((response) =>
        (response.data as any[]).map(
          (row) =>
            ({
              id: row.id,
              pledgeTitle: row.pledge_title ?? row.pledgeTitle,
              pledgeAmount: Number(row.pledge_amount ?? row.pledgeAmount ?? 0),
              amountReceived: Number(
                row.amount_received ?? row.amountReceived ?? 0
              ),
              balance: Number(row.balance ?? 0),
              progressPercent: Number(
                row.progress_percent ?? row.progressPercent ?? 0
              ),
              status: (row.status ?? row.status) as PledgeStatus,
            } as PledgeSummary)
        )
      ),
};

export const sundaySchoolApi = {
  // Categories
  listCategories: (params?: { is_active?: boolean }) =>
    api.get<SundaySchoolCategory[]>("/sunday-school/categories/", { params }),
  getCategory: (id: number | string) =>
    api.get<SundaySchoolCategory>(`/sunday-school/categories/${id}/`),
  createCategory: (data: Partial<SundaySchoolCategory>) =>
    api.post<SundaySchoolCategory>("/sunday-school/categories/", data),
  updateCategory: (id: number | string, data: Partial<SundaySchoolCategory>) =>
    api.put<SundaySchoolCategory>(`/sunday-school/categories/${id}/`, data),
  deleteCategory: (id: number | string) =>
    api.delete(`/sunday-school/categories/${id}/`),

  // Classes
  listClasses: (params?: {
    category?: number | string;
    is_active?: boolean;
    search?: string;
  }) => api.get<SundaySchoolClass[]>("/sunday-school/classes/", { params }),
  getClass: (id: number | string) =>
    api.get<SundaySchoolClass>(`/sunday-school/classes/${id}/`),
  createClass: (data: Partial<SundaySchoolClass>) =>
    api.post<SundaySchoolClass>("/sunday-school/classes/", data),
  updateClass: (id: number | string, data: Partial<SundaySchoolClass>) =>
    api.put<SundaySchoolClass>(`/sunday-school/classes/${id}/`, data),
  deleteClass: (id: number | string) =>
    api.delete(`/sunday-school/classes/${id}/`),
  enroll: (
    classId: number | string,
    payload: { person_ids: number[]; role: string }
  ) =>
    api.post<{ created: number; message: string }>(
      `/sunday-school/classes/${classId}/enroll/`,
      payload
    ),
  getClassSessions: (
    classId: number | string,
    params?: { date_from?: string; date_to?: string }
  ) =>
    api.get<SundaySchoolSession[]>(
      `/sunday-school/classes/${classId}/sessions/`,
      { params }
    ),
  getClassAttendance: (
    classId: number | string,
    params?: { occurrence_date?: string }
  ) =>
    api.get<any[]>(`/sunday-school/classes/${classId}/attendance/`, {
      params,
    }),
  summary: () =>
    api.get<SundaySchoolSummary>("/sunday-school/classes/summary/"),
  unenrolledByCategory: (params?: { status?: string; role?: string }) =>
    api.get<UnenrolledByCategory[]>(
      "/sunday-school/classes/unenrolled_by_category/",
      { params }
    ),

  // Members
  listMembers: (params?: {
    sunday_school_class?: number | string;
    role?: string;
    is_active?: boolean;
  }) =>
    api.get<SundaySchoolClassMember[]>("/sunday-school/members/", { params }),
  getMember: (id: number | string) =>
    api.get<SundaySchoolClassMember>(`/sunday-school/members/${id}/`),
  createMember: (data: Partial<SundaySchoolClassMember>) =>
    api.post<SundaySchoolClassMember>("/sunday-school/members/", data),
  updateMember: (id: number | string, data: Partial<SundaySchoolClassMember>) =>
    api.put<SundaySchoolClassMember>(`/sunday-school/members/${id}/`, data),
  deleteMember: (id: number | string) =>
    api.delete(`/sunday-school/members/${id}/`),

  // Sessions
  listSessions: (params?: {
    sunday_school_class?: number | string;
    session_date?: string;
    search?: string;
  }) => api.get<SundaySchoolSession[]>("/sunday-school/sessions/", { params }),
  getSession: (id: number | string) =>
    api.get<SundaySchoolSession>(`/sunday-school/sessions/${id}/`),
  createSession: (data: Partial<SundaySchoolSession>) =>
    api.post<SundaySchoolSession>("/sunday-school/sessions/", data),
  updateSession: (id: number | string, data: Partial<SundaySchoolSession>) =>
    api.put<SundaySchoolSession>(`/sunday-school/sessions/${id}/`, data),
  deleteSession: (id: number | string) =>
    api.delete(`/sunday-school/sessions/${id}/`),
  getSessionAttendanceReport: (id: number | string) =>
    api.get<AttendanceReport>(
      `/sunday-school/sessions/${id}/attendance_report/`
    ),
  createRecurringSessions: (payload: RecurringSessionData) =>
    api.post<{ created: number; sessions: SundaySchoolSession[] }>(
      "/sunday-school/sessions/create_recurring/",
      payload
    ),
};

export default api;
