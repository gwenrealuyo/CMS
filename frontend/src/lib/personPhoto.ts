/** Shared rules for person/profile photo uploads (must match backend). */

export const PERSON_PHOTO_MAX_BYTES = 5 * 1024 * 1024; // 5 MB
export const PERSON_PHOTO_MAX_DIMENSION = 4000;

export const PERSON_PHOTO_ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

/** Non-standard MIME types browsers (esp. Safari/Apple) sometimes report. */
const PERSON_PHOTO_MIME_ALIASES: Record<string, (typeof PERSON_PHOTO_ALLOWED_MIME_TYPES)[number]> =
  {
    "image/jpg": "image/jpeg",
    "image/pjpeg": "image/jpeg",
    "image/x-png": "image/png",
  };

export const PERSON_PHOTO_ALLOWED_EXTENSIONS = [
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
] as const;

const PERSON_PHOTO_HEIC_MIME_TYPES = [
  "image/heic",
  "image/heif",
  "image/heic-sequence",
  "image/heif-sequence",
] as const;

const PERSON_PHOTO_HEIC_EXTENSIONS = [".heic", ".heif"] as const;

/** Value for `<input type="file" accept="...">` (includes Apple HEIC/HEIF). */
export const PERSON_PHOTO_ACCEPT = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".heic",
  ".heif",
].join(",");

export const PERSON_PHOTO_HELPER_TEXT =
  "JPEG, PNG, WebP, or Apple HEIC · max 5 MB · max 4000×4000 px";

export type PersonPhotoValidationResult =
  | { ok: true }
  | { ok: false; message: string };

export type PersonPhotoPrepareResult =
  | { ok: true; file: File }
  | { ok: false; message: string };

function getExtension(filename: string): string {
  const i = filename.lastIndexOf(".");
  return i >= 0 ? filename.slice(i).toLowerCase() : "";
}

function normalizeMimeType(type: string): string {
  const lower = type.toLowerCase();
  return PERSON_PHOTO_MIME_ALIASES[lower] ?? lower;
}

export function isHeicLikePhoto(file: File): boolean {
  const ext = getExtension(file.name);
  const type = file.type.toLowerCase();
  return (
    PERSON_PHOTO_HEIC_EXTENSIONS.includes(
      ext as (typeof PERSON_PHOTO_HEIC_EXTENSIONS)[number],
    ) ||
    PERSON_PHOTO_HEIC_MIME_TYPES.includes(
      type as (typeof PERSON_PHOTO_HEIC_MIME_TYPES)[number],
    )
  );
}

function isAllowedType(file: File): boolean {
  const ext = getExtension(file.name);
  const normalizedType = normalizeMimeType(file.type);
  const mimeOk = PERSON_PHOTO_ALLOWED_MIME_TYPES.includes(
    normalizedType as (typeof PERSON_PHOTO_ALLOWED_MIME_TYPES)[number],
  );
  const extOk = PERSON_PHOTO_ALLOWED_EXTENSIONS.includes(
    ext as (typeof PERSON_PHOTO_ALLOWED_EXTENSIONS)[number],
  );
  // Accept if extension is allowed (some browsers leave type empty) and MIME is
  // empty or also allowed.
  if (!extOk) return false;
  if (!file.type) return true;
  return mimeOk;
}

function readImageDimensions(
  file: File,
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    if (typeof createImageBitmap === "function") {
      createImageBitmap(file)
        .then((bitmap) => {
          const dims = { width: bitmap.width, height: bitmap.height };
          bitmap.close();
          resolve(dims);
        })
        .catch(() => {
          // Fall through to Image element
          loadViaImageElement(file).then(resolve).catch(reject);
        });
      return;
    }
    loadViaImageElement(file).then(resolve).catch(reject);
  });
}

function loadViaImageElement(
  file: File,
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const dims = { width: img.naturalWidth, height: img.naturalHeight };
      URL.revokeObjectURL(url);
      resolve(dims);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read image"));
    };
    img.src = url;
  });
}

function jpegFileName(originalName: string): string {
  const base = originalName.replace(/\.[^.]+$/, "") || "photo";
  return `${base}.jpg`;
}

/**
 * Convert Apple HEIC/HEIF to JPEG so validation and the backend can accept it.
 */
async function convertHeicToJpeg(file: File): Promise<File> {
  const heic2any = (await import("heic2any")).default;
  const converted = await heic2any({
    blob: file,
    toType: "image/jpeg",
    quality: 0.92,
  });
  const blob = Array.isArray(converted) ? converted[0] : converted;
  return new File([blob], jpegFileName(file.name), {
    type: "image/jpeg",
    lastModified: Date.now(),
  });
}

/**
 * Normalize Safari MIME aliases (e.g. image/jpg) without re-encoding.
 */
function normalizeMimeAliasFile(file: File): File {
  if (!file.type) return file;
  const normalized = normalizeMimeType(file.type);
  if (normalized === file.type.toLowerCase()) return file;
  if (
    !PERSON_PHOTO_ALLOWED_MIME_TYPES.includes(
      normalized as (typeof PERSON_PHOTO_ALLOWED_MIME_TYPES)[number],
    )
  ) {
    return file;
  }
  return new File([file], file.name, {
    type: normalized,
    lastModified: file.lastModified,
  });
}

export async function validatePersonPhoto(
  file: File,
): Promise<PersonPhotoValidationResult> {
  if (!isAllowedType(file)) {
    return {
      ok: false,
      message: `Unsupported file type. Use ${PERSON_PHOTO_HELPER_TEXT}.`,
    };
  }

  if (file.size > PERSON_PHOTO_MAX_BYTES) {
    return {
      ok: false,
      message: `Photo is too large (max 5 MB). ${PERSON_PHOTO_HELPER_TEXT}.`,
    };
  }

  try {
    const { width, height } = await readImageDimensions(file);
    if (
      width > PERSON_PHOTO_MAX_DIMENSION ||
      height > PERSON_PHOTO_MAX_DIMENSION
    ) {
      return {
        ok: false,
        message: `Photo dimensions are too large (max ${PERSON_PHOTO_MAX_DIMENSION}×${PERSON_PHOTO_MAX_DIMENSION} px).`,
      };
    }
  } catch {
    return {
      ok: false,
      message: `Could not read image. Use ${PERSON_PHOTO_HELPER_TEXT}.`,
    };
  }

  return { ok: true };
}

/**
 * Prepare a selected file for upload: convert Apple HEIC/HEIF → JPEG, fix MIME
 * aliases, then validate against the same rules as the backend.
 */
export async function preparePersonPhoto(
  file: File,
): Promise<PersonPhotoPrepareResult> {
  let prepared = file;

  if (isHeicLikePhoto(file)) {
    try {
      prepared = await convertHeicToJpeg(file);
    } catch {
      return {
        ok: false,
        message:
          "Could not convert Apple HEIC photo. Try exporting as JPEG from Photos, then upload again.",
      };
    }
  } else {
    prepared = normalizeMimeAliasFile(file);
  }

  const result = await validatePersonPhoto(prepared);
  if (!result.ok) return result;
  return { ok: true, file: prepared };
}
