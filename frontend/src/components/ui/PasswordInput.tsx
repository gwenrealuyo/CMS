"use client";

import { useState } from "react";
import { EyeIcon, EyeSlashIcon } from "@heroicons/react/24/outline";

interface PasswordInputProps {
  id?: string;
  name?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  required?: boolean;
  className?: string;
  showStrengthIndicator?: boolean;
  disabled?: boolean;
  autoComplete?: string;
}

export default function PasswordInput({
  id,
  name,
  value,
  onChange,
  placeholder = "Enter password",
  required = false,
  className = "",
  showStrengthIndicator = false,
  disabled = false,
  autoComplete = "current-password",
}: PasswordInputProps) {
  const [showPassword, setShowPassword] = useState(false);

  const getPasswordStrength = (password: string) => {
    if (password.length === 0) return { strength: 0, label: "", color: "" };
    if (password.length < 8) return { strength: 1, label: "Too short", color: "bg-red-500" };
    
    const hasLetter = /[a-zA-Z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    
    if (hasLetter && hasNumber) {
      return { strength: 3, label: "Strong", color: "bg-green-500" };
    } else if (hasLetter || hasNumber) {
      return { strength: 2, label: "Medium", color: "bg-yellow-500" };
    } else {
      return { strength: 1, label: "Weak", color: "bg-red-500" };
    }
  };

  const strength = showStrengthIndicator ? getPasswordStrength(value) : null;

  return (
    <div className="relative">
      <input
        id={id}
        name={name}
        type={showPassword ? "text" : "password"}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        autoComplete={autoComplete}
        className={`w-full px-3 py-2 pr-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-transparent ${className}`}
      />
      <button
        type="button"
        onClick={() => setShowPassword(!showPassword)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 focus:outline-none"
        tabIndex={-1}
      >
        {showPassword ? (
          <EyeSlashIcon className="h-5 w-5" />
        ) : (
          <EyeIcon className="h-5 w-5" />
        )}
      </button>
      {showStrengthIndicator && strength && value.length > 0 && (
        <div className="mt-2">
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-gray-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all ${
                  strength.color
                }`}
                style={{ width: `${(strength.strength / 3) * 100}%` }}
              />
            </div>
            <span className={`text-xs ${strength.color.replace('bg-', 'text-')}`}>
              {strength.label}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

