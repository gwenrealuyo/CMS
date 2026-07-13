"use client";

import { KeyboardEvent, MouseEvent, useEffect, useState } from "react";
import { Person } from "@/src/types/person";
import ModalOverlay from "@/src/components/ui/ModalOverlay";

type PersonAvatarSize = "xs" | "sm" | "md" | "lg";

const sizeClasses: Record<PersonAvatarSize, string> = {
  xs: "w-6 h-6 text-xs",
  sm: "w-8 h-8 text-xs",
  md: "w-10 h-10 text-sm",
  lg: "w-14 h-14 text-lg",
};

export type PersonAvatarPerson = Partial<
  Pick<Person, "first_name" | "last_name" | "photo">
> & {
  id?: string | number;
};

interface PersonAvatarProps {
  person: PersonAvatarPerson;
  size?: PersonAvatarSize;
  className?: string;
  /** When true (default), clicking a photo opens an enlarged lightbox. */
  enlargeable?: boolean;
}

export function getPersonInitials(person: Pick<Person, "first_name" | "last_name"> | PersonAvatarPerson) {
  return `${person.first_name?.[0] || ""}${person.last_name?.[0] || ""}`.toUpperCase();
}

export default function PersonAvatar({
  person,
  size = "md",
  className = "",
  enlargeable = true,
}: PersonAvatarProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const [isEnlarged, setIsEnlarged] = useState(false);
  const sizeClass = sizeClasses[size];
  const initials = getPersonInitials(person);
  const alt = `${person.first_name ?? ""} ${person.last_name ?? ""}`.trim();
  const canEnlarge = Boolean(person.photo && !imageFailed && enlargeable);

  useEffect(() => {
    setImageFailed(false);
  }, [person.photo, person.id]);

  useEffect(() => {
    if (!isEnlarged) return;
    const onKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") setIsEnlarged(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isEnlarged]);

  const openEnlarge = (e: MouseEvent | KeyboardEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setIsEnlarged(true);
  };

  const lightbox = canEnlarge && person.photo ? (
    <ModalOverlay
      isOpen={isEnlarged}
      onClose={() => setIsEnlarged(false)}
      className="bg-black/80"
      panelClassName="relative max-w-none w-auto"
      zIndex={80}
    >
      <img
        src={person.photo}
        alt={alt || "Profile photo"}
        className="max-h-[85vh] max-w-[90vw] object-contain rounded-lg"
        onClick={(e) => e.stopPropagation()}
      />
    </ModalOverlay>
  ) : null;

  if (person.photo && !imageFailed) {
    return (
      <>
        <img
          src={person.photo}
          alt={alt || "Profile photo"}
          className={`${sizeClass} rounded-full object-cover flex-shrink-0 ${canEnlarge ? "cursor-pointer" : ""} ${className}`}
          onError={() => setImageFailed(true)}
          role={canEnlarge ? "button" : undefined}
          tabIndex={canEnlarge ? 0 : undefined}
          aria-label={canEnlarge ? `Enlarge photo of ${alt || "person"}` : undefined}
          onClick={canEnlarge ? openEnlarge : undefined}
          onKeyDown={
            canEnlarge
              ? (e) => {
                  if (e.key === "Enter" || e.key === " ") openEnlarge(e);
                }
              : undefined
          }
        />
        {lightbox}
      </>
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
