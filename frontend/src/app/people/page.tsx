"use client";

import { useState, useMemo } from "react";
import DashboardLayout from "@/src/components/layout/DashboardLayout";
import PersonForm from "@/src/components/people/PersonForm";
import PersonProfile from "@/src/components/people/PersonProfile";
import FamilyCard from "@/src/components/families/FamilyCard";
import FamilyForm from "@/src/components/families/FamilyForm";
import FamilyManagementDashboard from "@/src/components/families/FamilyManagementDashboard";
import Button from "@/src/components/ui/Button";
import Modal from "@/src/components/ui/Modal";
import ConfirmationModal from "@/src/components/ui/ConfirmationModal";
import FamilyView from "@/src/components/families/FamilyView";
import FilterBar, { FilterCondition } from "@/src/components/people/FilterBar";
import FilterDropdown from "@/src/components/people/FilterDropdown";
import FilterCard from "@/src/components/people/FilterCard";
import DataTable from "@/src/components/people/DataTable";
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
  const [bulkDeleteConfirmation, setBulkDeleteConfirmation] = useState<{
    isOpen: boolean;
    people: Person[];
    loading: boolean;
  }>({
    isOpen: false,
    people: [],
    loading: false,
  });
  // const [people, setPeople] = useState<Person[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilters, setActiveFilters] = useState<FilterCondition[]>([]);
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [showFilterCard, setShowFilterCard] = useState(false);
  const [selectedField, setSelectedField] = useState<any>(null);
  const [filterDropdownPosition, setFilterDropdownPosition] = useState({
    top: 0,
    left: 0,
  });
  const [filterCardPosition, setFilterCardPosition] = useState({
    top: 0,
    left: 0,
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

  const filteredPeopleUI = useMemo(() => {
    let filtered = peopleUI;

    // Apply active filters
    activeFilters.forEach((filter) => {
      filtered = filtered.filter((person) => {
        const fieldValue = person[filter.field as keyof PersonUI];

        switch (filter.operator) {
          case "is":
            return fieldValue === filter.value;
          case "is_not":
            return fieldValue !== filter.value;
          case "contains":
            return fieldValue
              ?.toString()
              .toLowerCase()
              .includes(filter.value.toString().toLowerCase());
          case "starts_with":
            return fieldValue
              ?.toString()
              .toLowerCase()
              .startsWith(filter.value.toString().toLowerCase());
          case "ends_with":
            return fieldValue
              ?.toString()
              .toLowerCase()
              .endsWith(filter.value.toString().toLowerCase());
          case "before":
            if (
              filter.field === "date_first_attended" ||
              filter.field === "birth_date"
            ) {
              return (
                new Date(fieldValue as string) <
                new Date(filter.value as string)
              );
            }
            return false;
          case "after":
            if (
              filter.field === "date_first_attended" ||
              filter.field === "birth_date"
            ) {
              return (
                new Date(fieldValue as string) >
                new Date(filter.value as string)
              );
            }
            return false;
          case "between":
            if (Array.isArray(filter.value)) {
              const [start, end] = filter.value;
              if (
                filter.field === "date_first_attended" ||
                filter.field === "birth_date"
              ) {
                const date = new Date(fieldValue as string);
                return date >= new Date(start) && date <= new Date(end);
              }
            }
            return false;
          case "greater_than":
            return Number(fieldValue) > Number(filter.value);
          case "less_than":
            return Number(fieldValue) < Number(filter.value);
          default:
            return true;
        }
      });
    });

    // Search query filter
    if (searchQuery) {
      filtered = filtered.filter(
        (person) =>
          person.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          person.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
          person.phone?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Filter out admin users and users without a name
    filtered = filtered.filter(
      (person) =>
        person.username !== "admin" && (person.first_name || person.last_name)
    );

    return filtered;
  }, [peopleUI, searchQuery, activeFilters]);

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

  const handleBulkDelete = async (people: Person[]) => {
    setBulkDeleteConfirmation({
      isOpen: true,
      people,
      loading: false,
    });
  };

  const confirmBulkDelete = async () => {
    if (!bulkDeleteConfirmation.people.length) return;

    try {
      setBulkDeleteConfirmation((prev) => ({ ...prev, loading: true }));
      await Promise.all(
        bulkDeleteConfirmation.people.map((person) => deletePerson(person.id))
      );
      setBulkDeleteConfirmation({
        isOpen: false,
        people: [],
        loading: false,
      });
    } catch (error) {
      console.error("Error deleting people:", error);
      alert("Failed to delete some people. Please try again.");
      setBulkDeleteConfirmation((prev) => ({ ...prev, loading: false }));
    }
  };

  const closeBulkDeleteConfirmation = () => {
    setBulkDeleteConfirmation({
      isOpen: false,
      people: [],
      loading: false,
    });
  };

  const handleBulkExport = (
    people: Person[],
    format: "excel" | "pdf" | "csv"
  ) => {
    // The export functionality is handled within DataTable component
    console.log(`Exporting ${people.length} people to ${format}`);
  };

  // Filter handlers
  const handleAddFilter = (anchorRect?: DOMRect) => {
    if (anchorRect) {
      const dropdownWidth = 256; // w-64 in FilterDropdown
      const viewportWidth = window.innerWidth + window.scrollX;
      const desiredLeft = Math.round(anchorRect.left + window.scrollX);
      const clampedLeft = Math.max(
        8,
        Math.min(desiredLeft, viewportWidth - dropdownWidth - 8)
      );
      setFilterDropdownPosition({
        top: Math.round(anchorRect.bottom + window.scrollY + 8),
        left: clampedLeft,
      });
    } else {
      setFilterDropdownPosition({ top: 200, left: 100 });
    }
    setShowFilterDropdown(true);
  };

  const handleSelectField = (field: any) => {
    setSelectedField(field);
    setShowFilterDropdown(false);

    // Position filter card
    const cardWidth = 320; // w-80 in FilterCard
    const viewportWidth = window.innerWidth + window.scrollX;
    const desiredLeft = filterDropdownPosition.left;
    const clampedLeft = Math.max(
      8,
      Math.min(desiredLeft, viewportWidth - cardWidth - 8)
    );
    setFilterCardPosition({
      top: filterDropdownPosition.top + 8,
      left: clampedLeft,
    });
    setShowFilterCard(true);
  };

  const handleApplyFilter = (filter: FilterCondition) => {
    setActiveFilters([...activeFilters, filter]);
    setShowFilterCard(false);
    setSelectedField(null);
  };

  const handleRemoveFilter = (filterId: string) => {
    setActiveFilters(activeFilters.filter((f) => f.id !== filterId));
  };

  const handleClearAllFilters = () => {
    setActiveFilters([]);
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
          <div className="space-y-6">
            <FilterBar
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              activeFilters={activeFilters}
              onRemoveFilter={handleRemoveFilter}
              onClearAllFilters={handleClearAllFilters}
              onAddFilter={handleAddFilter}
            />

            <DataTable
              people={filteredPeopleUI as unknown as Person[]}
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
              onBulkDelete={handleBulkDelete}
              onBulkExport={handleBulkExport}
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

      <ConfirmationModal
        isOpen={bulkDeleteConfirmation.isOpen}
        onClose={closeBulkDeleteConfirmation}
        onConfirm={confirmBulkDelete}
        title="Delete Selected People"
        message={`Are you sure you want to delete ${bulkDeleteConfirmation.people.length} selected people? This action cannot be undone and will permanently remove all selected people from the system.`}
        confirmText="Delete People"
        cancelText="Cancel"
        variant="danger"
        loading={bulkDeleteConfirmation.loading}
      />

      {/* Filter Dropdown */}
      <FilterDropdown
        isOpen={showFilterDropdown}
        onClose={() => setShowFilterDropdown(false)}
        onSelectField={handleSelectField}
        position={filterDropdownPosition}
      />

      {/* Filter Card */}
      {selectedField && (
        <FilterCard
          field={selectedField}
          isOpen={showFilterCard}
          onClose={() => {
            setShowFilterCard(false);
            setSelectedField(null);
          }}
          onApplyFilter={handleApplyFilter}
          position={filterCardPosition}
        />
      )}
    </DashboardLayout>
  );
}
