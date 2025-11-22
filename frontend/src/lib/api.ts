import axios from "axios";
import {
  Person,
  Family,
  Milestone,
  ModuleCoordinator,
} from "@/src/types/person";
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
  EvangelismGroup,
  EvangelismGroupMember,
  EvangelismSession,
  EvangelismWeeklyReport,
  Prospect,
  FollowUpTask,
  DropOff,
  Conversion,
  MonthlyConversionTracking,
  MonthlyStatistics,
  Each1Reach1Goal,
  EvangelismSummary,
  RecurringSessionData as EvangelismRecurringSessionData,
  BibleSharersCoverage,
  BulkEnrollData,
} from "@/src/types/evangelism";
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

// Token storage keys
const ACCESS_TOKEN_KEY = "access_token";
const REFRESH_TOKEN_KEY = "refresh_token";
const REMEMBER_ME_KEY = "remember_me";

// Token management functions
export const tokenStorage = {
  getAccessToken: () => localStorage.getItem(ACCESS_TOKEN_KEY),
  getRefreshToken: () => localStorage.getItem(REFRESH_TOKEN_KEY),
  setTokens: (access: string, refresh: string, rememberMe?: boolean) => {
    localStorage.setItem(ACCESS_TOKEN_KEY, access);
    localStorage.setItem(REFRESH_TOKEN_KEY, refresh);
    if (rememberMe !== undefined) {
      localStorage.setItem(REMEMBER_ME_KEY, rememberMe.toString());
    }
  },
  clearTokens: () => {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(REMEMBER_ME_KEY);
  },
  getRememberMe: () => localStorage.getItem(REMEMBER_ME_KEY) === "true",
};

// Request interceptor: Add JWT token to requests
api.interceptors.request.use(
  (config) => {
    const token = tokenStorage.getAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor: Handle 401 errors and token refresh
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value?: any) => void;
  reject: (reason?: any) => void;
}> = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // If error is 401 and we haven't tried to refresh yet
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        // If already refreshing, queue this request
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch((err) => {
            return Promise.reject(err);
          });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const refreshToken = tokenStorage.getRefreshToken();
      if (!refreshToken) {
        tokenStorage.clearTokens();
        processQueue(new Error("No refresh token"), null);
        window.location.href = "/login";
        return Promise.reject(error);
      }

      try {
        const response = await axios.post(
          `${api.defaults.baseURL}/auth/token/refresh/`,
          { refresh: refreshToken }
        );
        const { access } = response.data;
        tokenStorage.setTokens(access, refreshToken);
        originalRequest.headers.Authorization = `Bearer ${access}`;
        processQueue(null, access);
        return api(originalRequest);
      } catch (refreshError) {
        tokenStorage.clearTokens();
        processQueue(refreshError, null);
        window.location.href = "/login";
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    // Standardize error response format
    if (error.response?.data) {
      const errorData = error.response.data;
      if (errorData.error && errorData.message) {
        // Already in standardized format
        return Promise.reject(error);
      } else {
        // Convert to standardized format
        error.response.data = {
          error: "error",
          message: errorData.detail || errorData.message || "An error occurred",
          details: errorData,
        };
      }
    }

    return Promise.reject(error);
  }
);

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

export const moduleCoordinatorsApi = {
  getAll: (params?: {
    person?: number;
    module?: string;
    level?: string;
    resource_type?: string;
    search?: string;
  }) =>
    api.get<ModuleCoordinator[]>("/people/module-coordinators/", { params }),
  getById: (id: number) =>
    api.get<ModuleCoordinator>(`/people/module-coordinators/${id}/`),
  create: (data: {
    person: number;
    module: ModuleCoordinator["module"];
    level: ModuleCoordinator["level"];
    resource_id?: number | null;
    resource_type?: string;
  }) => api.post<ModuleCoordinator>("/people/module-coordinators/", data),
  update: (
    id: number,
    data: Partial<{
      person: number;
      module: ModuleCoordinator["module"];
      level: ModuleCoordinator["level"];
      resource_id?: number | null;
      resource_type?: string;
    }>
  ) => api.put<ModuleCoordinator>(`/people/module-coordinators/${id}/`, data),
  patch: (
    id: number,
    data: Partial<{
      person: number;
      module: ModuleCoordinator["module"];
      level: ModuleCoordinator["level"];
      resource_id?: number | null;
      resource_type?: string;
    }>
  ) => api.patch<ModuleCoordinator>(`/people/module-coordinators/${id}/`, data),
  delete: (id: number) => api.delete(`/people/module-coordinators/${id}/`),
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
  getById: (id: string | number) =>
    api.get<ClusterWeeklyReport>(`/clusters/cluster-weekly-reports/${id}/`),
  create: (data: ClusterWeeklyReportInput) =>
    api.post<ClusterWeeklyReport>("/clusters/cluster-weekly-reports/", data),
  update: (id: string | number, data: Partial<ClusterWeeklyReportInput>) =>
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

export const evangelismApi = {
  // Groups
  listGroups: (params?: {
    cluster?: number | string;
    is_active?: boolean;
    search?: string;
  }) => api.get<EvangelismGroup[]>("/evangelism/groups/", { params }),
  getGroup: (id: number | string) =>
    api.get<EvangelismGroup>(`/evangelism/groups/${id}/`),
  createGroup: (data: Partial<EvangelismGroup>) =>
    api.post<EvangelismGroup>("/evangelism/groups/", data),
  updateGroup: (id: number | string, data: Partial<EvangelismGroup>) =>
    api.put<EvangelismGroup>(`/evangelism/groups/${id}/`, data),
  deleteGroup: (id: number | string) => api.delete(`/evangelism/groups/${id}/`),
  enroll: (groupId: number | string, payload: BulkEnrollData) =>
    api.post<{ created: number; message: string }>(
      `/evangelism/groups/${groupId}/enroll/`,
      payload
    ),
  getGroupSessions: (
    groupId: number | string,
    params?: { date_from?: string; date_to?: string }
  ) =>
    api.get<EvangelismSession[]>(`/evangelism/groups/${groupId}/sessions/`, {
      params,
    }),
  getGroupConversions: (groupId: number | string) =>
    api.get<Conversion[]>(`/evangelism/groups/${groupId}/conversions/`),
  getGroupVisitors: (groupId: number | string) =>
    api.get<Prospect[]>(`/evangelism/groups/${groupId}/visitors/`),
  getGroupSummary: (groupId: number | string) =>
    api.get<any>(`/evangelism/groups/${groupId}/summary/`),
  getBibleSharersCoverage: () =>
    api.get<BibleSharersCoverage>("/evangelism/groups/bible_sharers_coverage/"),

  // Members
  listMembers: (params?: {
    evangelism_group?: number | string;
    role?: string;
    is_active?: boolean;
  }) => api.get<EvangelismGroupMember[]>("/evangelism/members/", { params }),
  getMember: (id: number | string) =>
    api.get<EvangelismGroupMember>(`/evangelism/members/${id}/`),
  createMember: (data: Partial<EvangelismGroupMember>) =>
    api.post<EvangelismGroupMember>("/evangelism/members/", data),
  updateMember: (id: number | string, data: Partial<EvangelismGroupMember>) =>
    api.put<EvangelismGroupMember>(`/evangelism/members/${id}/`, data),
  deleteMember: (id: number | string) =>
    api.delete(`/evangelism/members/${id}/`),

  // Sessions
  listSessions: (params?: {
    evangelism_group?: number | string;
    session_date?: string;
    search?: string;
  }) => api.get<EvangelismSession[]>("/evangelism/sessions/", { params }),
  getSession: (id: number | string) =>
    api.get<EvangelismSession>(`/evangelism/sessions/${id}/`),
  createSession: (data: Partial<EvangelismSession>) =>
    api.post<EvangelismSession>("/evangelism/sessions/", data),
  updateSession: (id: number | string, data: Partial<EvangelismSession>) =>
    api.put<EvangelismSession>(`/evangelism/sessions/${id}/`, data),
  deleteSession: (id: number | string) =>
    api.delete(`/evangelism/sessions/${id}/`),
  getSessionAttendanceReport: (id: number | string) =>
    api.get<any>(`/evangelism/sessions/${id}/attendance_report/`),
  createRecurringSessions: (payload: EvangelismRecurringSessionData) =>
    api.post<{ created: number; sessions: EvangelismSession[] }>(
      "/evangelism/sessions/create_recurring/",
      payload
    ),

  // Weekly Reports
  listWeeklyReports: (params?: {
    evangelism_group?: number | string;
    year?: number;
    week_number?: number;
    gathering_type?: string;
  }) =>
    api.get<EvangelismWeeklyReport[]>("/evangelism/weekly-reports/", {
      params,
    }),
  getWeeklyReport: (id: number | string) =>
    api.get<EvangelismWeeklyReport>(`/evangelism/weekly-reports/${id}/`),
  createWeeklyReport: (data: Partial<EvangelismWeeklyReport>) =>
    api.post<EvangelismWeeklyReport>("/evangelism/weekly-reports/", data),
  updateWeeklyReport: (
    id: number | string,
    data: Partial<EvangelismWeeklyReport>
  ) =>
    api.put<EvangelismWeeklyReport>(`/evangelism/weekly-reports/${id}/`, data),
  deleteWeeklyReport: (id: number | string) =>
    api.delete(`/evangelism/weekly-reports/${id}/`),

  // Prospects
  listProspects: (params?: {
    invited_by?: number | string;
    inviter_cluster?: number | string;
    evangelism_group?: number | string;
    pipeline_stage?: string;
    endorsed_cluster?: number | string;
    is_dropped_off?: boolean;
  }) => api.get<Prospect[]>("/evangelism/prospects/", { params }),
  getProspect: (id: number | string) =>
    api.get<Prospect>(`/evangelism/prospects/${id}/`),
  createProspect: (data: Partial<Prospect>) =>
    api.post<Prospect>("/evangelism/prospects/", data),
  updateProspect: (id: number | string, data: Partial<Prospect>) =>
    api.put<Prospect>(`/evangelism/prospects/${id}/`, data),
  deleteProspect: (id: number | string) =>
    api.delete(`/evangelism/prospects/${id}/`),
  endorseToCluster: (id: number | string, payload: { cluster_id: number }) =>
    api.post<Prospect>(
      `/evangelism/prospects/${id}/endorse_to_cluster/`,
      payload
    ),
  updateProgress: (
    id: number | string,
    payload: { pipeline_stage?: string; last_activity_date?: string }
  ) =>
    api.post<Prospect>(`/evangelism/prospects/${id}/update_progress/`, payload),
  markAttended: (
    id: number | string,
    payload?: { first_name?: string; last_name?: string }
  ) =>
    api.post<Prospect>(
      `/evangelism/prospects/${id}/mark_attended/`,
      payload || {}
    ),
  createPerson: (id: number | string, data: Partial<Person>) =>
    api.post<Prospect>(`/evangelism/prospects/${id}/create_person/`, data),
  markDroppedOff: (
    id: number | string,
    payload: { reason?: string; reason_details?: string }
  ) =>
    api.post<Prospect>(
      `/evangelism/prospects/${id}/mark_dropped_off/`,
      payload
    ),
  recover: (id: number | string) =>
    api.post<Prospect>(`/evangelism/prospects/${id}/recover/`),

  // Follow-up Tasks
  listFollowUpTasks: (params?: {
    prospect?: number | string;
    assigned_to?: number | string;
    status?: string;
    priority?: string;
  }) => api.get<FollowUpTask[]>("/evangelism/follow-up-tasks/", { params }),
  getFollowUpTask: (id: number | string) =>
    api.get<FollowUpTask>(`/evangelism/follow-up-tasks/${id}/`),
  createFollowUpTask: (data: Partial<FollowUpTask>) =>
    api.post<FollowUpTask>("/evangelism/follow-up-tasks/", data),
  updateFollowUpTask: (id: number | string, data: Partial<FollowUpTask>) =>
    api.put<FollowUpTask>(`/evangelism/follow-up-tasks/${id}/`, data),
  deleteFollowUpTask: (id: number | string) =>
    api.delete(`/evangelism/follow-up-tasks/${id}/`),
  completeTask: (id: number | string) =>
    api.post<FollowUpTask>(`/evangelism/follow-up-tasks/${id}/complete/`),
  getOverdueTasks: () =>
    api.get<FollowUpTask[]>("/evangelism/follow-up-tasks/overdue/"),

  // Drop-offs
  listDropOffs: (params?: {
    drop_off_stage?: string;
    reason?: string;
    recovered?: boolean;
    start_date?: string;
    end_date?: string;
  }) => api.get<DropOff[]>("/evangelism/drop-offs/", { params }),
  getDropOff: (id: number | string) =>
    api.get<DropOff>(`/evangelism/drop-offs/${id}/`),
  recoverDropOff: (id: number | string) =>
    api.post<DropOff>(`/evangelism/drop-offs/${id}/recover/`),
  getDropOffAnalytics: (params?: { start_date?: string; end_date?: string }) =>
    api.get<any>("/evangelism/drop-offs/analytics/", { params }),

  // Conversions
  listConversions: (params?: {
    converted_by?: number | string;
    cluster?: number | string;
    evangelism_group?: number | string;
    year?: number;
  }) => api.get<Conversion[]>("/evangelism/conversions/", { params }),
  getConversion: (id: number | string) =>
    api.get<Conversion>(`/evangelism/conversions/${id}/`),
  createConversion: (data: Partial<Conversion>) =>
    api.post<Conversion>("/evangelism/conversions/", data),
  updateConversion: (id: number | string, data: Partial<Conversion>) =>
    api.put<Conversion>(`/evangelism/conversions/${id}/`, data),
  deleteConversion: (id: number | string) =>
    api.delete(`/evangelism/conversions/${id}/`),

  // Monthly Tracking
  listMonthlyTracking: (params?: {
    cluster?: number | string;
    year?: number;
    month?: number;
    stage?: string;
  }) =>
    api.get<MonthlyConversionTracking[]>("/evangelism/monthly-tracking/", {
      params,
    }),
  getMonthlyStatistics: (params?: {
    cluster?: number | string;
    year?: number;
    month?: number;
  }) =>
    api.get<MonthlyStatistics[]>("/evangelism/monthly-tracking/statistics/", {
      params,
    }),

  // Each 1 Reach 1 Goals
  listGoals: (params?: {
    cluster?: number | string;
    year?: number;
    status?: string;
  }) =>
    api.get<Each1Reach1Goal[]>("/evangelism/each1reach1-goals/", { params }),
  getGoal: (id: number | string) =>
    api.get<Each1Reach1Goal>(`/evangelism/each1reach1-goals/${id}/`),
  createGoal: (data: Partial<Each1Reach1Goal>) =>
    api.post<Each1Reach1Goal>("/evangelism/each1reach1-goals/", data),
  updateGoal: (id: number | string, data: Partial<Each1Reach1Goal>) =>
    api.put<Each1Reach1Goal>(`/evangelism/each1reach1-goals/${id}/`, data),
  deleteGoal: (id: number | string) =>
    api.delete(`/evangelism/each1reach1-goals/${id}/`),
  getGoalProgress: (id: number | string) =>
    api.get<any>(`/evangelism/each1reach1-goals/${id}/progress/`),
  getMemberProgress: (id: number | string) =>
    api.get<any[]>(`/evangelism/each1reach1-goals/${id}/member_progress/`),
  getLeaderboard: (params?: { year?: number }) =>
    api.get<Each1Reach1Goal[]>("/evangelism/each1reach1-goals/leaderboard/", {
      params,
    }),
  getSummary: (params?: { year?: number }) =>
    api.get<any>("/evangelism/each1reach1-goals/summary/", { params }),
};

// Authentication API
export interface LoginResponse {
  access: string;
  refresh: string;
  user: {
    id: number;
    username: string;
    email: string;
    first_name: string;
    last_name: string;
    middle_name?: string;
    full_name: string;
    role: string;
    photo?: string;
  };
}

export interface User {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  middle_name?: string;
  full_name: string;
  role: string;
  photo?: string;
  must_change_password?: boolean;
  first_login?: boolean;
  module_coordinator_assignments?: ModuleCoordinator[];
}

export interface PasswordResetRequest {
  id: number;
  user_id: number;
  username: string;
  email: string;
  full_name: string;
  requested_at: string;
  approved_at: string | null;
  approved_by_name: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
  notes: string;
}

export interface LockedAccount {
  user_id: number;
  username: string;
  email: string;
  full_name: string;
  failed_attempts: number;
  locked_until: string | null;
  lockout_count: number;
  last_attempt: string;
}

export interface AuditLog {
  id: number;
  user_id: number | null;
  username: string | null;
  action: string;
  ip_address: string;
  user_agent: string;
  details: any;
  timestamp: string;
}

export const authApi = {
  login: (username: string, password: string, rememberMe: boolean = false) =>
    api
      .post<LoginResponse & { must_change_password?: boolean }>(
        "/auth/login/",
        {
          username,
          password,
          remember_me: rememberMe,
        }
      )
      .then((response) => {
        const { access, refresh, user, must_change_password } = response.data;
        tokenStorage.setTokens(access, refresh, rememberMe);
        return {
          access,
          refresh,
          user: {
            ...user,
            must_change_password: must_change_password || false,
          },
        };
      }),

  logout: () => {
    tokenStorage.clearTokens();
    return api.post("/auth/logout/");
  },

  refreshToken: () => {
    const refresh = tokenStorage.getRefreshToken();
    if (!refresh) {
      return Promise.reject(new Error("No refresh token available"));
    }
    return api
      .post<{ access: string }>("/auth/token/refresh/", { refresh })
      .then((response) => {
        const rememberMe = tokenStorage.getRememberMe();
        tokenStorage.setTokens(response.data.access, refresh, rememberMe);
        return response.data.access;
      });
  },

  getCurrentUser: () => api.get<User>("/auth/me/"),

  changePassword: (
    oldPassword: string,
    newPassword: string,
    confirmPassword: string
  ) => {
    const data: any = {
      new_password: newPassword,
      confirm_password: confirmPassword,
    };
    if (oldPassword) {
      data.old_password = oldPassword;
    }
    return api.post("/auth/change-password/", data);
  },

  updateProfile: (data: FormData | any) => {
    if (data instanceof FormData) {
      return api.patch("/auth/me/", data, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });
    }
    return api.patch<User>("/auth/me/", data);
  },

  requestPasswordReset: (userId: number, notes?: string) =>
    api.post("/auth/password-reset-request/", {
      user_id: userId,
      notes: notes || "",
    }),

  getPasswordResetRequests: (
    status?: string,
    page?: number,
    page_size?: number
  ) => {
    const params: any = {};
    if (status) params.status = status;
    if (page) params.page = page;
    if (page_size) params.page_size = page_size;
    return api.get<{
      count: number;
      page: number;
      page_size: number;
      results: PasswordResetRequest[];
    }>("/auth/admin/password-reset-requests/", {
      params,
    });
  },

  approvePasswordReset: (requestId: number) =>
    api.post(`/auth/admin/password-reset-requests/${requestId}/approve/`),

  getLockedAccounts: (page?: number, page_size?: number) => {
    const params: any = {};
    if (page) params.page = page;
    if (page_size) params.page_size = page_size;
    return api.get<{
      count: number;
      page: number;
      page_size: number;
      results: LockedAccount[];
    }>("/auth/admin/locked-accounts/", {
      params,
    });
  },

  unlockAccount: (userId: number) =>
    api.post(`/auth/admin/unlock-account/${userId}/`),

  getAuditLogs: (filters?: {
    user_id?: number;
    action?: string;
    start_date?: string;
    end_date?: string;
    page?: number;
    page_size?: number;
  }) => {
    return api.get<{
      count: number;
      page: number;
      page_size: number;
      results: AuditLog[];
    }>("/auth/admin/audit-logs/", { params: filters });
  },
};

export default api;
