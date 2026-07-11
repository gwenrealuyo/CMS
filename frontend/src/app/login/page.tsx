"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/src/contexts/AuthContext";
import Button from "@/src/components/ui/Button";
import PasswordInput from "@/src/components/ui/PasswordInput";
import AppLogo from "@/src/components/brand/AppLogo";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { login, isAuthenticated, isLoading: authLoading, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && isAuthenticated && user) {
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
    } catch (err: any) {
      if (
        err.response?.status === 423 ||
        err.response?.data?.error === "account_locked"
      ) {
        const lockedUntil = err.response?.data?.locked_until;
        if (lockedUntil) {
          const lockedDate = new Date(lockedUntil);
          const now = new Date();
          const minutes = Math.ceil(
            (lockedDate.getTime() - now.getTime()) / 60000
          );
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
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md p-6 md:p-8 bg-white rounded-lg shadow-md">
        <div className="mb-6 md:mb-8 text-center">
          <div className="flex justify-center mb-4">
            <AppLogo imageClassName="h-16 w-auto object-contain" />
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-primary mb-1">
            The Lighthouse
          </h1>
          <p className="text-sm text-muted-foreground mb-2">
            LAMP Church Management System
          </p>
          <p className="text-sm font-medium text-lighthouse-gold">
            A soul kept is a soul won.
          </p>
          <p className="text-sm md:text-base text-muted-foreground mt-4">
            Sign in to your account
          </p>
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
              className="block text-sm font-medium text-foreground mb-1"
            >
              Username or Email
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              className="input-field text-base md:text-sm"
              placeholder="Enter your username or email"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-foreground mb-1"
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
              className="h-4 w-4 text-primary focus:ring-ring border-input rounded"
            />
            <label
              htmlFor="remember-me"
              className="ml-2 block text-sm text-foreground"
            >
              Remember me
            </label>
          </div>

          <Button type="submit" disabled={isLoading} className="w-full">
            {isLoading ? "Signing in..." : "Sign in"}
          </Button>
        </form>

        <div className="mt-6 text-center">
          <a
            href="/forgot-password"
            className="text-sm text-primary hover:underline"
          >
            Forgot your password?
          </a>
        </div>
      </div>
    </div>
  );
}
