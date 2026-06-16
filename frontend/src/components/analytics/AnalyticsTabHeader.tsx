"use client";

interface AnalyticsTabHeaderProps {
  title: string;
  description: string;
}

/** Page title and blurb for the active analytics tab. */
export default function AnalyticsTabHeader({
  title,
  description,
}: AnalyticsTabHeaderProps) {
  return (
    <div>
      <h2 className="text-xl font-semibold text-foreground md:text-2xl">
        {title}
      </h2>
      <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
        {description}
      </p>
    </div>
  );
}
