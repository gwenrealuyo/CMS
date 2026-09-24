"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { QrCodeIcon } from "@heroicons/react/24/outline";

import { eventsApi } from "@/src/lib/api";
import { SelfCheckInSessionResponse } from "@/src/types/selfCheckIn";

export default function SundaySelfCheckInBanner() {
  const [session, setSession] = useState<SelfCheckInSessionResponse | null>(
    null,
  );

  useEffect(() => {
    let cancelled = false;
    eventsApi
      .selfCheckInSession()
      .then((response) => {
        if (!cancelled) setSession(response.data);
      })
      .catch(() => {
        if (!cancelled) setSession(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!session?.available) {
    return null;
  }

  const title = session.session?.event.title || session.options[0]?.title;
  const href = session.needs_selection
    ? "/events/self-check-in"
    : session.session
      ? `/events/self-check-in?event=${session.session.event.id ?? session.session.event.event_id}`
      : "/events/self-check-in";

  return (
    <div className="relative overflow-hidden rounded-xl border border-lighthouse-gold/50 bg-gradient-to-r from-amber-50 via-amber-50 to-lighthouse-gold/25 px-4 py-3.5 shadow-sm sm:px-5">
      <div className="absolute inset-y-0 left-0 w-1.5 bg-lighthouse-gold" />
      <div className="flex flex-col gap-3 pl-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-lighthouse-gold/90 text-lighthouse-navy">
            <QrCodeIcon className="h-5 w-5" />
          </span>
          <div>
            <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-amber-800">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-lighthouse-gold opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-lighthouse-gold" />
              </span>
              Online only
            </p>
            <p className="text-sm font-semibold text-lighthouse-navy">
              {title
                ? `${title} — online check-in is open`
                : "Online check-in is open"}
            </p>
            <p className="text-sm text-amber-900/70">
              {/* {title ? `${title}. ` : ""} */}
              Use this only if you are attending online.
            </p>
          </div>
        </div>
        <Link
          href={href}
          className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-md bg-lighthouse-navy px-4 py-2 text-sm font-medium text-white hover:bg-lighthouse-navy/90"
        >
          Check in online
        </Link>
      </div>
    </div>
  );
}
