import type { ComponentType, SVGProps } from "react";
import {
  CalendarIcon,
  ClipboardDocumentCheckIcon,
  MegaphoneIcon,
  UserPlusIcon,
  BookOpenIcon,
} from "@heroicons/react/24/outline";
import type { User } from "@/src/lib/api";
import type { ModuleCoordinator } from "@/src/types/person";
import type { ModuleType } from "@/src/types/moduleSettings";

type CoordinatorLevel = ModuleCoordinator["level"];

export type QuickActionKey =
  | "people"
  | "events"
  | "cluster-report"
  | "evangelism-report"
  | "lesson-session";

export interface QuickActionDefinition {
  key: QuickActionKey;
  label: string;
  href: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  blurb: string;
}

const QUICK_ACTIONS: QuickActionDefinition[] = [
  {
    key: "people",
    label: "Add Person",
    href: "/people?action=create",
    icon: UserPlusIcon,
    blurb: "Capture new members and returning guests.",
  },
  {
    key: "events",
    label: "Create Event",
    href: "/events?action=create",
    icon: CalendarIcon,
    blurb: "Schedule services, clusters, or special gatherings.",
  },
  {
    key: "cluster-report",
    label: "Submit Cluster Report",
    href: "/clusters?action=submit-report",
    icon: ClipboardDocumentCheckIcon,
    blurb: "Submit the weekly cluster report.",
  },
  {
    key: "evangelism-report",
    label: "Submit Evangelism Report",
    href: "/evangelism?action=submit-report",
    icon: MegaphoneIcon,
    blurb: "Submit the weekly evangelism group report.",
  },
  {
    key: "lesson-session",
    label: "Log Lesson Session",
    href: "/lessons?action=log-session",
    icon: BookOpenIcon,
    blurb: "Record a lesson session report.",
  },
];

export interface QuickActionsContext {
  user: User | null;
  isModuleCoordinator: (
    module: ModuleType,
    level?: CoordinatorLevel,
    resourceId?: number,
  ) => boolean;
  isSeniorCoordinator: (module?: ModuleType) => boolean;
  moduleEnabled: Partial<Record<ModuleType, boolean>>;
}

function isModuleEnabledForQuickAction(
  module: ModuleType,
  ctx: QuickActionsContext,
): boolean {
  if (ctx.user?.role === "ADMIN") {
    return true;
  }
  return ctx.moduleEnabled[module] !== false;
}

function canViewPeople(ctx: QuickActionsContext): boolean {
  const { user, isSeniorCoordinator } = ctx;
  if (!user) return false;
  return (
    ["MEMBER", "COORDINATOR", "PASTOR", "ADMIN"].includes(user.role) ||
    isSeniorCoordinator()
  );
}

function canViewEvents(ctx: QuickActionsContext): boolean {
  const { user, isModuleCoordinator, isSeniorCoordinator } = ctx;
  if (!user) return false;
  if (!isModuleEnabledForQuickAction("EVENTS", ctx)) return false;
  return (
    ["MEMBER", "COORDINATOR", "PASTOR", "ADMIN"].includes(user.role) ||
    isModuleCoordinator("EVENTS") ||
    isSeniorCoordinator()
  );
}

function canLogLessonSession(ctx: QuickActionsContext): boolean {
  const { user, isModuleCoordinator, isSeniorCoordinator } = ctx;
  if (!user) return false;
  if (!isModuleEnabledForQuickAction("LESSONS", ctx)) return false;
  return (
    user.role === "PASTOR" ||
    user.role === "ADMIN" ||
    isModuleCoordinator("LESSONS") ||
    isSeniorCoordinator("LESSONS")
  );
}

function canSubmitClusterReport(ctx: QuickActionsContext): boolean {
  const { user, isModuleCoordinator, isSeniorCoordinator } = ctx;
  if (!user) return false;
  if (!isModuleEnabledForQuickAction("CLUSTER", ctx)) return false;
  return (
    user.role === "COORDINATOR" ||
    user.role === "PASTOR" ||
    user.role === "ADMIN" ||
    isModuleCoordinator("CLUSTER") ||
    isSeniorCoordinator("CLUSTER")
  );
}

function canSubmitEvangelismReport(ctx: QuickActionsContext): boolean {
  const { user, isModuleCoordinator, isSeniorCoordinator } = ctx;
  if (!user) return false;
  if (!isModuleEnabledForQuickAction("EVANGELISM", ctx)) return false;
  return (
    user.role === "COORDINATOR" ||
    user.role === "PASTOR" ||
    user.role === "ADMIN" ||
    isModuleCoordinator("EVANGELISM") ||
    isSeniorCoordinator("EVANGELISM")
  );
}

function isVisible(action: QuickActionDefinition, ctx: QuickActionsContext): boolean {
  switch (action.key) {
    case "people":
      return canViewPeople(ctx);
    case "events":
      return canViewEvents(ctx);
    case "lesson-session":
      return canLogLessonSession(ctx);
    case "cluster-report":
      return canSubmitClusterReport(ctx);
    case "evangelism-report":
      return canSubmitEvangelismReport(ctx);
    default:
      return false;
  }
}

export function getAvailableQuickActions(
  ctx: QuickActionsContext,
): QuickActionDefinition[] {
  const isMember = ctx.user?.role === "MEMBER";

  return QUICK_ACTIONS.filter((action) => isVisible(action, ctx)).map(
    (action) => {
      if (action.key === "people" && isMember) {
        return {
          ...action,
          label: "Add Visitor",
          href: "/people?action=add-visitor",
        };
      }
      return action;
    },
  );
}
