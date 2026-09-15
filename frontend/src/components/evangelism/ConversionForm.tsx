"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import Button from "@/src/components/ui/Button";
import ErrorMessage from "@/src/components/ui/ErrorMessage";
import ScalableSelect from "@/src/components/ui/ScalableSelect";
import BaptismVerifierPicker from "@/src/components/people/BaptismVerifierPicker";
import { Conversion } from "@/src/types/evangelism";
import { Person } from "@/src/types/person";
import {
  BAPTIZED_BY_HINT,
  BAPTIZED_BY_LABEL,
  HG_WITNESSED_BY_HINT,
  HG_WITNESSED_BY_LABEL,
  historicalNamesComplete,
  initialVerifierMode,
  personIdString,
  verifierPeopleOptions,
  type VerifierEntryMode,
} from "@/src/lib/baptismVerifiers";

export interface ConversionFormValues {
  person_id: string;
  water_baptism_date?: string;
  spirit_baptism_date?: string;
  baptized_by_id?: string;
  baptized_by_first_name?: string;
  baptized_by_last_name?: string;
  hg_witnessed_by_id?: string;
  hg_witnessed_by_first_name?: string;
  hg_witnessed_by_last_name?: string;
  lesson_start_date?: string;
  date_first_invited?: string;
  date_first_attended?: string;
  notes: string;
}

interface ConversionFormProps {
  people?: Person[];
  onSubmit: (values: ConversionFormValues) => Promise<void>;
  onCancel: () => void;
  isSubmitting: boolean;
  error?: string | null;
  submitLabel?: string;
  initialData?: Conversion;
}

/** API omits write-only `person_id` on GET; use nested `person.id`. */
export function personIdFromConversion(c?: Conversion): string {
  if (!c) return "";
  if (c.person?.id != null && String(c.person.id) !== "") {
    return String(c.person.id);
  }
  if (c.person_id != null && String(c.person_id) !== "") {
    return String(c.person_id);
  }
  return "";
}

function isoDateInputValue(iso?: string | null): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) {
      return String(iso).slice(0, 10);
    }
    return d.toISOString().split("T")[0];
  } catch {
    return String(iso).slice(0, 10);
  }
}

/** Person first, else Prospect (canonical invite on visitor record). */
function initialDateFirstInvited(c?: Conversion): string {
  if (!c) return "";
  if (c.person?.date_first_invited) {
    return isoDateInputValue(c.person.date_first_invited);
  }
  if (c.prospect?.date_first_invited) {
    return isoDateInputValue(c.prospect.date_first_invited);
  }
  return "";
}

function initialDateFirstAttended(c?: Conversion): string {
  if (!c?.person?.date_first_attended) return "";
  return isoDateInputValue(c.person.date_first_attended);
}

export default function ConversionForm({
  people = [],
  onSubmit,
  onCancel,
  isSubmitting,
  error,
  submitLabel = "Record Conversion",
  initialData,
}: ConversionFormProps) {
  const [values, setValues] = useState<ConversionFormValues>({
    person_id: personIdFromConversion(initialData),
    water_baptism_date: initialData?.water_baptism_date
      ? new Date(initialData.water_baptism_date).toISOString().split("T")[0]
      : "",
    spirit_baptism_date: initialData?.spirit_baptism_date
      ? new Date(initialData.spirit_baptism_date).toISOString().split("T")[0]
      : "",
    baptized_by_id: personIdString(
      initialData?.baptized_by_id ?? initialData?.baptized_by,
    ),
    baptized_by_first_name: initialData?.baptized_by_first_name || "",
    baptized_by_last_name: initialData?.baptized_by_last_name || "",
    hg_witnessed_by_id: personIdString(
      initialData?.hg_witnessed_by_id ?? initialData?.hg_witnessed_by,
    ),
    hg_witnessed_by_first_name: initialData?.hg_witnessed_by_first_name || "",
    hg_witnessed_by_last_name: initialData?.hg_witnessed_by_last_name || "",
    lesson_start_date: initialData?.lesson_start_date
      ? isoDateInputValue(initialData.lesson_start_date)
      : "",
    date_first_invited: initialDateFirstInvited(initialData),
    date_first_attended: initialDateFirstAttended(initialData),
    notes: initialData?.notes || "",
  });
  const [localError, setLocalError] = useState<string | null>(null);
  const [baptizerMode, setBaptizerMode] = useState<VerifierEntryMode>(() =>
    initialVerifierMode(
      initialData?.baptized_by_id ?? initialData?.baptized_by,
      initialData?.baptized_by_first_name,
      initialData?.baptized_by_last_name,
    ),
  );
  const [hgWitnessMode, setHgWitnessMode] = useState<VerifierEntryMode>(() =>
    initialVerifierMode(
      initialData?.hg_witnessed_by_id ?? initialData?.hg_witnessed_by,
      initialData?.hg_witnessed_by_first_name,
      initialData?.hg_witnessed_by_last_name,
    ),
  );

  const verifierOptions = useMemo(
    () => verifierPeopleOptions(people),
    [people],
  );

  const handleChange =
    (field: keyof ConversionFormValues) =>
    (
      event: ChangeEvent<
        HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
      >,
    ) => {
      setValues((prev) => ({
        ...prev,
        [field]: event.target.value,
      }));
    };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!values.person_id) {
      return;
    }
    if (
      values.water_baptism_date &&
      baptizerMode === "historical" &&
      !historicalNamesComplete(
        values.baptized_by_first_name,
        values.baptized_by_last_name,
      )
    ) {
      setLocalError("Enter former/unknown baptizer first and last name.");
      return;
    }
    if (
      values.spirit_baptism_date &&
      hgWitnessMode === "historical" &&
      !historicalNamesComplete(
        values.hg_witnessed_by_first_name,
        values.hg_witnessed_by_last_name,
      )
    ) {
      setLocalError("Enter former/unknown witness first and last name.");
      return;
    }
    const payload: ConversionFormValues = { ...values };
    if (baptizerMode === "historical") {
      payload.baptized_by_id = "";
    } else {
      payload.baptized_by_first_name = "";
      payload.baptized_by_last_name = "";
    }
    if (hgWitnessMode === "historical") {
      payload.hg_witnessed_by_id = "";
    } else {
      payload.hg_witnessed_by_first_name = "";
      payload.hg_witnessed_by_last_name = "";
    }
    setLocalError(null);
    await onSubmit(payload);
  };

  const selectablePeople = useMemo(() => {
    if (!initialData?.person) return people;
    const pid = String(initialData.person.id);
    if (people.some((p) => String(p.id) === pid)) return people;
    return [...people, initialData.person];
  }, [people, initialData?.person]);

  const lockPersonSelection = Boolean(initialData);

  const nccTeacherDisplayName = useMemo(() => {
    const fromConversion = initialData?.person?.lesson_teacher_display_name;
    if (fromConversion) return fromConversion;
    const selected = selectablePeople.find(
      (person) => String(person.id) === values.person_id,
    );
    return selected?.lesson_teacher_display_name || "No teacher";
  }, [
    initialData?.person?.lesson_teacher_display_name,
    selectablePeople,
    values.person_id,
  ]);

  const formatPersonLabel = (person: Person) => {
    const name = `${person.first_name ?? ""} ${person.last_name ?? ""}`.trim();
    return name || person.email || person.username;
  };

  const personOptions = useMemo(
    () =>
      selectablePeople
        .map((person) => ({
          label: formatPersonLabel(person),
          value: String(person.id),
        }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [selectablePeople],
  );

  useEffect(() => {
    if (lockPersonSelection) {
      return;
    }
    const selected = selectablePeople.find(
      (person) => String(person.id) === values.person_id,
    );
    const started = selected?.lessons_started_at
      ? isoDateInputValue(selected.lessons_started_at)
      : "";
    setValues((prev) => ({ ...prev, lesson_start_date: started }));
    // Prefill only when the selected person changes so manual create-form
    // edits are not wiped if the people list identity changes.
  }, [values.person_id, lockPersonSelection]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      {(error || localError) && (
        <ErrorMessage message={error || localError || ""} />
      )}

      <div className="space-y-1">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Person <span className="text-red-500">*</span>
        </label>
        <ScalableSelect
          options={personOptions}
          value={values.person_id}
          onChange={(value) =>
            setValues((prev) => ({
              ...prev,
              person_id: value,
            }))
          }
          placeholder="Select person"
          className="w-full"
          showSearch
          disabled={lockPersonSelection}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700">
            First Invited
          </label>
          <input
            type="date"
            value={values.date_first_invited ?? ""}
            onChange={handleChange("date_first_invited")}
            className="w-full rounded-md border border-gray-200 px-3 py-2 min-h-[44px] text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700">
            First Attended
          </label>
          <input
            type="date"
            value={values.date_first_attended ?? ""}
            onChange={handleChange("date_first_attended")}
            className="w-full rounded-md border border-gray-200 px-3 py-2 min-h-[44px] text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1">
          <label
            htmlFor="conversion-lesson-start-date"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Lesson Start Date
          </label>
          <input
            id="conversion-lesson-start-date"
            type="date"
            value={values.lesson_start_date || ""}
            readOnly
            disabled
            className="w-full cursor-not-allowed rounded-md border border-gray-200 bg-gray-50 px-3 py-2 min-h-[44px] text-sm text-gray-700"
          />
          <p className="text-xs text-gray-500">
            Set automatically when an NCC teacher submits a session report.
          </p>
        </div>
        <div className="space-y-1">
          <label
            htmlFor="conversion-ncc-teacher"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            NCC teacher
          </label>
          <input
            id="conversion-ncc-teacher"
            type="text"
            readOnly
            disabled
            value={nccTeacherDisplayName}
            className="w-full cursor-not-allowed rounded-md border border-gray-200 bg-gray-50 px-3 py-2 min-h-[44px] text-sm text-gray-700"
          />
          <p className="text-xs text-gray-500">
            Assigned in Lessons. To change the teacher, use the{" "}
            <a
              href="/lessons"
              className="text-primary underline-offset-2 hover:underline"
            >
              Lessons
            </a>{" "}
            page.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700">
            Water Baptism Date
          </label>
          <input
            type="date"
            value={values.water_baptism_date}
            onChange={handleChange("water_baptism_date")}
            className="w-full rounded-md border border-gray-200 px-3 py-2 min-h-[44px] text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700">
            Holy Ghost Reception Date
          </label>
          <input
            type="date"
            value={values.spirit_baptism_date}
            onChange={handleChange("spirit_baptism_date")}
            className="w-full rounded-md border border-gray-200 px-3 py-2 min-h-[44px] text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <div className="space-y-1">
          <BaptismVerifierPicker
            label={BAPTIZED_BY_LABEL}
            hint={BAPTIZED_BY_HINT}
            radioName="conversion_baptizer_mode"
            mode={baptizerMode}
            onModeChange={(mode) => {
              setBaptizerMode(mode);
              setValues((prev) => ({
                ...prev,
                baptized_by_id:
                  mode === "historical" ? "" : prev.baptized_by_id,
                baptized_by_first_name:
                  mode === "select" ? "" : prev.baptized_by_first_name,
                baptized_by_last_name:
                  mode === "select" ? "" : prev.baptized_by_last_name,
              }));
            }}
            personId={values.baptized_by_id || ""}
            onPersonIdChange={(value) =>
              setValues((prev) => ({ ...prev, baptized_by_id: value }))
            }
            firstName={values.baptized_by_first_name || ""}
            lastName={values.baptized_by_last_name || ""}
            onFirstNameChange={(value) =>
              setValues((prev) => ({ ...prev, baptized_by_first_name: value }))
            }
            onLastNameChange={(value) =>
              setValues((prev) => ({ ...prev, baptized_by_last_name: value }))
            }
            options={verifierOptions}
            emptyMessage="No baptizer found"
            requireHistoricalNames={Boolean(values.water_baptism_date)}
            showClusterCodes={false}
          />
        </div>

        <div className="space-y-1">
          <BaptismVerifierPicker
            label={HG_WITNESSED_BY_LABEL}
            hint={HG_WITNESSED_BY_HINT}
            radioName="conversion_hg_witness_mode"
            mode={hgWitnessMode}
            onModeChange={(mode) => {
              setHgWitnessMode(mode);
              setValues((prev) => ({
                ...prev,
                hg_witnessed_by_id:
                  mode === "historical" ? "" : prev.hg_witnessed_by_id,
                hg_witnessed_by_first_name:
                  mode === "select" ? "" : prev.hg_witnessed_by_first_name,
                hg_witnessed_by_last_name:
                  mode === "select" ? "" : prev.hg_witnessed_by_last_name,
              }));
            }}
            personId={values.hg_witnessed_by_id || ""}
            onPersonIdChange={(value) =>
              setValues((prev) => ({ ...prev, hg_witnessed_by_id: value }))
            }
            firstName={values.hg_witnessed_by_first_name || ""}
            lastName={values.hg_witnessed_by_last_name || ""}
            onFirstNameChange={(value) =>
              setValues((prev) => ({
                ...prev,
                hg_witnessed_by_first_name: value,
              }))
            }
            onLastNameChange={(value) =>
              setValues((prev) => ({
                ...prev,
                hg_witnessed_by_last_name: value,
              }))
            }
            options={verifierOptions}
            emptyMessage="No witness found"
            requireHistoricalNames={Boolean(values.spirit_baptism_date)}
          />
        </div>
      </div>

      <p className="text-xs text-gray-500 hidden">
        Reached status requires first invited, first attended, at least one NCC
        lesson session (not lesson start date alone), and both baptism dates.
      </p>

      <div className="space-y-1">
        <label className="block text-sm font-medium text-gray-700">Notes</label>
        <textarea
          value={values.notes}
          onChange={handleChange("notes")}
          placeholder="Conversion notes..."
          rows={3}
          className="w-full rounded-md border border-gray-200 px-3 py-2 min-h-[44px] text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>

      <div className="flex flex-col-reverse sm:flex-row gap-4 pt-4">
        <Button
          variant="tertiary"
          className="flex-1 min-h-[44px]"
          onClick={onCancel}
          disabled={isSubmitting}
        >
          Cancel
        </Button>
        <Button
          className="flex-1 min-h-[44px]"
          disabled={isSubmitting}
          type="submit"
        >
          {isSubmitting ? "Saving..." : submitLabel}
        </Button>
      </div>
    </form>
  );
}
