/**
 * Format API / axios errors into user-facing messages that name invalid fields.
 */

const FIELD_LABELS: Record<string, string> = {
  first_name: "First name",
  middle_name: "Middle name",
  last_name: "Last name",
  maiden_name: "Maiden name",
  email: "Email",
  phone: "Phone",
  role: "Role",
  status: "Status",
  country: "Country",
  address: "Address",
  branch: "Branch",
  gender: "Gender",
  username: "Username",
  password: "Password",
  initial_password: "Temporary password",
  member_id: "LAMP ID",
  date_of_birth: "Birth date",
  date_first_attended: "First attended",
  date_first_invited: "First invited",
  first_activity_attended: "First activity attended",
  water_baptism_date: "Water baptism date",
  spirit_baptism_date: "Spirit baptism date",
  lessons_started_at: "Lessons started date",
  lessons_finished_at: "Lessons finished date",
  commitment_signed_at: "Commitment signed date",
  inviter: "Inviter",
  photo: "Photo",
  family_ids: "Families",
  non_field_errors: "",
};

function humanizeFieldKey(key: string): string {
  if (FIELD_LABELS[key] !== undefined) return FIELD_LABELS[key];
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function stringifyErrorValue(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    return value
      .map((item) => stringifyErrorValue(item))
      .filter(Boolean)
      .join(" ");
  }
  if (typeof value === "object") {
    // Nested serializer errors: { field: ["msg"] }
    return Object.entries(value as Record<string, unknown>)
      .map(([k, v]) => {
        const label = humanizeFieldKey(k);
        const msg = stringifyErrorValue(v);
        return label ? `${label}: ${msg}` : msg;
      })
      .filter(Boolean)
      .join("; ");
  }
  return String(value);
}

/** Build messages from DRF-style field error maps. */
export function formatFieldErrorDetails(details: unknown): string[] {
  if (!details) return [];
  if (typeof details === "string") return [details];
  if (Array.isArray(details)) {
    return details.map((item) => stringifyErrorValue(item)).filter(Boolean);
  }
  if (typeof details !== "object") return [];

  const messages: string[] = [];
  for (const [key, value] of Object.entries(details as Record<string, unknown>)) {
    if (key === "error" || key === "message" || key === "details") continue;
    const text = stringifyErrorValue(value);
    if (!text) continue;
    const label = humanizeFieldKey(key);
    messages.push(label ? `${label}: ${text}` : text);
  }
  return messages;
}

const GENERIC_MESSAGES = new Set([
  "An error occurred",
  "Invalid request",
  "Request failed",
  "Failed to create person",
  "Failed to update person",
]);

/**
 * Prefer field-level `details` so users know what to fix; fall back to message.
 */
export function formatApiErrorMessage(
  error: unknown,
  fallback = "An error occurred",
): string {
  const responseData = (
    error as { response?: { data?: Record<string, unknown> } }
  )?.response?.data;

  if (responseData && typeof responseData === "object") {
    const details =
      responseData.details !== undefined
        ? responseData.details
        : responseData.error && responseData.message
          ? undefined
          : responseData;
    const fromDetails = formatFieldErrorDetails(details);
    if (fromDetails.length > 0) {
      return fromDetails.join(" ");
    }

    const message = responseData.message;
    if (typeof message === "string" && message && !GENERIC_MESSAGES.has(message)) {
      return message;
    }

    const detail = responseData.detail;
    if (typeof detail === "string" && detail) return detail;
  }

  if (error instanceof Error && error.message && !GENERIC_MESSAGES.has(error.message)) {
    return error.message;
  }

  return fallback;
}
