export interface Donation {
  id: string;
  amount: number;
  date: Date;
  purpose: "Tithe" | "Offering" | "Project" | "Other";
  donorId?: string; // Optional for anonymous donations
  donorName?: string;
  notes?: string;
  paymentMethod: "Cash" | "Check" | "Bank Transfer" | "Online";
  isAnonymous: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface DonationStats {
  totalAmount: number;
  donationCount: number;
  averageDonation: number;
  purposeBreakdown: {
    [key: string]: number;
  };
}
