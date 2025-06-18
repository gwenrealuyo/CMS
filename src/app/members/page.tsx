"use client";

import { useState } from "react";
import DashboardLayout from "@/src/components/layout/DashboardLayout";
import MemberForm from "@/src/components/members/MemberForm";
import MemberCard from "@/src/components/members/MemberCard";
import FamilyCard from "@/src/components/families/FamilyCard";
import FamilyForm from "@/src/components/families/FamilyForm";
import Button from "@/src/components/ui/Button";
import Modal from "@/src/components/ui/Modal";
import { Person, Family } from "@/src/types/person";

export default function MembersPage() {
  const [activeTab, setActiveTab] = useState<"members" | "families">("members");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState<"member" | "family">("member");
  const [members, setMembers] = useState<Person[]>([]);
  const [families, setFamilies] = useState<Family[]>([]);

  const handleCreateMember = (memberData: Partial<Person>) => {
    const newMember = {
      ...memberData,
      id: Date.now().toString(),
      joinDate: new Date(),
      milestones: [],
    } as Person;
    setMembers([...members, newMember]);
    setIsModalOpen(false);
  };

  const handleCreateFamily = (familyData: Partial<Family>) => {
    const newFamily = {
      ...familyData,
      id: Date.now().toString(),
    } as Family;
    setFamilies([...families, newFamily]);
    setIsModalOpen(false);
  };

  const getMembersForFamily = (family: Family) => {
    return members.filter((member) => family.members.includes(member.id));
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div className="space-x-4">
            <button
              className={`px-4 py-2 font-medium rounded-md ${
                activeTab === "members"
                  ? "bg-[#805AD5] text-white"
                  : "text-gray-600 hover:text-gray-900"
              }`}
              onClick={() => setActiveTab("members")}
            >
              Members
            </button>
            <button
              className={`px-4 py-2 font-medium rounded-md ${
                activeTab === "families"
                  ? "bg-[#805AD5] text-white"
                  : "text-gray-600 hover:text-gray-900"
              }`}
              onClick={() => setActiveTab("families")}
            >
              Families
            </button>
          </div>
          <Button
            onClick={() => {
              setModalType(activeTab === "members" ? "member" : "family");
              setIsModalOpen(true);
            }}
          >
            Add {activeTab === "members" ? "Person" : "Family"}
          </Button>
        </div>

        {activeTab === "members" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {members.map((member) => (
              <MemberCard
                key={member.id}
                member={member}
                onEdit={() => {}}
                onDelete={() => {
                  setMembers(members.filter((m) => m.id !== member.id));
                }}
              />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {families.map((family) => (
              <FamilyCard
                key={family.id}
                family={family}
                members={getMembersForFamily(family)}
                onEdit={() => {}}
                onDelete={() => {
                  setFamilies(families.filter((f) => f.id !== family.id));
                }}
              />
            ))}
          </div>
        )}

        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title={`Add New ${modalType === "member" ? "Person" : "Family"}`}
        >
          {modalType === "member" ? (
            <MemberForm onSubmit={handleCreateMember} />
          ) : (
            <FamilyForm
              onSubmit={handleCreateFamily}
              availableMembers={members}
            />
          )}
        </Modal>
      </div>
    </DashboardLayout>
  );
}
