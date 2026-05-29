"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Button from "../components/ui/Button";
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
      <div className="min-h-screen flex items-center justify-center bg-[#F7FAFC] px-4">
        <div className="text-sm md:text-base text-gray-600">Loading...</div>
      </div>
    );
  }

  if (isAuthenticated) {
    return null; // Will redirect
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F7FAFC] px-4 py-8 sm:px-6">
      <div className="w-full max-w-md p-6 sm:p-8 bg-white rounded-lg shadow-md text-center">
        <h1 className="text-2xl sm:text-3xl font-bold text-[#2D3748] mb-3 leading-tight break-words">
          Church Management System
        </h1>
        <p className="text-sm sm:text-base text-gray-600 mb-8">
          Manage members, events, finances, and more in one place.
        </p>
        <Link href="/login" className="block w-full">
          <Button className="w-full">Sign In</Button>
        </Link>
      </div>
    </div>
  );
}
