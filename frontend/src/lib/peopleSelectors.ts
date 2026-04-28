type PersonSelectionLike = {
  role?: string | null;
  username?: string | null;
};

const normalize = (value?: string | null): string =>
  (value || "").trim().toUpperCase();

export const isAdminPerson = (person: PersonSelectionLike): boolean =>
  normalize(person.role) === "ADMIN" || normalize(person.username) === "ADMIN";

export const isSelectablePerson = (person: PersonSelectionLike): boolean =>
  !isAdminPerson(person);
