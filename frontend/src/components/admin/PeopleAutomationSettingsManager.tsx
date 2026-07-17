"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { peopleAutomationSettingsApi } from "@/src/lib/api";
import { PeopleAutomationSetting } from "@/src/types/peopleAutomationSettings";
import Modal from "@/src/components/ui/Modal";

export default function PeopleAutomationSettingsManager() {
  const [setting, setSetting] = useState<PeopleAutomationSetting | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [pendingToggle, setPendingToggle] = useState<boolean | null>(null);

  const fetchSetting = async () => {
    setLoading(true);
    try {
      const response = await peopleAutomationSettingsApi.get();
      setSetting(response.data);
    } catch (error: any) {
      toast.error(
        error?.response?.data?.message ||
          error?.message ||
          "Failed to load people automation settings.",
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
    const previous = setting.auto_status_updates_enabled;
    setSetting({ ...setting, auto_status_updates_enabled: enabled });

    try {
      const response = await peopleAutomationSettingsApi.patch({
        auto_status_updates_enabled: enabled,
      });
      setSetting(response.data);
      toast.success(
        enabled
          ? "Automated attendance status updates enabled."
          : "Automated attendance status updates disabled.",
      );
    } catch (error: any) {
      setSetting({ ...setting, auto_status_updates_enabled: previous });
      toast.error(
        error?.response?.data?.message ||
          error?.message ||
          "Failed to update people automation setting.",
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
        Loading people automation settings...
      </div>
    );
  }

  if (!setting) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6 text-center text-gray-600">
        Unable to load people automation settings.
      </div>
    );
  }

  const isEnabled = setting.auto_status_updates_enabled;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg sm:text-xl font-semibold text-foreground">
          People automations
        </h2>
        <p className="text-sm text-gray-600 mt-1">
          Control automated people workflows. Turning these off is useful during
          soft testing.
        </p>
      </div>

      <div className="bg-white rounded-lg shadow-md border border-gray-100">
        <div className="p-4 sm:p-5 flex items-center justify-between gap-4">
          <div>
            <h3 className="font-medium text-gray-900">
              Automated attendance status updates
            </h3>
            <p className="text-xs text-gray-500 mt-1 max-w-xl">
              When enabled, Active / Semi-active / Inactive are calculated from
              the 4-week attendance window. Does not change Dormant, Fall Away,
              Deceased, or statuses set manually in the person form.
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {isEnabled
                ? "Automation is currently on."
                : "Automation is currently off — statuses stay as set until you turn this back on."}
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
            aria-label="Toggle automated attendance status updates"
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
            ? "Enable status automation"
            : "Disable status automation"
        }
      >
        {pendingToggle !== null && (
          <div className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm text-gray-700">
                {pendingToggle
                  ? "Enable automated attendance status updates?"
                  : "Disable automated attendance status updates?"}
              </p>
              <p className="text-sm text-gray-500">
                {pendingToggle
                  ? "Attendance and cluster reports will again update Active, Semi-active, and Inactive automatically."
                  : "Attendance will no longer change Active, Semi-active, or Inactive. You can still set status manually on the person form."}
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
                    ? "Enable"
                    : "Disable"}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
