"use client";

import { useState } from "react";
import Link from "next/link";
import Button from "@/src/components/ui/Button";

export default function ForgotPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F7FAFC] px-4">
      <div className="w-full max-w-md p-6 md:p-8 bg-white rounded-lg shadow-md">
        <div className="mb-6 md:mb-8 text-center">
          <h1 className="text-2xl md:text-3xl font-bold text-[#2D3748] mb-2">
            Reset Password
          </h1>
          <p className="text-sm md:text-base text-gray-600">
            Contact an administrator to reset your password
          </p>
        </div>

        <div className="space-y-4">
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-md">
            <p className="text-sm text-blue-800 mb-2">
              <strong>Password reset is managed by administrators.</strong>
            </p>
            <p className="text-sm text-blue-700">
              To reset your password, please contact your system administrator.
              They will review your request and reset your password to a default
              value, which you can then change after logging in.
            </p>
          </div>
          <div className="flex gap-4">
            <Link href="/login" className="flex-1">
              <Button className="w-full">Back to Login</Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

