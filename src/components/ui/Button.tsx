import React, { ReactNode } from "react";

interface ButtonProps {
  children: ReactNode;
  variant?: "primary" | "secondary";
  onClick?: () => void;
  disabled?: boolean;
}

export default function Button({
  children,
  variant = "primary",
  onClick,
  disabled,
}: ButtonProps) {
  const baseStyles =
    "px-4 py-2 rounded-md font-medium transition-colors duration-200";
  const variants = {
    primary: "bg-[#2563EB] text-white hover:bg-[#6B46C1] disabled:bg-gray-300",
    secondary:
      "bg-[#4A5568] text-white hover:bg-[#2D3748] disabled:bg-gray-300",
  };

  return (
    <button
      className={`${baseStyles} ${variants[variant]}`}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}
