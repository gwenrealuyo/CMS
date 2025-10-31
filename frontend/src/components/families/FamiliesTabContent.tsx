"use client";

import React, { useState } from "react";
import FamilyForm from "@/src/components/families/FamilyForm";
import FamilyManagementDashboard from "@/src/components/families/FamilyManagementDashboard";
import FamilyView from "@/src/components/families/FamilyView";
import Modal from "@/src/components/ui/Modal";
import ConfirmationModal from "@/src/components/ui/ConfirmationModal";
import AddFamilyMemberModal from "@/src/components/families/AddFamilyMemberModal";
import { PersonUI, Family, Person } from "@/src/types/person";

interface FamiliesTabContentProps {
  families: Family[];
  peopleUI: PersonUI[];
  people: Person[];
  createFamily: (data: any) => Promise<any>;
  updateFamily: (id: string, data: any) => Promise<any>;
  deleteFamily: (id: string) => Promise<void>;
  refreshFamilies: () => Promise<void>;
  createTrigger?: number; // when incremented, open create modal
}

export default function FamiliesTabContent({
  families,
  peopleUI,
  people,
  createFamily,
  updateFamily,
  deleteFamily,
  refreshFamilies,
  createTrigger,
}: FamiliesTabContentProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
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
  const [addFamilyMemberModal, setAddFamilyMemberModal] = useState<{
    isOpen: boolean;
    family: Family | null;
  }>({
    isOpen: false,
    family: null,
  });

  // Open create modal when parent triggers
  React.useEffect(() => {
    if (createTrigger && createTrigger > 0) {
      setViewFamily(null);
      setEditFamily(null);
      setFamilyViewMode("view");
      setIsModalOpen(true);
    }
  }, [createTrigger]);

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
      await refreshFamilies();
      // If we are editing from view mode, return to view with updated data
      const updated = families.find((f: Family) => f.id === editFamily.id);
      if (updated) {
        setViewFamily(updated);
        setFamilyViewMode("view");
        setEditFamily(null);
        setIsModalOpen(true);
      } else {
        // Fallback: keep modal open in view mode
        setFamilyViewMode("view");
        setEditFamily(null);
      }
    } catch (error) {
      console.error("Error updating family:", error);
      throw error;
    }
  };

  const handleDeleteFamily = async () => {
    if (!deleteConfirmation.family) return;

    try {
      setDeleteConfirmation((prev) => ({ ...prev, loading: true }));
      await deleteFamily(deleteConfirmation.family!.id);
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

  const handleAddFamilyMembers = async (memberIds: string[]) => {
    if (addFamilyMemberModal.family) {
      try {
        await updateFamily(addFamilyMemberModal.family.id, {
          members: memberIds,
        });

        await refreshFamilies();
        if (viewFamily && viewFamily.id === addFamilyMemberModal.family.id) {
          const updatedFamily = families.find(
            (f: Family) => f.id === viewFamily.id
          );
          if (updatedFamily) {
            setViewFamily(updatedFamily);
          }
        }

        setAddFamilyMemberModal({ isOpen: false, family: null });
      } catch (error) {
        console.error("Error adding family members:", error);
        alert("Failed to add family members. Please try again.");
      }
    }
  };

  return (
    <>
      <FamilyManagementDashboard
        families={families}
        people={peopleUI}
        onCreateFamily={() => {
          setIsModalOpen(true);
        }}
        onViewFamily={(family) => {
          setViewFamily(family);
          setFamilyViewMode("view");
          setIsModalOpen(true);
        }}
        onEditFamily={(family) => {
          setEditFamily(family);
          setFamilyViewMode("edit");
          setIsModalOpen(true);
        }}
        onDeleteFamily={(family) => {
          setDeleteConfirmation({
            isOpen: true,
            family,
            loading: false,
          });
        }}
      />

      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditFamily(null);
          setViewFamily(null);
          setFamilyViewMode("view");
        }}
        title={
          viewFamily
            ? familyViewMode === "view"
              ? ""
              : "Edit Family"
            : editFamily
            ? `Edit Family`
            : `Add New Family`
        }
        hideHeader={!!(viewFamily && familyViewMode === "view")}
      >
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
              onCancel={() => {
                setIsModalOpen(false);
                setViewFamily(null);
                setFamilyViewMode("view");
              }}
              onClose={() => {
                setIsModalOpen(false);
                setViewFamily(null);
                setFamilyViewMode("view");
              }}
              onAddMember={() => {
                setAddFamilyMemberModal({
                  isOpen: true,
                  family: viewFamily,
                });
              }}
            />
          ) : (
            <FamilyForm
              onSubmit={handleUpdateFamily}
              onClose={() => {
                setFamilyViewMode("view");
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

      {addFamilyMemberModal.family && (
        <AddFamilyMemberModal
          family={addFamilyMemberModal.family}
          peopleUI={peopleUI}
          isOpen={addFamilyMemberModal.isOpen}
          onClose={() =>
            setAddFamilyMemberModal({ isOpen: false, family: null })
          }
          onAddMembers={handleAddFamilyMembers}
        />
      )}
    </>
  );
}
