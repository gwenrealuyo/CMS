"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Button from "../components/ui/Button";
import AppLogo from "@/src/components/brand/AppLogo";
import { useAuth } from "@/src/contexts/AuthContext";

export default function Home() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.push("/dashboard");
    }
  }, [isAuthenticated, isLoading, router]);

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
          <AppLogo imageClassName="h-16 w-auto object-contain" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-primary mb-1 leading-tight break-words">
          The Lighthouse
        </h1>
        <p className="text-sm text-muted-foreground mb-2">
          LAMP Church Care System
        </p>
        <p className="text-sm font-medium text-lighthouse-gold mb-6">
          A soul kept is a soul won.
        </p>
        <p className="text-sm sm:text-base text-muted-foreground mb-8">
          Shepherd every person from first visit to faithful service.
        </p>
        <Link href="/login" className="block w-full">
          <Button className="w-full">Sign In</Button>
        </Link>
      </div>
    </div>
  );
}
