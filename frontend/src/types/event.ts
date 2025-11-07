export interface EventOccurrence {
  event_id: string | number;
  occurrence_id: string;
  start_date: string;
  end_date: string;
  is_base_occurrence: boolean;
}

export interface WeeklyRecurrencePattern {
  frequency: "weekly";
  weekdays: number[];
  through: string;
  excluded_dates?: string[];
}

export interface Event {
  id: string;
  title: string;
  description: string;
  start_date: string;
  end_date: string;
  type:
    | "SUNDAY_SERVICE"
    | "BIBLE_STUDY"
    | "PRAYER_MEETING"
    | "CLUSTER_BS_EVANGELISM"
    | "CLUSTERING"
    | "DOCTRINAL_CLASS"
    | "CYM_CLASS"
    | "MINI_WORSHIP"
    | "GOLDEN_WARRIORS"
    | "CAMPING"
    | "AWTA"
    | "CONFERENCE"
    | "OTHER";
  type_display: string;
  location: string;
  is_recurring: boolean;
  recurrence_pattern?: WeeklyRecurrencePattern | null;
  occurrences?: EventOccurrence[];
  next_occurrence?: EventOccurrence | null;
  volunteers: string[];
  volunteer_count?: number;
  created_at: string;
}
