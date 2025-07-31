"use client";

import { useState, useMemo } from "react";
import DashboardLayout from "@/src/components/layout/DashboardLayout";
import PersonForm from "@/src/components/people/PersonForm";
import PeopleTable from "@/src/components/people/PeopleTable";
import FamilyCard from "@/src/components/families/FamilyCard";
import FamilyForm from "@/src/components/families/FamilyForm";
import SearchBar from "@/src/components/people/SearchBar";
import FilterOptions, {
  FilterState,
} from "@/src/components/people/FilterOptions";
import Button from "@/src/components/ui/Button";
import Modal from "@/src/components/ui/Modal";
import { Person, Family } from "@/src/types/person";
import { usePeople } from "@/src/hooks/usePeople";

export default function PeoplePage() {
  const [activeTab, setActiveTab] = useState<"people" | "families">("people");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState<"person" | "family">("person");
  // const [people, setPeople] = useState<Person[]>([]);
  const [families, setFamilies] = useState<Family[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState<FilterState>({
    role: "",
    dateRange: "",
  });

  const { people, createPerson, deletePerson, updatePerson, refreshPeople } =
    usePeople();

  // const filteredPeople = useMemo(() => {
  //   return people.filter((person) => {
  //     const searchMatch =
  //       searchQuery === "" ||
  //       person.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
  //       person.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
  //       person.phone?.includes(searchQuery);

  //     const roleMatch = !filters.role || person.role === filters.role;

  //     let dateMatch = true;
  //     if (filters.dateRange) {
  //       const now = new Date();
  //       const dateFirstAttended = new Date(person.date_first_attended);
  //       const diffTime = Math.abs(now.getTime() - dateFirstAttended.getTime());
  //       const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  //       switch (filters.dateRange) {
  //         case "week":
  //           dateMatch = diffDays <= 7;
  //           break;
  //         case "month":
  //           dateMatch = diffDays <= 30;
  //           break;
  //         case "year":
  //           dateMatch = diffDays <= 365;
  //           break;
  //       }
  //     }

  //     return searchMatch && roleMatch && dateMatch;
  //   });
  // }, [people, searchQuery, filters]);

  // const handleCreatePerson = (personData: Partial<Person>) => {
  //   const newPerson = {
  //     ...personData,
  //     id: Date.now().toString(),
  //     dateFirstAttended: new Date(),
  //     milestones: [],
  //   } as Person;
  //   setPeople([...people, newPerson]);
  //   setIsModalOpen(false);
  // };

  const handleCreatePerson = async (personData: Partial<Person>) => {
    try {
      await createPerson(personData);
      setIsModalOpen(false);
    } catch (err) {
      console.error(err);
      alert("Failed to save person.");
    }
  };

  const handleCreateFamily = (familyData: Partial<Family>) => {
    const newFamily = {
      ...familyData,
      id: Date.now().toString(),
    } as Family;
    setFamilies([...families, newFamily]);
    setIsModalOpen(false);
  };

  const getPeopleForFamily = (family: Family) => {
    return people.filter((person) => family.members.includes(person.id));
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div className="flex space-x-4">
            <button
              className={`px-4 py-2 font-medium rounded-md ${
                activeTab === "people"
                  ? "bg-[#2563EB] text-white"
                  : "text-gray-600 hover:text-gray-900"
              }`}
              onClick={() => setActiveTab("people")}
            >
              People
            </button>
            <button
              className={`px-4 py-2 font-medium rounded-md ${
                activeTab === "families"
                  ? "bg-[#2563EB] text-white"
                  : "text-gray-600 hover:text-gray-900"
              }`}
              onClick={() => setActiveTab("families")}
            >
              Families
            </button>
          </div>
          <Button
            onClick={() => {
              setModalType(activeTab === "people" ? "person" : "family");
              setIsModalOpen(true);
            }}
          >
            Add {activeTab === "people" ? "Person" : "Family"}
          </Button>
        </div>

        {activeTab === "people" && (
          <div className="space-y-4">
            <div className="flex gap-4">
              <SearchBar value={searchQuery} onChange={setSearchQuery} />
              <FilterOptions filters={filters} onFilterChange={setFilters} />
            </div>
            <PeopleTable people={people} />
          </div>
        )}

        {activeTab === "families" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {families.map((family) => (
              <FamilyCard
                key={family.id}
                family={family}
                members={getPeopleForFamily(family)}
                onEdit={() => {}}
                onDelete={() => {
                  setFamilies(families.filter((f) => f.id !== family.id));
                }}
              />
            ))}
          </div>
        )}
      </div>
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={`Add New ${modalType === "person" ? "Person" : "Family"}`}
      >
        {modalType === "person" ? (
          <PersonForm
            onSubmit={handleCreatePerson}
            onClose={() => setIsModalOpen(false)}
          />
        ) : (
          <FamilyForm onSubmit={handleCreateFamily} availableMembers={people} />
        )}
      </Modal>
    </DashboardLayout>
  );
}
