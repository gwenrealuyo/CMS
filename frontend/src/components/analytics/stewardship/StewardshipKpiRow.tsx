"use client";

import KpiCard from "@/src/components/analytics/KpiCard";
import type { StewardshipSummaryKpis } from "@/src/types/reports";

interface StewardshipKpiRowProps {
  summary: StewardshipSummaryKpis | null;
}

const formatCurrency = (value: number) =>
  `₱${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

export default function StewardshipKpiRow({ summary }: StewardshipKpiRowProps) {
  if (!summary) {
    return null;
  }

  const cards = [
    {
      label: "Total Collected",
      value: formatCurrency(summary.total_collected),
      hint: summary.includes_offerings
        ? "Donations, offerings, and pledge payments"
        : "Donations and pledge payments (branch view)",
    },
    {
      label: "Donations",
      value: formatCurrency(summary.donation_total),
      hint: `${summary.donation_count} entries`,
    },
    ...(summary.includes_offerings
      ? [
          {
            label: "Offerings",
            value: formatCurrency(summary.offering_total),
            hint: `${summary.offering_count} services`,
          },
        ]
      : []),
    {
      label: "Pledge Payments",
      value: formatCurrency(summary.pledge_received_in_year),
      hint: "Received this year",
    },
    {
      label: "Committed",
      value: formatCurrency(summary.total_pledged),
      hint: "Active and fulfilled pledges",
    },
    {
      label: "Outstanding",
      value: formatCurrency(summary.outstanding_balance),
      hint: "Remaining pledge balance",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {cards.map((card) => (
        <KpiCard
          key={card.label}
          label={card.label}
          value={card.value}
          hint={card.hint}
        />
      ))}
    </div>
  );
}
