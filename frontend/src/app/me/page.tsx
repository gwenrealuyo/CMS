"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/src/contexts/AuthContext";
import DashboardLayout from "@/src/components/layout/DashboardLayout";
import ProtectedRoute from "@/src/components/auth/ProtectedRoute";
import PersonProfile from "@/src/components/people/PersonProfile";
import PersonForm from "@/src/components/people/PersonForm";
import { Person } from "@/src/types/person";
import { Cluster } from "@/src/types/cluster";
import { clustersApi, journeysApi, peopleApi } from "@/src/lib/api";
import { usePeople } from "@/src/hooks/usePeople";
import { useFamilies } from "@/src/hooks/useFamilies";

export default function MePage() {
  return (
    <ProtectedRoute>
      <MePageContent />
    </ProtectedRoute>
  );
}

function MePageContent() {
  const { user } = useAuth();
  const router = useRouter();
  const { people, updatePerson } = usePeople(true);
  const { families } = useFamilies();

  const [person, setPerson] = useState<Person | null>(null);
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [viewMode, setViewMode] = useState<"view" | "edit">("view");
  const [startOnTimelineTab, setStartOnTimelineTab] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.role) return;
    if (user.role === "VISITOR") {
      router.replace("/profile");
    }
  }, [user?.role, router]);

  const loadData = useCallback(async () => {
    if (!user?.id || user.role === "VISITOR") return;
    setLoading(true);
    setError(null);
    try {
      const personId = String(user.id);
      const [personRes, journeysRes, clustersRes] = await Promise.all([
        peopleApi.getById(personId),
        journeysApi.getByUser(personId),
        clustersApi.getAll(),
      ]);
      setPerson({
        ...personRes.data,
        journeys: journeysRes.data,
      });
      setClusters(clustersRes.data as unknown as Cluster[]);
    } catch {
      setError("Failed to load your record.");
      setPerson(null);
    } finally {
      setLoading(false);
    }
  }, [user?.id, user?.role]);

  useEffect(() => {
    if (!user?.id || user.role === "VISITOR") return;
    loadData();
  }, [user?.id, user?.role, loadData]);

  const refreshPersonJourneys = async (personId: string) => {
    try {
      const [personResponse, journeysResponse] = await Promise.all([
        peopleApi.getById(personId),
        journeysApi.getByUser(personId),
      ]);
      setPerson({
        ...personResponse.data,
        journeys: journeysResponse.data,
      });
    } catch (e) {
      console.error("Failed to refresh person data:", e);
    }
  };

  if (!user) {
    return null;
  }

  if (user.role === "VISITOR") {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-12 text-gray-600">
          Redirecting…
        </div>
      </DashboardLayout>
    );
  }

  const isMember = user.role === "MEMBER";
  const canManageAssignments =
    user.role === "COORDINATOR" ||
    user.role === "PASTOR" ||
    user.role === "ADMIN";

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-4 px-2 sm:px-0">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <h1 className="text-2xl font-bold text-[#2D3748]">My record</h1>
          <Link
            href="/profile"
            className="text-sm font-medium text-blue-600 hover:text-blue-700"
          >
            Account settings
          </Link>
        </div>
        {isMember && (
          <p className="text-sm text-gray-600">
            To update your name, email, or photo, use Account settings. Other
            details may be updated by church staff.
          </p>
        )}
        {loading && (
          <div className="text-gray-600 py-8 text-center">Loading…</div>
        )}
        {error && !loading && (
          <div className="rounded-lg border border-red-200 bg-red-50 text-red-800 px-4 py-3 text-sm space-y-2">
            <p>{error}</p>
            <button
              type="button"
              className="text-sm font-medium underline"
              onClick={() => loadData()}
            >
              Try again
            </button>
          </div>
        )}
        {!loading && !error && person && viewMode === "view" && (
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            <PersonProfile
              person={person}
              clusters={clusters}
              families={families}
              hideDeleteButton
              hideEditButton={isMember}
              showTopHeader
              onViewFamily={() => router.push("/people/families")}
              onViewCluster={() => router.push("/clusters")}
              onNoFamilyClick={
                canManageAssignments ? () => router.push("/people") : undefined
              }
              onNoClusterClick={
                canManageAssignments ? () => router.push("/people") : undefined
              }
              onEdit={() => {
                setStartOnTimelineTab(false);
                setViewMode("edit");
              }}
              onDelete={() => {}}
              onCancel={() => router.push("/dashboard")}
              onAddTimeline={() => {
                setStartOnTimelineTab(true);
                setViewMode("edit");
              }}
              onClose={() => router.push("/dashboard")}
            />
          </div>
        )}
        {!loading && !error && person && viewMode === "edit" && (
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            <PersonForm
              initialData={person}
              isEditingFromProfile
              startOnTimelineTab={startOnTimelineTab}
              panelLayout={false}
              peopleOptions={people}
              onJourneySaved={(personId) => refreshPersonJourneys(personId)}
              onClose={() => {
                setViewMode("view");
                setStartOnTimelineTab(false);
              }}
              onBackToProfile={() => {
                setViewMode("view");
                setStartOnTimelineTab(false);
              }}
              onSubmit={async (data) => {
                const result = await updatePerson(person.id, data);
                setViewMode("view");
                setStartOnTimelineTab(false);
                await refreshPersonJourneys(String(person.id));
                return result;
              }}
            />
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
