export type NotificationCategory = "alert" | "activity";

export type NotificationSeverity = "info" | "warning" | "success";

export type NotificationType =
  | "password_reset_pending"
  | "account_locked"
  | "cluster_report_due"
  | "evangelism_report_due"
  | "cluster_report_overdue"
  | "follow_up_overdue"
  | "follow_up_due_soon"
  | "cluster_report_submitted"
  | "evangelism_report_submitted";

export interface NotificationItem {
  key: string;
  category: NotificationCategory;
  type: NotificationType;
  severity: NotificationSeverity;
  title: string;
  body: string;
  href: string;
  occurred_at: string;
}

export interface NotificationFeedResponse {
  unread_count: number;
  alert_count: number;
  activity_count: number;
  items: NotificationItem[];
}
