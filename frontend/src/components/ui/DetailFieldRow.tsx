import { ReactNode } from "react";

interface DetailFieldRowProps {
  label: string;
  value?: string | number | null;
  fallback?: string;
  renderAsBadge?: boolean;
  badgeClassName?: string;
  valueNode?: ReactNode;
}

export default function DetailFieldRow({
  label,
  value,
  fallback = "Not specified",
  renderAsBadge = false,
  badgeClassName = "",
  valueNode,
}: DetailFieldRowProps) {
  const isMissing =
    value === null ||
    value === undefined ||
    (typeof value === "string" && value.trim() === "");
  const displayValue = isMissing ? fallback : value;

  return (
    <div className="flex flex-col gap-0.5 py-2 md:flex-row md:items-start md:justify-between md:gap-3">
      <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">
        {label}
      </dt>
      <dd className="w-full break-words text-left md:w-auto md:max-w-[65%] md:text-right">
        {valueNode ? (
          valueNode
        ) : renderAsBadge && !isMissing ? (
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${badgeClassName}`}
          >
            {displayValue}
          </span>
        ) : (
          <span
            className={`text-sm ${
              isMissing ? "font-medium text-red-600" : "text-gray-800"
            }`}
          >
            {displayValue}
          </span>
        )}
      </dd>
    </div>
  );
}
