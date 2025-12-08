"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import DashboardLayout from "@/src/components/layout/DashboardLayout";
import ProtectedRoute from "@/src/components/auth/ProtectedRoute";
import DonationForm from "@/src/components/finance/DonationForm";
import DonationStats from "@/src/components/finance/DonationStats";
import DonationTable from "@/src/components/finance/DonationTable";
import FinanceOverviewStats from "@/src/components/finance/FinanceOverviewStats";
import OfferingSummaryCard from "@/src/components/finance/OfferingSummaryCard";
import OfferingTable from "@/src/components/finance/OfferingTable";
import OfferingForm from "@/src/components/finance/OfferingForm";
import PledgeTable from "@/src/components/finance/PledgeTable";
import PledgeForm from "@/src/components/finance/PledgeForm";
import Button from "@/src/components/ui/Button";
import Card from "@/src/components/ui/Card";
import Modal from "@/src/components/ui/Modal";
import ErrorMessage from "@/src/components/ui/ErrorMessage";
import LoadingSpinner from "@/src/components/ui/LoadingSpinner";
import ConfirmationModal from "@/src/components/ui/ConfirmationModal";
import ScalableSelect from "@/src/components/ui/ScalableSelect";
import { financeApi, peopleApi } from "@/src/lib/api";
import { Person } from "@/src/types/person";
import {
  Donation,
  DonationStats as DonationStatsType,
  Offering,
  OfferingWeeklySummary,
  Pledge,
  PledgeContribution,
} from "@/src/types/finance";

type LoadingState = {
  donations: boolean;
  offerings: boolean;
  pledges: boolean;
  summary: boolean;
};

const INITIAL_STATS: DonationStatsType = {
  totalAmount: 0,
  donationCount: 0,
  averageDonation: 0,
  purposeBreakdown: {},
};

const formatCurrency = (value: number) =>
  `₱${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

const createEmptyContributionForm = () => ({
  contributorId: "",
  amount: "",
  date: new Date().toISOString().slice(0, 10),
  note: "",
});

const formatDate = (value: string) => {
  if (!value) {
    return "—";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleDateString();
};

export default function FinancePage() {
  const [donations, setDonations] = useState<Donation[]>([]);
  const [donationStats, setDonationStats] =
    useState<DonationStatsType>(INITIAL_STATS);
  const [offerings, setOfferings] = useState<Offering[]>([]);
  const [pledges, setPledges] = useState<Pledge[]>([]);
  const [offeringSummary, setOfferingSummary] = useState<
    OfferingWeeklySummary[]
  >([]);
  const [monthlyContributions, setMonthlyContributions] = useState<
    PledgeContribution[]
  >([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [peopleLoading, setPeopleLoading] = useState(false);
  const [loading, setLoading] = useState<LoadingState>({
    donations: true,
    offerings: true,
    pledges: true,
    summary: true,
  });
  const [error, setError] = useState<string | null>(null);
  const [isDonationModalOpen, setIsDonationModalOpen] = useState(false);
  const [editingDonation, setEditingDonation] = useState<Donation | null>(null);
  const [isOfferingModalOpen, setIsOfferingModalOpen] = useState(false);
  const [editingOffering, setEditingOffering] = useState<Offering | null>(null);
  const [isPledgeModalOpen, setIsPledgeModalOpen] = useState(false);
  const [editingPledge, setEditingPledge] = useState<Pledge | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isContributionModalOpen, setContributionModalOpen] = useState(false);
  const [selectedPledge, setSelectedPledge] = useState<Pledge | null>(null);
  const [contributions, setContributions] = useState<PledgeContribution[]>([]);
  const [contributionsLoading, setContributionsLoading] = useState(false);
  const [contributionError, setContributionError] = useState<string | null>(
    null
  );
  const [contributionSubmitting, setContributionSubmitting] = useState(false);
  const [editingContribution, setEditingContribution] =
    useState<PledgeContribution | null>(null);
  const [deletingContributionId, setDeletingContributionId] = useState<
    number | string | null
  >(null);
  const [deleteContributionTarget, setDeleteContributionTarget] =
    useState<PledgeContribution | null>(null);
  const [deleteContributionLoading, setDeleteContributionLoading] =
    useState(false);
  const [deleteContributionError, setDeleteContributionError] = useState<
    string | null
  >(null);
  const [deleteOfferingTarget, setDeleteOfferingTarget] =
    useState<Offering | null>(null);
  const [deleteOfferingLoading, setDeleteOfferingLoading] = useState(false);
  const [deleteOfferingError, setDeleteOfferingError] = useState<string | null>(
    null
  );
  const [deletePledgeTarget, setDeletePledgeTarget] = useState<Pledge | null>(
    null
  );
  const [deletePledgeLoading, setDeletePledgeLoading] = useState(false);
  const [deletePledgeError, setDeletePledgeError] = useState<string | null>(
    null
  );
  const [deleteDonationTarget, setDeleteDonationTarget] =
    useState<Donation | null>(null);
  const [deleteDonationLoading, setDeleteDonationLoading] = useState(false);
  const [deleteDonationError, setDeleteDonationError] = useState<string | null>(
    null
  );
  const [contributionForm, setContributionForm] = useState(() =>
    createEmptyContributionForm()
  );

  type DateRangePeriod =
    | "thisWeek"
    | "thisMonth"
    | "thisYear"
    | "last7Days"
    | "last30Days"
    | "lastQuarter"
    | "last6Months"
    | "previousMonth"
    | "previousYear"
    | "customRange";
  const [dateRangePeriod, setDateRangePeriod] =
    useState<DateRangePeriod>("thisMonth");
  const [customStartDate, setCustomStartDate] = useState<string>("");
  const [customEndDate, setCustomEndDate] = useState<string>("");

  // Calculate date range based on selected period
  const dateRange = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const day = now.getDate();

    let start: Date;
    let end: Date;

    switch (dateRangePeriod) {
      case "thisWeek": {
        // Get Monday of current week
        const dayOfWeek = now.getDay();
        const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // Adjust when day is Sunday
        start = new Date(year, month, diff);
        start.setHours(0, 0, 0, 0);
        end = new Date(start);
        end.setDate(start.getDate() + 6); // Sunday
        break;
      }
      case "thisMonth":
        start = new Date(year, month, 1);
        end = new Date(year, month + 1, 0); // Last day of current month
        break;
      case "thisYear":
        start = new Date(year, 0, 1); // January 1st
        end = new Date(year, 11, 31); // December 31st
        break;
      case "last7Days":
        end = new Date(year, month, day);
        end.setHours(23, 59, 59, 999);
        start = new Date(end);
        start.setDate(start.getDate() - 6);
        start.setHours(0, 0, 0, 0);
        break;
      case "last30Days":
        end = new Date(year, month, day);
        end.setHours(23, 59, 59, 999);
        start = new Date(end);
        start.setDate(start.getDate() - 29);
        start.setHours(0, 0, 0, 0);
        break;
      case "lastQuarter": {
        // Last 3 months (90 days)
        end = new Date(year, month, day);
        end.setHours(23, 59, 59, 999);
        start = new Date(end);
        start.setDate(start.getDate() - 89);
        start.setHours(0, 0, 0, 0);
        break;
      }
      case "last6Months": {
        // Last 6 months (approximately 180 days)
        end = new Date(year, month, day);
        end.setHours(23, 59, 59, 999);
        start = new Date(end);
        start.setDate(start.getDate() - 179);
        start.setHours(0, 0, 0, 0);
        break;
      }
      case "previousMonth": {
        const prevMonth = month === 0 ? 11 : month - 1;
        const prevYear = month === 0 ? year - 1 : year;
        start = new Date(prevYear, prevMonth, 1);
        end = new Date(prevYear, prevMonth + 1, 0); // Last day of previous month
        break;
      }
      case "previousYear":
        start = new Date(year - 1, 0, 1); // January 1st of previous year
        end = new Date(year - 1, 11, 31); // December 31st of previous year
        break;
      case "customRange":
        if (customStartDate && customEndDate) {
          start = new Date(customStartDate);
          end = new Date(customEndDate);
        } else {
          // Default to this month if custom dates not set
          start = new Date(year, month, 1);
          end = new Date(year, month + 1, 0);
        }
        break;
      default:
        start = new Date(year, month, 1);
        end = new Date(year, month + 1, 0);
    }

    return {
      start: start.toISOString().split("T")[0],
      end: end.toISOString().split("T")[0],
    };
  }, [dateRangePeriod, customStartDate, customEndDate]);

  const periodLabel = useMemo(() => {
    switch (dateRangePeriod) {
      case "thisWeek":
        return "This Week";
      case "thisMonth":
        return "This Month";
      case "thisYear":
        return "This Year";
      case "last7Days":
        return "Last 7 Days";
      case "last30Days":
        return "Last 30 Days";
      case "lastQuarter":
        return "Last Quarter";
      case "last6Months":
        return "Last 6 Months";
      case "previousMonth":
        return "Previous Month";
      case "previousYear":
        return "Previous Year";
      case "customRange":
        if (customStartDate && customEndDate) {
          const start = new Date(customStartDate);
          const end = new Date(customEndDate);
          return `${start.toLocaleDateString()} - ${end.toLocaleDateString()}`;
        }
        return "Custom Range";
      default:
        return "This Month";
    }
  }, [dateRangePeriod, customStartDate, customEndDate]);

  const loadPeople = useCallback(async () => {
    setPeopleLoading(true);
    try {
      const response = await peopleApi.getAll();
      setPeople(response.data);
    } catch (err) {
      console.error("Failed to load people:", err);
    } finally {
      setPeopleLoading(false);
    }
  }, []);

  // Format person name for contributor dropdown (matches serializer format)
  const formatPersonLabel = useCallback((person: Person) => {
    // Format: First Name Middle Name Last Name Suffix
    const parts = [
      person.first_name,
      person.middle_name,
      person.last_name,
      person.suffix,
    ].filter(Boolean);
    const fullName = parts.join(" ").trim();
    // Fallback to email or username if no name parts exist
    return fullName || person.email || person.username || "Unknown";
  }, []);

  // Options for contributor dropdown
  const contributorOptions = useMemo(() => {
    const filtered = people.filter(
      (p) =>
        p.username !== "admin" &&
        ((p.first_name ?? "") !== "" || (p.last_name ?? "") !== "")
    );
    return filtered
      .map((person) => ({
        label: formatPersonLabel(person),
        value: String(person.id),
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [people, formatPersonLabel]);

  const loadFinanceData = useCallback(async () => {
    setLoading({
      donations: true,
      offerings: true,
      pledges: true,
      summary: true,
    });
    setError(null);

    try {
      const [
        donationData,
        donationStatsData,
        offeringData,
        pledgeData,
        offeringSummaryData,
        contributionsData,
      ] = await Promise.all([
        financeApi.listDonations({
          start: dateRange.start,
          end: dateRange.end,
        }),
        financeApi.donationStats({
          start: dateRange.start,
          end: dateRange.end,
        }),
        financeApi.listOfferings({
          start: dateRange.start,
          end: dateRange.end,
        }),
        financeApi.listPledges(),
        financeApi.weeklyOfferingSummary({
          start: dateRange.start,
          end: dateRange.end,
        }),
        financeApi.listAllPledgeContributions({
          start: dateRange.start,
          end: dateRange.end,
        }),
      ]);

      setDonations(donationData);
      setDonationStats(donationStatsData);
      setOfferings(offeringData);
      setPledges(pledgeData);
      setOfferingSummary(offeringSummaryData);
      setMonthlyContributions(contributionsData);
    } catch (err) {
      console.error(err);
      setError(
        "We couldn't load the latest finance data. Please try again shortly."
      );
    } finally {
      setLoading({
        donations: false,
        offerings: false,
        pledges: false,
        summary: false,
      });
    }
  }, [dateRange]);

  useEffect(() => {
    loadFinanceData();
  }, [loadFinanceData]);

  useEffect(() => {
    loadPeople();
  }, [loadPeople]);

  const refreshPledges = useCallback(async () => {
    try {
      const updated = await financeApi.listPledges();
      setPledges(updated);
      return updated;
    } catch (err) {
      console.error(err);
      setError(
        "We couldn't refresh the pledge list. Please try again shortly."
      );
      return null;
    }
  }, []);

  const fetchPledgeContributions = useCallback(
    async (pledgeId: number | string) => {
      setContributionsLoading(true);
      setContributionError(null);
      try {
        const data = await financeApi.listPledgeContributions(pledgeId);
        console.log("Fetched contributions:", data); // Debug logging
        setContributions(data || []);
      } catch (err) {
        console.error("Error fetching contributions:", err);
        setContributionError(
          "We couldn't load contributions. Please try again."
        );
        setContributions([]); // Ensure contributions is set to empty array on error
      } finally {
        setContributionsLoading(false);
      }
    },
    []
  );

  // Helper function to refresh donation stats
  const refreshDonationStats = useCallback(async () => {
    try {
      const stats = await financeApi.donationStats({
        start: dateRange.start,
        end: dateRange.end,
      });
      setDonationStats(stats);
    } catch (err) {
      console.error("Failed to refresh donation stats:", err);
    }
  }, [dateRange]);

  const offeringMetrics = useMemo(() => {
    if (offerings.length === 0) {
      return {
        totalAmount: 0,
        offeringCount: 0,
        averageOffering: 0,
      };
    }
    const totalAmount = offerings.reduce(
      (sum, offering) => sum + offering.amount,
      0
    );
    return {
      totalAmount,
      offeringCount: offerings.length,
      averageOffering: offerings.length ? totalAmount / offerings.length : 0,
    };
  }, [offerings]);

  const pledgeMetrics = useMemo(() => {
    // Calculate metrics from contributions received this month
    const totalReceived = monthlyContributions.reduce(
      (sum, contribution) => sum + contribution.amount,
      0
    );

    // Get unique pledges that have contributions this month
    const pledgeIdsWithContributions = new Set(
      monthlyContributions.map((c) => String(c.pledgeId))
    );
    const relevantPledges = pledges.filter((p) =>
      pledgeIdsWithContributions.has(String(p.id))
    );

    const totalPledged = relevantPledges.reduce(
      (sum, pledge) => sum + pledge.pledgeAmount,
      0
    );

    const outstandingBalance = totalPledged - totalReceived;

    return {
      totalPledged,
      totalReceived,
      outstandingBalance: Math.max(0, outstandingBalance),
    };
  }, [pledges, monthlyContributions]);

  const openContributionModal = (pledge: Pledge) => {
    setSelectedPledge(pledge);
    setContributionForm(createEmptyContributionForm());
    setEditingContribution(null);
    setContributionError(null);
    setContributions([]); // Reset contributions before fetching
    setContributionModalOpen(true);
    fetchPledgeContributions(pledge.id);
  };

  const closeContributionModal = () => {
    setContributionModalOpen(false);
    setSelectedPledge(null);
    setContributions([]);
    setEditingContribution(null);
    setContributionError(null);
    setDeletingContributionId(null);
    setDeleteContributionTarget(null);
    setDeleteContributionError(null);
    setContributionForm(createEmptyContributionForm());
  };

  const handleEditContribution = (contribution: PledgeContribution) => {
    setEditingContribution(contribution);
    setContributionForm({
      contributorId: contribution.contributorId
        ? String(contribution.contributorId)
        : "",
      amount: String(contribution.amount),
      date: contribution.contributionDate,
      note: contribution.note || "",
    });
    setContributionError(null);
    // Scroll to the form section
    setTimeout(() => {
      const formElement = document.querySelector("[data-contribution-form]");
      if (formElement) {
        formElement.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 100);
  };

  const handleContributionSubmit = async () => {
    if (!selectedPledge) {
      return;
    }
    const amount = Number.parseFloat(contributionForm.amount || "0");
    if (!Number.isFinite(amount) || amount <= 0) {
      setContributionError("Enter a positive contribution amount.");
      return;
    }
    if (!contributionForm.date) {
      setContributionError("Select a contribution date.");
      return;
    }
    setContributionSubmitting(true);
    setContributionError(null);
    try {
      const payload = {
        contributorId: contributionForm.contributorId
          ? Number(contributionForm.contributorId)
          : null,
        amount,
        contributionDate: contributionForm.date,
        note: contributionForm.note?.trim()
          ? contributionForm.note.trim()
          : null,
      };

      if (editingContribution) {
        // Update existing contribution
        await financeApi.updatePledgeContribution(
          editingContribution.id,
          selectedPledge.id,
          payload
        );
      } else {
        // Create new contribution
        await financeApi.createPledgeContribution(selectedPledge.id, payload);
      }

      await fetchPledgeContributions(selectedPledge.id);
      const updated = await refreshPledges();
      if (updated) {
        const refreshed = updated.find(
          (pledge) => String(pledge.id) === String(selectedPledge.id)
        );
        if (refreshed) {
          setSelectedPledge(refreshed);
        }
      }
      setContributionForm(createEmptyContributionForm());
      setEditingContribution(null);
    } catch (err) {
      console.error(err);
      setContributionError(
        editingContribution
          ? "Unable to update the contribution right now. Please review the details and retry."
          : "Unable to save the contribution right now. Please review the details and retry."
      );
    } finally {
      setContributionSubmitting(false);
    }
  };

  const requestDeleteContribution = (contribution: PledgeContribution) => {
    setDeleteContributionTarget(contribution);
    setDeleteContributionError(null);
  };

  const confirmDeleteContribution = async () => {
    if (!selectedPledge || !deleteContributionTarget) {
      return;
    }
    setDeleteContributionLoading(true);
    setDeleteContributionError(null);
    try {
      await financeApi.deletePledgeContribution(deleteContributionTarget.id);
      await fetchPledgeContributions(selectedPledge.id);
      const updated = await refreshPledges();
      if (updated) {
        const refreshed = updated.find(
          (pledge) => String(pledge.id) === String(selectedPledge.id)
        );
        if (refreshed) {
          setSelectedPledge(refreshed);
        }
      }
      setDeleteContributionTarget(null);
    } catch (err) {
      console.error(err);
      setDeleteContributionError(
        "Unable to remove the contribution right now. Please try again."
      );
    } finally {
      setDeleteContributionLoading(false);
    }
  };

  const handleCreateDonation = async (payload: Partial<Donation>) => {
    setIsSubmitting(true);
    setError(null);
    try {
      const created = await financeApi.createDonation({
        ...payload,
        notes:
          payload.donorName && payload.donorName.trim().length > 0
            ? `${payload.notes ? `${payload.notes}\n` : ""}Donor: ${
                payload.donorName
              }`
            : payload.notes,
      });
      setDonations((prev) => [created, ...prev]);
      await refreshDonationStats();
      setIsDonationModalOpen(false);
      setEditingDonation(null);
    } catch (err) {
      console.error(err);
      setError(
        "Unable to record the donation right now. Please review the details and retry."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditDonation = (donation: Donation) => {
    setEditingDonation(donation);
    setIsDonationModalOpen(true);
  };

  const handleUpdateDonation = async (payload: Partial<Donation>) => {
    if (!editingDonation) return;

    setIsSubmitting(true);
    setError(null);
    try {
      const updated = await financeApi.updateDonation(
        editingDonation.id,
        payload
      );
      setDonations((prev) =>
        prev.map((d) =>
          String(d.id) === String(editingDonation.id) ? updated : d
        )
      );
      await refreshDonationStats();
      setIsDonationModalOpen(false);
      setEditingDonation(null);
    } catch (err) {
      console.error(err);
      setError(
        "Unable to update the donation. Please check the fields and try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const requestDeleteDonation = (donation: Donation) => {
    setDeleteDonationTarget(donation);
    setDeleteDonationError(null);
  };

  const confirmDeleteDonation = async () => {
    if (!deleteDonationTarget) {
      return;
    }
    setDeleteDonationLoading(true);
    setDeleteDonationError(null);
    try {
      await financeApi.deleteDonation(deleteDonationTarget.id);
      setDonations((prev) =>
        prev.filter((d) => String(d.id) !== String(deleteDonationTarget.id))
      );
      await refreshDonationStats();
      setIsDonationModalOpen(false);
      setEditingDonation(null);
      setDeleteDonationTarget(null);
    } catch (err) {
      console.error(err);
      setDeleteDonationError("Failed to delete the donation.");
    } finally {
      setDeleteDonationLoading(false);
    }
  };

  const handleCreateOffering = async (payload: Partial<Offering>) => {
    setIsSubmitting(true);
    setError(null);
    try {
      const created = await financeApi.createOffering(payload);
      setOfferings((prev) => [created, ...prev]);
      const summary = await financeApi.weeklyOfferingSummary();
      setOfferingSummary(summary);
      setIsOfferingModalOpen(false);
    } catch (err) {
      console.error(err);
      setError("Unable to save the offering entry. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditOffering = (offering: Offering) => {
    setEditingOffering(offering);
    setIsOfferingModalOpen(true);
  };

  const handleUpdateOffering = async (payload: Partial<Offering>) => {
    if (!editingOffering) return;

    setIsSubmitting(true);
    setError(null);
    try {
      const updated = await financeApi.updateOffering(
        editingOffering.id,
        payload
      );
      setOfferings((prev) =>
        prev.map((o) =>
          String(o.id) === String(editingOffering.id) ? updated : o
        )
      );
      const summary = await financeApi.weeklyOfferingSummary();
      setOfferingSummary(summary);
      setIsOfferingModalOpen(false);
      setEditingOffering(null);
    } catch (err) {
      console.error(err);
      setError(
        "Unable to update the offering. Please check the fields and try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const requestDeleteOffering = (offering: Offering) => {
    setDeleteOfferingTarget(offering);
    setDeleteOfferingError(null);
  };

  const confirmDeleteOffering = async () => {
    if (!deleteOfferingTarget) {
      return;
    }
    setDeleteOfferingLoading(true);
    setDeleteOfferingError(null);
    try {
      await financeApi.deleteOffering(deleteOfferingTarget.id);
      setOfferings((prev) =>
        prev.filter((o) => String(o.id) !== String(deleteOfferingTarget.id))
      );
      const summary = await financeApi.weeklyOfferingSummary();
      setOfferingSummary(summary);
      setIsOfferingModalOpen(false);
      setEditingOffering(null);
      setDeleteOfferingTarget(null);
    } catch (err) {
      console.error(err);
      setDeleteOfferingError("Failed to delete the offering.");
    } finally {
      setDeleteOfferingLoading(false);
    }
  };

  const handleCreatePledge = async (payload: Partial<Pledge>) => {
    setIsSubmitting(true);
    setError(null);
    try {
      const created = await financeApi.createPledge(payload);
      setPledges((prev) => [created, ...prev]);
      setIsPledgeModalOpen(false);
      setEditingPledge(null);
    } catch (err) {
      console.error(err);
      setError(
        "Unable to save the pledge. Please check the fields and try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditPledge = (pledge: Pledge) => {
    setEditingPledge(pledge);
    setIsPledgeModalOpen(true);
  };

  const handleUpdatePledge = async (payload: Partial<Pledge>) => {
    if (!editingPledge) return;

    setIsSubmitting(true);
    setError(null);
    try {
      const updated = await financeApi.updatePledge(editingPledge.id, payload);
      setPledges((prev) =>
        prev.map((p) =>
          String(p.id) === String(editingPledge.id) ? updated : p
        )
      );
      setIsPledgeModalOpen(false);
      setEditingPledge(null);
    } catch (err) {
      console.error(err);
      setError(
        "Unable to update the pledge. Please check the fields and try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const requestDeletePledge = (pledge: Pledge) => {
    setDeletePledgeTarget(pledge);
    setDeletePledgeError(null);
  };

  const confirmDeletePledge = async () => {
    if (!deletePledgeTarget) {
      return;
    }
    setDeletePledgeLoading(true);
    setDeletePledgeError(null);
    try {
      await financeApi.deletePledge(deletePledgeTarget.id);
      setPledges((prev) =>
        prev.filter((p) => String(p.id) !== String(deletePledgeTarget.id))
      );
      setIsPledgeModalOpen(false);
      setEditingPledge(null);
      setDeletePledgeTarget(null);
    } catch (err) {
      console.error(err);
      setDeletePledgeError("Failed to delete the pledge.");
    } finally {
      setDeletePledgeLoading(false);
    }
  };

  return (
    <ProtectedRoute allowedRoles={["ADMIN", "PASTOR"]}>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-[#2D3748]">Finance</h1>
              <p className="text-sm text-gray-600 mt-1">
                Track donations, weekly offerings, and pledge progress in one
                view.
              </p>
            </div>
            <div className="w-full md:w-auto">
              <Button
                variant="primary"
                onClick={() => setIsOfferingModalOpen(true)}
                className="w-full md:w-auto min-h-[44px]"
              >
                Record Offering
              </Button>
            </div>
          </div>

          {error && <ErrorMessage message={error} />}

          <FinanceOverviewStats
            donationStats={{
              totalAmount: donationStats.totalAmount,
              donationCount: donationStats.donationCount,
              averageDonation: donationStats.averageDonation,
            }}
            offeringStats={offeringMetrics}
            pledgeStats={pledgeMetrics}
            dateRangePeriod={dateRangePeriod}
            onDateRangeChange={setDateRangePeriod}
            customStartDate={customStartDate}
            customEndDate={customEndDate}
            onCustomStartDateChange={setCustomStartDate}
            onCustomEndDateChange={setCustomEndDate}
          />

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <div className="space-y-6">
              <OfferingTable
                offerings={offerings}
                loading={loading.offerings}
                onAddOffering={() => setIsOfferingModalOpen(true)}
                onEditOffering={handleEditOffering}
              />
              <OfferingSummaryCard
                summary={offeringSummary}
                loading={loading.summary}
              />
            </div>

            <div className="space-y-6">
              <PledgeTable
                pledges={pledges}
                loading={loading.pledges}
                onAddPledge={() => {
                  setEditingPledge(null);
                  setIsPledgeModalOpen(true);
                }}
                onManageContributions={openContributionModal}
                onEditPledge={handleEditPledge}
              />
              <Card title="Pledge Snapshot">
                {pledges.length === 0 ? (
                  <p className="text-sm text-gray-500">
                    Add a pledge to monitor campaign progress.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <SnapshotTile
                      label="Total Pledged"
                      value={formatCurrency(pledgeMetrics.totalPledged)}
                      description="Across active commitments"
                      badgeClass="bg-blue-100 text-blue-700"
                    />
                    <SnapshotTile
                      label="Received"
                      value={formatCurrency(pledgeMetrics.totalReceived)}
                      description="Funds already collected"
                      badgeClass="bg-green-100 text-green-700"
                    />
                    <SnapshotTile
                      label="Outstanding"
                      value={formatCurrency(pledgeMetrics.outstandingBalance)}
                      description="Remaining balance to fulfill"
                      badgeClass="bg-amber-100 text-amber-700"
                    />
                  </div>
                )}
              </Card>
              <DonationTable
                donations={donations}
                loading={loading.donations}
                onAddDonation={() => {
                  setEditingDonation(null);
                  setIsDonationModalOpen(true);
                }}
                onEditDonation={handleEditDonation}
              />
              <Card
                title="Donation Snapshot"
                headerAction={
                  <Button
                    variant="primary"
                    onClick={() => {
                      setEditingDonation(null);
                      setIsDonationModalOpen(true);
                    }}
                    className="w-full sm:w-auto min-h-[44px]"
                  >
                    Record Donation
                  </Button>
                }
              >
                {loading.donations && donations.length === 0 ? (
                  <div className="flex justify-center py-12">
                    <LoadingSpinner />
                  </div>
                ) : (
                  <DonationStats stats={donationStats} />
                )}
              </Card>
            </div>
          </div>
        </div>

        <Modal
          isOpen={isDonationModalOpen}
          onClose={() => {
            setIsDonationModalOpen(false);
            setEditingDonation(null);
          }}
          title={editingDonation ? "Edit Donation" : "Record New Donation"}
        >
          <DonationForm
            onSubmit={
              editingDonation ? handleUpdateDonation : handleCreateDonation
            }
            onCancel={() => {
              setIsDonationModalOpen(false);
              setEditingDonation(null);
            }}
            onDelete={
              editingDonation
                ? () => requestDeleteDonation(editingDonation)
                : undefined
            }
            submitting={isSubmitting}
            initialData={editingDonation || undefined}
          />
        </Modal>

        <Modal
          isOpen={isOfferingModalOpen}
          onClose={() => {
            setIsOfferingModalOpen(false);
            setEditingOffering(null);
          }}
          title={editingOffering ? "Edit Offering" : "Record Weekly Offering"}
        >
          <OfferingForm
            onSubmit={
              editingOffering ? handleUpdateOffering : handleCreateOffering
            }
            onCancel={() => {
              setIsOfferingModalOpen(false);
              setEditingOffering(null);
            }}
            onDelete={
              editingOffering
                ? () => requestDeleteOffering(editingOffering)
                : undefined
            }
            submitting={isSubmitting}
            initialData={editingOffering || undefined}
          />
        </Modal>

        <Modal
          isOpen={isPledgeModalOpen}
          onClose={() => {
            setIsPledgeModalOpen(false);
            setEditingPledge(null);
          }}
          title={editingPledge ? "Edit Pledge" : "Add Pledge"}
        >
          <PledgeForm
            onSubmit={editingPledge ? handleUpdatePledge : handleCreatePledge}
            onCancel={() => {
              setIsPledgeModalOpen(false);
              setEditingPledge(null);
            }}
            onDelete={
              editingPledge
                ? () => requestDeletePledge(editingPledge)
                : undefined
            }
            submitting={isSubmitting}
            existingPledges={pledges}
            initialData={editingPledge || undefined}
          />
        </Modal>

        <Modal
          isOpen={isContributionModalOpen}
          onClose={closeContributionModal}
          title={
            selectedPledge
              ? `Log Contributions — ${selectedPledge.pledgeTitle}`
              : "Log Contributions"
          }
        >
          <div className="space-y-6">
            {selectedPledge && (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-gray-600">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div>
                    <span className="block text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Target
                    </span>
                    <span className="text-sm font-medium text-[#1F2937]">
                      {formatCurrency(selectedPledge.pledgeAmount)}
                    </span>
                  </div>
                  <div>
                    <span className="block text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Received
                    </span>
                    <span className="text-sm font-medium text-green-600">
                      {formatCurrency(selectedPledge.amountReceived)}
                    </span>
                  </div>
                  <div>
                    <span className="block text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Outstanding
                    </span>
                    <span className="text-sm font-medium text-[#D97706]">
                      {formatCurrency(selectedPledge.balance)}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {contributionError && <ErrorMessage message={contributionError} />}

            <div
              className="space-y-4 rounded-lg border border-slate-200 p-4 shadow-sm"
              data-contribution-form
            >
              <h3 className="text-sm font-semibold text-[#2D3748]">
                {editingContribution ? "Edit Contribution" : "Add Contribution"}
              </h3>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Contributor (optional)
                </label>
                <ScalableSelect
                  options={[
                    { label: "Not set", value: "" },
                    ...contributorOptions,
                  ]}
                  value={contributionForm.contributorId}
                  onChange={(value) => {
                    setContributionForm((previous) => ({
                      ...previous,
                      contributorId: value,
                    }));
                    setContributionError(null);
                  }}
                  placeholder="Select contributor..."
                  className="w-full"
                  showSearch
                />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Amount *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={contributionForm.amount}
                    onChange={(event) => {
                      setContributionForm((previous) => ({
                        ...previous,
                        amount: event.target.value,
                      }));
                      setContributionError(null);
                    }}
                    className="w-full min-h-[44px] rounded-lg border border-slate-200 bg-white py-2 px-3 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="₱0.00"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Contribution Date *
                  </label>
                  <input
                    type="date"
                    value={contributionForm.date}
                    onChange={(event) => {
                      setContributionForm((previous) => ({
                        ...previous,
                        date: event.target.value,
                      }));
                      setContributionError(null);
                    }}
                    className="w-full min-h-[44px] rounded-lg border border-slate-200 bg-white py-2 px-3 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Notes (optional)
                </label>
                <textarea
                  value={contributionForm.note}
                  onChange={(event) => {
                    setContributionForm((previous) => ({
                      ...previous,
                      note: event.target.value,
                    }));
                    setContributionError(null);
                  }}
                  rows={3}
                  className="w-full min-h-[44px] rounded-lg border border-slate-200 bg-white py-2 px-3 text-sm leading-relaxed focus:border-transparent focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="Add any reminders or context for this contribution."
                />
              </div>
              <div className="flex flex-col-reverse sm:flex-row justify-end gap-3">
                {editingContribution && (
                  <Button
                    variant="tertiary"
                    onClick={() => {
                      setContributionForm(createEmptyContributionForm());
                      setEditingContribution(null);
                      setContributionError(null);
                    }}
                    disabled={contributionSubmitting}
                    className="w-full sm:w-auto min-h-[44px]"
                  >
                    Cancel Edit
                  </Button>
                )}
                <Button
                  variant="tertiary"
                  onClick={() =>
                    setContributionForm((previous) => ({
                      ...previous,
                      amount: "",
                      note: "",
                    }))
                  }
                  disabled={contributionSubmitting || !!editingContribution}
                  className="w-full sm:w-auto min-h-[44px]"
                >
                  Clear
                </Button>
                <Button
                  onClick={handleContributionSubmit}
                  disabled={contributionSubmitting}
                  className="w-full sm:w-auto min-h-[44px]"
                >
                  {contributionSubmitting
                    ? "Saving…"
                    : editingContribution
                    ? "Update Contribution"
                    : "Save Contribution"}
                </Button>
              </div>
            </div>

            <div className="space-y-3 rounded-lg border border-slate-200 p-4 shadow-sm">
              <h3 className="text-sm font-semibold text-[#2D3748]">
                Contribution History
              </h3>
              {contributionsLoading ? (
                <div className="flex justify-center py-6">
                  <LoadingSpinner />
                </div>
              ) : contributions.length === 0 ? (
                <p className="text-sm text-gray-500">
                  No contributions recorded for this pledge yet.
                </p>
              ) : (
                <div className="max-h-72 overflow-y-auto">
                  <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead className="bg-slate-50 text-xs uppercase tracking-wide text-gray-500">
                      <tr>
                        <th className="px-3 py-2 text-left">Date</th>
                        <th className="px-3 py-2 text-left">Contributor</th>
                        <th className="px-3 py-2 text-right">Amount</th>
                        <th className="px-3 py-2 text-left">Recorded By</th>
                        <th className="px-3 py-2 text-left">Notes</th>
                        <th className="px-3 py-2 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {contributions.map((contribution) => (
                        <tr key={contribution.id}>
                          <td
                            className="px-3 py-2 text-gray-700 cursor-pointer hover:text-[#2563EB] hover:underline transition-colors"
                            onClick={() => handleEditContribution(contribution)}
                            title="Click to edit this contribution"
                          >
                            {formatDate(contribution.contributionDate)}
                          </td>
                          <td
                            className="px-3 py-2 text-gray-600 cursor-pointer hover:text-[#2563EB] hover:underline transition-colors"
                            onClick={() => handleEditContribution(contribution)}
                            title="Click to edit this contribution"
                          >
                            {contribution.contributorName ?? "—"}
                          </td>
                          <td
                            className="px-3 py-2 text-right font-semibold text-[#2563EB] cursor-pointer hover:text-blue-700 hover:underline transition-colors"
                            onClick={() => handleEditContribution(contribution)}
                            title="Click to edit this contribution"
                          >
                            {formatCurrency(contribution.amount)}
                          </td>
                          <td
                            className="px-3 py-2 text-gray-600 cursor-pointer hover:text-[#2563EB] hover:underline transition-colors"
                            onClick={() => handleEditContribution(contribution)}
                            title="Click to edit this contribution"
                          >
                            {contribution.recordedByName ?? "—"}
                          </td>
                          <td
                            className="px-3 py-2 text-gray-600 cursor-pointer hover:text-[#2563EB] hover:underline transition-colors"
                            onClick={() => handleEditContribution(contribution)}
                            title="Click to edit this contribution"
                          >
                            {contribution.note ? (
                              <span className="whitespace-pre-line">
                                {contribution.note}
                              </span>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <div className="flex flex-col items-end gap-1">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleEditContribution(contribution);
                                }}
                                disabled={
                                  deleteContributionTarget?.id ===
                                    contribution.id ||
                                  contributionSubmitting ||
                                  deleteContributionLoading
                                }
                                className="text-xs font-semibold text-blue-600 hover:text-blue-700 disabled:cursor-not-allowed disabled:text-blue-300"
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  requestDeleteContribution(contribution);
                                }}
                                disabled={
                                  deleteContributionTarget?.id ===
                                    contribution.id ||
                                  contributionSubmitting ||
                                  deleteContributionLoading
                                }
                                className="text-xs font-semibold text-red-600 hover:text-red-700 disabled:cursor-not-allowed disabled:text-red-300"
                              >
                                Remove
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </Modal>

        <ConfirmationModal
          isOpen={Boolean(deleteContributionTarget)}
          onClose={() => {
            if (deleteContributionLoading) return;
            setDeleteContributionTarget(null);
            setDeleteContributionError(null);
          }}
          onConfirm={confirmDeleteContribution}
          title="Delete Contribution"
          message={
            deleteContributionError
              ? `${deleteContributionError} Please try again.`
              : `Are you sure you want to delete this contribution of ${formatCurrency(
                  deleteContributionTarget?.amount || 0
                )}? This action cannot be undone and will update the pledge totals.`
          }
          confirmText="Delete Contribution"
          cancelText="Cancel"
          variant="danger"
          loading={deleteContributionLoading}
        />

        <ConfirmationModal
          isOpen={Boolean(deleteOfferingTarget)}
          onClose={() => {
            if (deleteOfferingLoading) return;
            setDeleteOfferingTarget(null);
            setDeleteOfferingError(null);
          }}
          onConfirm={confirmDeleteOffering}
          title="Delete Offering"
          message={
            deleteOfferingError
              ? `${deleteOfferingError} Please try again.`
              : `Are you sure you want to delete the offering for "${
                  deleteOfferingTarget?.serviceName
                }" on ${formatDate(
                  deleteOfferingTarget?.serviceDate || ""
                )}? This action cannot be undone and will remove ${formatCurrency(
                  deleteOfferingTarget?.amount || 0
                )} from your offering records.`
          }
          confirmText="Delete Offering"
          cancelText="Cancel"
          variant="danger"
          loading={deleteOfferingLoading}
        />

        <ConfirmationModal
          isOpen={Boolean(deletePledgeTarget)}
          onClose={() => {
            if (deletePledgeLoading) return;
            setDeletePledgeTarget(null);
            setDeletePledgeError(null);
          }}
          onConfirm={confirmDeletePledge}
          title="Delete Pledge"
          message={
            deletePledgeError
              ? `${deletePledgeError} Please try again.`
              : `Are you sure you want to delete the pledge "${deletePledgeTarget?.pledgeTitle}"? This action cannot be undone and will remove all associated contribution records.`
          }
          confirmText="Delete Pledge"
          cancelText="Cancel"
          variant="danger"
          loading={deletePledgeLoading}
        />

        <ConfirmationModal
          isOpen={Boolean(deleteDonationTarget)}
          onClose={() => {
            if (deleteDonationLoading) return;
            setDeleteDonationTarget(null);
            setDeleteDonationError(null);
          }}
          onConfirm={confirmDeleteDonation}
          title="Delete Donation"
          message={
            deleteDonationError
              ? `${deleteDonationError} Please try again.`
              : `Are you sure you want to delete the donation of ${formatCurrency(
                  deleteDonationTarget?.amount || 0
                )} on ${formatDate(
                  deleteDonationTarget?.date || ""
                )}? This action cannot be undone and will remove this donation from your records.`
          }
          confirmText="Delete Donation"
          cancelText="Cancel"
          variant="danger"
          loading={deleteDonationLoading}
        />
      </DashboardLayout>
    </ProtectedRoute>
  );
}

interface SnapshotTileProps {
  label: string;
  value: string;
  description: string;
  badgeClass: string;
}

function SnapshotTile({
  label,
  value,
  description,
  badgeClass,
}: SnapshotTileProps) {
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-4">
      <span
        className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${badgeClass}`}
      >
        {label}
      </span>
      <p className="mt-3 text-2xl font-bold text-[#1F2937]">{value}</p>
      <p className="mt-2 text-xs text-gray-500">{description}</p>
    </div>
  );
}
