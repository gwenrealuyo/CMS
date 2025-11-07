"use client";

import { Suspense, useState } from "react";
import { usePeople } from "@/src/hooks/usePeople";
import { useFamilies } from "@/src/hooks/useFamilies";
import DashboardLayout from "@/src/components/layout/DashboardLayout";
import Button from "@/src/components/ui/Button";
import FamiliesTabContent from "@/src/components/families/FamiliesTabContent";

export default function FamiliesPage() {
  const { people, peopleUI } = usePeople();
  const {
    families,
    createFamily,
    updateFamily,
    deleteFamily,
    refreshFamilies,
  } = useFamilies();
  const [createTrigger, setCreateTrigger] = useState(0);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-[#2D3748]">Families</h1>
          <Button onClick={() => setCreateTrigger((n) => n + 1)}>
            Add Family
          </Button>
        </div>

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
            createTrigger={createTrigger}
          />
        </Suspense>
      </div>
    </DashboardLayout>
  );
}
