import { useState, useEffect, useCallback } from "react";
import { Person, PersonUI } from "@/src/types/person";
import { peopleApi, PeopleListParams } from "@/src/lib/api";
import { formatPersonName } from "@/src/lib/name";

export const usePeople = (
  enabled: boolean = true,
  params?: PeopleListParams,
) => {
  const [people, setPeople] = useState<Person[]>([]);
  const peopleUI: PersonUI[] = people.map((p) => ({
    ...p,
    name: formatPersonName(p),
    dateFirstAttended: p.date_first_attended,
  }));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const paramsKey = JSON.stringify(params ?? {});

  const fetchPeople = useCallback(async () => {
    if (!enabled) {
      return;
    }
    try {
      setLoading(true);
      const listParams: PeopleListParams = paramsKey
        ? JSON.parse(paramsKey)
        : {};
      const response = await peopleApi.getAll(listParams);
      setPeople(response.data);
      setError(null);
    } catch (err) {
      setError("Failed to fetch people");
    } finally {
      setLoading(false);
    }
  }, [enabled, paramsKey]);

  const createPerson = async (personData: Partial<Person> | FormData) => {
    const response = await peopleApi.create(personData);
    setPeople((prev) => [...prev, response.data]);
    return response.data;
  };

  const updatePerson = async (id: string, personData: Partial<Person> | FormData) => {
    const response = await peopleApi.update(id, personData);
    setPeople((prev) => prev.map((p) => (p.id === id ? response.data : p)));
    return response.data;
  };

  const deletePerson = async (id: string) => {
    await peopleApi.delete(id);
    setPeople((prev) => prev.filter((p) => p.id !== id));
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
