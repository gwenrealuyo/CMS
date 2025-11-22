import React, { ReactNode } from "react";

interface ButtonProps {
  children: ReactNode;
  variant?: "primary" | "secondary" | "tertiary";
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  type?: "button" | "submit" | "reset";
}

export default function Button({
  children,
  variant = "primary",
  onClick,
  disabled,
  className,
  type = "button",
}: ButtonProps) {
  const baseStyles =
    "px-4 py-2.5 md:py-2 rounded-md font-medium transition-colors duration-200 min-h-[44px] md:min-h-0 flex items-center justify-center";
  const variants = {
    primary: "bg-[#2563EB] text-white hover:bg-[#1d4ed8] disabled:bg-gray-300",
    secondary:
      "bg-[#4A5568] text-white hover:bg-[#2D3748] disabled:bg-gray-300",
    tertiary:
      "bg-white text-gray-700 border border-gray-300 hover:bg-gray-100 disabled:bg-gray-100",
  };

  return (
    <button
      type={type}
      className={`${baseStyles} ${variants[variant]} ${className || ""}`}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}
