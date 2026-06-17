"use client";

import {
  BanknotesIcon,
  ChartBarIcon,
  CurrencyDollarIcon,
  GiftIcon,
  ScaleIcon,
} from "@heroicons/react/24/outline";
import KpiCard from "@/src/components/analytics/KpiCard";
import { kpiIcon } from "@/src/components/analytics/analyticsKpiIcons";
import {
  toneWhenPositiveIsBad,
  toneWhenZeroIsBad,
  type KpiValueTone,
} from "@/src/lib/kpiValueTone";
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
      valueTone: toneWhenZeroIsBad(summary.total_collected),
      hint: summary.includes_offerings
        ? "Donations, offerings, and pledge payments"
        : "Donations and pledge payments (branch view)",
      icon: kpiIcon(BanknotesIcon),
    },
    {
      label: "Donations",
      value: formatCurrency(summary.donation_total),
      valueTone: toneWhenZeroIsBad(summary.donation_total),
      hint: `${summary.donation_count} entries`,
      icon: kpiIcon(GiftIcon),
    },
    ...(summary.includes_offerings
      ? [
          {
            label: "Offerings",
            value: formatCurrency(summary.offering_total),
            valueTone: toneWhenZeroIsBad(summary.offering_total),
            hint: `${summary.offering_count} services`,
            icon: kpiIcon(CurrencyDollarIcon),
          },
        ]
      : []),
    {
      label: "Pledge Payments",
      value: formatCurrency(summary.pledge_received_in_year),
      valueTone: "default" as KpiValueTone,
      hint: "Received this year",
      icon: kpiIcon(ChartBarIcon),
    },
    {
      label: "Committed",
      value: formatCurrency(summary.total_pledged),
      valueTone: "default" as KpiValueTone,
      hint: "Active and fulfilled pledges",
      icon: kpiIcon(ScaleIcon),
    },
    {
      label: "Outstanding",
      value: formatCurrency(summary.outstanding_balance),
      valueTone: toneWhenPositiveIsBad(summary.outstanding_balance),
      hint: "Remaining pledge balance",
      icon: kpiIcon(ScaleIcon),
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {cards.map((card) => (
        <KpiCard
          key={card.label}
          label={card.label}
          value={card.value}
          valueTone={card.valueTone}
          hint={card.hint}
          icon={card.icon}
        />
      ))}
    </div>
  );
}
