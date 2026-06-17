"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import Card from "@/src/components/ui/Card";
import { useAuth } from "@/src/contexts/AuthContext";
import { useModuleSettings } from "@/src/hooks/useModuleSettings";
import { getAvailableQuickActions } from "@/src/lib/quickActionsConfig";

export default function QuickActions() {
  const router = useRouter();
  const { user, isModuleCoordinator, isSeniorCoordinator, isPlainMember } = useAuth();
  const { moduleEnabled } = useModuleSettings();

  const availableActions = useMemo(
    () =>
      getAvailableQuickActions({
        user,
        isModuleCoordinator,
        isSeniorCoordinator,
        isPlainMember,
        moduleEnabled,
      }),
    [user, isModuleCoordinator, isSeniorCoordinator, isPlainMember, moduleEnabled],
  );

  return (
    <Card>
      <h3 className="text-lg font-semibold text-foreground mb-4">
        Quick Actions
      </h3>
      {availableActions.length === 0 ? (
        <p className="text-sm text-gray-500">No quick actions available.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {availableActions.map(({ key, label, icon: Icon, href }) => (
            <button
              key={key}
              onClick={() => router.push(href)}
              className="group rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-left transition hover:-translate-y-0.5 hover:border-primary/40 hover:bg-primary/10 focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm font-semibold text-[#1F2937]">
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white text-primary shadow-sm shadow-[primary]/20">
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  {label}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </Card>
  );
}
