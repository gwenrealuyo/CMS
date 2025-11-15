export type PaymentMethod =
  | "CASH"
  | "CHECK"
  | "BANK_TRANSFER"
  | "CARD"
  | "DIGITAL_WALLET";

export type DonationPurpose = "Tithe" | "Offering" | "Project" | "Other";

export interface Donation {
  id: number | string;
  amount: number;
  date: string;
  purpose: DonationPurpose;
  donorId?: number | string | null;
  donorName?: string | null;
  notes?: string | null;
  paymentMethod: PaymentMethod;
  isAnonymous: boolean;
  receiptNumber?: string;
  recordedById?: number | string | null;
  recordedByName?: string | null;
  createdAt: string;
}

export interface DonationStats {
  totalAmount: number;
  donationCount: number;
  averageDonation: number;
  purposeBreakdown: Record<string, number>;
}

export interface Offering {
  id: number | string;
  serviceDate: string;
  serviceName: string;
  fund?: string | null;
  amount: number;
  notes?: string | null;
  recordedByName?: string | null;
  createdAt: string;
}

export interface OfferingWeeklySummary {
  weekStart: string | null;
  totalAmount: number;
}

export type PledgeStatus = "ACTIVE" | "FULFILLED" | "CANCELLED";

export interface Pledge {
  id: number | string;
  pledgeTitle: string;
  pledgeAmount: number;
  amountReceived: number;
  contributionsTotal: number;
  balance: number;
  progressPercent: number;
  startDate: string;
  targetDate?: string | null;
  purpose?: string | null;
  status: PledgeStatus;
  notes?: string | null;
  pledgerId?: number | string | null;
  pledgerName?: string | null;
  recordedByName?: string | null;
  createdAt: string;
  updatedAt: string;
  contributions: PledgeContribution[];
}

export interface PledgeSummary {
  id: number;
  pledgeTitle: string;
  pledgeAmount: number;
  amountReceived: number;
  balance: number;
  progressPercent: number;
  status: PledgeStatus;
}

export interface PledgeContribution {
  id: number | string;
  pledgeId: number | string;
  contributorId?: number | string | null;
  contributorName?: string | null;
  amount: number;
  contributionDate: string;
  note?: string | null;
  recordedById?: number | string | null;
  recordedByName?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PledgeContributionInput {
  amount: number;
  contributionDate: string;
  contributorId?: number | string | null;
  note?: string | null;
}
