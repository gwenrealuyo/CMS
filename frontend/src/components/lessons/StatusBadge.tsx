interface StatusBadgeProps {
  label: string;
  count: number;
  colorClass: string;
}

export default function StatusBadge({ label, count, colorClass }: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${colorClass}`}
    >
      {label}: {count}
    </span>
  );
}


