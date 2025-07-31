import React, { ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  title?: string;
}

export default function Card({ children, title }: CardProps) {
  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      {title && (
        <h3 className="text-xl font-semibold text-[#2D3748] mb-4">{title}</h3>
      )}
      {children}
    </div>
  );
}
