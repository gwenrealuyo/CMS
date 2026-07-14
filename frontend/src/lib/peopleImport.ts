import { Person, PersonRole, PersonStatus } from "@/src/types/person";

export type PeopleExportFormat = "excel" | "pdf" | "csv";

export const PEOPLE_EXPORT_FIELDS: { key: string; label: string }[] = [
  { key: "first_name", label: "First Name" },
  { key: "middle_name", label: "Middle Name" },
  { key: "last_name", label: "Last Name" },
  { key: "maiden_name", label: "Maiden Name" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
  { key: "role", label: "Role" },
  { key: "status", label: "Status" },
  { key: "country", label: "Country" },
  { key: "address", label: "Address" },
  { key: "date_of_birth", label: "Birth Date" },
  { key: "date_first_attended", label: "First Attended" },
  { key: "first_activity_attended", label: "First Activity Attended" },
  { key: "water_baptism_date", label: "Water Baptism" },
  { key: "spirit_baptism_date", label: "Spirit Baptism" },
  { key: "member_id", label: "LAMP ID" },
];

const ROLE_VALUES = new Set<string>(["MEMBER", "VISITOR", "PASTOR", "ADMIN"]);
const STATUS_VALUES = new Set<string>([
  "ACTIVE",
  "SEMIACTIVE",
  "INACTIVE",
  "DORMANT",
  "FALLAWAY",
  "DECEASED",
  "ONGOING",
  "NO_RESPONSE",
]);

const DATE_KEYS = [
  "date_of_birth",
  "date_first_attended",
  "water_baptism_date",
  "spirit_baptism_date",
] as const;

/** Map CSV headers (snake_case keys or export labels) → Person field keys. */
export function buildImportHeaderMap(): Record<string, string> {
  const map: Record<string, string> = {
    branch: "branch",
    branch_id: "branch",
    "branch id": "branch",
    "join date": "date_first_attended",
    "lamp id": "member_id",
  };
  for (const field of PEOPLE_EXPORT_FIELDS) {
    map[field.key] = field.key;
    map[field.label.toLowerCase()] = field.key;
    map[field.label.toLowerCase().replace(/\s+/g, "_")] = field.key;
  }
  return map;
}

export function normalizeImportHeader(
  header: string,
  headerMap: Record<string, string> = buildImportHeaderMap()
): string {
  const cleaned = header.trim().replace(/^\uFEFF/, "");
  return headerMap[cleaned.toLowerCase()] ?? cleaned;
}

export function normalizeImportRow(
  row: Record<string, string>,
  headerMap: Record<string, string> = buildImportHeaderMap()
): Record<string, string> {
  const normalized: Record<string, string> = {};
  for (const [rawKey, value] of Object.entries(row)) {
    const key = normalizeImportHeader(rawKey, headerMap);
    normalized[key] = value;
  }
  return normalized;
}

/** Format date values for CSV export as YYYY-MM-DD (local calendar day). */
export function formatExportDate(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.slice(0, 10);
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return trimmed;
  const y = parsed.getFullYear();
  const m = String(parsed.getMonth() + 1).padStart(2, "0");
  const d = String(parsed.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function parseImportDate(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.slice(0, 10);
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return formatExportDate(
    `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}-${String(parsed.getDate()).padStart(2, "0")}`
  );
}

function pickString(row: Record<string, string>, key: string): string | undefined {
  const value = (row[key] ?? "").trim();
  return value ? value : undefined;
}

export type MapImportRowOptions = {
  defaultBranchId?: number | null;
  resolveActivityCode?: (value: string) => string | undefined;
};

/**
 * Convert one normalized CSV row into a create-person payload.
 * Returns null when first_name or last_name is missing.
 */
export function mapImportRowToPerson(
  row: Record<string, string>,
  options: MapImportRowOptions = {}
): Partial<Person> | null {
  const first_name = pickString(row, "first_name");
  const last_name = pickString(row, "last_name");
  if (!first_name || !last_name) return null;

  const payload: Partial<Person> = {
    first_name,
    last_name,
  };

  const middle_name = pickString(row, "middle_name");
  if (middle_name) payload.middle_name = middle_name;

  const maiden_name = pickString(row, "maiden_name");
  if (maiden_name) payload.maiden_name = maiden_name;

  const email = pickString(row, "email");
  if (email) payload.email = email;

  const phone = pickString(row, "phone");
  if (phone) payload.phone = phone;

  const address = pickString(row, "address");
  if (address) payload.address = address;

  const country = pickString(row, "country");
  if (country) payload.country = country;

  const member_id = pickString(row, "member_id");
  if (member_id) payload.member_id = member_id;

  const roleRaw = (pickString(row, "role") || "MEMBER").toUpperCase();
  payload.role = (
    ROLE_VALUES.has(roleRaw) ? roleRaw : "MEMBER"
  ) as PersonRole;

  const statusRaw = (pickString(row, "status") || "ACTIVE").toUpperCase();
  payload.status = (
    STATUS_VALUES.has(statusRaw) ? statusRaw : "ACTIVE"
  ) as PersonStatus;

  const branchRaw = pickString(row, "branch");
  if (branchRaw && !Number.isNaN(Number(branchRaw))) {
    payload.branch = Number(branchRaw);
  } else if (options.defaultBranchId != null) {
    payload.branch = options.defaultBranchId;
  }

  for (const key of DATE_KEYS) {
    const raw = pickString(row, key);
    if (!raw) continue;
    const parsed = parseImportDate(raw);
    if (parsed) {
      (payload as Record<string, string>)[key] = parsed;
    }
  }

  const activity = pickString(row, "first_activity_attended");
  if (activity) {
    const code =
      options.resolveActivityCode?.(activity) ??
      (/^[A-Z0-9_]+$/i.test(activity) ? activity : undefined);
    if (code) payload.first_activity_attended = code;
  }

  if (payload.role !== "VISITOR") {
    payload.generate_temporary_password = true;
  }

  return payload;
}

export function getPeopleImportTemplateCsv(options?: {
  branchId?: number | null;
}): string {
  const headers = [
    ...PEOPLE_EXPORT_FIELDS.map((f) => f.key),
    "branch",
  ];
  const sample = {
    first_name: "First",
    middle_name: "",
    last_name: "Last",
    maiden_name: "",
    email: "person@example.com",
    phone: "",
    role: "MEMBER",
    status: "ACTIVE",
    country: "",
    address: "",
    date_of_birth: "",
    date_first_attended: "",
    first_activity_attended: "",
    water_baptism_date: "",
    spirit_baptism_date: "",
    member_id: "",
    branch:
      options?.branchId != null && !Number.isNaN(Number(options.branchId))
        ? String(options.branchId)
        : "",
  } as Record<string, string>;
  const row = headers.map((h) => sample[h] ?? "").join(",");
  return `${headers.join(",")}\n${row}\n`;
}

export function formatPeopleImportApiError(error: unknown): string {
  const data = (error as { response?: { data?: unknown } })?.response?.data;
  if (!data) {
    return error instanceof Error ? error.message : "Unknown error";
  }
  if (typeof data === "string") return data;
  if (typeof data === "object" && data !== null) {
    const entries = Object.entries(data as Record<string, unknown>);
    if (entries.length === 0) return "Request failed";
    return entries
      .map(([key, value]) => {
        const msg = Array.isArray(value)
          ? value.join(" ")
          : typeof value === "string"
            ? value
            : JSON.stringify(value);
        return `${key}: ${msg}`;
      })
      .join("; ");
  }
  return "Request failed";
}
