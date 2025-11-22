// BEGIN EDIT: Add collapsible sections and sub-menus
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useMemo } from "react";
import { useSidebar } from "./SidebarContext";
import { useAuth } from "@/src/contexts/AuthContext";
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
} from "@heroicons/react/24/outline";

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: HomeIcon },
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

export default function Sidebar() {
  const pathname = usePathname();
  const [expandedSections, setExpandedSections] = useState<string[]>([]);
  const { collapsed, toggle } = useSidebar();
  const { user, isModuleCoordinator, isSeniorCoordinator } = useAuth();

  // Filter navigation based on user role and module coordinator assignments
  const filteredNavigation = useMemo(() => {
    if (!user) return [];

    return navigation.filter((item) => {
      // Admin Settings: Only ADMIN
      if (item.name === "Admin Settings") {
        return user.role === "ADMIN";
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
          user.role === "COORDINATOR" ||
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
          user.role === "COORDINATOR" ||
          user.role === "PASTOR" ||
          user.role === "ADMIN" ||
          isModuleCoordinator("EVANGELISM")
        );
      }

      // Sunday School: MEMBER and above (read-only for MEMBER)
      if (item.name === "Sunday School") {
        return (
          user.role === "MEMBER" ||
          user.role === "COORDINATOR" ||
          user.role === "PASTOR" ||
          user.role === "ADMIN" ||
          isModuleCoordinator("SUNDAY_SCHOOL")
        );
      }

      // Lessons: MEMBER and above (read-only for MEMBER)
      if (item.name === "Lessons") {
        return (
          user.role === "MEMBER" ||
          user.role === "COORDINATOR" ||
          user.role === "PASTOR" ||
          user.role === "ADMIN" ||
          isModuleCoordinator("LESSONS")
        );
      }

      // Events: MEMBER and above (read-only for MEMBER)
      if (item.name === "Events") {
        return (
          user.role === "MEMBER" ||
          user.role === "COORDINATOR" ||
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
          user.role === "COORDINATOR" ||
          user.role === "PASTOR" ||
          user.role === "ADMIN" ||
          isModuleCoordinator("MINISTRIES")
        );
      }

      // People: MEMBER and above (filtered by role in backend)
      if (item.name === "People") {
        return (
          user.role === "MEMBER" ||
          user.role === "COORDINATOR" ||
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
  }, [user, isModuleCoordinator, isSeniorCoordinator]);

  const toggleSection = (sectionName: string) => {
    setExpandedSections((prev) =>
      prev.includes(sectionName)
        ? prev.filter((name) => name !== sectionName)
        : [...prev, sectionName]
    );
  };

  const renderNavItem = (item: any) => {
    const isActive = pathname === item.href;
    const isExpanded = expandedSections.includes(item.name);
    const hasChildren = item.children && item.children.length > 0;

    return (
      <div key={item.name} className="mb-1">
        {hasChildren ? (
          <button
            onClick={() => toggleSection(item.name)}
            className={`w-full flex items-center justify-between px-3 py-3 rounded-lg transition-colors ${
              isExpanded
                ? "bg-blue-50 text-blue-700"
                : "text-gray-700 hover:bg-gray-50"
            }`}
          >
            <div className="flex items-center">
              <item.icon
                className={`h-5 w-5 ${
                  collapsed ? "mr-0" : "mr-3"
                } text-gray-400`}
              />
              {!collapsed && <span className="font-medium">{item.name}</span>}
            </div>
            {!collapsed &&
              (isExpanded ? (
                <ChevronUpIcon className="h-4 w-4" />
              ) : (
                <ChevronDownIcon className="h-4 w-4" />
              ))}
          </button>
        ) : (
          <Link
            href={item.href}
            title={collapsed ? item.name : undefined}
            className={`flex items-center px-3 py-3 rounded-lg transition-colors ${
              isActive
                ? "bg-blue-50 text-blue-700"
                : "text-gray-700 hover:bg-gray-50"
            }`}
          >
            <item.icon
              className={`h-5 w-5 ${collapsed ? "mr-0" : "mr-3"} ${
                isActive ? "text-blue-700" : "text-gray-400"
              }`}
            />
            {!collapsed && <span className="font-medium">{item.name}</span>}
          </Link>
        )}

        {hasChildren && isExpanded && !collapsed && (
          <div className="ml-6 mt-1 space-y-1">
            {item.children.map((child: any) => {
              const isChildActive = pathname === child.href;
              return (
                <Link
                  key={child.name}
                  href={child.href}
                  className={`flex items-center px-3 py-2 rounded-lg transition-colors ${
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
    <aside
      className={`fixed left-0 top-0 h-screen ${
        collapsed ? "w-16" : "w-64"
      } bg-white shadow-lg z-20 transition-all`}
    >
      <div className="p-6 flex items-center justify-between">
        {!collapsed && (
          <h1 className="text-2xl font-bold text-[#2D3748]">Church Manager</h1>
        )}
        <button
          onClick={toggle}
          aria-label="Toggle sidebar"
          className="p-2 rounded-md hover:bg-gray-100 text-gray-600"
          title={collapsed ? "Expand" : "Collapse"}
        >
          {collapsed ? (
            <ChevronRightIcon className="h-5 w-5" />
          ) : (
            <ChevronLeftIcon className="h-5 w-5" />
          )}
        </button>
      </div>

      <nav className="mt-6 px-3">
        {filteredNavigation.map((item) => renderNavItem(item))}
      </nav>

      {!collapsed && (
        <div className="absolute bottom-0 left-0 right-0 p-6">
          <div className="bg-blue-50 rounded-lg p-4">
            <h3 className="text-sm font-medium text-blue-800">Need Help?</h3>
            <p className="text-sm text-blue-600 mt-1">
              Check our documentation or contact support
            </p>
          </div>
        </div>
      )}
    </aside>
  );
}
// END EDIT
