"use client";

import DashboardLayout from "@/src/components/layout/DashboardLayout";
import ProtectedRoute from "@/src/components/auth/ProtectedRoute";
import FaqAccordion from "@/src/components/faq/FaqAccordion";
import { faqCategories } from "@/src/data/faqContent";

export default function FaqPage() {
  return (
    <ProtectedRoute>
      <FaqPageContent />
    </ProtectedRoute>
  );
}

function FaqPageContent() {
  return (
    <DashboardLayout>
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Frequently asked questions
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Quick answers about signing in, access, people, clusters, and more.
          </p>
        </div>

        {faqCategories.map((category) => (
          <section key={category.id} className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold text-foreground">
              {category.title}
            </h2>
            <FaqAccordion items={category.items} />
          </section>
        ))}
      </div>
    </DashboardLayout>
  );
}
