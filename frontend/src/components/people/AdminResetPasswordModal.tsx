"use client";

import { useState } from "react";
import Modal from "@/src/components/ui/Modal";
import Button from "@/src/components/ui/Button";
import PasswordInput from "@/src/components/ui/PasswordInput";
import { authApi } from "@/src/lib/api";
import { Person } from "@/src/types/person";
import toast from "react-hot-toast";
import UserLoginCredentialsModal from "@/src/components/people/UserLoginCredentialsModal";

interface AdminResetPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  person: Person;
}

function personDisplayName(person: Person): string {
  return (
    `${person.first_name ?? ""} ${person.last_name ?? ""}`.trim() ||
    person.username
  );
}

export default function AdminResetPasswordModal({
  isOpen,
  onClose,
  person,
}: AdminResetPasswordModalProps) {
  const [autoGenerate, setAutoGenerate] = useState(true);
  const [manualPassword, setManualPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [credentials, setCredentials] = useState<{
    username: string;
    temporaryPassword?: string;
  } | null>(null);

  const handleClose = () => {
    setAutoGenerate(true);
    setManualPassword("");
    setConfirmPassword("");
    setCredentials(null);
    onClose();
  };

  const handleSubmit = async () => {
    if (!autoGenerate) {
      if (!manualPassword) {
        toast.error("Please enter a temporary password.");
        return;
      }
      if (manualPassword.length < 8) {
        toast.error("Password must be at least 8 characters long.");
        return;
      }
      if (!/[a-zA-Z]/.test(manualPassword) || !/[0-9]/.test(manualPassword)) {
        toast.error("Password must contain at least one letter and one number.");
        return;
      }
      if (manualPassword !== confirmPassword) {
        toast.error("Passwords do not match.");
        return;
      }
    }

    setLoading(true);
    try {
      const response = await authApi.adminResetPassword(
        Number(person.id),
        autoGenerate
          ? { generate_temporary_password: true }
          : { new_password: manualPassword },
      );
      setCredentials({
        username: response.data.username,
        temporaryPassword: response.data.temporary_password,
      });
      toast.success("Password reset successfully.");
    } catch (error: any) {
      toast.error(
        error?.response?.data?.error ||
          error?.response?.data?.message ||
          error?.message ||
          "Failed to reset password.",
      );
    } finally {
      setLoading(false);
    }
  };

  if (credentials) {
    return (
      <UserLoginCredentialsModal
        isOpen={isOpen}
        onClose={handleClose}
        fullName={personDisplayName(person)}
        username={credentials.username}
        temporaryPassword={credentials.temporaryPassword}
        variant="reset"
      />
    );
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={`Reset password for ${personDisplayName(person)}`}
    >
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Set a new temporary password. The user will be required to change it
          on next login.
        </p>

        <div className="flex flex-col sm:flex-row gap-3">
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="reset_password_mode"
              checked={autoGenerate}
              onChange={() => setAutoGenerate(true)}
              className="text-primary border-gray-300 focus:ring-ring"
            />
            <span className="text-sm text-gray-700">
              Auto-generate temporary password
            </span>
          </label>
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="reset_password_mode"
              checked={!autoGenerate}
              onChange={() => setAutoGenerate(false)}
              className="text-primary border-gray-300 focus:ring-ring"
            />
            <span className="text-sm text-gray-700">Set password manually</span>
          </label>
        </div>

        {!autoGenerate && (
          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Temporary password
              </label>
              <PasswordInput
                value={manualPassword}
                onChange={(e) => setManualPassword(e.target.value)}
                placeholder="At least 8 characters"
                showStrengthIndicator
                autoComplete="new-password"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Confirm password
              </label>
              <PasswordInput
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter password"
                autoComplete="new-password"
              />
            </div>
          </div>
        )}

        <div className="flex flex-col-reverse sm:flex-row justify-end gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={handleClose}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={loading}>
            {loading ? "Resetting..." : "Reset password"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
