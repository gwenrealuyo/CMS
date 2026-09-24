"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { QrCodeIcon } from "@heroicons/react/24/outline";
import Button from "../components/ui/Button";
import AppLogo from "@/src/components/brand/AppLogo";
import { useAuth } from "@/src/contexts/AuthContext";
import { publicSelfCheckInApi } from "@/src/lib/api";
import type { PublicSelfCheckInSessionResponse } from "@/src/types/selfCheckIn";

function selfCheckInButtonLabel(
  data: PublicSelfCheckInSessionResponse,
): string {
  const typeLabels = [
    data.session?.event.type_display,
    ...data.options.map((option) => option.type_display),
  ].filter((label): label is string => Boolean(label?.trim()));
  const unique = Array.from(new Set(typeLabels));
  // "Online only" sits above the button — keep the CTA short for narrow phones.
  if (unique.length === 1) {
    return `${unique[0]} check\u2011in`;
  }
  return "Online check\u2011in";
}

export default function Home() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const [selfCheckInOpen, setSelfCheckInOpen] = useState(false);
  const [checkInLabel, setCheckInLabel] = useState("Online check\u2011in");

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.push("/dashboard");
    }
  }, [isAuthenticated, isLoading, router]);

  useEffect(() => {
    if (isLoading || isAuthenticated) return;
    let cancelled = false;
    publicSelfCheckInApi
      .session()
      .then((response) => {
        if (cancelled) return;
        setSelfCheckInOpen(Boolean(response.data.available));
        if (response.data.available) {
          setCheckInLabel(selfCheckInButtonLabel(response.data));
        }
      })
      .catch(() => {
        if (!cancelled) setSelfCheckInOpen(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, isLoading]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="text-sm md:text-base text-muted-foreground">
          Loading...
        </div>
      </div>
    );
  }

  if (isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-8 sm:px-6">
      <div className="w-full max-w-md p-6 sm:p-8 bg-white rounded-lg shadow-md text-center">
        <div className="flex justify-center mb-4">
          <AppLogo imageClassName="h-24 w-auto object-contain" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-primary mb-1 leading-tight break-words">
          The Lighthouse
        </h1>
        <p className="text-sm text-muted-foreground mb-2">
          LAMP Church Management System
        </p>
        <p className="text-sm font-medium text-lighthouse-gold mb-6">
          A soul kept is a soul won.
        </p>
        <p className="text-sm sm:text-base text-muted-foreground mb-8">
          Shepherd every person from first visit to faithful service.
        </p>
        {selfCheckInOpen ? (
          <div className="space-y-3">
            <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-amber-800">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-lighthouse-gold opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-lighthouse-gold" />
              </span>
              Online only
            </p>
            <Link
              href="/events/self-check-in"
              className="flex min-h-12 w-full items-center justify-center gap-2 rounded-md bg-lighthouse-gold px-3 py-3 text-sm font-semibold leading-snug text-[#5f2b0d] shadow-sm hover:bg-lighthouse-gold/90 sm:min-h-14 sm:gap-2.5 sm:px-4 sm:py-3.5 sm:text-base"
            >
              <QrCodeIcon className="h-5 w-5 shrink-0" />
              <span className="min-w-0 text-balance text-center">
                {checkInLabel}
              </span>
            </Link>
            <Link href="/login" className="block w-full">
              <Button
                variant="tertiary"
                className="w-full !border-primary text-primary hover:bg-primary/5"
              >
                Sign In
              </Button>
            </Link>
          </div>
        ) : (
          <Link href="/login" className="block w-full">
            <Button className="w-full">Sign In</Button>
          </Link>
        )}
      </div>
    </div>
  );
}
