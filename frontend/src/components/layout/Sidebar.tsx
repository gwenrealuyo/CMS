// BEGIN EDIT: Add collapsible sections and sub-menus
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useMemo, useEffect } from "react";
import { useSidebar } from "./SidebarContext";
import { useAuth } from "@/src/contexts/AuthContext";
import { moduleSettingsApi } from "@/src/lib/api";
import { ModuleType } from "@/src/types/moduleSettings";
import AppLogo from "@/src/components/brand/AppLogo";
import {
  HomeIcon,
  UserGroupIcon,
  CalendarIcon,
  ClipboardDocumentCheckIcon,
  CurrencyDollarIcon,
  UserIcon,
  BookOpenIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  RectangleStackIcon,
  Squares2X2Icon,
  DocumentChartBarIcon,
  AcademicCapIcon,
  MegaphoneIcon,
  Cog6ToothIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: HomeIcon },
  {
    name: "Analytics",
    href: "/analytics",
    icon: DocumentChartBarIcon,
    roles: ["ADMIN", "PASTOR"],
  },
  {
    name: "People",
    href: "/people",
    icon: UserGroupIcon,
    children: [
      { name: "Directory", href: "/people", icon: UserIcon },
      { name: "Families", href: "/people/families", icon: RectangleStackIcon },
    ],
  },
  { name: "Clusters", href: "/clusters", icon: Squares2X2Icon },
  { name: "Evangelism", href: "/evangelism", icon: MegaphoneIcon },
  { name: "Ministries", href: "/ministries", icon: UserGroupIcon },
  { name: "Sunday School", href: "/sunday-school", icon: AcademicCapIcon },
  { name: "Events", href: "/events", icon: CalendarIcon },
  // { name: "Attendance", href: "/attendance", icon: ClipboardDocumentCheckIcon },
  { name: "Finance", href: "/finance", icon: CurrencyDollarIcon },
  { name: "Lessons", href: "/lessons", icon: BookOpenIcon },
  {
    name: "Admin Settings",
    href: "/admin-settings",
    icon: Cog6ToothIcon,
    roles: ["ADMIN"],
  },
];

const moduleByNavName: Record<string, ModuleType> = {
  Clusters: "CLUSTER",
  Evangelism: "EVANGELISM",
  Ministries: "MINISTRIES",
  "Sunday School": "SUNDAY_SCHOOL",
  Events: "EVENTS",
  Finance: "FINANCE",
  Lessons: "LESSONS",
};

/** Path-only segment of href — matches usePathname() which omits query/hash. */
function getPathFromHref(href: string): string {
  const noQuery = href.split("?")[0] ?? href;
  return (noQuery.split("#")[0] ?? noQuery) || "/";
}

export default function Sidebar() {
  const pathname = usePathname();
  const [expandedSections, setExpandedSections] = useState<string[]>([]);
  const [moduleEnabledState, setModuleEnabledState] = useState<
    Partial<Record<ModuleType, boolean>>
  >({});
  const { collapsed, mobileOpen, toggle, closeMobile } = useSidebar();
  const { user, isModuleCoordinator, isSeniorCoordinator } = useAuth();
  const isCompact = collapsed && !mobileOpen;

  useEffect(() => {
    closeMobile();
  }, [pathname, closeMobile]);

  useEffect(() => {
    const fetchModuleSettings = async () => {
      try {
        const response = await moduleSettingsApi.getAll();
        const nextState: Partial<Record<ModuleType, boolean>> = {};
        response.data.forEach((setting) => {
          nextState[setting.module] = setting.is_enabled;
        });
        setModuleEnabledState(nextState);
      } catch (error) {
        // Keep current defaults if settings endpoint is unavailable.
      }
    };

    if (user) {
      fetchModuleSettings();
    }
  }, [user]);

  // Filter navigation based on user role and module coordinator assignments
  const filteredNavigation = useMemo(() => {
    if (!user) return [];

    return navigation.filter((item) => {
      const moduleType = moduleByNavName[item.name];
      if (
        moduleType &&
        user.role !== "ADMIN" &&
        moduleEnabledState[moduleType] === false
      ) {
        return false;
      }

      // Admin Settings: Only ADMIN
      if (item.name === "Admin Settings") {
        return user.role === "ADMIN";
      }

      // Analytics: ADMIN and PASTOR only
      if (item.name === "Analytics") {
        return user.role === "ADMIN" || user.role === "PASTOR";
      }

      // Finance: ADMIN, PASTOR, or Finance Coordinator
      if (item.name === "Finance") {
        return (
          user.role === "ADMIN" ||
          user.role === "PASTOR" ||
          isModuleCoordinator("FINANCE")
        );
      }

      // Clusters: MEMBER and above (read-only for MEMBER)
      if (item.name === "Clusters") {
        return (
          user.role === "MEMBER" ||
          user.role === "PASTOR" ||
          user.role === "ADMIN" ||
          isModuleCoordinator("CLUSTER") ||
          isSeniorCoordinator("CLUSTER")
        );
      }

      // Evangelism: MEMBER and above (all can see stats)
      if (item.name === "Evangelism") {
        return (
          user.role === "MEMBER" ||
          user.role === "PASTOR" ||
          user.role === "ADMIN" ||
          isModuleCoordinator("EVANGELISM")
        );
      }

      // Sunday School: MEMBER and above (read-only for MEMBER)
      if (item.name === "Sunday School") {
        return (
          user.role === "MEMBER" ||
          user.role === "PASTOR" ||
          user.role === "ADMIN" ||
          isModuleCoordinator("SUNDAY_SCHOOL")
        );
      }

      // Lessons: MEMBER and above (read-only for MEMBER)
      if (item.name === "Lessons") {
        return (
          user.role === "MEMBER" ||
          user.role === "PASTOR" ||
          user.role === "ADMIN" ||
          isModuleCoordinator("LESSONS")
        );
      }

      // Events: MEMBER and above (read-only for MEMBER)
      if (item.name === "Events") {
        return (
          user.role === "MEMBER" ||
          user.role === "PASTOR" ||
          user.role === "ADMIN" ||
          isModuleCoordinator("EVENTS") ||
          isSeniorCoordinator()
        );
      }

      // Ministries: MEMBER and above (read-only for MEMBER)
      if (item.name === "Ministries") {
        return (
          user.role === "MEMBER" ||
          user.role === "PASTOR" ||
          user.role === "ADMIN" ||
          isModuleCoordinator("MINISTRIES")
        );
      }

      // People: MEMBER and above (filtered by role in backend)
      if (item.name === "People") {
        return (
          user.role === "MEMBER" ||
          user.role === "PASTOR" ||
          user.role === "ADMIN" ||
          isSeniorCoordinator()
        );
      }

      // Dashboard: All authenticated users
      if (item.name === "Dashboard") {
        return true;
      }

      // All other items: All authenticated users (MEMBER and above)
      return true;
    });
  }, [user, isModuleCoordinator, isSeniorCoordinator, moduleEnabledState]);

  const toggleSection = (sectionName: string) => {
    setExpandedSections((prev) =>
      prev.includes(sectionName)
        ? prev.filter((name) => name !== sectionName)
        : [...prev, sectionName]
    );
  };

  const renderNavItem = (item: any) => {
    const isActive = pathname === getPathFromHref(item.href);
    const isExpanded = expandedSections.includes(item.name);
    const hasChildren = item.children && item.children.length > 0;
    const childActive =
      hasChildren &&
      item.children.some(
        (child: { href: string }) =>
          pathname === getPathFromHref(child.href)
      );
    const shouldShowChildren =
      (item.name === "People" && childActive) || isExpanded;

    return (
      <div key={item.name} className="mb-1">
        {hasChildren ? (
          <button
            onClick={() => toggleSection(item.name)}
            className={`w-full flex items-center justify-between px-3 py-3 rounded-lg transition-colors min-h-[44px] ${
              childActive || isExpanded
                ? "bg-blue-50 text-blue-700"
                : "text-gray-700 hover:bg-gray-50"
            }`}
          >
            <div className="flex items-center">
              <item.icon
                className={`h-5 w-5 ${
                  isCompact ? "mr-0" : "mr-3"
                } ${childActive ? "text-blue-700" : "text-gray-400"}`}
              />
              {!isCompact && <span className="font-medium">{item.name}</span>}
            </div>
            {!isCompact &&
              (shouldShowChildren ? (
                <ChevronUpIcon className="h-4 w-4" />
              ) : (
                <ChevronDownIcon className="h-4 w-4" />
              ))}
          </button>
        ) : (
          <Link
            href={item.href}
            title={isCompact ? item.name : undefined}
            onClick={closeMobile}
            className={`flex items-center px-3 py-3 rounded-lg transition-colors min-h-[44px] ${
              isActive
                ? "bg-blue-50 text-blue-700 border-l-2 border-primary"
                : "text-gray-700 hover:bg-gray-50"
            }`}
          >
            <item.icon
              className={`h-5 w-5 ${isCompact ? "mr-0" : "mr-3"} ${
                isActive ? "text-blue-700" : "text-gray-400"
              }`}
            />
            {!isCompact && <span className="font-medium">{item.name}</span>}
          </Link>
        )}

        {hasChildren && shouldShowChildren && !isCompact && (
          <div className="ml-6 mt-1 space-y-1">
            {item.children.map((child: any) => {
              const isChildActive = pathname === getPathFromHref(child.href);
              return (
                <Link
                  key={child.name}
                  href={child.href}
                  onClick={closeMobile}
                  className={`flex items-center px-3 py-2 rounded-lg transition-colors min-h-[44px] ${
                    isChildActive
                      ? "bg-blue-50 text-blue-700"
                      : "text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  {child.icon && (
                    <child.icon
                      className={`h-4 w-4 mr-2 ${
                        isChildActive ? "text-blue-700" : "text-gray-400"
                      }`}
                    />
                  )}
                  <span className="font-medium">{child.name}</span>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
          onClick={closeMobile}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed left-0 top-0 flex h-screen flex-col ${
          isCompact ? "w-16" : "w-[17.5rem]"
        } bg-white shadow-lg z-[60] transition-transform duration-300 ease-in-out ${
          mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
      >
        <div
          className={`flex shrink-0 gap-2 p-3 md:p-4 ${
            isCompact ? "flex-col items-center" : "items-center justify-between"
          }`}
        >
          {isCompact ? (
            <AppLogo
              href="/dashboard"
              className="justify-center"
              imageClassName="h-8 w-8 object-contain"
            />
          ) : (
            <AppLogo
              href="/dashboard"
              showWordmark
              className="flex-1"
              imageClassName="h-8 w-8 object-contain"
              wordmarkClassName="text-lg font-bold leading-tight text-primary whitespace-nowrap"
            />
          )}
          <div className="flex shrink-0 items-center gap-2">
            {/* Mobile close button */}
            <button
              onClick={closeMobile}
              aria-label="Close sidebar"
              className="p-1.5 rounded-md hover:bg-gray-100 text-gray-600 md:hidden"
              title="Close"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
            {/* Desktop collapse button */}
            <button
              onClick={toggle}
              aria-label="Toggle sidebar"
              className="p-1.5 rounded-md hover:bg-gray-100 text-gray-600 hidden md:block"
              title={collapsed ? "Expand" : "Collapse"}
            >
              {collapsed ? (
                <ChevronRightIcon className="h-5 w-5" />
              ) : (
                <ChevronLeftIcon className="h-5 w-5" />
              )}
            </button>
          </div>
        </div>

      <nav className="min-h-0 flex-1 overflow-y-auto px-3 pb-6 pt-2">
        {filteredNavigation.map((item) => renderNavItem(item))}
      </nav>

      {false && !isCompact && (
        <div className="absolute bottom-0 left-0 right-0 p-6">
          <div className="bg-primary/10 rounded-lg p-4">
            <h3 className="text-sm font-medium text-primary">Need Help?</h3>
            <p className="text-sm text-primary mt-1">
              Check our documentation or contact support
            </p>
          </div>
        </div>
      )}
    </aside>
    </>
  );
}
// END EDIT
