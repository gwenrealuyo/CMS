"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { PlusIcon } from "@heroicons/react/24/outline";
import { useAuth } from "@/src/contexts/AuthContext";
import { useModuleSettings } from "@/src/hooks/useModuleSettings";
import { getAvailableQuickActions } from "@/src/lib/quickActionsConfig";

export default function NavbarQuickActions() {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const { user, isModuleCoordinator, isSeniorCoordinator } = useAuth();
  const { moduleEnabled } = useModuleSettings();

  const actions = useMemo(
    () =>
      getAvailableQuickActions({
        user,
        isModuleCoordinator,
        isSeniorCoordinator,
        moduleEnabled,
      }),
    [user, isModuleCoordinator, isSeniorCoordinator, moduleEnabled],
  );

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  if (!user || user.role === "VISITOR" || actions.length === 0) {
    return null;
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="p-2 rounded-full hover:bg-muted text-muted-foreground relative min-w-[44px] min-h-[44px] flex items-center justify-center border border-gray-200 bg-white shadow-sm"
        aria-label="Quick actions"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <PlusIcon className="h-6 w-6" />
      </button>

      {open && (
        <div
          className="absolute right-0 mt-2 w-56 max-w-[calc(100vw-2rem)] bg-white rounded-lg shadow-lg py-2 border z-50"
          role="menu"
        >
          {actions.map(({ key, label, href, icon: Icon }) => (
            <button
              key={key}
              type="button"
              role="menuitem"
              className="w-full text-left px-4 py-3 hover:bg-muted min-h-[44px] flex items-center gap-3 text-sm text-foreground"
              onClick={() => {
                setOpen(false);
                router.push(href);
              }}
            >
              <Icon className="h-5 w-5 text-muted-foreground shrink-0" />
              <span>{label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
