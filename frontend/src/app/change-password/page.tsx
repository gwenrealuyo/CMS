"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/src/contexts/AuthContext";
import Button from "@/src/components/ui/Button";
import PasswordInput from "@/src/components/ui/PasswordInput";
import { authApi } from "@/src/lib/api";
import ProtectedRoute from "@/src/components/auth/ProtectedRoute";

export default function ChangePasswordPage() {
  return (
    <ProtectedRoute>
      <ChangePasswordPageContent />
    </ProtectedRoute>
  );
}

function ChangePasswordPageContent() {
  const { user, refreshUser } = useAuth();
  const router = useRouter();
  const [passwordData, setPasswordData] = useState({
    old_password: "",
    new_password: "",
    confirm_password: "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const isFirstLogin = user?.first_login || false;

  // Redirect if user doesn't need to change password
  useEffect(() => {
    if (user && !user.must_change_password && !user.first_login) {
      router.push("/dashboard");
    }
  }, [user, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (passwordData.new_password !== passwordData.confirm_password) {
      setError("Passwords do not match.");
      return;
    }

    setIsLoading(true);

    try {
      await authApi.changePassword(
        isFirstLogin ? "" : passwordData.old_password,
        passwordData.new_password,
        passwordData.confirm_password
      );
      await refreshUser();
      router.push("/dashboard");
    } catch (error: any) {
      setError(
        error.response?.data?.message ||
          error.response?.data?.old_password?.[0] ||
          error.message ||
          "Failed to change password."
      );
    } finally {
      setIsLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F7FAFC]">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F7FAFC]">
      <div className="w-full max-w-md p-8 bg-white rounded-lg shadow-md">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-[#2D3748] mb-2">
            {isFirstLogin ? "Set Your Password" : "Change Your Password"}
          </h1>
          <p className="text-gray-600">
            {isFirstLogin
              ? "Please set a secure password for your account"
              : "You must change your password before continuing"}
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {!isFirstLogin && (
            <div>
              <label
                htmlFor="old_password"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Current Password
              </label>
              <PasswordInput
                id="old_password"
                name="old_password"
                value={passwordData.old_password}
                onChange={(e) =>
                  setPasswordData({
                    ...passwordData,
                    old_password: e.target.value,
                  })
                }
                placeholder="Enter current password"
                required
              />
            </div>
          )}

          <div>
            <label
              htmlFor="new_password"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              New Password
            </label>
            <PasswordInput
              id="new_password"
              name="new_password"
              value={passwordData.new_password}
              onChange={(e) =>
                setPasswordData({
                  ...passwordData,
                  new_password: e.target.value,
                })
              }
              placeholder="Enter new password"
              required
              showStrengthIndicator
            />
            <p className="mt-1 text-xs text-gray-500">
              Password must be at least 8 characters and contain at least one
              letter and one number.
            </p>
          </div>

          <div>
            <label
              htmlFor="confirm_password"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Confirm New Password
            </label>
            <PasswordInput
              id="confirm_password"
              name="confirm_password"
              value={passwordData.confirm_password}
              onChange={(e) =>
                setPasswordData({
                  ...passwordData,
                  confirm_password: e.target.value,
                })
              }
              placeholder="Confirm new password"
              required
            />
          </div>

          <Button type="submit" disabled={isLoading} className="w-full">
            {isLoading
              ? "Changing Password..."
              : isFirstLogin
              ? "Set Password"
              : "Change Password"}
          </Button>
        </form>
      </div>
    </div>
  );
}
