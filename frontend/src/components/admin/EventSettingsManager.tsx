"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { eventSettingsApi } from "@/src/lib/api";
import { EventSetting } from "@/src/types/eventSettings";
import Modal from "@/src/components/ui/Modal";

export default function EventSettingsManager() {
  const [setting, setSetting] = useState<EventSetting | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [pendingToggle, setPendingToggle] = useState<boolean | null>(null);

  const fetchSetting = async () => {
    setLoading(true);
    try {
      const response = await eventSettingsApi.get();
      setSetting(response.data);
    } catch (error: any) {
      toast.error(
        error?.response?.data?.message ||
          error?.message ||
          "Failed to load event settings.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSetting();
  }, []);

  const handleToggle = async (enabled: boolean) => {
    if (!setting) return;
    setUpdating(true);
    const previous = setting.member_self_checkin_enabled;
    setSetting({ ...setting, member_self_checkin_enabled: enabled });

    try {
      const response = await eventSettingsApi.patch({
        member_self_checkin_enabled: enabled,
      });
      setSetting(response.data);
      toast.success(
        enabled
          ? "Member self-check-in is now open to all members."
          : "Member self-check-in is limited to admins and Events coordinators.",
      );
    } catch (error: any) {
      setSetting({ ...setting, member_self_checkin_enabled: previous });
      toast.error(
        error?.response?.data?.message ||
          error?.message ||
          "Failed to update event settings.",
      );
    } finally {
      setUpdating(false);
    }
  };

  const openToggleConfirmation = (targetEnabled: boolean) => {
    if (pendingToggle !== null || updating || !setting) {
      return;
    }
    setPendingToggle(targetEnabled);
  };

  const closeToggleConfirmation = () => {
    if (updating) return;
    setPendingToggle(null);
  };

  const confirmToggle = async () => {
    if (pendingToggle === null) return;
    await handleToggle(pendingToggle);
    setPendingToggle(null);
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6 text-center text-gray-600">
        Loading event settings...
      </div>
    );
  }

  if (!setting) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6 text-center text-gray-600">
        Unable to load event settings.
      </div>
    );
  }

  const isEnabled = setting.member_self_checkin_enabled;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg sm:text-xl font-semibold text-foreground">
          Events
        </h2>
        <p className="text-sm text-gray-600 mt-1">
          Control who can use Sunday Service self-check-in.
        </p>
      </div>

      <div className="bg-white rounded-lg shadow-md border border-gray-100">
        <div className="p-4 sm:p-5 flex items-center justify-between gap-4">
          <div>
            <h3 className="font-medium text-gray-900">Member self-check-in</h3>
            <p className="text-xs text-gray-500 mt-1 max-w-xl">
              When off, only admins and Events coordinators see the Sunday
              check-in banner and page. Turn this on when you are ready for all
              members to check themselves in.
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {isEnabled
                ? "Open to all members."
                : "Limited to admins and Events coordinators."}
              {setting.updated_by_name
                ? ` Last updated by ${setting.updated_by_name}.`
                : ""}
            </p>
          </div>

          <button
            type="button"
            disabled={updating || pendingToggle !== null}
            onClick={() => openToggleConfirmation(!isEnabled)}
            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
              isEnabled ? "bg-green-600" : "bg-gray-300"
            } ${updating || pendingToggle !== null ? "opacity-60 cursor-not-allowed" : ""}`}
            aria-pressed={isEnabled}
            aria-label="Toggle member self-check-in"
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                isEnabled ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>
      </div>

      <Modal
        isOpen={pendingToggle !== null}
        onClose={closeToggleConfirmation}
        title={
          pendingToggle
            ? "Open self-check-in to members"
            : "Limit self-check-in to staff"
        }
      >
        {pendingToggle !== null && (
          <div className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm text-gray-700">
                {pendingToggle
                  ? "Let all logged-in members use Sunday self-check-in?"
                  : "Hide Sunday self-check-in from members?"}
              </p>
              <p className="text-sm text-gray-500">
                {pendingToggle
                  ? "Members will see the check-in banner on the dashboard and My record when a Sunday Service is open."
                  : "Only admins and Events coordinators will still see and use self-check-in."}
              </p>
            </div>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={closeToggleConfirmation}
                disabled={updating}
                className="px-4 py-2 rounded-md border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmToggle}
                disabled={updating}
                className={`px-4 py-2 rounded-md text-sm font-medium text-white disabled:opacity-60 disabled:cursor-not-allowed ${
                  pendingToggle
                    ? "bg-green-600 hover:bg-green-700"
                    : "bg-red-600 hover:bg-red-700"
                }`}
              >
                {updating
                  ? "Saving..."
                  : pendingToggle
                    ? "Open to members"
                    : "Limit to staff"}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
