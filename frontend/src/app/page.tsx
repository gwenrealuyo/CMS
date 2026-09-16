"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { QrCodeIcon } from "@heroicons/react/24/outline";
import Button from "../components/ui/Button";
import AppLogo from "@/src/components/brand/AppLogo";
import { useAuth } from "@/src/contexts/AuthContext";
import { publicSelfCheckInApi } from "@/src/lib/api";

export default function Home() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const [sundayCheckInOpen, setSundayCheckInOpen] = useState(false);

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
        if (!cancelled) setSundayCheckInOpen(Boolean(response.data.available));
      })
      .catch(() => {
        if (!cancelled) setSundayCheckInOpen(false);
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
        {sundayCheckInOpen ? (
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
              className="flex min-h-14 w-full items-center justify-center gap-2 rounded-md bg-lighthouse-gold px-4 py-3.5 text-base font-semibold text-[#5f2b0d] shadow-sm hover:bg-lighthouse-gold/90"
            >
              <QrCodeIcon className="h-5 w-5 shrink-0" />
              Sunday online check-in
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
