"use client";

import Modal from "@/src/components/ui/Modal";
import Button from "@/src/components/ui/Button";
import toast from "react-hot-toast";

interface UserLoginCredentialsModalProps {
  isOpen: boolean;
  onClose: () => void;
  fullName: string;
  username: string;
  temporaryPassword?: string;
  variant?: "created" | "reset";
}

function copyToClipboard(label: string, value: string) {
  navigator.clipboard.writeText(value).then(
    () => toast.success(`${label} copied`),
    () => toast.error(`Failed to copy ${label.toLowerCase()}`),
  );
}

export default function UserLoginCredentialsModal({
  isOpen,
  onClose,
  fullName,
  username,
  temporaryPassword,
  variant = "created",
}: UserLoginCredentialsModalProps) {
  const title =
    variant === "created" ? "User created successfully" : "Password reset";

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          {variant === "created"
            ? "Share these login details with the new user securely."
            : "Share the new temporary password with the user securely."}
        </p>

        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-3">
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Name
            </p>
            <p className="text-sm text-gray-900 mt-1">{fullName}</p>
          </div>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                Username
              </p>
              <p className="text-sm font-mono text-gray-900 mt-1 break-all">
                {username}
              </p>
            </div>
            <Button
              type="button"
              variant="secondary"
              className="shrink-0 text-xs"
              onClick={() => copyToClipboard("Username", username)}
            >
              Copy
            </Button>
          </div>
          {temporaryPassword && (
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Temporary password
                </p>
                <p className="text-sm font-mono text-gray-900 mt-1 break-all">
                  {temporaryPassword}
                </p>
              </div>
              <Button
                type="button"
                variant="secondary"
                className="shrink-0 text-xs"
                onClick={() =>
                  copyToClipboard("Password", temporaryPassword)
                }
              >
                Copy
              </Button>
            </div>
          )}
        </div>

        <p className="text-xs text-gray-500">
          The user must change their password on first login.
        </p>

        <div className="flex justify-end">
          <Button type="button" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </Modal>
  );
}
