"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/src/contexts/AuthContext";
import DashboardLayout from "@/src/components/layout/DashboardLayout";
import Button from "@/src/components/ui/Button";
import PasswordInput from "@/src/components/ui/PasswordInput";
import { authApi } from "@/src/lib/api";
import ProtectedRoute from "@/src/components/auth/ProtectedRoute";

export default function ProfilePage() {
  return (
    <ProtectedRoute>
      <ProfilePageContent />
    </ProtectedRoute>
  );
}

function ProfilePageContent() {
  const { user, refreshUser } = useAuth();
  const [profileData, setProfileData] = useState({
    first_name: "",
    last_name: "",
    middle_name: "",
    email: "",
    photo: null as File | null,
  });
  const [passwordData, setPasswordData] = useState({
    old_password: "",
    new_password: "",
    confirm_password: "",
  });
  const [profileLoading, setProfileLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [profileSuccess, setProfileSuccess] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");

  useEffect(() => {
    if (user) {
      setProfileData({
        first_name: user.first_name || "",
        last_name: user.last_name || "",
        middle_name: user.middle_name || "",
        email: user.email || "",
        photo: null,
      });
    }
  }, [user]);

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError("");
    setProfileSuccess("");
    setProfileLoading(true);

    try {
      // If photo is included, use FormData, otherwise use JSON
      if (profileData.photo) {
        const formData = new FormData();
        if (profileData.first_name) formData.append("first_name", profileData.first_name);
        if (profileData.last_name) formData.append("last_name", profileData.last_name);
        if (profileData.middle_name) formData.append("middle_name", profileData.middle_name);
        if (profileData.email) formData.append("email", profileData.email);
        formData.append("photo", profileData.photo);
        await authApi.updateProfile(formData);
      } else {
        const data: any = {};
        if (profileData.first_name) data.first_name = profileData.first_name;
        if (profileData.last_name) data.last_name = profileData.last_name;
        if (profileData.middle_name) data.middle_name = profileData.middle_name;
        if (profileData.email) data.email = profileData.email;
        await authApi.updateProfile(data);
      }
      setProfileSuccess("Profile updated successfully!");
      await refreshUser();
      setProfileData({ ...profileData, photo: null }); // Clear photo after upload
    } catch (error: any) {
      setProfileError(
        error.response?.data?.message ||
          error.message ||
          "Failed to update profile."
      );
    } finally {
      setProfileLoading(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError("");
    setPasswordSuccess("");

    if (passwordData.new_password !== passwordData.confirm_password) {
      setPasswordError("Passwords do not match.");
      return;
    }

    setPasswordLoading(true);

    try {
      await authApi.changePassword(
        passwordData.old_password,
        passwordData.new_password,
        passwordData.confirm_password
      );
      setPasswordSuccess("Password changed successfully!");
      setPasswordData({
        old_password: "",
        new_password: "",
        confirm_password: "",
      });
    } catch (error: any) {
      setPasswordError(
        error.response?.data?.message ||
          error.response?.data?.old_password?.[0] ||
          error.message ||
          "Failed to change password."
      );
    } finally {
      setPasswordLoading(false);
    }
  };

  if (!user) {
    return (
      <DashboardLayout>
        <div className="flex justify-center items-center h-full">
          <div className="text-gray-600">Loading...</div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-[#2D3748]">Your Profile</h1>
          <p className="text-gray-500">Manage your profile information and password</p>
        </div>

        {/* Profile Information Section */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-[#2D3748] mb-4">
            Profile Information
          </h2>
          <form onSubmit={handleProfileSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="username"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Username
              </label>
              <input
                id="username"
                type="text"
                value={user.username}
                disabled
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-500 cursor-not-allowed"
              />
              <p className="mt-1 text-xs text-gray-500">
                Username cannot be changed
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="first_name"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  First Name
                </label>
                <input
                  id="first_name"
                  type="text"
                  value={profileData.first_name}
                  onChange={(e) =>
                    setProfileData({ ...profileData, first_name: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-transparent"
                />
              </div>

              <div>
                <label
                  htmlFor="last_name"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Last Name
                </label>
                <input
                  id="last_name"
                  type="text"
                  value={profileData.last_name}
                  onChange={(e) =>
                    setProfileData({ ...profileData, last_name: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="middle_name"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Middle Name
              </label>
              <input
                id="middle_name"
                type="text"
                value={profileData.middle_name}
                onChange={(e) =>
                  setProfileData({ ...profileData, middle_name: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-transparent"
              />
            </div>

            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                value={profileData.email}
                onChange={(e) =>
                  setProfileData({ ...profileData, email: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-transparent"
              />
            </div>

            <div>
              <label
                htmlFor="photo"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Photo
              </label>
              <input
                id="photo"
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setProfileData({ ...profileData, photo: file });
                  }
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-transparent"
              />
            </div>

            {profileError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm text-red-600">{profileError}</p>
              </div>
            )}

            {profileSuccess && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-md">
                <p className="text-sm text-green-600">{profileSuccess}</p>
              </div>
            )}

            <Button type="submit" disabled={profileLoading}>
              {profileLoading ? "Updating..." : "Update Profile"}
            </Button>
          </form>
        </div>

        {/* Change Password Section */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-[#2D3748] mb-4">
            Change Password
          </h2>
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
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

            {passwordError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm text-red-600">{passwordError}</p>
              </div>
            )}

            {passwordSuccess && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-md">
                <p className="text-sm text-green-600">{passwordSuccess}</p>
              </div>
            )}

            <Button type="submit" disabled={passwordLoading}>
              {passwordLoading ? "Changing..." : "Change Password"}
            </Button>
          </form>
        </div>
      </div>
    </DashboardLayout>
  );
}

