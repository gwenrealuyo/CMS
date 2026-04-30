import { Suspense } from "react";
import LoadingSpinner from "@/src/components/ui/LoadingSpinner";

export default function EvangelismLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-24">
          <LoadingSpinner />
        </div>
      }
    >
      {children}
    </Suspense>
  );
}
