import { useEffect, useState } from "react";
import { Person } from "@/src/types/person";

type PersonAvatarSize = "xs" | "sm" | "md" | "lg";

const sizeClasses: Record<PersonAvatarSize, string> = {
  xs: "w-6 h-6 text-xs",
  sm: "w-8 h-8 text-xs",
  md: "w-10 h-10 text-sm",
  lg: "w-14 h-14 text-lg",
};

interface PersonAvatarProps {
  person: Pick<Person, "first_name" | "last_name" | "photo"> & {
    id?: string | number;
  };
  size?: PersonAvatarSize;
  className?: string;
}

export function getPersonInitials(
  person: Pick<Person, "first_name" | "last_name">
) {
  return `${person.first_name?.[0] || ""}${person.last_name?.[0] || ""}`.toUpperCase();
}

export default function PersonAvatar({
  person,
  size = "md",
  className = "",
}: PersonAvatarProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const sizeClass = sizeClasses[size];
  const initials = getPersonInitials(person);
  const alt = `${person.first_name ?? ""} ${person.last_name ?? ""}`.trim();

  useEffect(() => {
    setImageFailed(false);
  }, [person.photo, person.id]);

  if (person.photo && !imageFailed) {
    return (
      <img
        src={person.photo}
        alt={alt || "Profile photo"}
        className={`${sizeClass} rounded-full object-cover flex-shrink-0 ${className}`}
        onError={() => setImageFailed(true)}
      />
    );
  }

  return (
    <div
      className={`${sizeClass} bg-gradient-to-br from-blue-400 to-indigo-500 rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0 ${className}`}
    >
      {initials}
    </div>
  );
}
