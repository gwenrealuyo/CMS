import React, { ReactNode } from "react";

interface ButtonProps {
  children: ReactNode;
  variant?: "primary" | "secondary" | "tertiary";
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  type?: "button" | "submit" | "reset";
  form?: string;
}

export default function Button({
  children,
  variant = "primary",
  onClick,
  disabled,
  className,
  type = "button",
  form,
}: ButtonProps) {
  const baseStyles =
    "px-4 py-2.5 md:py-2 rounded-md font-medium transition-colors duration-200 min-h-[44px] md:min-h-0 flex items-center justify-center";
  const variants = {
    primary:
      "bg-primary text-primary-foreground hover:bg-blue-700 disabled:bg-gray-300 disabled:text-gray-500",
    secondary:
      "bg-[#4A5568] text-white hover:bg-[#2D3748] disabled:bg-gray-300 disabled:text-gray-500",
    tertiary:
      "bg-white text-gray-700 border border-gray-300 hover:bg-gray-100 disabled:bg-gray-100",
  };

  return (
    <button
      type={type}
      form={form}
      className={`${baseStyles} ${variants[variant]} ${className || ""}`}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}
