import { useState, useEffect } from "react";
import { Person } from "@/src/types/person";
import { peopleApi } from "@/src/lib/api";

export const usePeople = () => {
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPeople = async () => {
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
  };

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
    fetchPeople();
  }, []);

  return {
    people,
    loading,
    error,
    createPerson,
    updatePerson,
    deletePerson,
    refreshPeople: fetchPeople,
  };
};
