"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import AttendanceVenuesManager from "@/src/components/events/AttendanceVenuesManager";
import { eventSettingsApi } from "@/src/lib/api";
import { EventSetting } from "@/src/types/eventSettings";
import Modal from "@/src/components/ui/Modal";
import Button from "@/src/components/ui/Button";

export default function EventSettingsManager() {
  const [setting, setSetting] = useState<EventSetting | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [pendingToggle, setPendingToggle] = useState<boolean | null>(null);
  const [venuesOpen, setVenuesOpen] = useState(false);

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
          ? "Online self-check-in is now open from the public link."
          : "Online self-check-in is limited to admins and Events coordinators.",
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
          Control online self-check-in and online attendance venues.
        </p>
      </div>

      <div className="bg-white rounded-lg shadow-md border border-gray-100">
        <div className="p-4 sm:p-5 flex items-center justify-between gap-4">
          <div>
            <h3 className="font-medium text-gray-900">Online venues</h3>
            <p className="text-xs text-gray-500 mt-1 max-w-xl">
              Manage Home altar, Cluster house, and other online venues used
              when people check in remotely.
            </p>
          </div>
          <Button
            type="button"
            variant="tertiary"
            onClick={() => setVenuesOpen(true)}
            className="shrink-0"
          >
            Manage venues
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md border border-gray-100">
        <div className="p-4 sm:p-5 flex items-center justify-between gap-4">
          <div>
            <h3 className="font-medium text-gray-900">
              Member online self-check-in
            </h3>
            <p className="text-xs text-gray-500 mt-1 max-w-xl">
              Opens the public link at /events/self-check-in so members can
              check in online with their LAMP ID or member QR, without logging
              in, for events that have self-check-in enabled. Onsite check-in
              stays on the staff station. When off, only admins and Events
              coordinators can use logged-in household and guest check-in.
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {isEnabled
                ? "Public LAMP ID check-in is open."
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
            aria-label="Toggle member online self-check-in"
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
            ? "Open the public check-in link"
            : "Limit online self-check-in to staff"
        }
      >
        {pendingToggle !== null && (
          <div className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm text-gray-700">
                {pendingToggle
                  ? "Let members check in online from the public link using their LAMP ID or member QR, without logging in?"
                  : "Hide online self-check-in from members?"}
              </p>
              <p className="text-sm text-gray-500">
                {pendingToggle
                  ? "The shared /events/self-check-in page will accept LAMP ID, camera scan, or a QR photo (decoded in the browser, not saved) for events with self-check-in enabled. Logged-in admins and Events coordinators keep household and guest check-in. Do not use this if they are onsite."
                  : "Only admins and Events coordinators will still see and use logged-in household and guest self-check-in."}
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
                    ? "Open public link"
                    : "Limit to staff"}
              </button>
            </div>
          </div>
        )}
      </Modal>

      <AttendanceVenuesManager
        isOpen={venuesOpen}
        onClose={() => setVenuesOpen(false)}
      />
    </div>
  );
}
