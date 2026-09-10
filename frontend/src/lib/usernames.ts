/** Keep in sync with backend/apps/people/usernames.py */
const USERNAME_DISALLOWED = /[^a-z0-9@.+_-]/g;
const USERNAME_VALID = /^[a-z0-9@.+_-]+$/;
const RESERVED_USERNAMES = new Set(["admin"]);

export function suggestedUsername(firstName: string, lastName: string): string {
  const first = (firstName || "").trim().toLowerCase().replace(USERNAME_DISALLOWED, "");
  const last = (lastName || "").trim().toLowerCase().replace(USERNAME_DISALLOWED, "");
  return `${first.slice(0, 2)}${last}`;
}

export function isValidUsername(value: string): boolean {
  const username = value.trim().toLowerCase();
  return Boolean(username) && USERNAME_VALID.test(username) && !RESERVED_USERNAMES.has(username);
}
