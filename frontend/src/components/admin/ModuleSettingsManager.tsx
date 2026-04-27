"use client";

import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { moduleSettingsApi } from "@/src/lib/api";
import { ModuleSetting, ModuleType } from "@/src/types/moduleSettings";
import Modal from "@/src/components/ui/Modal";

const MODULE_ORDER: ModuleType[] = [
  "CLUSTER",
  "FINANCE",
  "EVANGELISM",
  "SUNDAY_SCHOOL",
  "LESSONS",
  "EVENTS",
  "MINISTRIES",
];

function fallbackLabel(module: ModuleType) {
  return module
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (ch) => ch.toUpperCase());
}

export default function ModuleSettingsManager() {
  const [settings, setSettings] = useState<ModuleSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<Record<number, boolean>>({});
  const [pendingToggle, setPendingToggle] = useState<{
    setting: ModuleSetting;
    targetEnabled: boolean;
  } | null>(null);

  const settingsByModule = useMemo(() => {
    const map = new Map<ModuleType, ModuleSetting>();
    settings.forEach((setting) => map.set(setting.module, setting));
    return map;
  }, [settings]);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const response = await moduleSettingsApi.getAll();
      setSettings(response.data);
    } catch (error: any) {
      toast.error(
        error?.response?.data?.message ||
          error?.message ||
          "Failed to load module settings."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleToggle = async (setting: ModuleSetting, isEnabled: boolean) => {
    setUpdating((prev) => ({ ...prev, [setting.id]: true }));
    setSettings((prev) =>
      prev.map((item) =>
        item.id === setting.id ? { ...item, is_enabled: isEnabled } : item
      )
    );

    try {
      const response = await moduleSettingsApi.patch(setting.id, {
        is_enabled: isEnabled,
      });
      setSettings((prev) =>
        prev.map((item) => (item.id === setting.id ? response.data : item))
      );
      toast.success(
        `${setting.module_display || fallbackLabel(setting.module)} ${
          isEnabled ? "enabled" : "disabled"
        }.`
      );
    } catch (error: any) {
      setSettings((prev) =>
        prev.map((item) =>
          item.id === setting.id
            ? { ...item, is_enabled: !isEnabled }
            : item
        )
      );
      toast.error(
        error?.response?.data?.message ||
          error?.message ||
          "Failed to update module setting."
      );
    } finally {
      setUpdating((prev) => ({ ...prev, [setting.id]: false }));
    }
  };

  const openToggleConfirmation = (
    setting: ModuleSetting,
    targetEnabled: boolean
  ) => {
    if (pendingToggle || updating[setting.id]) {
      return;
    }
    setPendingToggle({ setting, targetEnabled });
  };

  const closeToggleConfirmation = () => {
    if (pendingToggle && updating[pendingToggle.setting.id]) {
      return;
    }
    setPendingToggle(null);
  };

  const confirmToggle = async () => {
    if (!pendingToggle) {
      return;
    }
    const { setting, targetEnabled } = pendingToggle;
    await handleToggle(setting, targetEnabled);
    setPendingToggle(null);
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6 text-center text-gray-600">
        Loading module settings...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg sm:text-xl font-semibold text-[#2D3748]">
          Module Controls
        </h2>
        <p className="text-sm text-gray-600 mt-1">
          Enable or disable modules to control non-admin access across the app.
        </p>
      </div>

      <div className="bg-white rounded-lg shadow-md border border-gray-100 divide-y divide-gray-100">
        {MODULE_ORDER.map((module) => {
          const setting = settingsByModule.get(module);
          const label = setting?.module_display || fallbackLabel(module);
          const isEnabled = setting?.is_enabled ?? true;
          const isUpdating = setting ? !!updating[setting.id] : false;

          return (
            <div
              key={module}
              className="p-4 sm:p-5 flex items-center justify-between gap-4"
            >
              <div>
                <h3 className="font-medium text-gray-900">{label}</h3>
                <p className="text-xs text-gray-500 mt-1">
                  {isEnabled
                    ? "Module is currently enabled."
                    : "Module is currently disabled for non-admin users."}
                </p>
              </div>

              <button
                type="button"
                disabled={!setting || isUpdating || !!pendingToggle}
                onClick={() =>
                  setting && openToggleConfirmation(setting, !isEnabled)
                }
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  isEnabled ? "bg-green-600" : "bg-gray-300"
                } ${!setting || isUpdating || pendingToggle ? "opacity-60 cursor-not-allowed" : ""}`}
                aria-pressed={isEnabled}
                aria-label={`Toggle ${label}`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    isEnabled ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
          );
        })}
      </div>

      <Modal
        isOpen={!!pendingToggle}
        onClose={closeToggleConfirmation}
        title={pendingToggle?.targetEnabled ? "Enable Module" : "Disable Module"}
      >
        {pendingToggle && (
          <div className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm text-gray-700">
                {pendingToggle.targetEnabled
                  ? `Are you sure you want to enable ${
                      pendingToggle.setting.module_display ||
                      fallbackLabel(pendingToggle.setting.module)
                    }?`
                  : `Are you sure you want to disable ${
                      pendingToggle.setting.module_display ||
                      fallbackLabel(pendingToggle.setting.module)
                    }?`}
              </p>
              <p className="text-sm text-gray-500">
                {pendingToggle.targetEnabled
                  ? "This will allow non-admin users to access this module again."
                  : "This will block non-admin users from accessing this module."}
              </p>
            </div>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={closeToggleConfirmation}
                disabled={!!updating[pendingToggle.setting.id]}
                className="px-4 py-2 rounded-md border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmToggle}
                disabled={!!updating[pendingToggle.setting.id]}
                className={`px-4 py-2 rounded-md text-sm font-medium text-white disabled:opacity-60 disabled:cursor-not-allowed ${
                  pendingToggle.targetEnabled
                    ? "bg-green-600 hover:bg-green-700"
                    : "bg-red-600 hover:bg-red-700"
                }`}
              >
                {updating[pendingToggle.setting.id]
                  ? "Saving..."
                  : pendingToggle.targetEnabled
                    ? "Enable Module"
                    : "Disable Module"}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
