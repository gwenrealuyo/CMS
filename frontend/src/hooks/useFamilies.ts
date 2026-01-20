import { useState, useEffect } from "react";
import { Family } from "@/src/types/person";
import { familiesApi } from "@/src/lib/api";

export function useFamilies() {
  const [families, setFamilies] = useState<Family[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshFamilies = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await familiesApi.getAll();
      setFamilies(response.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch families");
      console.error("Error fetching families:", err);
    } finally {
      setLoading(false);
    }
  };

  const createFamily = async (data: Partial<Family>) => {
    try {
      const response = await familiesApi.create(data);
      setFamilies((prev) => [...prev, response.data]);
      return response.data;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create family");
      console.error("Error creating family:", err);
      throw err;
    }
  };

  const updateFamily = async (id: string, data: Partial<Family>) => {
    try {
      // Use PATCH for partial updates instead of PUT which requires all fields
      const response = await familiesApi.patch(id, data);
      setFamilies((prev) =>
        prev.map((family) => (family.id === id ? response.data : family))
      );
      return response.data;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update family");
      console.error("Error updating family:", err);
      throw err;
    }
  };

  const deleteFamily = async (id: string) => {
    try {
      await familiesApi.delete(id);
      setFamilies((prev) => prev.filter((family) => family.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete family");
      console.error("Error deleting family:", err);
      throw err;
    }
  };

  const addMemberToFamily = async (familyId: string, memberId: string) => {
    try {
      await familiesApi.addMember(familyId, memberId);
      setFamilies((prev) =>
        prev.map((family) =>
          family.id === familyId
            ? { ...family, members: [...family.members, memberId] }
            : family
        )
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to add member to family"
      );
      console.error("Error adding member to family:", err);
      throw err;
    }
  };

  const removeMemberFromFamily = async (familyId: string, memberId: string) => {
    try {
      await familiesApi.removeMember(familyId, memberId);
      setFamilies((prev) =>
        prev.map((family) =>
          family.id === familyId
            ? {
                ...family,
                members: family.members.filter((id) => id !== memberId),
              }
            : family
        )
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to remove member from family"
      );
      console.error("Error removing member from family:", err);
      throw err;
    }
  };

  useEffect(() => {
    refreshFamilies();
  }, []);

  return {
    families,
    loading,
    error,
    refreshFamilies,
    createFamily,
    updateFamily,
    deleteFamily,
    addMemberToFamily,
    removeMemberFromFamily,
  };
}

