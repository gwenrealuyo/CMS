"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { BellIcon, UserCircleIcon } from "@heroicons/react/24/outline";
import { useSidebar } from "./SidebarContext";
import { useAuth } from "@/src/contexts/AuthContext";

export default function Navbar() {
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const { collapsed } = useSidebar();
  const { user, logout } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    await logout();
    router.push("/login");
  };

  const displayName = user?.full_name || user?.username || "User";
  const userRole = user?.role || "";

  return (
    <nav
      className={`bg-white shadow-sm fixed top-0 right-0 ${
        collapsed ? "left-16" : "left-64"
      } h-16 z-30 transition-all`}
    >
      <div className="h-full px-6 flex items-center justify-between">
        <div className="flex items-center gap-3 flex-1">
          <input
            type="search"
            placeholder="Search..."
            className="w-64 px-4 py-2 rounded-lg bg-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>

        <div className="flex items-center space-x-4">
          <div className="relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="p-2 rounded-full hover:bg-gray-100 relative"
            >
              <BellIcon className="h-6 w-6 text-gray-600" />
              <span className="absolute top-1 right-1 h-2 w-2 bg-red-500 rounded-full"></span>
            </button>

            {showNotifications && (
              <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg py-2 border">
                <div className="px-4 py-2 border-b">
                  <h3 className="font-semibold">Notifications</h3>
                </div>
                <div className="max-h-64 overflow-y-auto">
                  {/* Sample notifications */}
                  <div className="px-4 py-3 hover:bg-gray-50">
                    <p className="text-sm">New member registration</p>
                    <p className="text-xs text-gray-500">2 minutes ago</p>
                  </div>
                  <div className="px-4 py-3 hover:bg-gray-50">
                    <p className="text-sm">Upcoming event: Sunday Service</p>
                    <p className="text-xs text-gray-500">1 hour ago</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="relative">
            <button
              onClick={() => setShowProfile(!showProfile)}
              className="flex items-center space-x-3 p-2 rounded-lg hover:bg-gray-100"
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
              <div className="text-left">
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
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg py-2 border">
                <Link
                  href="/profile"
                  className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  onClick={() => setShowProfile(false)}
                >
                  Your Profile
                </Link>
                {user?.role === "ADMIN" && (
                  <Link
                    href="/admin-settings"
                    className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    onClick={() => setShowProfile(false)}
                  >
                    Admin Settings
                  </Link>
                )}
                <hr className="my-2" />
                <button
                  onClick={handleLogout}
                  className="w-full text-left block px-4 py-2 text-sm text-red-600 hover:bg-gray-100"
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
