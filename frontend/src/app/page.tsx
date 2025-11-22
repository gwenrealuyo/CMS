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
      <div className="min-h-screen flex items-center justify-center bg-[#F7FAFC]">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  if (isAuthenticated) {
    return null; // Will redirect
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#F7FAFC]">
      <h1 className="text-4xl font-bold text-[#2D3748] mb-6">
        Church Management System
      </h1>
      <Link href="/login">
        <Button>Sign In</Button>
      </Link>
    </div>
  );
}
