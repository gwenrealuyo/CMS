"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Button from "@/src/components/ui/Button";
import AttendanceSelector from "@/src/components/reports/AttendanceSelector";
import AddVisitorModal from "@/src/components/reports/AddVisitorModal";
import {
  EvangelismGroup,
  EvangelismWeeklyReport,
  Prospect,
} from "@/src/types/evangelism";
import { Person, PersonUI } from "@/src/types/person";
import { peopleApi } from "@/src/lib/api";
import { isSelectablePerson } from "@/src/lib/peopleSelectors";

export interface EvangelismWeeklyReportFormValues {
  evangelism_group_id: string;
  year: number;
  week_number: number;
  meeting_date: string;
  members_attended: string[];
  visitors_attended: string[];
  gathering_type: "PHYSICAL" | "ONLINE" | "HYBRID";
  topic?: string;
  activities_held?: string;
  prayer_requests?: string;
  testimonies?: string;
  new_prospects: number;
  notes?: string;
}

interface EvangelismWeeklyReportFormProps {
  group: EvangelismGroup;
  initialData?: EvangelismWeeklyReport | null;
  prospects?: Prospect[];
  onSubmit: (values: EvangelismWeeklyReportFormValues) => Promise<void>;
  onCancel: () => void;
  isSubmitting: boolean;
  error?: string | null;
}

const getWeekNumber = (date: Date): number => {
  const start = new Date(date.getFullYear(), 0, 1);
  const days = Math.floor(
    (date.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)
  );
  return Math.ceil((days + start.getDay() + 1) / 7);
};

/** Display list for members attended; includes coordinator alongside enrolled members. */
function personToMemberOption(person: Person): PersonUI {
  const middleInitial = person.middle_name
    ? ` ${person.middle_name.trim().charAt(0)}.`
    : "";
  const suffixPart =
    person.suffix && person.suffix.trim().length > 0
      ? ` ${person.suffix.trim()}`
      : "";
  const name = `${person.first_name ?? ""}${middleInitial} ${
    person.last_name ?? ""
  }${suffixPart}`.trim();
  return {
    ...person,
    name,
    dateFirstAttended: person.date_first_attended,
    id: person.id?.toString() || "",
  };
}

export default function EvangelismWeeklyReportForm({
  group,
  initialData,
  prospects = [],
  onSubmit,
  onCancel,
  isSubmitting,
  error,
}: EvangelismWeeklyReportFormProps) {
  const [people, setPeople] = useState<PersonUI[]>([]);
  const [loadingPeople, setLoadingPeople] = useState(false);
  const [showAddVisitorModal, setShowAddVisitorModal] = useState(false);

  const defaultDate = new Date().toISOString().split("T")[0];
  const [formData, setFormData] = useState<EvangelismWeeklyReportFormValues>({
    evangelism_group_id: String(group.id),
    year: new Date().getFullYear(),
    week_number: getWeekNumber(new Date()),
    meeting_date: defaultDate,
    members_attended: [],
    visitors_attended: [],
    gathering_type: "PHYSICAL",
    topic: "",
    activities_held: "",
    prayer_requests: "",
    testimonies: "",
    new_prospects: 0,
    notes: "",
  });

  useEffect(() => {
    if (!initialData) return;
    setFormData({
      evangelism_group_id: String(group.id),
      year: initialData.year,
      week_number: initialData.week_number,
      meeting_date: initialData.meeting_date,
      members_attended: (initialData.members_attended || []).map(String),
      visitors_attended: (initialData.visitors_attended || []).map(String),
      gathering_type: initialData.gathering_type,
      topic: initialData.topic || "",
      activities_held: initialData.activities_held || "",
      prayer_requests: initialData.prayer_requests || "",
      testimonies: initialData.testimonies || "",
      new_prospects: initialData.new_prospects || 0,
      notes: initialData.notes || "",
    });
  }, [group.id, initialData]);

  useEffect(() => {
    const fetchPeople = async () => {
      try {
        setLoadingPeople(true);
        const response = await peopleApi.getAll();
        const peopleUI: PersonUI[] = response.data
          .filter(isSelectablePerson)
          .map((p) => {
            const middleInitial = p.middle_name
              ? ` ${p.middle_name.trim().charAt(0)}.`
              : "";
            const suffixPart =
              p.suffix && p.suffix.trim().length > 0
                ? ` ${p.suffix.trim()}`
                : "";
            const name = `${p.first_name ?? ""}${middleInitial} ${
              p.last_name ?? ""
            }${suffixPart}`.trim();
            return {
              ...p,
              name,
              dateFirstAttended: p.date_first_attended,
              id: p.id?.toString() || "",
            };
          });
        setPeople(peopleUI);
      } catch (err) {
        console.error("Error loading people:", err);
      } finally {
        setLoadingPeople(false);
      }
    };
    fetchPeople();
  }, []);

  const allowedMemberIds = useMemo(() => {
    const inlineIds =
      group.members?.map((member) => String(member.id)) || [];
    const coordinatorIds = group.coordinator?.id
      ? [String(group.coordinator.id)]
      : [];
    return Array.from(new Set([...inlineIds, ...coordinatorIds]));
  }, [group.members, group.coordinator?.id]);

  const coordinatorOption = useMemo(
    () =>
      group.coordinator
        ? personToMemberOption(group.coordinator as Person)
        : null,
    [group.coordinator],
  );

  const memberOptions = useMemo(() => {
    const inlineMembers =
      group.members?.map((member) => personToMemberOption(member)) || [];

    const combined = [...people, ...inlineMembers];
    if (coordinatorOption) {
      const hasCoordinator = combined.some(
        (p) => p.id === coordinatorOption.id,
      );
      if (!hasCoordinator) {
        combined.unshift(coordinatorOption);
      }
    }
    const seen = new Set<string>();
    return combined.filter((person) => {
      if (!person.id || seen.has(person.id)) return false;
      seen.add(person.id);
      return true;
    });
  }, [coordinatorOption, group.members, people]);

  const visitorOptions = useMemo(() => {
    const attendedVisitors = prospects
      .filter((prospect) => prospect.person)
      .map((prospect) => prospect.person as Person)
      .filter((person) => person.role === "VISITOR" && person.status === "ATTENDED")
      .map((person) => {
        const middleInitial = person.middle_name
          ? ` ${person.middle_name.trim().charAt(0)}.`
          : "";
        const suffixPart =
          person.suffix && person.suffix.trim().length > 0
            ? ` ${person.suffix.trim()}`
            : "";
        const name = `${person.first_name ?? ""}${middleInitial} ${
          person.last_name ?? ""
        }${suffixPart}`.trim();
        return {
          ...person,
          name,
          dateFirstAttended: person.date_first_attended,
          id: person.id?.toString() || "",
        } as PersonUI;
      });
    const invitedProspects = prospects
      .filter((prospect) => !prospect.person)
      .map((prospect) => {
        const invitedBy = prospect.invited_by?.full_name || "Unknown";
        const stageLabel =
          prospect.pipeline_stage_display || prospect.pipeline_stage || "INVITED";
        return {
          id: `prospect:${prospect.id}`,
          name: `${prospect.name} (${stageLabel.toLowerCase()})`,
          role: "VISITOR" as const,
          status: "INVITED" as const,
          inviter: prospect.invited_by?.id,
          inviterName: invitedBy,
        };
      });

    return [...attendedVisitors, ...invitedProspects] as PersonUI[];
  }, [prospects]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    await onSubmit(formData);
  };

  const handleAddVisitor = async (visitorData: Partial<Person>) => {
    const created = await peopleApi.create(visitorData);
    const person = created.data;
    const middleInitial = person.middle_name
      ? ` ${person.middle_name.trim().charAt(0)}.`
      : "";
    const suffixPart =
      person.suffix && person.suffix.trim().length > 0
        ? ` ${person.suffix.trim()}`
        : "";
    const name = `${person.first_name ?? ""}${middleInitial} ${
      person.last_name ?? ""
    }${suffixPart}`.trim();
    const personUI: PersonUI = {
      ...person,
      name,
      dateFirstAttended: person.date_first_attended,
      id: person.id?.toString() || "",
    };

    setPeople((prev) => [...prev, personUI]);
    setFormData((prev) => ({
      ...prev,
      visitors_attended: [...prev.visitors_attended, personUI.id],
    }));
    return person;
  };

  return (
    <form className="space-y-6" onSubmit={handleSubmit}>
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Year
          </label>
          <input
            type="number"
            value={formData.year}
            onChange={(e) =>
              setFormData((prev) => ({
                ...prev,
                year: Number(e.target.value),
              }))
            }
            className="w-full rounded-md border border-gray-200 px-3 py-2 min-h-[44px] text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Week Number
          </label>
          <input
            type="number"
            value={formData.week_number}
            onChange={(e) =>
              setFormData((prev) => ({
                ...prev,
                week_number: Number(e.target.value),
              }))
            }
            className="w-full rounded-md border border-gray-200 px-3 py-2 min-h-[44px] text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Meeting Date
          </label>
          <input
            type="date"
            value={formData.meeting_date}
            onChange={(e) =>
              setFormData((prev) => ({
                ...prev,
                meeting_date: e.target.value,
              }))
            }
            className="w-full rounded-md border border-gray-200 px-3 py-2 min-h-[44px] text-sm"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Gathering Type
          </label>
          <select
            value={formData.gathering_type}
            onChange={(e) =>
              setFormData((prev) => ({
                ...prev,
                gathering_type: e.target.value as EvangelismWeeklyReportFormValues["gathering_type"],
              }))
            }
            className="w-full rounded-md border border-gray-200 px-3 py-2 min-h-[44px] text-sm"
          >
            <option value="PHYSICAL">Physical</option>
            <option value="ONLINE">Online</option>
            <option value="HYBRID">Hybrid</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Topic
          </label>
          <input
            type="text"
            value={formData.topic || ""}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, topic: e.target.value }))
            }
            className="w-full rounded-md border border-gray-200 px-3 py-2 min-h-[44px] text-sm"
            placeholder="Weekly topic"
          />
        </div>
      </div>

      <div className="space-y-4">
        <AttendanceSelector
          label="Members Attended"
          selectedIds={formData.members_attended}
          availablePeople={memberOptions}
          filterRole="MEMBER"
          onSelectionChange={(ids) =>
            setFormData((prev) => ({ ...prev, members_attended: ids }))
          }
          allowedIds={allowedMemberIds}
        />
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-gray-700">
            Visitors Attended
          </label>
          <Button
            type="button"
            variant="secondary"
            className="!text-orange-600 bg-white border border-orange-200 hover:bg-orange-50 hover:border-orange-300 text-xs py-1 px-2"
            onClick={() => setShowAddVisitorModal(true)}
          >
            Add New Visitor
          </Button>
        </div>
        <AttendanceSelector
          label=""
          selectedIds={formData.visitors_attended}
          availablePeople={visitorOptions}
          filterRole="VISITOR"
          onSelectionChange={(ids) =>
            setFormData((prev) => ({ ...prev, visitors_attended: ids }))
          }
          className="mt-0"
        />
        {loadingPeople && (
          <div className="text-xs text-gray-500">Loading people...</div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            New Visitors
          </label>
          <input
            type="number"
            value={formData.new_prospects}
            onChange={(e) =>
              setFormData((prev) => ({
                ...prev,
                new_prospects: Number(e.target.value),
              }))
            }
            className="w-full rounded-md border border-gray-200 px-3 py-2 min-h-[44px] text-sm"
          />
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Activities Held
          </label>
          <textarea
            value={formData.activities_held || ""}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, activities_held: e.target.value }))
            }
            rows={2}
            className="w-full rounded-md border border-gray-200 px-3 py-2 min-h-[44px] text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Prayer Requests
          </label>
          <textarea
            value={formData.prayer_requests || ""}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, prayer_requests: e.target.value }))
            }
            rows={2}
            className="w-full rounded-md border border-gray-200 px-3 py-2 min-h-[44px] text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Testimonies
          </label>
          <textarea
            value={formData.testimonies || ""}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, testimonies: e.target.value }))
            }
            rows={2}
            className="w-full rounded-md border border-gray-200 px-3 py-2 min-h-[44px] text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Notes
          </label>
          <textarea
            value={formData.notes || ""}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, notes: e.target.value }))
            }
            rows={3}
            className="w-full rounded-md border border-gray-200 px-3 py-2 min-h-[44px] text-sm"
          />
        </div>
      </div>

      <div className="flex flex-col-reverse sm:flex-row gap-4 pt-4">
        <Button
          variant="tertiary"
          className="flex-1 min-h-[44px]"
          onClick={onCancel}
          disabled={isSubmitting}
          type="button"
        >
          Cancel
        </Button>
        <Button
          className="flex-1 min-h-[44px]"
          disabled={isSubmitting}
          type="submit"
        >
          {isSubmitting ? "Saving..." : "Submit Report"}
        </Button>
      </div>

      <AddVisitorModal
        isOpen={showAddVisitorModal}
        onClose={() => setShowAddVisitorModal(false)}
        onAdd={handleAddVisitor}
        defaultDateFirstAttended={formData.meeting_date}
        defaultFirstActivityAttended="CLUSTER_BS_EVANGELISM"
      />
    </form>
  );
}
