"use client";

import { Suspense, useCallback, useState } from "react";
import { usePeople } from "@/src/hooks/usePeople";
import { useFamilies } from "@/src/hooks/useFamilies";
import DashboardLayout from "@/src/components/layout/DashboardLayout";
import Button from "@/src/components/ui/Button";
import FamiliesTabContent from "@/src/components/families/FamiliesTabContent";

export default function FamiliesPage() {
  const [needPeopleCatalog, setNeedPeopleCatalog] = useState(false);
  const { people, peopleUI } = usePeople(needPeopleCatalog);
  const {
    createFamily,
    updateFamily,
    deleteFamily,
  } = useFamilies(false);
  const [createTrigger, setCreateTrigger] = useState(0);
  const [refetchKey, setRefetchKey] = useState(0);

  const bumpDirectory = useCallback(() => {
    setRefetchKey((n) => n + 1);
  }, []);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground">Families</h1>
          <Button
            onClick={() => {
              setNeedPeopleCatalog(true);
              setCreateTrigger((n) => n + 1);
            }}
          >
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
            peopleUI={peopleUI}
            people={people}
            createFamily={async (data) => {
              const created = await createFamily(data);
              bumpDirectory();
              return created;
            }}
            updateFamily={async (id, data) => {
              const updated = await updateFamily(id, data);
              bumpDirectory();
              return updated;
            }}
            deleteFamily={async (id) => {
              await deleteFamily(id);
              bumpDirectory();
            }}
            refreshFamilies={async () => {
              bumpDirectory();
            }}
            createTrigger={createTrigger}
            directoryRefetchKey={refetchKey}
            onNeedPeopleCatalog={() => setNeedPeopleCatalog(true)}
          />
        </Suspense>
      </div>
    </DashboardLayout>
  );
}
