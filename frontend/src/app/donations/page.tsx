"use client";

import { useState } from "react";
import DashboardLayout from "@/src/components/layout/DashboardLayout";
import DonationForm from "@/src/components/donations/DonationForm";
import DonationStats from "@/src/components/donations/DonationStats";
import Button from "@/src/components/ui/Button";
import Modal from "@/src/components/ui/Modal";
import { Donation } from "@/src/types/donation";

export default function DonationsPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [donations, setDonations] = useState<Donation[]>([]);

  const mockStats = {
    totalAmount: 25000,
    donationCount: 150,
    averageDonation: 166.67,
    purposeBreakdown: {
      Tithe: 15000,
      Offering: 5000,
      Project: 4000,
      Other: 1000,
    },
  };

  const handleCreateDonation = (donationData: Partial<Donation>) => {
    const newDonation = {
      ...donationData,
      id: Date.now().toString(),
      date: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    } as Donation;

    setDonations([...donations, newDonation]);
    setIsModalOpen(false);
  };

  return (
    <DashboardLayout>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-[#2D3748]">Donations</h1>
        <Button onClick={() => setIsModalOpen(true)}>Record Donation</Button>
      </div>

      <div className="mb-8">
        <DonationStats stats={mockStats} />
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Record New Donation"
      >
        <DonationForm onSubmit={handleCreateDonation} />
      </Modal>
    </DashboardLayout>
  );
}
