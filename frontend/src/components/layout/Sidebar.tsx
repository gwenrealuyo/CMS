// BEGIN EDIT: Add collapsible sections and sub-menus
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
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
} from "@heroicons/react/24/outline";

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: HomeIcon },
  { name: "People", href: "/people", icon: UserGroupIcon },
  { name: "Events", href: "/events", icon: CalendarIcon },
  { name: "Attendance", href: "/attendance", icon: ClipboardDocumentCheckIcon },
  { name: "Donations", href: "/donations", icon: CurrencyDollarIcon },
  { name: "Volunteers", href: "/volunteers", icon: UserIcon },
  { name: "Lessons", href: "/lessons", icon: BookOpenIcon },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [expandedSections, setExpandedSections] = useState<string[]>([]);

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
              <item.icon className="h-5 w-5 mr-3 text-gray-400" />
              <span className="font-medium">{item.name}</span>
            </div>
            {isExpanded ? (
              <ChevronUpIcon className="h-4 w-4" />
            ) : (
              <ChevronDownIcon className="h-4 w-4" />
            )}
          </button>
        ) : (
          <Link
            href={item.href}
            className={`flex items-center px-3 py-3 rounded-lg transition-colors ${
              isActive
                ? "bg-blue-50 text-blue-700"
                : "text-gray-700 hover:bg-gray-50"
            }`}
          >
            <item.icon
              className={`h-5 w-5 mr-3 ${
                isActive ? "text-blue-700" : "text-gray-400"
              }`}
            />
            <span className="font-medium">{item.name}</span>
          </Link>
        )}

        {hasChildren && isExpanded && (
          <div className="ml-6 mt-1 space-y-1">
            {item.children.map((child: any) => (
              <Link
                key={child.name}
                href={child.href}
                className={`flex items-center px-3 py-2 rounded-lg transition-colors ${
                  pathname === child.href
                    ? "bg-blue-50 text-blue-700"
                    : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                <span className="font-medium">{child.name}</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-white shadow-lg z-20">
      <div className="p-6">
        <h1 className="text-2xl font-bold text-[#2D3748]">Church Manager</h1>
      </div>

      <nav className="mt-6 px-3">
        {navigation.map((item) => renderNavItem(item))}
      </nav>

      <div className="absolute bottom-0 left-0 right-0 p-6">
        <div className="bg-blue-50 rounded-lg p-4">
          <h3 className="text-sm font-medium text-blue-800">Need Help?</h3>
          <p className="text-sm text-blue-600 mt-1">
            Check our documentation or contact support
          </p>
        </div>
      </div>
    </aside>
  );
}
// END EDIT
