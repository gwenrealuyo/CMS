"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/src/contexts/AuthContext";

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[];
}

export default function ProtectedRoute({
  children,
  allowedRoles,
}: ProtectedRouteProps) {
  const { isAuthenticated, user, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isLoading) {
      if (!isAuthenticated) {
        router.push("/login");
        return;
      }

      // Check if user must change password (before checking roles)
      // Allow access to /change-password page if must_change_password or first_login
      if (user && (user.must_change_password || user.first_login)) {
        if (pathname !== "/change-password") {
          router.push("/change-password");
          return;
        }
      } else {
        // If user is on change-password page but doesn't need to change password, redirect
        if (pathname === "/change-password") {
          router.push("/dashboard");
          return;
        }
      }

      // Check role-based access if allowedRoles is specified
      if (allowedRoles && user && !allowedRoles.includes(user.role)) {
        // User doesn't have required role, redirect to dashboard
        router.push("/dashboard");
        return;
      }
    }
  }, [isAuthenticated, user, isLoading, allowedRoles, router, pathname]);

  // Show loading state while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F7FAFC]">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  // Don't render children if not authenticated
  if (!isAuthenticated) {
    return null;
  }

  // Don't render children if must change password and not on change-password page
  if (user && (user.must_change_password || user.first_login) && pathname !== "/change-password") {
    return null;
  }

  // Don't render children if doesn't have required role
  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    return null;
  }

  return <>{children}</>;
}

