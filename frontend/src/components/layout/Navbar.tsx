"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  BellIcon,
  UserCircleIcon,
  Bars3Icon,
  MagnifyingGlassIcon,
} from "@heroicons/react/24/outline";
import { useSidebar } from "./SidebarContext";
import { useAuth } from "@/src/contexts/AuthContext";

export default function Navbar() {
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const { collapsed, toggleMobile } = useSidebar();
  const { user, logout } = useAuth();
  const router = useRouter();
  const notificationsRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  const handleLogout = async () => {
    await logout();
    router.push("/login");
  };

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        notificationsRef.current &&
        !notificationsRef.current.contains(event.target as Node)
      ) {
        setShowNotifications(false);
      }
      if (
        profileRef.current &&
        !profileRef.current.contains(event.target as Node)
      ) {
        setShowProfile(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const displayName = user?.full_name || user?.username || "User";
  const userRole = user?.role || "";

  return (
    <nav
      className={`bg-white shadow-sm fixed top-0 right-0 ${
        collapsed ? "left-16 md:left-16" : "left-0 md:left-64"
      } h-16 z-30 transition-all`}
    >
      <div className="h-full px-4 md:px-6 flex items-center justify-between">
        {/* Mobile menu button and search toggle */}
        <div className="flex items-center gap-2 md:gap-3 flex-1">
          <button
            onClick={toggleMobile}
            aria-label="Open menu"
            className="p-2 rounded-md hover:bg-gray-100 text-gray-600 md:hidden min-w-[44px] min-h-[44px] flex items-center justify-center"
          >
            <Bars3Icon className="h-6 w-6" />
          </button>

          {/* Desktop search */}
          <div className="hidden md:flex items-center gap-3 flex-1">
            <input
              type="search"
              placeholder="Search..."
              className="w-64 px-4 py-2 rounded-lg bg-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          {/* Mobile search toggle */}
          <button
            onClick={() => setShowSearch(!showSearch)}
            aria-label="Toggle search"
            className="p-2 rounded-md hover:bg-gray-100 text-gray-600 md:hidden min-w-[44px] min-h-[44px] flex items-center justify-center"
          >
            <MagnifyingGlassIcon className="h-6 w-6" />
          </button>
        </div>

        {/* Mobile search bar */}
        {showSearch && (
          <div className="absolute top-full left-0 right-0 bg-white border-b px-4 py-3 md:hidden z-40">
            <input
              type="search"
              placeholder="Search..."
              className="w-full px-4 py-2 rounded-lg bg-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500"
              autoFocus
            />
          </div>
        )}

        <div className="flex items-center space-x-2 md:space-x-4">
          <div className="relative" ref={notificationsRef}>
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="p-2 rounded-full hover:bg-gray-100 relative min-w-[44px] min-h-[44px] flex items-center justify-center"
              aria-label="Notifications"
            >
              <BellIcon className="h-6 w-6 text-gray-600" />
              <span className="absolute top-1 right-1 h-2 w-2 bg-red-500 rounded-full"></span>
            </button>

            {showNotifications && (
              <div className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-2rem)] bg-white rounded-lg shadow-lg py-2 border z-50">
                <div className="px-4 py-2 border-b">
                  <h3 className="font-semibold">Notifications</h3>
                </div>
                <div className="max-h-64 overflow-y-auto">
                  {/* Sample notifications */}
                  <div className="px-4 py-3 hover:bg-gray-50 min-h-[44px] flex flex-col justify-center">
                    <p className="text-sm">New member registration</p>
                    <p className="text-xs text-gray-500">2 minutes ago</p>
                  </div>
                  <div className="px-4 py-3 hover:bg-gray-50 min-h-[44px] flex flex-col justify-center">
                    <p className="text-sm">Upcoming event: Sunday Service</p>
                    <p className="text-xs text-gray-500">1 hour ago</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="relative" ref={profileRef}>
            <button
              onClick={() => setShowProfile(!showProfile)}
              className="flex items-center space-x-2 md:space-x-3 p-2 rounded-lg hover:bg-gray-100 min-h-[44px]"
              aria-label="User menu"
            >
              {user?.photo ? (
                <img
                  src={user.photo}
                  alt={displayName}
                  className="h-8 w-8 rounded-full object-cover"
                />
              ) : (
                <UserCircleIcon className="h-8 w-8 text-gray-600" />
              )}
              <div className="text-left hidden md:block">
                <span className="text-sm font-medium text-gray-700 block">
                  {displayName}
                </span>
                {userRole && (
                  <span className="text-xs text-gray-500 block">
                    {userRole}
                  </span>
                )}
              </div>
            </button>

            {showProfile && (
              <div className="absolute right-0 mt-2 w-48 max-w-[calc(100vw-2rem)] bg-white rounded-lg shadow-lg py-2 border z-50">
                <Link
                  href="/profile"
                  className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 min-h-[44px] flex items-center"
                  onClick={() => setShowProfile(false)}
                >
                  Your Profile
                </Link>
                {user?.role === "ADMIN" && (
                  <Link
                    href="/admin-settings"
                    className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 min-h-[44px] flex items-center"
                    onClick={() => setShowProfile(false)}
                  >
                    Admin Settings
                  </Link>
                )}
                <hr className="my-2" />
                <button
                  onClick={handleLogout}
                  className="w-full text-left block px-4 py-2 text-sm text-red-600 hover:bg-gray-100 min-h-[44px] flex items-center"
                >
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
