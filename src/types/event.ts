export interface Event {
  id: string;
  title: string;
  description: string;
  startDate: Date;
  endDate: Date;
  type: "Sunday Service" | "Bible Study" | "Prayer Meeting" | "Other";
  location?: string;
  isRecurring: boolean;
  recurrencePattern?: {
    frequency: "daily" | "weekly" | "monthly";
    interval: number;
  };
  volunteers: string[];
  attendees: string[];
  createdAt: Date;
  updatedAt: Date;
}
