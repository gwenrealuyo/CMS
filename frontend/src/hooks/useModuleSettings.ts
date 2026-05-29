import { useEffect, useState } from "react";
import { moduleSettingsApi } from "@/src/lib/api";
import { ModuleType } from "@/src/types/moduleSettings";
import { useAuth } from "@/src/contexts/AuthContext";

export function useModuleSettings() {
  const { user } = useAuth();
  const [moduleEnabled, setModuleEnabled] = useState<
    Partial<Record<ModuleType, boolean>>
  >({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) {
      setModuleEnabled({});
      return;
    }

    let cancelled = false;
    setLoading(true);

    moduleSettingsApi
      .getAll()
      .then((response) => {
        if (cancelled) {
          return;
        }
        const next: Partial<Record<ModuleType, boolean>> = {};
        response.data.forEach((setting) => {
          next[setting.module] = setting.is_enabled;
        });
        setModuleEnabled(next);
      })
      .catch(() => {
        // Keep defaults if settings are unavailable.
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [user]);

  return { moduleEnabled, loading };
}
