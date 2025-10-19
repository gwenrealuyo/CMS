"use client";

import { useState, useMemo } from "react";
import DashboardLayout from "@/src/components/layout/DashboardLayout";
import PersonForm from "@/src/components/people/PersonForm";
import PersonProfile from "@/src/components/people/PersonProfile";
import PeopleTable from "@/src/components/people/PeopleTable";
import FamilyCard from "@/src/components/families/FamilyCard";
import FamilyForm from "@/src/components/families/FamilyForm";
import FamilyManagementDashboard from "@/src/components/families/FamilyManagementDashboard";
import SearchBar from "@/src/components/people/SearchBar";
import FilterOptions, {
  FilterState,
} from "@/src/components/people/FilterOptions";
import Button from "@/src/components/ui/Button";
import Modal from "@/src/components/ui/Modal";
import ConfirmationModal from "@/src/components/ui/ConfirmationModal";
import FamilyView from "@/src/components/families/FamilyView";
import { Person, PersonUI, Family } from "@/src/types/person";
import { usePeople } from "@/src/hooks/usePeople";
import { useFamilies } from "@/src/hooks/useFamilies";

export default function PeoplePage() {
  const [activeTab, setActiveTab] = useState<"people" | "families">("people");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState<"person" | "family">("person");
  const [viewEditPerson, setViewEditPerson] = useState<Person | null>(null);
  const [viewMode, setViewMode] = useState<"view" | "edit">("view");
  const [startOnTimelineTab, setStartOnTimelineTab] = useState(false);
  const [editFamily, setEditFamily] = useState<Family | null>(null);
  const [viewFamily, setViewFamily] = useState<Family | null>(null);
  const [familyViewMode, setFamilyViewMode] = useState<"view" | "edit">("view");
  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    isOpen: boolean;
    family: Family | null;
    loading: boolean;
  }>({
    isOpen: false,
    family: null,
    loading: false,
  });
  // const [people, setPeople] = useState<Person[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState<FilterState>({
    role: "",
    dateRange: "",
  });

  const {
    people,
    peopleUI,
    createPerson,
    deletePerson,
    updatePerson,
    refreshPeople,
  } = usePeople();

  const {
    families,
    createFamily,
    updateFamily,
    deleteFamily,
    refreshFamilies,
  } = useFamilies();

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
      const result = await createPerson(personData);
      setIsModalOpen(false);
      return result; // Return the created person for milestone handling
    } catch (err) {
      console.error(err);
      alert("Failed to save person.");
      throw err;
    }
  };

  const handleCreateFamily = async (familyData: Partial<Family>) => {
    try {
      await createFamily(familyData);
      setIsModalOpen(false);
      setEditFamily(null);
    } catch (error) {
      console.error("Error creating family:", error);
      throw error;
    }
  };

  const handleUpdateFamily = async (familyData: Partial<Family>) => {
    if (!editFamily) return;
    try {
      await updateFamily(editFamily.id, familyData);
      setIsModalOpen(false);
      setEditFamily(null);
    } catch (error) {
      console.error("Error updating family:", error);
      throw error;
    }
  };

  const handleDeleteFamily = async () => {
    if (!deleteConfirmation.family) return;

    try {
      setDeleteConfirmation((prev) => ({ ...prev, loading: true }));
      await deleteFamily(deleteConfirmation.family.id);
      setDeleteConfirmation({
        isOpen: false,
        family: null,
        loading: false,
      });
    } catch (error) {
      console.error("Error deleting family:", error);
      alert("Failed to delete family. Please try again.");
      setDeleteConfirmation((prev) => ({ ...prev, loading: false }));
    }
  };

  const closeDeleteConfirmation = () => {
    setDeleteConfirmation({
      isOpen: false,
      family: null,
      loading: false,
    });
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
            <PeopleTable
              people={peopleUI as unknown as Person[]}
              onView={(p) => {
                setViewEditPerson(p);
                setViewMode("view");
                setIsModalOpen(true);
                setModalType("person");
              }}
              onEdit={(p) => {
                setViewEditPerson(p);
                setViewMode("edit");
                setIsModalOpen(true);
                setModalType("person");
              }}
              onDelete={async (p) => {
                if (confirm(`Delete ${p.username}?`)) {
                  await deletePerson(p.id);
                }
              }}
            />
          </div>
        )}

        {activeTab === "families" && (
          <FamilyManagementDashboard
            families={families}
            people={peopleUI}
            onCreateFamily={() => {
              setModalType("family");
              setIsModalOpen(true);
            }}
            onViewFamily={(family) => {
              setViewFamily(family);
              setFamilyViewMode("view");
              setModalType("family");
              setIsModalOpen(true);
            }}
            onEditFamily={(family) => {
              setEditFamily(family);
              setFamilyViewMode("edit");
              setModalType("family");
              setIsModalOpen(true);
            }}
            onDeleteFamily={(family) => {
              setDeleteConfirmation({
                isOpen: true,
                family,
                loading: false,
              });
            }}
            onAssignMember={(personId, familyId) => {
              // TODO: Implement assign member functionality
              console.log("Assign member:", personId, "to family:", familyId);
            }}
            onRemoveMember={(personId, familyId) => {
              // TODO: Implement remove member functionality
              console.log("Remove member:", personId, "from family:", familyId);
            }}
          />
        )}
      </div>
      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setViewEditPerson(null);
          setEditFamily(null);
          setViewFamily(null);
          setFamilyViewMode("view");
          setStartOnTimelineTab(false);
        }}
        title={
          viewEditPerson
            ? `${viewMode === "view" ? "View Profile" : "Edit Profile"} (${
                viewEditPerson.first_name
              } ${viewEditPerson.last_name})`
            : viewFamily
            ? `View Family (${viewFamily.name})`
            : editFamily
            ? `Edit Family (${editFamily.name})`
            : `Add New ${modalType === "person" ? "Person" : "Family"}`
        }
      >
        {modalType === "person" ? (
          <>
            {viewEditPerson ? (
              viewMode === "view" ? (
                <PersonProfile
                  person={viewEditPerson}
                  onEdit={() => {
                    setViewMode("edit");
                  }}
                  onAddTimeline={() => {
                    setViewMode("edit");
                    setStartOnTimelineTab(true);
                  }}
                  onClose={() => {
                    setIsModalOpen(false);
                    setViewEditPerson(null);
                  }}
                />
              ) : (
                <PersonForm
                  initialData={viewEditPerson}
                  isEditingFromProfile={true}
                  startOnTimelineTab={startOnTimelineTab}
                  onSubmit={async (data) => {
                    const result = await updatePerson(viewEditPerson.id, data);
                    setIsModalOpen(false);
                    setViewEditPerson(null);
                    setStartOnTimelineTab(false);
                    return result; // Return for milestone handling
                  }}
                  onClose={() => {
                    setIsModalOpen(false);
                    setViewEditPerson(null);
                    setStartOnTimelineTab(false);
                  }}
                  onBackToProfile={() => {
                    setViewMode("view");
                    setStartOnTimelineTab(false);
                  }}
                />
              )
            ) : (
              <PersonForm
                onSubmit={handleCreatePerson}
                onClose={() => setIsModalOpen(false)}
              />
            )}
          </>
        ) : (
          <>
            {viewFamily ? (
              familyViewMode === "view" ? (
                <FamilyView
                  family={viewFamily}
                  familyMembers={peopleUI.filter((person) =>
                    viewFamily.members.includes(person.id)
                  )}
                  onEdit={() => {
                    setEditFamily(viewFamily);
                    setFamilyViewMode("edit");
                  }}
                  onDelete={() => {
                    setDeleteConfirmation({
                      isOpen: true,
                      family: viewFamily,
                      loading: false,
                    });
                  }}
                  onClose={() => {
                    setIsModalOpen(false);
                    setViewFamily(null);
                    setFamilyViewMode("view");
                  }}
                />
              ) : (
                <FamilyForm
                  onSubmit={handleUpdateFamily}
                  onClose={() => {
                    setIsModalOpen(false);
                    setEditFamily(null);
                    setViewFamily(null);
                    setFamilyViewMode("view");
                  }}
                  onDelete={(family) => {
                    setDeleteConfirmation({
                      isOpen: true,
                      family,
                      loading: false,
                    });
                  }}
                  initialData={editFamily || undefined}
                  availableMembers={peopleUI}
                  showDeleteButton={false}
                />
              )
            ) : editFamily ? (
              <FamilyForm
                onSubmit={handleUpdateFamily}
                onClose={() => {
                  setIsModalOpen(false);
                  setEditFamily(null);
                }}
                onDelete={(family) => {
                  setDeleteConfirmation({
                    isOpen: true,
                    family,
                    loading: false,
                  });
                }}
                initialData={editFamily || undefined}
                availableMembers={peopleUI}
                showDeleteButton={false}
              />
            ) : (
              <FamilyForm
                onSubmit={handleCreateFamily}
                onClose={() => setIsModalOpen(false)}
                initialData={undefined}
                availableMembers={peopleUI}
              />
            )}
          </>
        )}
      </Modal>

      <ConfirmationModal
        isOpen={deleteConfirmation.isOpen}
        onClose={closeDeleteConfirmation}
        onConfirm={handleDeleteFamily}
        title="Delete Family"
        message={`Are you sure you want to delete the "${deleteConfirmation.family?.name}" family? This action cannot be undone and will remove all family members from this family.`}
        confirmText="Delete Family"
        cancelText="Cancel"
        variant="danger"
        loading={deleteConfirmation.loading}
      />
    </DashboardLayout>
  );
}
