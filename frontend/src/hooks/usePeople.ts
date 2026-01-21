import { useState, useEffect, useCallback } from "react";
import { Person, PersonUI } from "@/src/types/person";
import { peopleApi } from "@/src/lib/api";

export const usePeople = (enabled: boolean = true) => {
  const [people, setPeople] = useState<Person[]>([]);
  const peopleUI: PersonUI[] = people.map((p) => ({
    ...p,
    name: `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim(),
    dateFirstAttended: p.date_first_attended,
  }));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPeople = useCallback(async () => {
    if (!enabled) {
      return;
    }
    try {
      setLoading(true);
      const response = await peopleApi.getAll();
      setPeople(response.data);
      setError(null);
    } catch (err) {
      setError("Failed to fetch people");
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  const createPerson = async (personData: Partial<Person>) => {
    try {
      const response = await peopleApi.create(personData);
      setPeople((prev) => [...prev, response.data]);
      return response.data;
    } catch (err) {
      throw new Error("Failed to create person");
    }
  };

  const updatePerson = async (id: string, personData: Partial<Person>) => {
    try {
      const response = await peopleApi.update(id, personData);
      setPeople((prev) => prev.map((p) => (p.id === id ? response.data : p)));
      return response.data;
    } catch (err) {
      throw new Error("Failed to update person");
    }
  };

  const deletePerson = async (id: string) => {
    try {
      await peopleApi.delete(id);
      setPeople((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      throw new Error("Failed to delete person");
    }
  };

  useEffect(() => {
    if (!enabled) {
      setPeople([]);
      setError(null);
      setLoading(false);
      return;
    }
    fetchPeople();
  }, [enabled, fetchPeople]);

  return {
    people,
    peopleUI,
    loading,
    error,
    createPerson,
    updatePerson,
    deletePerson,
    refreshPeople: fetchPeople,
  };
};
