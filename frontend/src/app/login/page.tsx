"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/src/contexts/AuthContext";
import Button from "@/src/components/ui/Button";
import PasswordInput from "@/src/components/ui/PasswordInput";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { login, isAuthenticated, isLoading: authLoading, user } = useAuth();
  const router = useRouter();

  // Redirect if already authenticated
  useEffect(() => {
    if (!authLoading && isAuthenticated && user) {
      // Check if user must change password
      if (user.must_change_password || user.first_login) {
        router.push("/change-password");
      } else {
        router.push("/dashboard");
      }
    }
  }, [isAuthenticated, authLoading, router, user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      await login(username, password, rememberMe);
      // AuthContext will handle redirect to change-password if needed
      // Otherwise, redirect to dashboard
      // Note: user state might not be updated yet, so we check in useEffect
    } catch (err: any) {
      // Handle account locked error
      if (err.response?.status === 423 || err.response?.data?.error === "account_locked") {
        const lockedUntil = err.response?.data?.locked_until;
        if (lockedUntil) {
          const lockedDate = new Date(lockedUntil);
          const now = new Date();
          const minutes = Math.ceil((lockedDate.getTime() - now.getTime()) / 60000);
          setError(
            err.response?.data?.message ||
              `Account is locked. Please try again in ${minutes} minute(s) or contact an administrator.`
          );
        } else {
          setError(
            err.response?.data?.message ||
              "Account is locked. Please contact an administrator."
          );
        }
      } else {
        setError(err.message || "Login failed. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F7FAFC]">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  if (isAuthenticated) {
    return null; // Will redirect
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F7FAFC] px-4">
      <div className="w-full max-w-md p-6 md:p-8 bg-white rounded-lg shadow-md">
        <div className="mb-6 md:mb-8 text-center">
          <h1 className="text-2xl md:text-3xl font-bold text-[#2D3748] mb-2">
            Church Management System
          </h1>
          <p className="text-sm md:text-base text-gray-600">Sign in to your account</p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label
              htmlFor="username"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Username or Email
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              className="w-full px-3 py-2.5 md:py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-transparent text-base md:text-sm min-h-[44px] md:min-h-0"
              placeholder="Enter your username or email"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Password
            </label>
            <PasswordInput
              id="password"
              name="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
            />
          </div>

          <div className="flex items-center">
            <input
              id="remember-me"
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="h-4 w-4 text-[#2563EB] focus:ring-[#2563EB] border-gray-300 rounded"
            />
            <label
              htmlFor="remember-me"
              className="ml-2 block text-sm text-gray-700"
            >
              Remember me
            </label>
          </div>

          <Button
            type="submit"
            disabled={isLoading}
            className="w-full"
          >
            {isLoading ? "Signing in..." : "Sign in"}
          </Button>
        </form>

        <div className="mt-6 text-center">
          <a
            href="/forgot-password"
            className="text-sm text-[#2563EB] hover:underline"
          >
            Forgot your password?
          </a>
        </div>
      </div>
    </div>
  );
}

