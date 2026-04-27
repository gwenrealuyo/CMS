export type ModuleType =
  | "CLUSTER"
  | "FINANCE"
  | "EVANGELISM"
  | "SUNDAY_SCHOOL"
  | "LESSONS"
  | "EVENTS"
  | "MINISTRIES";

export interface ModuleSetting {
  id: number;
  module: ModuleType;
  module_display?: string;
  is_enabled: boolean;
  updated_at?: string;
  updated_by?: number | null;
  updated_by_name?: string | null;
}
