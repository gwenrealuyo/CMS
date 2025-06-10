import React, { ReactNode } from "react";
import Card from "@/src/components/ui/Card";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: ReactNode;
  trend?: {
    value: number;
    isPositive: boolean;
  };
}

export default function StatCard({ title, value, icon, trend }: StatCardProps) {
  return (
    <Card>
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-sm text-gray-500">{title}</p>
          <h3 className="text-2xl font-bold text-[#2D3748] mt-1">{value}</h3>
          {trend && (
            <p
              className={`text-sm mt-2 ${
                trend.isPositive ? "text-green-500" : "text-red-500"
              }`}
            >
              {trend.isPositive ? "↑" : "↓"} {Math.abs(trend.value)}%
            </p>
          )}
        </div>
        <div className="text-[#805AD5] text-2xl">{icon}</div>
      </div>
    </Card>
  );
}
