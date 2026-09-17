"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Button from "@/src/components/ui/Button";
import ErrorMessage from "@/src/components/ui/ErrorMessage";
import ScalableSelect from "@/src/components/ui/ScalableSelect";
import type { Prospect } from "@/src/types/evangelism";
import type { Person } from "@/src/types/person";
import { formatPersonName } from "@/src/lib/name";
import {
  isSelectablePerson,
  personDropdownChips,
} from "@/src/lib/peopleSelectors";

export interface EncodedVisitorFormValues {
  person_ids: string[];
}

interface AddEncodedVisitorFormProps {
  visitors: Person[];
  groupProspects?: Prospect[];
  excludedPersonIds?: Array<string | number>;
  onSubmit: (values: EncodedVisitorFormValues) => Promise<void>;
  onCancel: () => void;
  isSubmitting: boolean;
  error?: string | null;
}

function prospectDisplayName(prospect: Prospect): string {
  if (prospect.display_name?.trim()) return prospect.display_name;
  const parts = [prospect.first_name, prospect.middle_name, prospect.last_name].filter(
    Boolean,
  ) as string[];
  let base = parts.join(" ");
  if (prospect.suffix?.trim()) {
    base = base ? `${base}, ${prospect.suffix}` : prospect.suffix;
  }
  return base || "Unknown";
}

function isInvitedOnlyProspect(prospect: Prospect): boolean {
  if (prospect.is_dropped_off) return false;
  if (prospect.person) return false;
  if (prospect.pipeline_stage && prospect.pipeline_stage !== "INVITED") {
    return false;
  }
  return true;
}

export default function AddEncodedVisitorForm({
  visitors,
  groupProspects = [],
  excludedPersonIds = [],
  onSubmit,
  onCancel,
  isSubmitting,
  error,
}: AddEncodedVisitorFormProps) {
  const [selectedPersonIds, setSelectedPersonIds] = useState<string[]>([]);
  const [validationError, setValidationError] = useState<string | null>(null);

  const excluded = useMemo(
    () => new Set(excludedPersonIds.map((id) => String(id))),
    [excludedPersonIds],
  );

  const returningVisitors = useMemo(
    () =>
      visitors
        .filter(
          (person) =>
            person.role === "VISITOR" &&
            !excluded.has(String(person.id)) &&
            isSelectablePerson(person),
        )
        .sort((a, b) =>
          formatPersonName(a).localeCompare(formatPersonName(b)),
        ),
    [visitors, excluded],
  );

  const visitorOptions = useMemo(() => {
    const returning = returningVisitors.map((person) => ({
      label: formatPersonName(person),
      value: String(person.id),
      disabled: selectedPersonIds.includes(String(person.id)),
      ...personDropdownChips(person),
    }));

    const invitedOnly = groupProspects
      .filter(isInvitedOnlyProspect)
      .map((prospect) => {
        const cluster =
          prospect.inviter_cluster?.code ||
          prospect.endorsed_cluster?.code ||
          "";
        return {
          label: prospectDisplayName(prospect),
          value: `prospect:${prospect.id}`,
          disabled: true,
          statusLabel: "Invited only",
          statusClassName: "bg-orange-100 text-orange-800",
          clusterCode: cluster || "NO CLUSTER",
          clusterBranchId:
            prospect.inviter_cluster?.branch ??
            prospect.endorsed_cluster?.branch ??
            null,
        };
      })
      .sort((a, b) => a.label.localeCompare(b.label));

    return [...returning, ...invitedOnly];
  }, [returningVisitors, groupProspects, selectedPersonIds]);

  const selectedLabels = useMemo(() => {
    const byId = new Map(
      returningVisitors.map((person) => [
        String(person.id),
        formatPersonName(person),
      ]),
    );
    return selectedPersonIds.map((id) => ({
      id,
      label: byId.get(id) ?? id,
    }));
  }, [returningVisitors, selectedPersonIds]);

  useEffect(() => {
    setValidationError(null);
  }, [selectedPersonIds, error]);

  useEffect(() => {
    const valid = new Set(returningVisitors.map((person) => String(person.id)));
    setSelectedPersonIds((prev) => {
      const next = prev.filter((id) => valid.has(id));
      return next.length === prev.length ? prev : next;
    });
  }, [returningVisitors]);

  const handleSelectVisitor = (value: string) => {
    if (!value || value.startsWith("prospect:")) return;
    setSelectedPersonIds((prev) =>
      prev.includes(value) ? prev : [...prev, value],
    );
  };

  const handleRemoveVisitor = (id: string) => {
    setSelectedPersonIds(selectedPersonIds.filter((item) => item !== id));
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (selectedPersonIds.length === 0) {
      setValidationError("Choose at least one returning visitor.");
      return;
    }
    await onSubmit({ person_ids: selectedPersonIds });
  };

  const shownError = validationError || error || null;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {shownError && <ErrorMessage message={shownError} />}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Select Visitors
        </label>
        <ScalableSelect
          options={visitorOptions}
          value=""
          onChange={handleSelectVisitor}
          onConfirm={handleSelectVisitor}
          placeholder="Search and pick visitor to add"
          emptyMessage="No visitors found"
          className="w-full z-[60]"
          showSearch
        />
        {selectedLabels.length > 0 ? (
          <ul className="mt-3 flex flex-wrap gap-2">
            {selectedLabels.map(({ id, label }) => (
              <li key={id}>
                <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-sm text-primary border border-primary/20">
                  {label}
                  <button
                    type="button"
                    onClick={() => handleRemoveVisitor(id)}
                    className="text-primary hover:text-primary focus:outline-none"
                    aria-label={`Remove ${label}`}
                  >
                    ×
                  </button>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-xs text-gray-500">
            Add as many returning visitors as needed. They&rsquo;ll appear here
            once added.
          </p>
        )}
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
          disabled={isSubmitting || selectedPersonIds.length === 0}
          type="submit"
        >
          {isSubmitting
            ? "Adding..."
            : `Add ${selectedPersonIds.length} Returning Visitor${
                selectedPersonIds.length !== 1 ? "s" : ""
              }`}
        </Button>
      </div>
    </form>
  );
}
