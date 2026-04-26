"use client";

import React, { useState } from "react";
import FamilyForm from "@/src/components/families/FamilyForm";
import FamilyManagementDashboard from "@/src/components/families/FamilyManagementDashboard";
import FamilyView from "@/src/components/families/FamilyView";
import Modal from "@/src/components/ui/Modal";
import ConfirmationModal from "@/src/components/ui/ConfirmationModal";
import AddFamilyMemberModal from "@/src/components/families/AddFamilyMemberModal";
import PersonDetailPanel from "@/src/components/people/PersonDetailPanel";
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
  const [isDesktop, setIsDesktop] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.innerWidth >= 1024;
  });
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelMode, setPanelMode] = useState<"view" | "edit" | "create">("view");
  const [panelFamily, setPanelFamily] = useState<Family | null>(null);
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

  React.useEffect(() => {
    const onResize = () => setIsDesktop(window.innerWidth >= 1024);
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const closeFamilyPanel = () => {
    setPanelOpen(false);
    setPanelMode("view");
    setPanelFamily(null);
    setViewFamily(null);
    setEditFamily(null);
    setFamilyViewMode("view");
  };

  const openFamilyInteraction = (
    mode: "view" | "edit" | "create",
    family?: Family | null
  ) => {
    if (isDesktop) {
      setPanelOpen(true);
      setPanelMode(mode);
      setPanelFamily(family || null);
      setIsModalOpen(false);

      if (mode === "view") {
        setViewFamily(family || null);
        setFamilyViewMode("view");
        setEditFamily(null);
      } else if (mode === "edit") {
        setEditFamily(family || null);
        setFamilyViewMode("edit");
        setViewFamily(family || null);
      } else {
        setViewFamily(null);
        setEditFamily(null);
        setFamilyViewMode("view");
      }
      return;
    }

    setIsModalOpen(true);
    if (mode === "view") {
      setViewFamily(family || null);
      setFamilyViewMode("view");
      setEditFamily(null);
    } else if (mode === "edit") {
      setEditFamily(family || null);
      setFamilyViewMode("edit");
      setViewFamily(family || null);
    } else {
      setViewFamily(null);
      setEditFamily(null);
      setFamilyViewMode("view");
    }
  };

  // Open create modal when parent triggers
  React.useEffect(() => {
    if (createTrigger && createTrigger > 0) {
      openFamilyInteraction("create");
    }
  }, [createTrigger, isDesktop]);

  const handleCreateFamily = async (familyData: Partial<Family>) => {
    try {
      await createFamily(familyData);
      if (isDesktop) {
        closeFamilyPanel();
      } else {
        setIsModalOpen(false);
      }
      setEditFamily(null);
    } catch (error) {
      console.error("Error creating family:", error);
      throw error;
    }
  };

  const handleUpdateFamily = async (familyData: Partial<Family>) => {
    if (!editFamily) return;
    try {
      const updatedFamily = await updateFamily(editFamily.id, familyData);
      await refreshFamilies();
      // If we are editing from view mode, return to view with updated data
      // Use the API response to avoid stale families list reads.
      if (updatedFamily) {
        setViewFamily(updatedFamily);
        setFamilyViewMode("view");
        setEditFamily(null);
        setPanelFamily(updatedFamily);
        if (isDesktop) {
          setPanelOpen(true);
          setPanelMode("view");
        } else {
          setIsModalOpen(true);
        }
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
        const updatedFamily = await updateFamily(addFamilyMemberModal.family.id, {
          members: memberIds,
        });

        await refreshFamilies();
        if (viewFamily && viewFamily.id === addFamilyMemberModal.family.id) {
          // Use API response to avoid stale families list reads.
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

  const renderFamilyFlow = (isPanel: boolean) => {
    if (viewFamily) {
      if (familyViewMode === "view") {
        return (
          <FamilyView
            family={viewFamily}
            familyMembers={peopleUI.filter((person) =>
              viewFamily.members.includes(person.id)
            )}
            showTopHeader={!isPanel}
            onEdit={() => {
              setEditFamily(viewFamily);
              setFamilyViewMode("edit");
              if (isPanel) {
                setPanelMode("edit");
              }
            }}
            onDelete={() => {
              setDeleteConfirmation({
                isOpen: true,
                family: viewFamily,
                loading: false,
              });
            }}
            onCancel={() => {
              if (isPanel) {
                closeFamilyPanel();
              } else {
                setIsModalOpen(false);
                setViewFamily(null);
                setFamilyViewMode("view");
              }
            }}
            onClose={() => {
              if (isPanel) {
                closeFamilyPanel();
              } else {
                setIsModalOpen(false);
                setViewFamily(null);
                setFamilyViewMode("view");
              }
            }}
            onAddMember={() => {
              setAddFamilyMemberModal({
                isOpen: true,
                family: viewFamily,
              });
            }}
          />
        );
      }

      return (
        <FamilyForm
          key={
            viewFamily?.id
              ? `family-edit-${viewFamily.id}`
              : `family-edit-${editFamily?.id || "none"}`
          }
          onSubmit={handleUpdateFamily}
          onClose={() => {
            setFamilyViewMode("view");
            setEditFamily(null);
            if (isPanel) {
              setPanelMode("view");
            }
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
          compactLayout={isPanel}
        />
      );
    }

    if (editFamily) {
      return (
        <FamilyForm
          key={`family-direct-edit-${editFamily.id}`}
          onSubmit={handleUpdateFamily}
          onClose={() => {
            if (isPanel) {
              closeFamilyPanel();
            } else {
              setIsModalOpen(false);
              setEditFamily(null);
            }
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
          compactLayout={isPanel}
        />
      );
    }

    return (
      <FamilyForm
        key="family-create"
        onSubmit={handleCreateFamily}
        onClose={() => {
          if (isPanel) {
            closeFamilyPanel();
          } else {
            setIsModalOpen(false);
          }
        }}
        initialData={undefined}
        availableMembers={peopleUI}
        compactLayout={isPanel}
      />
    );
  };

  return (
    <>
      <div
        className={
          panelOpen
            ? "lg:grid lg:grid-cols-[minmax(0,1fr)_500px] lg:gap-6 lg:items-start"
            : ""
        }
      >
        <FamilyManagementDashboard
          families={families}
          people={peopleUI}
          onCreateFamily={() => openFamilyInteraction("create")}
          onViewFamily={(family) => openFamilyInteraction("view", family)}
          onEditFamily={(family) => openFamilyInteraction("edit", family)}
          onDeleteFamily={(family) => {
            setDeleteConfirmation({
              isOpen: true,
              family,
              loading: false,
            });
          }}
        />
        {isDesktop && panelOpen && (
          <PersonDetailPanel
            isOpen={panelOpen}
            title={
              panelMode === "create"
                ? "Add New Family"
                : panelMode === "edit"
                ? "Edit Family"
                : "Family"
            }
            onClose={closeFamilyPanel}
          >
            {renderFamilyFlow(true)}
          </PersonDetailPanel>
        )}
      </div>

      <Modal
        isOpen={isModalOpen && !isDesktop}
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
        {renderFamilyFlow(false)}
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
