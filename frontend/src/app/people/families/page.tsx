"use client";

import { Suspense } from "react";
import dynamic from "next/dynamic";
import { usePeople } from "@/src/hooks/usePeople";
import { useFamilies } from "@/src/hooks/useFamilies";

// Lazy load the families tab content
const FamiliesTabContent = dynamic(
  () => import("@/src/components/families/FamiliesTabContent"),
  { ssr: false }
);

export default function FamiliesPage() {
  const { people, peopleUI } = usePeople();
  const {
    families,
    createFamily,
    updateFamily,
    deleteFamily,
    refreshFamilies,
  } = useFamilies();

  return (
    <>
      <Suspense
        fallback={
          <div className="flex items-center justify-center py-12">
            <div className="text-gray-500">Loading...</div>
          </div>
        }
      >
        <FamiliesTabContent
          families={families}
          peopleUI={peopleUI}
          people={people}
          createFamily={createFamily}
          updateFamily={updateFamily}
          deleteFamily={deleteFamily}
          refreshFamilies={refreshFamilies}
        />
      </Suspense>
    </>
  );
}
