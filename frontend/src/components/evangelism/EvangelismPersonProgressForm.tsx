"use client";

import {
  ChangeEvent,
  FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Button from "@/src/components/ui/Button";
import ErrorMessage from "@/src/components/ui/ErrorMessage";
import ScalableSelect from "@/src/components/ui/ScalableSelect";
import BaptismVerifierPicker from "@/src/components/people/BaptismVerifierPicker";
import PersonAvatar from "@/src/components/people/PersonAvatar";
import SearchableSelect from "@/src/components/ui/SearchableSelect";
import { Person } from "@/src/types/person";
import { formatPersonName } from "@/src/lib/name";
import { personDataToFormData, peopleApi } from "@/src/lib/api";
import {
  PERSON_PHOTO_ACCEPT,
  PERSON_PHOTO_HELPER_TEXT,
  preparePersonPhoto,
} from "@/src/lib/personPhoto";
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
import {
  DEFAULT_COUNTRY,
  UNIQUE_DIAL_CODES,
  findCountryForDialCode,
  getCountryDialCode,
  getCountryLocalMax,
  getKnownDialCodes,
} from "@/src/lib/countries";

export interface EvangelismPersonProgressFormValues {
  person_id: string;
  phone?: string;
  email?: string;
  facebook_name?: string;
  inviter?: string;
  water_baptism_date?: string;
  spirit_baptism_date?: string;
  baptized_by?: string | null;
  baptized_by_first_name?: string;
  baptized_by_last_name?: string;
  hg_witnessed_by?: string | null;
  hg_witnessed_by_first_name?: string;
  hg_witnessed_by_last_name?: string;
  date_first_invited?: string;
  date_first_attended?: string;
  note?: string;
}

interface EvangelismPersonProgressFormProps {
  /** Candidates with an existing Person profile (attended visitors). */
  people?: Person[];
  verifierPeople?: Person[];
  onSubmit: (person: Person) => Promise<void>;
  onCancel: () => void;
  isSubmitting: boolean;
  error?: string | null;
  submitLabel?: string;
  initialPerson?: Person | null;
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

function parsePhoneParts(
  phone?: string | null,
  preferredCountry?: string | null,
): { dialCountry: string; local: string } {
  const country = (preferredCountry || DEFAULT_COUNTRY) as string;
  const phoneVal = phone || "";
  if (!phoneVal) return { dialCountry: country, local: "" };
  const digits = phoneVal.replace(/[^0-9+]/g, "");
  if (digits.startsWith("+")) {
    const match = getKnownDialCodes().find((code) => digits.startsWith(code));
    if (match) {
      return {
        dialCountry: findCountryForDialCode(match, country),
        local: digits.slice(match.length),
      };
    }
    return {
      dialCountry: country,
      local: digits.replace(/^\+\d{1,3}/, ""),
    };
  }
  return { dialCountry: country, local: digits };
}

function valuesFromPerson(person?: Person | null): EvangelismPersonProgressFormValues {
  if (!person) {
    return {
      person_id: "",
      phone: "",
      email: "",
      facebook_name: "",
      inviter: "",
      water_baptism_date: "",
      spirit_baptism_date: "",
      baptized_by: "",
      baptized_by_first_name: "",
      baptized_by_last_name: "",
      hg_witnessed_by: "",
      hg_witnessed_by_first_name: "",
      hg_witnessed_by_last_name: "",
      date_first_invited: "",
      date_first_attended: "",
      note: "",
    };
  }
  return {
    person_id: String(person.id),
    phone: person.phone || "",
    email: person.email || "",
    facebook_name: person.facebook_name || "",
    inviter: personIdString(person.inviter),
    water_baptism_date: isoDateInputValue(person.water_baptism_date),
    spirit_baptism_date: isoDateInputValue(person.spirit_baptism_date),
    baptized_by: personIdString(person.baptized_by),
    baptized_by_first_name: person.baptized_by_first_name || "",
    baptized_by_last_name: person.baptized_by_last_name || "",
    hg_witnessed_by: personIdString(person.hg_witnessed_by),
    hg_witnessed_by_first_name: person.hg_witnessed_by_first_name || "",
    hg_witnessed_by_last_name: person.hg_witnessed_by_last_name || "",
    date_first_invited: isoDateInputValue(person.date_first_invited),
    date_first_attended: isoDateInputValue(person.date_first_attended),
    note: "",
  };
}

export default function EvangelismPersonProgressForm({
  people = [],
  verifierPeople,
  onSubmit,
  onCancel,
  isSubmitting,
  error,
  submitLabel = "Save progress",
  initialPerson = null,
}: EvangelismPersonProgressFormProps) {
  const [values, setValues] = useState<EvangelismPersonProgressFormValues>(() =>
    valuesFromPerson(initialPerson),
  );
  const [localError, setLocalError] = useState<string | null>(null);
  const initialPhone = parsePhoneParts(
    initialPerson?.phone,
    initialPerson?.country,
  );
  const [phoneDialCountry, setPhoneDialCountry] = useState(
    initialPhone.dialCountry,
  );
  const [phoneLocal, setPhoneLocal] = useState(initialPhone.local);
  const phoneCountryCode = getCountryDialCode(phoneDialCountry);
  const [baptizerMode, setBaptizerMode] = useState<VerifierEntryMode>(() =>
    initialVerifierMode(
      initialPerson?.baptized_by,
      initialPerson?.baptized_by_first_name,
      initialPerson?.baptized_by_last_name,
    ),
  );
  const [hgWitnessMode, setHgWitnessMode] = useState<VerifierEntryMode>(() =>
    initialVerifierMode(
      initialPerson?.hg_witnessed_by,
      initialPerson?.hg_witnessed_by_first_name,
      initialPerson?.hg_witnessed_by_last_name,
    ),
  );
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoRemoved, setPhotoRemoved] = useState(false);
  const [saving, setSaving] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const verifierOptions = useMemo(
    () => verifierPeopleOptions(verifierPeople ?? people),
    [verifierPeople, people],
  );

  const selectablePeople = useMemo(() => {
    if (!initialPerson) return people;
    const pid = String(initialPerson.id);
    if (people.some((p) => String(p.id) === pid)) return people;
    return [...people, initialPerson];
  }, [people, initialPerson]);

  const lockPersonSelection = Boolean(initialPerson);

  const selectedPerson = useMemo(
    () =>
      selectablePeople.find((p) => String(p.id) === values.person_id) ||
      initialPerson ||
      null,
    [selectablePeople, values.person_id, initialPerson],
  );

  const nccTeacherDisplayName =
    selectedPerson?.lesson_teacher_display_name || "No teacher";
  const lessonStartDate = isoDateInputValue(selectedPerson?.lessons_started_at);

  const personOptions = useMemo(
    () =>
      selectablePeople
        .map((person) => ({
          label: formatPersonName(person),
          value: String(person.id),
          nickname: person.nickname?.trim() || null,
          firstName: person.first_name?.trim() || null,
        }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [selectablePeople],
  );

  const photoPreviewUrl = useMemo(() => {
    if (photoFile) return URL.createObjectURL(photoFile);
    return null;
  }, [photoFile]);

  useEffect(() => {
    return () => {
      if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl);
    };
  }, [photoPreviewUrl]);

  const showPhotoPreview =
    Boolean(photoPreviewUrl) ||
    Boolean(selectedPerson?.photo && !photoRemoved);

  const handleChange =
    (field: keyof EvangelismPersonProgressFormValues) =>
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setValues((prev) => ({ ...prev, [field]: event.target.value }));
    };

  const syncPhoneToValues = (code: string, local: string) => {
    setValues((prev) => ({
      ...prev,
      phone: local ? `${code}${local}` : "",
    }));
  };

  const applyPhoneDialCountry = (countryName: string, local: string) => {
    const code = getCountryDialCode(countryName);
    const max = getCountryLocalMax(countryName);
    const nextLocal = local.slice(0, max);
    setPhoneDialCountry(countryName);
    setPhoneLocal(nextLocal);
    syncPhoneToValues(code, nextLocal);
  };

  const applyPhoneFromPerson = (person?: Person | null) => {
    const parts = parsePhoneParts(person?.phone, person?.country);
    setPhoneDialCountry(parts.dialCountry);
    setPhoneLocal(parts.local);
  };

  const handlePhotoChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const result = await preparePersonPhoto(file);
    if (!result.ok) {
      setLocalError(result.message);
      if (photoInputRef.current) photoInputRef.current.value = "";
      return;
    }
    setLocalError(null);
    setPhotoFile(result.file);
    setPhotoRemoved(false);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!values.person_id) return;
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

    const payload = {
      phone: phoneLocal ? `${phoneCountryCode}${phoneLocal}` : "",
      email: values.email || "",
      facebook_name: values.facebook_name || "",
      inviter: values.inviter || null,
      date_first_invited: values.date_first_invited || null,
      date_first_attended: values.date_first_attended || null,
      water_baptism_date: values.water_baptism_date || null,
      spirit_baptism_date: values.spirit_baptism_date || null,
      note: (values.note || "").trim() || undefined,
    } as Partial<Person>;

    if (baptizerMode === "historical") {
      payload.baptized_by = null;
      payload.baptized_by_first_name =
        (values.baptized_by_first_name || "").trim();
      payload.baptized_by_last_name =
        (values.baptized_by_last_name || "").trim();
    } else {
      payload.baptized_by = values.baptized_by || null;
      payload.baptized_by_first_name = "";
      payload.baptized_by_last_name = "";
    }

    if (hgWitnessMode === "historical") {
      payload.hg_witnessed_by = null;
      payload.hg_witnessed_by_first_name =
        (values.hg_witnessed_by_first_name || "").trim();
      payload.hg_witnessed_by_last_name =
        (values.hg_witnessed_by_last_name || "").trim();
    } else {
      payload.hg_witnessed_by = values.hg_witnessed_by || null;
      payload.hg_witnessed_by_first_name = "";
      payload.hg_witnessed_by_last_name = "";
    }

    setLocalError(null);
    setSaving(true);
    try {
      let response;
      if (photoFile) {
        response = await peopleApi.update(
          values.person_id,
          personDataToFormData(payload, photoFile),
        );
      } else if (photoRemoved) {
        response = await peopleApi.update(values.person_id, {
          ...payload,
          photo: null,
        });
      } else {
        response = await peopleApi.patch(values.person_id, payload);
      }
      await onSubmit(response.data);
    } catch (err: unknown) {
      const ax = err as { response?: { data?: Record<string, unknown> } };
      const data = ax.response?.data || {};
      const first = Object.values(data)[0];
      const message = Array.isArray(first)
        ? String(first[0])
        : typeof data.detail === "string"
          ? data.detail
          : "Failed to save person progress";
      setLocalError(message);
    } finally {
      setSaving(false);
    }
  };

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
          onChange={(value) => {
            const next = selectablePeople.find((p) => String(p.id) === value);
            setValues(valuesFromPerson(next || null));
            applyPhoneFromPerson(next || null);
            setPhotoFile(null);
            setPhotoRemoved(false);
            setBaptizerMode(
              initialVerifierMode(
                next?.baptized_by,
                next?.baptized_by_first_name,
                next?.baptized_by_last_name,
              ),
            );
            setHgWitnessMode(
              initialVerifierMode(
                next?.hg_witnessed_by,
                next?.hg_witnessed_by_first_name,
                next?.hg_witnessed_by_last_name,
              ),
            );
          }}
          placeholder="Select attended visitor"
          className="w-full"
          showSearch
          disabled={lockPersonSelection}
        />
        <p className="text-xs text-gray-500">
          Only visitors who already have a Person profile (after first
          attendance).
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700">
            Phone Number
          </label>
          <div className="flex gap-2 items-stretch">
            <select
              aria-label="Phone country code"
              value={
                UNIQUE_DIAL_CODES.includes(phoneCountryCode)
                  ? phoneCountryCode
                  : getCountryDialCode(DEFAULT_COUNTRY)
              }
              onChange={(e) => {
                const nextCountry = findCountryForDialCode(
                  e.target.value,
                  phoneDialCountry,
                );
                applyPhoneDialCountry(nextCountry, phoneLocal);
              }}
              className="w-[7.5rem] shrink-0 rounded-md border border-gray-200 bg-white px-2 py-2 min-h-[44px] text-sm text-gray-700 focus:border-primary focus:outline-none focus:ring-1 focus:ring-ring"
            >
              {UNIQUE_DIAL_CODES.map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </select>
            <input
              type="tel"
              inputMode="numeric"
              pattern="[0-9]*"
              value={phoneLocal}
              onChange={(e) => {
                const digitsOnly = e.target.value.replace(/\D/g, "");
                const max = getCountryLocalMax(phoneDialCountry);
                const next = digitsOnly.slice(0, max);
                setPhoneLocal(next);
                syncPhoneToValues(phoneCountryCode, next);
              }}
              placeholder="##########"
              className="min-w-0 flex-1 rounded-md border border-gray-200 px-3 py-2 min-h-[44px] text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
        </div>
        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700">
            Email
          </label>
          <input
            type="email"
            value={values.email || ""}
            onChange={handleChange("email")}
            placeholder="name@example.com"
            className="w-full rounded-md border border-gray-200 px-3 py-2 min-h-[44px] text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700">
            Facebook Name
          </label>
          <input
            type="text"
            value={values.facebook_name || ""}
            onChange={handleChange("facebook_name")}
            placeholder="Facebook display name"
            className="w-full rounded-md border border-gray-200 px-3 py-2 min-h-[44px] text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700">
            Photo
          </label>
          <p className="text-xs text-gray-500 mb-2">{PERSON_PHOTO_HELPER_TEXT}</p>
          {showPhotoPreview && (
            <div className="flex items-center gap-3 mb-2">
              <PersonAvatar
                person={{
                  ...(selectedPerson || { id: values.person_id }),
                  photo: photoRemoved
                    ? undefined
                    : photoPreviewUrl || selectedPerson?.photo,
                }}
                size="md"
              />
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  if (photoFile) {
                    setPhotoFile(null);
                    if (photoInputRef.current) photoInputRef.current.value = "";
                  } else {
                    setPhotoRemoved(true);
                  }
                }}
              >
                Remove photo
              </Button>
            </div>
          )}
          <input
            ref={photoInputRef}
            type="file"
            accept={PERSON_PHOTO_ACCEPT}
            onChange={handlePhotoChange}
            className="w-full text-sm"
          />
        </div>
      </div>

      <div className="space-y-1">
        <label className="block text-sm font-medium text-gray-700">
          Inviter
        </label>
        <SearchableSelect
          value={values.inviter || ""}
          onChange={(value) =>
            setValues((prev) => ({ ...prev, inviter: value }))
          }
          options={verifierOptions}
          placeholder="Type a name to search..."
          emptyMessage="No inviter found"
          showEmptyOption
          emptyOptionLabel="No inviter"
          showStatus={false}
          showClusterCodes
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
          <label className="block text-sm font-medium text-gray-700">
            Lesson Start Date
          </label>
          <input
            type="date"
            value={lessonStartDate}
            readOnly
            disabled
            className="w-full cursor-not-allowed rounded-md border border-gray-200 bg-gray-50 px-3 py-2 min-h-[44px] text-sm text-gray-700"
          />
        </div>
        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700">
            NCC teacher
          </label>
          <input
            type="text"
            readOnly
            disabled
            value={nccTeacherDisplayName}
            className="w-full cursor-not-allowed rounded-md border border-gray-200 bg-gray-50 px-3 py-2 min-h-[44px] text-sm text-gray-700"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700">
            Water Baptism Date
          </label>
          <input
            type="date"
            value={values.water_baptism_date || ""}
            onChange={handleChange("water_baptism_date")}
            className="w-full rounded-md border border-gray-200 px-3 py-2 min-h-[44px] text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700">
            Spirit Baptism Date
          </label>
          <input
            type="date"
            value={values.spirit_baptism_date || ""}
            onChange={handleChange("spirit_baptism_date")}
            className="w-full rounded-md border border-gray-200 px-3 py-2 min-h-[44px] text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
      </div>

      <BaptismVerifierPicker
        label={BAPTIZED_BY_LABEL}
        hint={BAPTIZED_BY_HINT}
        radioName="evangelism_baptizer_mode"
        mode={baptizerMode}
        onModeChange={(mode) => {
          setBaptizerMode(mode);
          setValues((prev) => ({
            ...prev,
            baptized_by: mode === "historical" ? "" : prev.baptized_by,
            baptized_by_first_name:
              mode === "select" ? "" : prev.baptized_by_first_name,
            baptized_by_last_name:
              mode === "select" ? "" : prev.baptized_by_last_name,
          }));
        }}
        personId={values.baptized_by || ""}
        onPersonIdChange={(value) =>
          setValues((prev) => ({ ...prev, baptized_by: value }))
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
        showClusterCodes
      />

      <BaptismVerifierPicker
        label={HG_WITNESSED_BY_LABEL}
        hint={HG_WITNESSED_BY_HINT}
        radioName="evangelism_hg_witness_mode"
        mode={hgWitnessMode}
        onModeChange={(mode) => {
          setHgWitnessMode(mode);
          setValues((prev) => ({
            ...prev,
            hg_witnessed_by: mode === "historical" ? "" : prev.hg_witnessed_by,
            hg_witnessed_by_first_name:
              mode === "select" ? "" : prev.hg_witnessed_by_first_name,
            hg_witnessed_by_last_name:
              mode === "select" ? "" : prev.hg_witnessed_by_last_name,
          }));
        }}
        personId={values.hg_witnessed_by || ""}
        onPersonIdChange={(value) =>
          setValues((prev) => ({ ...prev, hg_witnessed_by: value }))
        }
        firstName={values.hg_witnessed_by_first_name || ""}
        lastName={values.hg_witnessed_by_last_name || ""}
        onFirstNameChange={(value) =>
          setValues((prev) => ({ ...prev, hg_witnessed_by_first_name: value }))
        }
        onLastNameChange={(value) =>
          setValues((prev) => ({ ...prev, hg_witnessed_by_last_name: value }))
        }
        options={verifierOptions}
        emptyMessage="No witness found"
        requireHistoricalNames={Boolean(values.spirit_baptism_date)}
        showClusterCodes
      />

      <div className="space-y-1">
        <label className="block text-sm font-medium text-gray-700">Notes</label>
        <textarea
          value={values.note || ""}
          onChange={handleChange("note")}
          rows={3}
          className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-ring"
          placeholder="Optional note about this visitor’s progress..."
        />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting || saving || !values.person_id}>
          {isSubmitting || saving ? "Saving..." : submitLabel}
        </Button>
      </div>
    </form>
  );
}
